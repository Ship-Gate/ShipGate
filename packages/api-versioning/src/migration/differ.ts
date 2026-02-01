/**
 * Domain Differ
 * 
 * Compares two ISL domain versions and produces a diff.
 */

import type {
  Domain,
  DomainDiff,
  Change,
  ChangeType,
  ChangeSeverity,
  Entity,
  Behavior,
  Field,
  TypeDeclaration,
} from '../types.js';

/**
 * Diff two domain versions
 */
export function diffDomains(from: Domain, to: Domain): DomainDiff {
  const breaking: Change[] = [];
  const nonBreaking: Change[] = [];

  // Diff entities
  diffEntities(from.entities, to.entities, breaking, nonBreaking);

  // Diff behaviors
  diffBehaviors(from.behaviors, to.behaviors, breaking, nonBreaking);

  // Diff types
  diffTypes(from.types, to.types, breaking, nonBreaking);

  return {
    from: `${from.name}@${from.version}`,
    to: `${to.name}@${to.version}`,
    breaking,
    nonBreaking,
    compatible: breaking.length === 0,
  };
}

/**
 * Diff entities
 */
function diffEntities(
  fromEntities: Entity[],
  toEntities: Entity[],
  breaking: Change[],
  nonBreaking: Change[]
): void {
  const fromMap = new Map(fromEntities.map(e => [e.name, e]));
  const toMap = new Map(toEntities.map(e => [e.name, e]));

  // Check for removed entities
  for (const [name, entity] of fromMap) {
    if (!toMap.has(name)) {
      breaking.push({
        type: 'entity_removed',
        path: name,
        description: `Entity '${name}' was removed`,
        severity: 'high',
        from: entity,
        affectedEndpoints: guessAffectedEndpoints(name),
        migration: `Remove references to ${name} entity`,
      });
    }
  }

  // Check for added entities
  for (const [name, entity] of toMap) {
    if (!fromMap.has(name)) {
      nonBreaking.push({
        type: 'entity_added',
        path: name,
        description: `Entity '${name}' was added`,
        severity: 'low',
        to: entity,
      });
    }
  }

  // Diff matching entities
  for (const [name, fromEntity] of fromMap) {
    const toEntity = toMap.get(name);
    if (toEntity) {
      diffFields(name, fromEntity.fields, toEntity.fields, breaking, nonBreaking);
    }
  }
}

/**
 * Diff entity fields
 */
function diffFields(
  entityName: string,
  fromFields: Field[],
  toFields: Field[],
  breaking: Change[],
  nonBreaking: Change[]
): void {
  const fromMap = new Map(fromFields.map(f => [f.name, f]));
  const toMap = new Map(toFields.map(f => [f.name, f]));

  // Check for removed fields
  for (const [name, field] of fromMap) {
    if (!toMap.has(name)) {
      breaking.push({
        type: 'field_removed',
        path: `${entityName}.${name}`,
        description: `Field '${name}' removed from ${entityName} entity`,
        severity: 'high',
        from: field,
        affectedEndpoints: guessAffectedEndpoints(entityName),
        migration: `Remove usage of ${entityName}.${name}`,
      });
    }
  }

  // Check for added fields
  for (const [name, field] of toMap) {
    if (!fromMap.has(name)) {
      const isOptional = field.optional === true;
      if (isOptional) {
        nonBreaking.push({
          type: 'field_added',
          path: `${entityName}.${name}`,
          description: `Optional field '${name}' added to ${entityName}`,
          severity: 'low',
          to: field,
        });
      } else {
        breaking.push({
          type: 'field_added',
          path: `${entityName}.${name}`,
          description: `Required field '${name}' added to ${entityName}`,
          severity: 'medium',
          to: field,
          migration: `Provide value for new required field ${entityName}.${name}`,
        });
      }
    }
  }

  // Check for changed fields
  for (const [name, fromField] of fromMap) {
    const toField = toMap.get(name);
    if (toField) {
      // Type change
      if (fromField.type !== toField.type) {
        const isWideningChange = isTypeWidening(fromField.type, toField.type);
        if (isWideningChange) {
          nonBreaking.push({
            type: 'field_type_changed',
            path: `${entityName}.${name}`,
            description: `Field type widened from ${fromField.type} to ${toField.type}`,
            severity: 'low',
            from: fromField.type,
            to: toField.type,
          });
        } else {
          breaking.push({
            type: 'field_type_changed',
            path: `${entityName}.${name}`,
            description: `Field type changed from ${fromField.type} to ${toField.type}`,
            severity: 'medium',
            from: fromField.type,
            to: toField.type,
            affectedEndpoints: guessAffectedEndpoints(entityName),
            migration: `Update ${entityName}.${name} to use new type ${toField.type}`,
          });
        }
      }

      // Optional -> Required
      if (fromField.optional && !toField.optional) {
        breaking.push({
          type: 'field_required_changed',
          path: `${entityName}.${name}`,
          description: `Field '${name}' changed from optional to required`,
          severity: 'medium',
          from: 'optional',
          to: 'required',
          affectedEndpoints: guessAffectedEndpoints(entityName),
          migration: `Ensure ${entityName}.${name} is always provided`,
        });
      }

      // Required -> Optional
      if (!fromField.optional && toField.optional) {
        nonBreaking.push({
          type: 'field_required_changed',
          path: `${entityName}.${name}`,
          description: `Field '${name}' changed from required to optional`,
          severity: 'low',
          from: 'required',
          to: 'optional',
        });
      }

      // Constraint changes
      diffConstraints(
        `${entityName}.${name}`,
        fromField.constraints ?? [],
        toField.constraints ?? [],
        breaking,
        nonBreaking
      );
    }
  }
}

