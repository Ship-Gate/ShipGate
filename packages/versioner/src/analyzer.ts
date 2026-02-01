// ============================================================================
// Change Analyzer
// Analyzes differences between two ISL Domain versions
// ============================================================================

import type * as AST from '../../../master_contracts/ast';

// ============================================================================
// TYPES
// ============================================================================

export type ChangeType =
  // Breaking changes (MAJOR)
  | 'entity-removed'
  | 'field-removed'
  | 'field-type-changed'
  | 'behavior-removed'
  | 'input-field-removed'
  | 'input-field-type-changed'
  | 'output-type-changed'
  | 'error-removed'
  | 'type-removed'
  | 'enum-variant-removed'
  | 'constraint-tightened'
  | 'precondition-added'
  | 'lifecycle-transition-removed'
  // Additions (MINOR)
  | 'entity-added'
  | 'field-added'
  | 'behavior-added'
  | 'input-field-added-optional'
  | 'output-field-added'
  | 'error-added'
  | 'type-added'
  | 'enum-variant-added'
  | 'constraint-relaxed'
  | 'postcondition-added'
  | 'lifecycle-transition-added'
  | 'view-added'
  | 'policy-added'
  | 'invariant-added'
  // Fixes/Patches (PATCH)
  | 'description-changed'
  | 'annotation-changed'
  | 'constraint-unchanged'
  | 'documentation-changed'
  | 'temporal-spec-changed'
  | 'security-spec-changed';

