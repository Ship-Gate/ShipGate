/**
 * Schema Differ - Detect changes between ISL schema versions
 */
import type {
  ISLSchema,
  DomainSchema,
  EntitySchema,
  BehaviorSchema,
  FieldSchema,
  SchemaChange,
  ChangeType,
  MigrationStep,
} from './types';

export class SchemaDiffer {
  /**
   * Compare two schemas and return all changes
   */
  diff(oldSchema: ISLSchema, newSchema: ISLSchema): SchemaChange[] {
    const changes: SchemaChange[] = [];

    // Compare domains
    const oldDomains = new Map(oldSchema.domains.map(d => [d.name, d]));
    const newDomains = new Map(newSchema.domains.map(d => [d.name, d]));

    // Find removed domains
    for (const [name, domain] of oldDomains) {
      if (!newDomains.has(name)) {
        changes.push(this.createChange('DOMAIN_REMOVED', `domains.${name}`, true, {
          description: `Domain '${name}' was removed`,
          oldValue: domain,
        }));
      }
    }

    // Find added and modified domains
    for (const [name, newDomain] of newDomains) {
      const oldDomain = oldDomains.get(name);
      if (!oldDomain) {
        changes.push(this.createChange('DOMAIN_ADDED', `domains.${name}`, false, {
          description: `Domain '${name}' was added`,
          newValue: newDomain,
        }));
      } else {
        changes.push(...this.diffDomain(oldDomain, newDomain));
      }
    }

    // Compare types
    const oldTypes = new Map(oldSchema.types.map(t => [t.name, t]));
    const newTypes = new Map(newSchema.types.map(t => [t.name, t]));

    for (const [name, oldType] of oldTypes) {
      if (!newTypes.has(name)) {
        changes.push(this.createChange('TYPE_REMOVED', `types.${name}`, true, {
          description: `Type '${name}' was removed`,
          oldValue: oldType,
        }));
      }
    }

    for (const [name, newType] of newTypes) {
      const oldType = oldTypes.get(name);
      if (!oldType) {
        changes.push(this.createChange('TYPE_ADDED', `types.${name}`, false, {
          description: `Type '${name}' was added`,
          newValue: newType,
        }));
      } else if (JSON.stringify(oldType) !== JSON.stringify(newType)) {
        changes.push(this.createChange('TYPE_MODIFIED', `types.${name}`, true, {
          description: `Type '${name}' was modified`,
          oldValue: oldType,
          newValue: newType,
        }));
      }
    }

    return changes;
  }

  /**
   * Compare two domains
   */
  private diffDomain(oldDomain: DomainSchema, newDomain: DomainSchema): SchemaChange[] {
    const changes: SchemaChange[] = [];
    const basePath = `domains.${newDomain.name}`;

    // Compare entities
    const oldEntities = new Map(oldDomain.entities.map(e => [e.name, e]));
    const newEntities = new Map(newDomain.entities.map(e => [e.name, e]));

    for (const [name, oldEntity] of oldEntities) {
      if (!newEntities.has(name)) {
        changes.push(this.createChange('ENTITY_REMOVED', `${basePath}.entities.${name}`, true, {
          description: `Entity '${name}' was removed from domain '${newDomain.name}'`,
          oldValue: oldEntity,
        }));
      }
    }

    for (const [name, newEntity] of newEntities) {
      const oldEntity = oldEntities.get(name);
      if (!oldEntity) {
        changes.push(this.createChange('ENTITY_ADDED', `${basePath}.entities.${name}`, false, {
          description: `Entity '${name}' was added to domain '${newDomain.name}'`,
          newValue: newEntity,
        }));
      } else {
        changes.push(...this.diffEntity(oldEntity, newEntity, basePath));
      }
    }

    // Compare behaviors
    const oldBehaviors = new Map(oldDomain.behaviors.map(b => [b.name, b]));
    const newBehaviors = new Map(newDomain.behaviors.map(b => [b.name, b]));

    for (const [name, oldBehavior] of oldBehaviors) {
      if (!newBehaviors.has(name)) {
        changes.push(this.createChange('BEHAVIOR_REMOVED', `${basePath}.behaviors.${name}`, true, {
          description: `Behavior '${name}' was removed from domain '${newDomain.name}'`,
          oldValue: oldBehavior,
        }));
      }
    }

    for (const [name, newBehavior] of newBehaviors) {
      const oldBehavior = oldBehaviors.get(name);
      if (!oldBehavior) {
        changes.push(this.createChange('BEHAVIOR_ADDED', `${basePath}.behaviors.${name}`, false, {
          description: `Behavior '${name}' was added to domain '${newDomain.name}'`,
          newValue: newBehavior,
        }));
      } else {
        changes.push(...this.diffBehavior(oldBehavior, newBehavior, basePath));
      }
    }

    // Compare enums
    const oldEnums = new Map(oldDomain.enums.map(e => [e.name, e]));
    const newEnums = new Map(newDomain.enums.map(e => [e.name, e]));

    for (const [name, oldEnum] of oldEnums) {
      if (!newEnums.has(name)) {
        changes.push(this.createChange('ENUM_REMOVED', `${basePath}.enums.${name}`, true, {
          description: `Enum '${name}' was removed`,
          oldValue: oldEnum,
        }));
      }
    }

    for (const [name, newEnum] of newEnums) {
      const oldEnum = oldEnums.get(name);
      if (!oldEnum) {
        changes.push(this.createChange('ENUM_ADDED', `${basePath}.enums.${name}`, false, {
          description: `Enum '${name}' was added`,
          newValue: newEnum,
        }));
      } else {
        // Check for removed values (breaking)
        for (const value of oldEnum.values) {
          if (!newEnum.values.includes(value)) {
            changes.push(this.createChange(
              'ENUM_VALUE_REMOVED',
              `${basePath}.enums.${name}.${value}`,
              true,
              { description: `Enum value '${value}' was removed from '${name}'` }
            ));
          }
        }
        // Check for added values (non-breaking)
        for (const value of newEnum.values) {
          if (!oldEnum.values.includes(value)) {
            changes.push(this.createChange(
              'ENUM_VALUE_ADDED',
              `${basePath}.enums.${name}.${value}`,
              false,
              { description: `Enum value '${value}' was added to '${name}'` }
            ));
          }
        }
      }
    }

    return changes;
  }