/**
 * Diff behaviors
 */
function diffBehaviors(
  fromBehaviors: Behavior[],
  toBehaviors: Behavior[],
  breaking: Change[],
  nonBreaking: Change[]
): void {
  const fromMap = new Map(fromBehaviors.map(b => [b.name, b]));
  const toMap = new Map(toBehaviors.map(b => [b.name, b]));

  // Check for removed behaviors
  for (const [name, behavior] of fromMap) {
    if (!toMap.has(name)) {
      breaking.push({
        type: 'behavior_removed',
        path: name,
        description: `Behavior '${name}' was removed`,
        severity: 'high',
        from: behavior,
        affectedEndpoints: [behaviorToEndpoint(name)],
        migration: `Remove calls to ${name} endpoint`,
      });
    }
  }

  // Check for added behaviors
  for (const [name, behavior] of toMap) {
    if (!fromMap.has(name)) {
      nonBreaking.push({
        type: 'behavior_added',
        path: name,
        description: `Behavior '${name}' was added`,
        severity: 'low',
        to: behavior,
      });
    }
  }

  // Diff matching behaviors
  for (const [name, fromBehavior] of fromMap) {
    const toBehavior = toMap.get(name);
    if (toBehavior) {
      // Diff input fields
      diffFields(`${name}.input`, fromBehavior.input, toBehavior.input, breaking, nonBreaking);

      // Diff errors
      diffErrors(name, fromBehavior.errors ?? [], toBehavior.errors ?? [], breaking, nonBreaking);

      // Diff postconditions
      diffConditions(
        `${name}`,
        'postcondition',
        fromBehavior.postconditions ?? [],
        toBehavior.postconditions ?? [],
        nonBreaking
      );
    }
  }
}

/**
 * Diff behavior errors
 */
function diffErrors(
  behaviorName: string,
  fromErrors: Array<{ name: string }>,
  toErrors: Array<{ name: string }>,
  breaking: Change[],
  nonBreaking: Change[]
): void {
  const fromSet = new Set(fromErrors.map(e => e.name));
  const toSet = new Set(toErrors.map(e => e.name));

  // Removed errors (breaking - client might rely on them)
  for (const name of fromSet) {
    if (!toSet.has(name)) {
      breaking.push({
        type: 'error_removed',
        path: `${behaviorName}.errors.${name}`,
        description: `Error '${name}' removed from ${behaviorName}`,
        severity: 'medium',
        from: name,
        affectedEndpoints: [behaviorToEndpoint(behaviorName)],
        migration: `Update error handling to not expect ${name}`,
      });
    }
  }

  // Added errors (non-breaking - clients should handle unknown errors)
  for (const name of toSet) {
    if (!fromSet.has(name)) {
      nonBreaking.push({
        type: 'error_added',
        path: `${behaviorName}.errors.${name}`,
        description: `Error '${name}' added to ${behaviorName}`,
        severity: 'low',
        to: name,
      });
    }
  }
}

/**
 * Diff conditions (pre/post)
 */
function diffConditions(
  path: string,
  conditionType: 'precondition' | 'postcondition',
  fromConditions: string[],
  toConditions: string[],
  nonBreaking: Change[]
): void {
  const fromSet = new Set(fromConditions);
  const toSet = new Set(toConditions);

  for (const condition of toSet) {
    if (!fromSet.has(condition)) {
      nonBreaking.push({
        type: `${conditionType}_added` as ChangeType,
        path: path,
        description: `${conditionType} added: ${condition}`,
        severity: 'low',
        to: condition,
      });
    }
  }
}

/**
 * Diff type declarations
 */