export interface Change {
  type: ChangeType;
  category: 'breaking' | 'feature' | 'fix';
  path: string;
  description: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface ChangeAnalysis {
  breaking: Change[];
  features: Change[];
  fixes: Change[];
  all: Change[];
  summary: {
    breakingCount: number;
    featureCount: number;
    fixCount: number;
    suggestedBump: 'major' | 'minor' | 'patch' | 'none';
  };
}

// ============================================================================
// MAIN ANALYZER
// ============================================================================

/**
 * Analyze changes between two domain versions
 */
export function analyzeChanges(
  oldDomain: AST.Domain,
  newDomain: AST.Domain
): ChangeAnalysis {
  const changes: Change[] = [];

  // Analyze types
  changes.push(...analyzeTypes(oldDomain.types, newDomain.types));

  // Analyze entities
  changes.push(...analyzeEntities(oldDomain.entities, newDomain.entities));

  // Analyze behaviors
  changes.push(...analyzeBehaviors(oldDomain.behaviors, newDomain.behaviors));

  // Analyze invariants
  changes.push(...analyzeInvariants(oldDomain.invariants, newDomain.invariants));

  // Analyze policies
  changes.push(...analyzePolicies(oldDomain.policies, newDomain.policies));

  // Analyze views
  changes.push(...analyzeViews(oldDomain.views, newDomain.views));

  // Categorize changes
  const breaking = changes.filter(c => c.category === 'breaking');
  const features = changes.filter(c => c.category === 'feature');
  const fixes = changes.filter(c => c.category === 'fix');

  // Determine suggested bump
  let suggestedBump: 'major' | 'minor' | 'patch' | 'none' = 'none';
  if (breaking.length > 0) {
    suggestedBump = 'major';
  } else if (features.length > 0) {
    suggestedBump = 'minor';
  } else if (fixes.length > 0) {
    suggestedBump = 'patch';
  }

  return {
    breaking,
    features,
    fixes,
    all: changes,
    summary: {
      breakingCount: breaking.length,
      featureCount: features.length,
      fixCount: fixes.length,
      suggestedBump,
    },
  };
}

// ============================================================================
// TYPE ANALYSIS
// ============================================================================

function analyzeTypes(
  oldTypes: AST.TypeDeclaration[],
  newTypes: AST.TypeDeclaration[]
): Change[] {
  const changes: Change[] = [];
  const oldMap = new Map(oldTypes.map(t => [t.name.name, t]));
  const newMap = new Map(newTypes.map(t => [t.name.name, t]));

  // Check for removed types (BREAKING)
  for (const [name, oldType] of oldMap) {
    if (!newMap.has(name)) {
      changes.push({
        type: 'type-removed',
        category: 'breaking',
        path: `types.${name}`,
        description: `Type "${name}" was removed`,
        oldValue: oldType,
      });
    }
  }

  // Check for added types (MINOR)
  for (const [name, newType] of newMap) {
    if (!oldMap.has(name)) {
      changes.push({
        type: 'type-added',
        category: 'feature',
        path: `types.${name}`,
        description: `Type "${name}" was added`,
        newValue: newType,
      });
    }
  }

  // Check for modified types
  for (const [name, oldType] of oldMap) {
    const newType = newMap.get(name);
    if (newType) {
      changes.push(...analyzeTypeChanges(name, oldType, newType));
    }
  }

  return changes;
}

function analyzeTypeChanges(
  name: string,
  oldType: AST.TypeDeclaration,
  newType: AST.TypeDeclaration
): Change[] {
  const changes: Change[] = [];
  const path = `types.${name}`;

  // Check enum variants
  if (oldType.definition.kind === 'EnumType' && newType.definition.kind === 'EnumType') {
    const oldVariants = new Set(oldType.definition.variants.map(v => v.name.name));
    const newVariants = new Set(newType.definition.variants.map(v => v.name.name));

    // Removed variants (BREAKING)
    for (const variant of oldVariants) {
      if (!newVariants.has(variant)) {
        changes.push({
          type: 'enum-variant-removed',
          category: 'breaking',
          path: `${path}.variants.${variant}`,
          description: `Enum variant "${variant}" was removed from "${name}"`,
          oldValue: variant,
        });
      }
    }

    // Added variants (MINOR)
    for (const variant of newVariants) {
      if (!oldVariants.has(variant)) {
        changes.push({
          type: 'enum-variant-added',
          category: 'feature',
          path: `${path}.variants.${variant}`,
          description: `Enum variant "${variant}" was added to "${name}"`,
          newValue: variant,
        });
      }
    }
  }

  // Check constraint changes
  if (oldType.definition.kind === 'ConstrainedType' && newType.definition.kind === 'ConstrainedType') {
    changes.push(...analyzeConstraintChanges(path, oldType.definition, newType.definition));
  }

  return changes;
}

function analyzeConstraintChanges(
  path: string,
  oldType: AST.ConstrainedType,
  newType: AST.ConstrainedType
): Change[] {
  const changes: Change[] = [];
  const oldConstraints = new Map(oldType.constraints.map(c => [c.name, c]));
  const newConstraints = new Map(newType.constraints.map(c => [c.name, c]));

  for (const [cname, oldConstraint] of oldConstraints) {
    const newConstraint = newConstraints.get(cname);
    
    if (!newConstraint) {
      // Constraint removed - could be relaxing (MINOR) or tightening (BREAKING)
      changes.push({
        type: 'constraint-relaxed',
        category: 'feature',
        path: `${path}.constraints.${cname}`,
        description: `Constraint "${cname}" was removed (relaxed)`,
        oldValue: oldConstraint,
      });
    } else {
      // Compare values
      const oldVal = extractConstraintValue(oldConstraint.value);
      const newVal = extractConstraintValue(newConstraint.value);
      
      if (oldVal !== newVal) {
        const isTightened = isConstraintTightened(cname, oldVal, newVal);
        changes.push({
          type: isTightened ? 'constraint-tightened' : 'constraint-relaxed',
          category: isTightened ? 'breaking' : 'feature',
          path: `${path}.constraints.${cname}`,
          description: `Constraint "${cname}" changed from ${oldVal} to ${newVal}`,
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    }
  }

  // New constraints added (BREAKING - more restrictive)
  for (const [cname, newConstraint] of newConstraints) {
    if (!oldConstraints.has(cname)) {
      changes.push({
        type: 'constraint-tightened',
        category: 'breaking',
        path: `${path}.constraints.${cname}`,
        description: `New constraint "${cname}" was added`,
        newValue: newConstraint,
      });
    }
  }

  return changes;
}

function isConstraintTightened(name: string, oldVal: unknown, newVal: unknown): boolean {
  if (typeof oldVal !== 'number' || typeof newVal !== 'number') return true;

  switch (name) {
    case 'min':
    case 'minimum':
    case 'min_length':
      return newVal > oldVal; // Higher min is tighter
    case 'max':
    case 'maximum':
    case 'max_length':
      return newVal < oldVal; // Lower max is tighter
    default:
      return oldVal !== newVal;
  }
}

// ============================================================================
// ENTITY ANALYSIS
// ============================================================================

function analyzeEntities(
  oldEntities: AST.Entity[],
  newEntities: AST.Entity[]
): Change[] {
  const changes: Change[] = [];
  const oldMap = new Map(oldEntities.map(e => [e.name.name, e]));
  const newMap = new Map(newEntities.map(e => [e.name.name, e]));

  // Removed entities (BREAKING)
  for (const [name, oldEntity] of oldMap) {
    if (!newMap.has(name)) {
      changes.push({
        type: 'entity-removed',
        category: 'breaking',
        path: `entities.${name}`,
        description: `Entity "${name}" was removed`,
        oldValue: oldEntity,
      });
    }
  }

  // Added entities (MINOR)
  for (const [name, newEntity] of newMap) {
    if (!oldMap.has(name)) {
      changes.push({
        type: 'entity-added',
        category: 'feature',
        path: `entities.${name}`,
        description: `Entity "${name}" was added`,
        newValue: newEntity,
      });
    }
  }

  // Modified entities
  for (const [name, oldEntity] of oldMap) {
    const newEntity = newMap.get(name);
    if (newEntity) {
      changes.push(...analyzeEntityChanges(name, oldEntity, newEntity));
    }
  }

  return changes;
}

function analyzeEntityChanges(
  name: string,
  oldEntity: AST.Entity,
  newEntity: AST.Entity
): Change[] {
  const changes: Change[] = [];
  const path = `entities.${name}`;

  // Analyze fields
  changes.push(...analyzeFields(path, oldEntity.fields, newEntity.fields));

  // Analyze lifecycle
  if (oldEntity.lifecycle && newEntity.lifecycle) {
    changes.push(...analyzeLifecycle(path, oldEntity.lifecycle, newEntity.lifecycle));
  } else if (oldEntity.lifecycle && !newEntity.lifecycle) {
    changes.push({
      type: 'lifecycle-transition-removed',
      category: 'breaking',
      path: `${path}.lifecycle`,
      description: `Lifecycle was removed from entity "${name}"`,
      oldValue: oldEntity.lifecycle,
    });
  } else if (!oldEntity.lifecycle && newEntity.lifecycle) {
    changes.push({
      type: 'lifecycle-transition-added',
      category: 'feature',
      path: `${path}.lifecycle`,
      description: `Lifecycle was added to entity "${name}"`,
      newValue: newEntity.lifecycle,
    });
  }

  return changes;
}

function analyzeFields(
  path: string,
  oldFields: AST.Field[],
  newFields: AST.Field[]
): Change[] {
  const changes: Change[] = [];
  const oldMap = new Map(oldFields.map(f => [f.name.name, f]));
  const newMap = new Map(newFields.map(f => [f.name.name, f]));

  // Removed fields (BREAKING)
  for (const [fname, oldField] of oldMap) {
    if (!newMap.has(fname)) {
      changes.push({
        type: 'field-removed',
        category: 'breaking',
        path: `${path}.fields.${fname}`,
        description: `Field "${fname}" was removed`,
        oldValue: oldField,
      });
    }
  }

  // Added fields
  for (const [fname, newField] of newMap) {
    if (!oldMap.has(fname)) {
      changes.push({
        type: 'field-added',
        category: 'feature',
        path: `${path}.fields.${fname}`,
        description: `Field "${fname}" was added${newField.optional ? ' (optional)' : ''}`,
        newValue: newField,
      });
    }
  }

  // Modified fields
  for (const [fname, oldField] of oldMap) {
    const newField = newMap.get(fname);
    if (newField) {
      // Type change (BREAKING)
      if (!typesEqual(oldField.type, newField.type)) {
        changes.push({
          type: 'field-type-changed',
          category: 'breaking',
          path: `${path}.fields.${fname}`,
          description: `Field "${fname}" type changed`,
          oldValue: formatType(oldField.type),
          newValue: formatType(newField.type),
        });
      }

      // Optional -> Required (BREAKING)
      if (oldField.optional && !newField.optional) {
        changes.push({
          type: 'constraint-tightened',
          category: 'breaking',
          path: `${path}.fields.${fname}`,
          description: `Field "${fname}" changed from optional to required`,
          oldValue: 'optional',
          newValue: 'required',
        });
      }
    }
  }

  return changes;
}

function analyzeLifecycle(
  path: string,
  oldLifecycle: AST.LifecycleSpec,
  newLifecycle: AST.LifecycleSpec
): Change[] {
  const changes: Change[] = [];
  
  const oldTransitions = new Set(
    oldLifecycle.transitions.map(t => `${t.from.name}->${t.to.name}`)
  );
  const newTransitions = new Set(
    newLifecycle.transitions.map(t => `${t.from.name}->${t.to.name}`)
  );

  // Removed transitions (BREAKING)
  for (const trans of oldTransitions) {
    if (!newTransitions.has(trans)) {
      changes.push({
        type: 'lifecycle-transition-removed',
        category: 'breaking',
        path: `${path}.lifecycle.transitions`,
        description: `Lifecycle transition "${trans}" was removed`,
        oldValue: trans,
      });
    }
  }

  // Added transitions (MINOR)
  for (const trans of newTransitions) {
    if (!oldTransitions.has(trans)) {
      changes.push({
        type: 'lifecycle-transition-added',
        category: 'feature',
        path: `${path}.lifecycle.transitions`,
        description: `Lifecycle transition "${trans}" was added`,
        newValue: trans,
      });
    }
  }

  return changes;
}

// ============================================================================
// BEHAVIOR ANALYSIS
// ============================================================================

function analyzeBehaviors(
  oldBehaviors: AST.Behavior[],
  newBehaviors: AST.Behavior[]
): Change[] {
  const changes: Change[] = [];
  const oldMap = new Map(oldBehaviors.map(b => [b.name.name, b]));
  const newMap = new Map(newBehaviors.map(b => [b.name.name, b]));

  // Removed behaviors (BREAKING)
  for (const [name, oldBehavior] of oldMap) {
    if (!newMap.has(name)) {
      changes.push({
        type: 'behavior-removed',
        category: 'breaking',
        path: `behaviors.${name}`,
        description: `Behavior "${name}" was removed`,
        oldValue: oldBehavior,
      });
    }
  }

  // Added behaviors (MINOR)
  for (const [name, newBehavior] of newMap) {
    if (!oldMap.has(name)) {
      changes.push({
        type: 'behavior-added',
        category: 'feature',
        path: `behaviors.${name}`,
        description: `Behavior "${name}" was added`,
        newValue: newBehavior,
      });
    }
  }

  // Modified behaviors
  for (const [name, oldBehavior] of oldMap) {
    const newBehavior = newMap.get(name);
    if (newBehavior) {
      changes.push(...analyzeBehaviorChanges(name, oldBehavior, newBehavior));
    }
  }

  return changes;
}

function analyzeBehaviorChanges(
  name: string,
  oldBehavior: AST.Behavior,
  newBehavior: AST.Behavior
): Change[] {
  const changes: Change[] = [];
  const path = `behaviors.${name}`;

  // Analyze input changes
  changes.push(...analyzeInputChanges(path, oldBehavior.input, newBehavior.input));

  // Analyze output changes
  changes.push(...analyzeOutputChanges(path, oldBehavior.output, newBehavior.output));

  // Analyze precondition changes
  if (newBehavior.preconditions.length > oldBehavior.preconditions.length) {
    changes.push({
      type: 'precondition-added',
      category: 'breaking',
      path: `${path}.preconditions`,
      description: `New preconditions were added to "${name}"`,
      oldValue: oldBehavior.preconditions.length,
      newValue: newBehavior.preconditions.length,
    });
  }

  // Analyze description changes (PATCH)
  const oldDesc = oldBehavior.description?.value;
  const newDesc = newBehavior.description?.value;
  if (oldDesc !== newDesc) {
    changes.push({
      type: 'description-changed',
      category: 'fix',
      path: `${path}.description`,
      description: `Description of "${name}" was updated`,
      oldValue: oldDesc,
      newValue: newDesc,
    });
  }

  // Analyze temporal spec changes (PATCH)
  if (JSON.stringify(oldBehavior.temporal) !== JSON.stringify(newBehavior.temporal)) {
    changes.push({
      type: 'temporal-spec-changed',
      category: 'fix',
      path: `${path}.temporal`,
      description: `Temporal specifications of "${name}" were updated`,
    });
  }

  return changes;
}

function analyzeInputChanges(
  path: string,
  oldInput: AST.InputSpec,
  newInput: AST.InputSpec
): Change[] {
  const changes: Change[] = [];
  const oldFields = new Map(oldInput.fields.map(f => [f.name.name, f]));
  const newFields = new Map(newInput.fields.map(f => [f.name.name, f]));

  // Removed input fields (BREAKING)
  for (const [fname, oldField] of oldFields) {
    if (!newFields.has(fname)) {
      changes.push({
        type: 'input-field-removed',
        category: 'breaking',
        path: `${path}.input.${fname}`,
        description: `Input field "${fname}" was removed`,
        oldValue: oldField,
      });
    }
  }

  // Added input fields
  for (const [fname, newField] of newFields) {
    if (!oldFields.has(fname)) {
      changes.push({
        type: newField.optional ? 'input-field-added-optional' : 'precondition-added',
        category: newField.optional ? 'feature' : 'breaking',
        path: `${path}.input.${fname}`,
        description: `Input field "${fname}" was added${newField.optional ? ' (optional)' : ' (required - breaking)'}`,
        newValue: newField,
      });
    }
  }

  // Type changes
  for (const [fname, oldField] of oldFields) {
    const newField = newFields.get(fname);
    if (newField && !typesEqual(oldField.type, newField.type)) {
      changes.push({
        type: 'input-field-type-changed',
        category: 'breaking',
        path: `${path}.input.${fname}`,
        description: `Input field "${fname}" type changed`,
        oldValue: formatType(oldField.type),
        newValue: formatType(newField.type),
      });
    }
  }

  return changes;
}

function analyzeOutputChanges(
  path: string,
  oldOutput: AST.OutputSpec,
  newOutput: AST.OutputSpec
): Change[] {
  const changes: Change[] = [];

  // Success type change (BREAKING)
  if (!typesEqual(oldOutput.success, newOutput.success)) {
    changes.push({
      type: 'output-type-changed',
      category: 'breaking',
      path: `${path}.output.success`,
      description: 'Output success type changed',
      oldValue: formatType(oldOutput.success),
      newValue: formatType(newOutput.success),
    });
  }

  // Error changes
  const oldErrors = new Map(oldOutput.errors.map(e => [e.name.name, e]));
  const newErrors = new Map(newOutput.errors.map(e => [e.name.name, e]));

  // Removed errors (BREAKING - clients may depend on these)
  for (const [ename] of oldErrors) {
    if (!newErrors.has(ename)) {
      changes.push({
        type: 'error-removed',
        category: 'breaking',
        path: `${path}.output.errors.${ename}`,
        description: `Error "${ename}" was removed`,
        oldValue: ename,
      });
    }
  }

  // Added errors (MINOR)
  for (const [ename, newError] of newErrors) {
    if (!oldErrors.has(ename)) {
      changes.push({
        type: 'error-added',
        category: 'feature',
        path: `${path}.output.errors.${ename}`,
        description: `Error "${ename}" was added`,
        newValue: newError,
      });
    }
  }

  return changes;
}

// ============================================================================
// OTHER ANALYSIS
// ============================================================================

function analyzeInvariants(
  oldInvariants: AST.InvariantBlock[],
  newInvariants: AST.InvariantBlock[]
): Change[] {
  const changes: Change[] = [];
  const oldNames = new Set(oldInvariants.map(i => i.name.name));
  const newNames = new Set(newInvariants.map(i => i.name.name));

  for (const name of newNames) {
    if (!oldNames.has(name)) {
      changes.push({
        type: 'invariant-added',
        category: 'feature',
        path: `invariants.${name}`,
        description: `Invariant "${name}" was added`,
      });
    }
  }

  return changes;
}

function analyzePolicies(
  oldPolicies: AST.Policy[],
  newPolicies: AST.Policy[]
): Change[] {
  const changes: Change[] = [];
  const oldNames = new Set(oldPolicies.map(p => p.name.name));
  const newNames = new Set(newPolicies.map(p => p.name.name));

  for (const name of newNames) {
    if (!oldNames.has(name)) {
      changes.push({
        type: 'policy-added',
        category: 'feature',
        path: `policies.${name}`,
        description: `Policy "${name}" was added`,
      });
    }
  }

  return changes;
}

function analyzeViews(
  oldViews: AST.View[],
  newViews: AST.View[]
): Change[] {
  const changes: Change[] = [];
  const oldNames = new Set(oldViews.map(v => v.name.name));
  const newNames = new Set(newViews.map(v => v.name.name));

  for (const name of newNames) {
    if (!oldNames.has(name)) {
      changes.push({
        type: 'view-added',
        category: 'feature',
        path: `views.${name}`,
        description: `View "${name}" was added`,
      });
    }
  }

  return changes;
}

// ============================================================================
// HELPERS
// ============================================================================

function typesEqual(a: AST.TypeDefinition, b: AST.TypeDefinition): boolean {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case 'PrimitiveType':
      return a.name === (b as AST.PrimitiveType).name;
    case 'ReferenceType':
      return formatType(a) === formatType(b);
    case 'ListType':
      return typesEqual(a.element, (b as AST.ListType).element);
    case 'MapType':
      return (
        typesEqual(a.key, (b as AST.MapType).key) &&
        typesEqual(a.value, (b as AST.MapType).value)
      );
    case 'OptionalType':
      return typesEqual(a.inner, (b as AST.OptionalType).inner);
    default:
      return JSON.stringify(a) === JSON.stringify(b);
  }
}

function formatType(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      return type.name;
    case 'ReferenceType':
      return type.name.parts.map(p => p.name).join('.');
    case 'ListType':
      return `List<${formatType(type.element)}>`;
    case 'MapType':
      return `Map<${formatType(type.key)}, ${formatType(type.value)}>`;
    case 'OptionalType':
      return `${formatType(type.inner)}?`;
    case 'EnumType':
      return `enum{${type.variants.map(v => v.name.name).join(', ')}}`;
    default:
      return type.kind;
  }
}

function extractConstraintValue(expr: AST.Expression): unknown {
  switch (expr.kind) {
    case 'NumberLiteral':
      return expr.value;
    case 'StringLiteral':
      return expr.value;
    case 'BooleanLiteral':
      return expr.value;
    default:
      return null;
  }
}