  /**
   * Compare two entities
   */
  private diffEntity(
    oldEntity: EntitySchema,
    newEntity: EntitySchema,
    basePath: string
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];
    const entityPath = `${basePath}.entities.${newEntity.name}`;

    // Compare fields
    const oldFields = new Map(oldEntity.fields.map(f => [f.name, f]));
    const newFields = new Map(newEntity.fields.map(f => [f.name, f]));

    for (const [name, oldField] of oldFields) {
      if (!newFields.has(name)) {
        changes.push(this.createChange('FIELD_REMOVED', `${entityPath}.fields.${name}`, true, {
          description: `Field '${name}' was removed from entity '${newEntity.name}'`,
          oldValue: oldField,
        }));
      }
    }

    for (const [name, newField] of newFields) {
      const oldField = oldFields.get(name);
      if (!oldField) {
        // Adding required field without default is breaking
        const isBreaking = newField.required && newField.defaultValue === undefined;
        changes.push(this.createChange('FIELD_ADDED', `${entityPath}.fields.${name}`, isBreaking, {
          description: `Field '${name}' was added to entity '${newEntity.name}'`,
          newValue: newField,
          migration: isBreaking ? undefined : {
            type: 'SET_DEFAULT',
            target: name,
            defaultValue: newField.defaultValue,
          },
        }));
      } else {
        changes.push(...this.diffField(oldField, newField, entityPath));
      }
    }

    // Compare invariants
    for (const oldInvariant of oldEntity.invariants) {
      if (!newEntity.invariants.includes(oldInvariant)) {
        changes.push(this.createChange(
          'INVARIANT_REMOVED',
          `${entityPath}.invariants`,
          false,
          { description: `Invariant '${oldInvariant}' was removed`, oldValue: oldInvariant }
        ));
      }
    }

    for (const newInvariant of newEntity.invariants) {
      if (!oldEntity.invariants.includes(newInvariant)) {
        changes.push(this.createChange(
          'INVARIANT_ADDED',
          `${entityPath}.invariants`,
          true, // Adding invariants can break existing data
          { description: `Invariant '${newInvariant}' was added`, newValue: newInvariant }
        ));
      }
    }