function diffTypes(
  fromTypes: TypeDeclaration[],
  toTypes: TypeDeclaration[],
  breaking: Change[],
  nonBreaking: Change[]
): void {
  const fromMap = new Map(fromTypes.map(t => [t.name, t]));
  const toMap = new Map(toTypes.map(t => [t.name, t]));

  // Check for removed types
  for (const [name, type] of fromMap) {
    if (!toMap.has(name)) {
      breaking.push({
        type: 'type_removed',
        path: name,
        description: `Type '${name}' was removed`,
        severity: 'high',
        from: type,
        migration: `Replace usage of type ${name}`,
      });
    }
  }

  // Check for added types
  for (const [name, type] of toMap) {
    if (!fromMap.has(name)) {
      nonBreaking.push({
        type: 'type_added',
        path: name,
        description: `Type '${name}' was added`,
        severity: 'low',
        to: type,
      });
    }
  }

  // Check for changed types
  for (const [name, fromType] of fromMap) {
    const toType = toMap.get(name);
    if (toType) {
      if (fromType.baseType !== toType.baseType) {
        breaking.push({
          type: 'type_changed',
          path: name,
          description: `Type base changed from ${fromType.baseType} to ${toType.baseType}`,
          severity: 'medium',
          from: fromType.baseType,
          to: toType.baseType,
          migration: `Update values of type ${name} to match new base type`,
        });
      }

      diffConstraints(name, fromType.constraints ?? [], toType.constraints ?? [], breaking, nonBreaking);
    }
  }
}

/**
 * Diff constraints
 */
function diffConstraints(
  path: string,
  fromConstraints: Array<{ name: string; value: unknown }>,
  toConstraints: Array<{ name: string; value: unknown }>,
  breaking: Change[],
  nonBreaking: Change[]
): void {
  const fromMap = new Map(fromConstraints.map(c => [c.name, c.value]));
  const toMap = new Map(toConstraints.map(c => [c.name, c.value]));

  // Added constraints (breaking - more restrictive)
  for (const [name, value] of toMap) {
    if (!fromMap.has(name)) {
      breaking.push({
        type: 'constraint_added',
        path: `${path}.${name}`,
        description: `Constraint '${name}' added with value ${JSON.stringify(value)}`,
        severity: 'medium',
        to: value,
        migration: `Ensure values at ${path} satisfy new constraint ${name}`,
      });
    }
  }

  // Removed constraints (non-breaking - less restrictive)
  for (const [name, value] of fromMap) {
    if (!toMap.has(name)) {
      nonBreaking.push({
        type: 'constraint_removed',
        path: `${path}.${name}`,
        description: `Constraint '${name}' removed`,
        severity: 'low',
        from: value,
      });
    }
  }

  // Changed constraints
  for (const [name, fromValue] of fromMap) {
    const toValue = toMap.get(name);
    if (toValue !== undefined && JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
      const isMoreRestrictive = isConstraintMoreRestrictive(name, fromValue, toValue);
      if (isMoreRestrictive) {
        breaking.push({
          type: 'constraint_changed',
          path: `${path}.${name}`,
          description: `Constraint '${name}' changed from ${JSON.stringify(fromValue)} to ${JSON.stringify(toValue)}`,
          severity: 'medium',
          from: fromValue,
          to: toValue,
          migration: `Update values to satisfy new constraint`,
        });
      } else {
        nonBreaking.push({
          type: 'constraint_changed',
          path: `${path}.${name}`,
          description: `Constraint '${name}' relaxed from ${JSON.stringify(fromValue)} to ${JSON.stringify(toValue)}`,
          severity: 'low',
          from: fromValue,
          to: toValue,
        });
      }
    }
  }
}

/**
 * Check if a type change is widening (non-breaking)
 */
function isTypeWidening(from: string, to: string): boolean {
  // String -> Any is widening
  // Int -> Number is widening
  const wideningMap: Record<string, string[]> = {
    'Int': ['Number', 'Decimal', 'String'],
    'Boolean': ['String'],
    'UUID': ['String'],
  };
  
  return wideningMap[from]?.includes(to) ?? false;
}

/**
 * Check if a constraint change is more restrictive
 */
function isConstraintMoreRestrictive(name: string, from: unknown, to: unknown): boolean {
  if (name === 'min_length' || name === 'min') {
    return (to as number) > (from as number);
  }
  if (name === 'max_length' || name === 'max') {
    return (to as number) < (from as number);
  }
  // Default to breaking for unknown constraints
  return true;
}

/**
 * Guess affected endpoints from entity name
 */
function guessAffectedEndpoints(entityName: string): string[] {
  const lower = entityName.toLowerCase();
  return [
    `GET /${lower}s`,
    `GET /${lower}s/:id`,
    `POST /${lower}s`,
    `PUT /${lower}s/:id`,
    `DELETE /${lower}s/:id`,
  ];
}

/**
 * Convert behavior name to endpoint
 */
function behaviorToEndpoint(behaviorName: string): string {
  // CreateUser -> POST /users
  // GetUser -> GET /users/:id
  // UpdateUser -> PUT /users/:id
  // DeleteUser -> DELETE /users/:id
  // ListUsers -> GET /users
  
  const match = behaviorName.match(/^(Create|Get|Update|Delete|List)(.+)$/);
  if (match) {
    const [, action, entity] = match;
    const path = `/${entity.toLowerCase()}s`;
    switch (action) {
      case 'Create': return `POST ${path}`;
      case 'Get': return `GET ${path}/:id`;
      case 'Update': return `PUT ${path}/:id`;
      case 'Delete': return `DELETE ${path}/:id`;
      case 'List': return `GET ${path}`;
    }
  }
  return `${behaviorName}`;
}

export { behaviorToEndpoint, isTypeWidening };