    return changes;
  }

  /**
   * Compare two fields
   */
  private diffField(oldField: FieldSchema, newField: FieldSchema, basePath: string): SchemaChange[] {
    const changes: SchemaChange[] = [];
    const fieldPath = `${basePath}.fields.${newField.name}`;

    // Type change
    if (oldField.type !== newField.type) {
      changes.push(this.createChange('FIELD_TYPE_CHANGED', fieldPath, true, {
        description: `Field '${newField.name}' type changed from '${oldField.type}' to '${newField.type}'`,
        oldValue: oldField.type,
        newValue: newField.type,
        migration: {
          type: 'TRANSFORM',
          source: newField.name,
          target: newField.name,
          transform: `convert_${oldField.type}_to_${newField.type}`,
        },
      }));
    }

    // Required change
    if (oldField.required !== newField.required) {
      const isBreaking = newField.required && newField.defaultValue === undefined;
      changes.push(this.createChange('FIELD_REQUIRED_CHANGED', fieldPath, isBreaking, {
        description: `Field '${newField.name}' required changed from ${oldField.required} to ${newField.required}`,
        oldValue: oldField.required,
        newValue: newField.required,
      }));
    }

    // Default value change
    if (JSON.stringify(oldField.defaultValue) !== JSON.stringify(newField.defaultValue)) {
      changes.push(this.createChange('FIELD_DEFAULT_CHANGED', fieldPath, false, {
        description: `Field '${newField.name}' default value changed`,
        oldValue: oldField.defaultValue,
        newValue: newField.defaultValue,
      }));
    }

    // Constraint changes
    const oldConstraints = new Map(oldField.constraints.map(c => [`${c.type}:${c.value}`, c]));
    const newConstraints = new Map(newField.constraints.map(c => [`${c.type}:${c.value}`, c]));

    for (const [key, constraint] of oldConstraints) {
      if (!newConstraints.has(key)) {
        changes.push(this.createChange('CONSTRAINT_REMOVED', `${fieldPath}.constraints`, false, {
          description: `Constraint '${constraint.type}' was removed from field '${newField.name}'`,
          oldValue: constraint,
        }));
      }
    }

    for (const [key, constraint] of newConstraints) {
      if (!oldConstraints.has(key)) {
        changes.push(this.createChange('CONSTRAINT_ADDED', `${fieldPath}.constraints`, true, {
          description: `Constraint '${constraint.type}' was added to field '${newField.name}'`,
          newValue: constraint,
        }));
      }
    }

    return changes;
  }

  /**
   * Compare two behaviors
   */
  private diffBehavior(
    oldBehavior: BehaviorSchema,
    newBehavior: BehaviorSchema,
    basePath: string
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];
    const behaviorPath = `${basePath}.behaviors.${newBehavior.name}`;

    // Compare input fields
    const inputChanges = this.diffFieldList(
      oldBehavior.input,
      newBehavior.input,
      `${behaviorPath}.input`,
      'INPUT_CHANGED'
    );
    changes.push(...inputChanges);

    // Compare output fields
    const outputChanges = this.diffFieldList(
      oldBehavior.output,
      newBehavior.output,
      `${behaviorPath}.output`,
      'OUTPUT_CHANGED'
    );
    changes.push(...outputChanges);

    // Compare errors
    const oldErrors = new Map(oldBehavior.errors.map(e => [e.code, e]));
    const newErrors = new Map(newBehavior.errors.map(e => [e.code, e]));

    for (const [code] of oldErrors) {
      if (!newErrors.has(code)) {
        changes.push(this.createChange('ERROR_REMOVED', `${behaviorPath}.errors.${code}`, true, {
          description: `Error '${code}' was removed from behavior '${newBehavior.name}'`,
        }));
      }
    }

    for (const [code, error] of newErrors) {
      if (!oldErrors.has(code)) {
        changes.push(this.createChange('ERROR_ADDED', `${behaviorPath}.errors.${code}`, false, {
          description: `Error '${code}' was added to behavior '${newBehavior.name}'`,
          newValue: error,
        }));
      }
    }

    // Compare preconditions
    for (const pre of oldBehavior.preconditions) {
      if (!newBehavior.preconditions.includes(pre)) {
        changes.push(this.createChange('PRECONDITION_REMOVED', `${behaviorPath}.preconditions`, false, {
          description: `Precondition '${pre}' was removed`,
        }));
      }
    }

    for (const pre of newBehavior.preconditions) {
      if (!oldBehavior.preconditions.includes(pre)) {
        changes.push(this.createChange('PRECONDITION_ADDED', `${behaviorPath}.preconditions`, true, {
          description: `Precondition '${pre}' was added`,
        }));
      }
    }

    // Compare postconditions
    for (const post of oldBehavior.postconditions) {
      if (!newBehavior.postconditions.includes(post)) {
        changes.push(this.createChange('POSTCONDITION_REMOVED', `${behaviorPath}.postconditions`, true, {
          description: `Postcondition '${post}' was removed`,
        }));
      }
    }

    for (const post of newBehavior.postconditions) {
      if (!oldBehavior.postconditions.includes(post)) {
        changes.push(this.createChange('POSTCONDITION_ADDED', `${behaviorPath}.postconditions`, false, {
          description: `Postcondition '${post}' was added`,
        }));
      }
    }

    return changes;
  }

  private diffFieldList(
    oldFields: FieldSchema[],
    newFields: FieldSchema[],
    path: string,
    changeType: ChangeType
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];
    
    const oldMap = new Map(oldFields.map(f => [f.name, f]));
    const newMap = new Map(newFields.map(f => [f.name, f]));

    // Detect significant changes
    for (const [name, oldField] of oldMap) {
      if (!newMap.has(name)) {
        changes.push(this.createChange(changeType, `${path}.${name}`, true, {
          description: `Field '${name}' was removed`,
          oldValue: oldField,
        }));
      }
    }

    for (const [name, newField] of newMap) {
      const oldField = oldMap.get(name);
      if (!oldField) {
        const isBreaking = newField.required && newField.defaultValue === undefined;
        changes.push(this.createChange(changeType, `${path}.${name}`, isBreaking, {
          description: `Field '${name}' was added`,
          newValue: newField,
        }));
      }
    }

    return changes;
  }

  private createChange(
    type: ChangeType,
    path: string,
    breaking: boolean,
    options: {
      description: string;
      oldValue?: unknown;
      newValue?: unknown;
      migration?: MigrationStep;
    }
  ): SchemaChange {
    return {
      id: `${type}-${path}-${Date.now()}`,
      type,
      path,
      breaking,
      ...options,
    };
  }
}
