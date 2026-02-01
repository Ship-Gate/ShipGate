/**
 * ISL Diff Engine
 *
 * Deterministic diff calculation between two ISL ASTs.
 * All comparisons are sorted by name for stable, reproducible output.
 */

import type {
  Domain,
  Entity,
  Behavior,
  Field,
  TypeDeclaration,
  Expression,
  ErrorSpec,
  TemporalSpec,
  SecuritySpec,
  PostconditionBlock,
} from '@isl-lang/parser';

import type {
  DomainDiff,
  EntityDiff,
  BehaviorDiff,
  TypeDiff,
  FieldChange,
  ClauseChange,
  ErrorChange,
  InputDiff,
  OutputDiff,
  DiffSummary,
  DiffOptions,
  ChangeType,
  ChangeSeverity,
} from './diffTypes.js';

// ============================================================================
// EXPRESSION SERIALIZATION
// ============================================================================

/**
 * Serialize an expression to a stable string representation.
 * Used for comparing expressions deterministically.
 */
function serializeExpression(expr: Expression | undefined, ignoreWhitespace = true): string {
  if (!expr) return '';

  const serialize = (e: Expression): string => {
    switch (e.kind) {
      case 'Identifier':
        return e.name;
      case 'QualifiedName':
        return e.parts.map((p) => p.name).join('.');
      case 'StringLiteral':
        return `"${e.value}"`;
      case 'NumberLiteral':
        return String(e.value);
      case 'BooleanLiteral':
        return String(e.value);
      case 'NullLiteral':
        return 'null';
      case 'DurationLiteral':
        return `${e.value}.${e.unit}`;
      case 'RegexLiteral':
        return `/${e.pattern}/${e.flags}`;
      case 'BinaryExpr':
        return `(${serialize(e.left)} ${e.operator} ${serialize(e.right)})`;
      case 'UnaryExpr':
        return `(${e.operator} ${serialize(e.operand)})`;
      case 'CallExpr':
        return `${serialize(e.callee)}(${e.arguments.map(serialize).join(', ')})`;
      case 'MemberExpr':
        return `${serialize(e.object)}.${e.property.name}`;
      case 'IndexExpr':
        return `${serialize(e.object)}[${serialize(e.index)}]`;
      case 'QuantifierExpr':
        return `${e.quantifier}(${e.variable.name} in ${serialize(e.collection)}): ${serialize(e.predicate)}`;
      case 'ConditionalExpr':
        return `(${serialize(e.condition)} ? ${serialize(e.thenBranch)} : ${serialize(e.elseBranch)})`;
      case 'OldExpr':
        return `old(${serialize(e.expression)})`;
      case 'ResultExpr':
        return e.property ? `result.${e.property.name}` : 'result';
      case 'InputExpr':
        return `input.${e.property.name}`;
      case 'LambdaExpr':
        return `(${e.params.map((p) => p.name).join(', ')}) => ${serialize(e.body)}`;
      case 'ListExpr':
        return `[${e.elements.map(serialize).join(', ')}]`;
      case 'MapExpr':
        return `{${e.entries.map((en) => `${serialize(en.key)}: ${serialize(en.value)}`).join(', ')}}`;
      default:
        return JSON.stringify(e);
    }
  };

  const result = serialize(expr);
  return ignoreWhitespace ? result.replace(/\s+/g, ' ').trim() : result;
}

/**
 * Serialize a type definition to a stable string
 */
function serializeType(type: unknown): string {
  if (!type) return 'unknown';

  const t = type as Record<string, unknown>;
  switch (t.kind) {
    case 'PrimitiveType':
      return t.name as string;
    case 'ReferenceType': {
      const ref = t.name as { parts?: Array<{ name: string }> };
      return ref.parts?.map((p) => p.name).join('.') ?? 'unknown';
    }
    case 'ListType':
      return `List<${serializeType(t.element)}>`;
    case 'MapType':
      return `Map<${serializeType(t.key)}, ${serializeType(t.value)}>`;
    case 'OptionalType':
      return `${serializeType(t.inner)}?`;
    case 'ConstrainedType':
      return `${serializeType(t.base)} { constrained }`;
    case 'EnumType': {
      const variants = (t.variants as Array<{ name: { name: string } }>) ?? [];
      return `enum { ${variants.map((v) => v.name.name).join(', ')} }`;
    }
    case 'StructType':
      return `struct { ... }`;
    case 'UnionType':
      return `union { ... }`;
    default:
      return 'unknown';
  }
}

// ============================================================================
// FIELD DIFFING
// ============================================================================

/**
 * Compare two fields and return changes
 */
function diffField(oldField: Field | undefined, newField: Field | undefined): FieldChange | null {
  if (!oldField && !newField) return null;

  const name = oldField?.name.name ?? newField!.name.name;

  if (!oldField) {
    return {
      name,
      change: 'added',
      newType: serializeType(newField!.type),
      newOptional: newField!.optional,
      newAnnotations: newField!.annotations.map((a) => a.name.name),
    };
  }

  if (!newField) {
    return {
      name,
      change: 'removed',
      oldType: serializeType(oldField.type),
      oldOptional: oldField.optional,
      oldAnnotations: oldField.annotations.map((a) => a.name.name),
    };
  }

  const oldType = serializeType(oldField.type);
  const newType = serializeType(newField.type);
  const oldAnnotations = oldField.annotations.map((a) => a.name.name).sort();
  const newAnnotations = newField.annotations.map((a) => a.name.name).sort();

  const typeChanged = oldType !== newType;
  const optionalChanged = oldField.optional !== newField.optional;
  const annotationsChanged = JSON.stringify(oldAnnotations) !== JSON.stringify(newAnnotations);

  if (!typeChanged && !optionalChanged && !annotationsChanged) {
    return null;
  }

  return {
    name,
    change: 'changed',
    oldType,
    newType,
    oldOptional: oldField.optional,
    newOptional: newField.optional,
    oldAnnotations,
    newAnnotations,
  };
}

/**
 * Diff two arrays of fields
 */
function diffFields(oldFields: Field[], newFields: Field[]): FieldChange[] {
  const changes: FieldChange[] = [];
  const oldByName = new Map(oldFields.map((f) => [f.name.name, f]));
  const newByName = new Map(newFields.map((f) => [f.name.name, f]));
  const allNames = new Set([...oldByName.keys(), ...newByName.keys()]);

  // Sort for deterministic output
  const sortedNames = Array.from(allNames).sort();

  for (const name of sortedNames) {
    const change = diffField(oldByName.get(name), newByName.get(name));
    if (change) {
      changes.push(change);
    }
  }

  return changes;
}

// ============================================================================
// CLAUSE DIFFING
// ============================================================================

/**
 * Diff two arrays of expressions (preconditions, invariants, etc.)
 */
function diffExpressions(
  oldExprs: Expression[],
  newExprs: Expression[],
  clauseType: ClauseChange['clauseType'],
  options: DiffOptions = {}
): ClauseChange[] {
  const changes: ClauseChange[] = [];
  const ignoreWhitespace = options.ignoreWhitespace ?? true;

  const oldSerialized = oldExprs.map((e, i) => ({
    index: i,
    expr: serializeExpression(e, ignoreWhitespace),
  }));
  const newSerialized = newExprs.map((e, i) => ({
    index: i,
    expr: serializeExpression(e, ignoreWhitespace),
  }));

  const oldSet = new Set(oldSerialized.map((o) => o.expr));
  const newSet = new Set(newSerialized.map((n) => n.expr));

  // Find removed clauses
  for (const old of oldSerialized) {
    if (!newSet.has(old.expr)) {
      changes.push({
        clauseType,
        change: 'removed',
        oldExpression: old.expr,
        index: old.index,
      });
    }
  }

  // Find added clauses
  for (const newItem of newSerialized) {
    if (!oldSet.has(newItem.expr)) {
      changes.push({
        clauseType,
        change: 'added',
        newExpression: newItem.expr,
        index: newItem.index,
      });
    }
  }

  // Sort by expression for deterministic output
  return changes.sort((a, b) => {
    const aExpr = a.oldExpression ?? a.newExpression ?? '';
    const bExpr = b.oldExpression ?? b.newExpression ?? '';
    return aExpr.localeCompare(bExpr);
  });
}

/**
 * Diff postcondition blocks
 */
function diffPostconditions(
  oldBlocks: PostconditionBlock[],
  newBlocks: PostconditionBlock[],
  options: DiffOptions = {}
): ClauseChange[] {
  const changes: ClauseChange[] = [];

  // Flatten all postconditions into a single array for comparison
  const flatten = (blocks: PostconditionBlock[]): Expression[] => {
    return blocks.flatMap((b) => b.predicates);
  };

  return diffExpressions(flatten(oldBlocks), flatten(newBlocks), 'postcondition', options);
}

/**
 * Diff temporal specs
 */
function diffTemporalSpecs(
  oldSpecs: TemporalSpec[],
  newSpecs: TemporalSpec[],
  options: DiffOptions = {}
): ClauseChange[] {
  const serialize = (spec: TemporalSpec): string => {
    let result = spec.operator;
    if (spec.duration) {
      result += ` ${spec.duration.value}.${spec.duration.unit}`;
    }
    if (spec.percentile) {
      result += ` (p${spec.percentile})`;
    }
    result += `: ${serializeExpression(spec.predicate, options.ignoreWhitespace ?? true)}`;
    return result;
  };

  const oldSerialized = oldSpecs.map((s, i) => ({ index: i, expr: serialize(s) }));
  const newSerialized = newSpecs.map((s, i) => ({ index: i, expr: serialize(s) }));

  const changes: ClauseChange[] = [];
  const oldSet = new Set(oldSerialized.map((o) => o.expr));
  const newSet = new Set(newSerialized.map((n) => n.expr));

  for (const old of oldSerialized) {
    if (!newSet.has(old.expr)) {
      changes.push({
        clauseType: 'temporal',
        change: 'removed',
        oldExpression: old.expr,
        index: old.index,
      });
    }
  }

  for (const newItem of newSerialized) {
    if (!oldSet.has(newItem.expr)) {
      changes.push({
        clauseType: 'temporal',
        change: 'added',
        newExpression: newItem.expr,
        index: newItem.index,
      });
    }
  }

  return changes.sort((a, b) => {
    const aExpr = a.oldExpression ?? a.newExpression ?? '';
    const bExpr = b.oldExpression ?? b.newExpression ?? '';
    return aExpr.localeCompare(bExpr);
  });
}

/**
 * Diff security specs
 */
function diffSecuritySpecs(
  oldSpecs: SecuritySpec[],
  newSpecs: SecuritySpec[],
  options: DiffOptions = {}
): ClauseChange[] {
  const serialize = (spec: SecuritySpec): string => {
    return `${spec.type}: ${serializeExpression(spec.details, options.ignoreWhitespace ?? true)}`;
  };

  const oldSerialized = oldSpecs.map((s, i) => ({ index: i, expr: serialize(s) }));
  const newSerialized = newSpecs.map((s, i) => ({ index: i, expr: serialize(s) }));

  const changes: ClauseChange[] = [];
  const oldSet = new Set(oldSerialized.map((o) => o.expr));
  const newSet = new Set(newSerialized.map((n) => n.expr));

  for (const old of oldSerialized) {
    if (!newSet.has(old.expr)) {
      changes.push({
        clauseType: 'security',
        change: 'removed',
        oldExpression: old.expr,
        index: old.index,
      });
    }
  }

  for (const newItem of newSerialized) {
    if (!oldSet.has(newItem.expr)) {
      changes.push({
        clauseType: 'security',
        change: 'added',
        newExpression: newItem.expr,
        index: newItem.index,
      });
    }
  }

  return changes.sort((a, b) => {
    const aExpr = a.oldExpression ?? a.newExpression ?? '';
    const bExpr = b.oldExpression ?? b.newExpression ?? '';
    return aExpr.localeCompare(bExpr);
  });
}

// ============================================================================
// ERROR SPEC DIFFING
// ============================================================================

/**
 * Diff error specifications
 */
function diffErrors(oldErrors: ErrorSpec[], newErrors: ErrorSpec[]): ErrorChange[] {
  const changes: ErrorChange[] = [];
  const oldByName = new Map(oldErrors.map((e) => [e.name.name, e]));
  const newByName = new Map(newErrors.map((e) => [e.name.name, e]));
  const allNames = new Set([...oldByName.keys(), ...newByName.keys()]);

  const sortedNames = Array.from(allNames).sort();

  for (const name of sortedNames) {
    const oldErr = oldByName.get(name);
    const newErr = newByName.get(name);

    if (!oldErr) {
      changes.push({
        name,
        change: 'added',
        newWhen: newErr!.when?.value,
        newRetriable: newErr!.retriable,
      });
    } else if (!newErr) {
      changes.push({
        name,
        change: 'removed',
        oldWhen: oldErr.when?.value,
        oldRetriable: oldErr.retriable,
      });
    } else {
      const whenChanged = oldErr.when?.value !== newErr.when?.value;
      const retriableChanged = oldErr.retriable !== newErr.retriable;

      if (whenChanged || retriableChanged) {
        changes.push({
          name,
          change: 'changed',
          oldWhen: oldErr.when?.value,
          newWhen: newErr.when?.value,
          oldRetriable: oldErr.retriable,
          newRetriable: newErr.retriable,
        });
      }
    }
  }

  return changes;
}

// ============================================================================
// ENTITY DIFFING
// ============================================================================

/**
 * Calculate severity of entity changes
 */
function calculateEntitySeverity(change: ChangeType, fieldChanges: FieldChange[]): ChangeSeverity {
  if (change === 'removed') return 'breaking';
  if (change === 'added') return 'compatible';

  // Check field changes for breaking changes
  for (const fc of fieldChanges) {
    if (fc.change === 'removed') return 'breaking';
    if (fc.change === 'changed') {
      // Type changes are breaking
      if (fc.oldType !== fc.newType) return 'breaking';
      // Making required -> optional is compatible, optional -> required is breaking
      if (fc.oldOptional === true && fc.newOptional === false) return 'breaking';
    }
  }

  return fieldChanges.length > 0 ? 'compatible' : 'patch';
}

/**
 * Diff a single entity
 */
function diffEntity(
  oldEntity: Entity | undefined,
  newEntity: Entity | undefined,
  options: DiffOptions = {}
): EntityDiff | null {
  if (!oldEntity && !newEntity) return null;

  const name = oldEntity?.name.name ?? newEntity!.name.name;

  if (!oldEntity) {
    return {
      name,
      change: 'added',
      severity: 'compatible',
      fieldChanges: [],
      invariantChanges: [],
      lifecycleChanged: false,
    };
  }

  if (!newEntity) {
    return {
      name,
      change: 'removed',
      severity: 'breaking',
      fieldChanges: [],
      invariantChanges: [],
      lifecycleChanged: false,
    };
  }

  const fieldChanges = diffFields(oldEntity.fields, newEntity.fields);
  const invariantChanges = diffExpressions(
    oldEntity.invariants,
    newEntity.invariants,
    'invariant',
    options
  );

  // Check lifecycle changes
  const oldLifecycle = JSON.stringify(oldEntity.lifecycle ?? null);
  const newLifecycle = JSON.stringify(newEntity.lifecycle ?? null);
  const lifecycleChanged = oldLifecycle !== newLifecycle;

  if (fieldChanges.length === 0 && invariantChanges.length === 0 && !lifecycleChanged) {
    return null;
  }

  const severity = calculateEntitySeverity('changed', fieldChanges);

  return {
    name,
    change: 'changed',
    severity,
    fieldChanges,
    invariantChanges,
    lifecycleChanged,
  };
}

// ============================================================================
// BEHAVIOR DIFFING
// ============================================================================

/**
 * Calculate severity of behavior changes
 */
function calculateBehaviorSeverity(
  change: ChangeType,
  inputDiff: InputDiff,
  outputDiff: OutputDiff,
  preconditionChanges: ClauseChange[]
): ChangeSeverity {
  if (change === 'removed') return 'breaking';
  if (change === 'added') return 'compatible';

  // Check for breaking changes
  for (const fc of inputDiff.fieldChanges) {
    // Adding required input field is breaking
    if (fc.change === 'added' && !fc.newOptional) return 'breaking';
    // Removing input field is breaking
    if (fc.change === 'removed') return 'breaking';
    // Changing input type is breaking
    if (fc.change === 'changed' && fc.oldType !== fc.newType) return 'breaking';
  }

  // Output type change is breaking
  if (outputDiff.successTypeChanged) return 'breaking';

  // Removing error is breaking (clients may depend on it)
  for (const ec of outputDiff.errorChanges) {
    if (ec.change === 'removed') return 'breaking';
  }

  // Adding preconditions can be breaking
  for (const pc of preconditionChanges) {
    if (pc.change === 'added') return 'breaking';
  }

  const hasChanges =
    inputDiff.changed ||
    outputDiff.changed ||
    preconditionChanges.length > 0;

  return hasChanges ? 'compatible' : 'patch';
}

/**
 * Diff a single behavior
 */
function diffBehavior(
  oldBehavior: Behavior | undefined,
  newBehavior: Behavior | undefined,
  options: DiffOptions = {}
): BehaviorDiff | null {
  if (!oldBehavior && !newBehavior) return null;

  const name = oldBehavior?.name.name ?? newBehavior!.name.name;

  if (!oldBehavior) {
    return {
      name,
      change: 'added',
      severity: 'compatible',
      descriptionChanged: false,
      inputDiff: { changed: false, fieldChanges: [] },
      outputDiff: { changed: false, successTypeChanged: false, errorChanges: [] },
      preconditionChanges: [],
      postconditionChanges: [],
      invariantChanges: [],
      temporalChanges: [],
      securityChanges: [],
    };
  }

  if (!newBehavior) {
    return {
      name,
      change: 'removed',
      severity: 'breaking',
      descriptionChanged: false,
      inputDiff: { changed: false, fieldChanges: [] },
      outputDiff: { changed: false, successTypeChanged: false, errorChanges: [] },
      preconditionChanges: [],
      postconditionChanges: [],
      invariantChanges: [],
      temporalChanges: [],
      securityChanges: [],
    };
  }

  // Diff description
  const descriptionChanged =
    (oldBehavior.description?.value ?? '') !== (newBehavior.description?.value ?? '');

  // Diff input
  const inputFieldChanges = diffFields(
    oldBehavior.input?.fields ?? [],
    newBehavior.input?.fields ?? []
  );
  const inputDiff: InputDiff = {
    changed: inputFieldChanges.length > 0,
    fieldChanges: inputFieldChanges,
  };

  // Diff output
  const oldSuccessType = serializeType(oldBehavior.output?.success);
  const newSuccessType = serializeType(newBehavior.output?.success);
  const successTypeChanged = oldSuccessType !== newSuccessType;
  const errorChanges = diffErrors(
    oldBehavior.output?.errors ?? [],
    newBehavior.output?.errors ?? []
  );
  const outputDiff: OutputDiff = {
    changed: successTypeChanged || errorChanges.length > 0,
    successTypeChanged,
    oldSuccessType: successTypeChanged ? oldSuccessType : undefined,
    newSuccessType: successTypeChanged ? newSuccessType : undefined,
    errorChanges,
  };

  // Diff clauses
  const preconditionChanges = diffExpressions(
    oldBehavior.preconditions,
    newBehavior.preconditions,
    'precondition',
    options
  );
  const postconditionChanges = diffPostconditions(
    oldBehavior.postconditions,
    newBehavior.postconditions,
    options
  );
  const invariantChanges = diffExpressions(
    oldBehavior.invariants,
    newBehavior.invariants,
    'invariant',
    options
  );
  const temporalChanges = diffTemporalSpecs(
    oldBehavior.temporal,
    newBehavior.temporal,
    options
  );
  const securityChanges = diffSecuritySpecs(
    oldBehavior.security,
    newBehavior.security,
    options
  );

  // Check if anything changed
  const hasChanges =
    descriptionChanged ||
    inputDiff.changed ||
    outputDiff.changed ||
    preconditionChanges.length > 0 ||
    postconditionChanges.length > 0 ||
    invariantChanges.length > 0 ||
    temporalChanges.length > 0 ||
    securityChanges.length > 0;

  if (!hasChanges) {
    return null;
  }

  const severity = calculateBehaviorSeverity(
    'changed',
    inputDiff,
    outputDiff,
    preconditionChanges
  );

  return {
    name,
    change: 'changed',
    severity,
    descriptionChanged,
    inputDiff,
    outputDiff,
    preconditionChanges,
    postconditionChanges,
    invariantChanges,
    temporalChanges,
    securityChanges,
  };
}

// ============================================================================
// TYPE DIFFING
// ============================================================================

/**
 * Diff a type declaration
 */
function diffType(
  oldType: TypeDeclaration | undefined,
  newType: TypeDeclaration | undefined
): TypeDiff | null {
  if (!oldType && !newType) return null;

  const name = oldType?.name.name ?? newType!.name.name;

  if (!oldType) {
    return {
      name,
      change: 'added',
      severity: 'compatible',
      definitionChanged: false,
    };
  }

  if (!newType) {
    return {
      name,
      change: 'removed',
      severity: 'breaking',
      definitionChanged: false,
    };
  }

  const oldDef = serializeType(oldType.definition);
  const newDef = serializeType(newType.definition);

  if (oldDef === newDef) {
    return null;
  }

  return {
    name,
    change: 'changed',
    severity: 'breaking',
    definitionChanged: true,
    oldDefinition: oldDef,
    newDefinition: newDef,
  };
}

// ============================================================================
// DOMAIN DIFFING
// ============================================================================

/**
 * Calculate diff summary
 */
function calculateSummary(
  entityDiffs: EntityDiff[],
  behaviorDiffs: BehaviorDiff[],
  typeDiffs: TypeDiff[]
): DiffSummary {
  const count = (diffs: Array<{ change: ChangeType }>, type: ChangeType) =>
    diffs.filter((d) => d.change === type).length;

  const countSeverity = (
    diffs: Array<{ severity: ChangeSeverity }>,
    severity: ChangeSeverity
  ) => diffs.filter((d) => d.severity === severity).length;

  const allDiffs = [...entityDiffs, ...behaviorDiffs, ...typeDiffs];

  return {
    totalChanges: allDiffs.length,
    entitiesAdded: count(entityDiffs, 'added'),
    entitiesRemoved: count(entityDiffs, 'removed'),
    entitiesChanged: count(entityDiffs, 'changed'),
    behaviorsAdded: count(behaviorDiffs, 'added'),
    behaviorsRemoved: count(behaviorDiffs, 'removed'),
    behaviorsChanged: count(behaviorDiffs, 'changed'),
    typesAdded: count(typeDiffs, 'added'),
    typesRemoved: count(typeDiffs, 'removed'),
    typesChanged: count(typeDiffs, 'changed'),
    breakingChanges: countSeverity(allDiffs, 'breaking'),
    compatibleChanges: countSeverity(allDiffs, 'compatible'),
    patchChanges: countSeverity(allDiffs, 'patch'),
  };
}

/**
 * Main diff function - compares two ISL domains
 *
 * @param astA - The "before" domain AST
 * @param astB - The "after" domain AST
 * @param options - Diff options
 * @returns A deterministic diff between the two domains
 */
export function diffSpec(
  astA: Domain,
  astB: Domain,
  options: DiffOptions = {}
): DomainDiff {
  const domainName = astB.name.name;

  // Version change
  const versionChange =
    astA.version.value !== astB.version.value
      ? { oldVersion: astA.version.value, newVersion: astB.version.value }
      : undefined;

  // Entity diffs
  const oldEntities = new Map(astA.entities.map((e) => [e.name.name, e]));
  const newEntities = new Map(astB.entities.map((e) => [e.name.name, e]));
  const allEntityNames = new Set([...oldEntities.keys(), ...newEntities.keys()]);
  const sortedEntityNames = Array.from(allEntityNames).sort();

  const entityDiffs: EntityDiff[] = [];
  for (const name of sortedEntityNames) {
    const diff = diffEntity(oldEntities.get(name), newEntities.get(name), options);
    if (diff) {
      entityDiffs.push(diff);
    }
  }

  // Behavior diffs
  const oldBehaviors = new Map(astA.behaviors.map((b) => [b.name.name, b]));
  const newBehaviors = new Map(astB.behaviors.map((b) => [b.name.name, b]));
  const allBehaviorNames = new Set([...oldBehaviors.keys(), ...newBehaviors.keys()]);
  const sortedBehaviorNames = Array.from(allBehaviorNames).sort();

  const behaviorDiffs: BehaviorDiff[] = [];
  for (const name of sortedBehaviorNames) {
    const diff = diffBehavior(oldBehaviors.get(name), newBehaviors.get(name), options);
    if (diff) {
      behaviorDiffs.push(diff);
    }
  }

  // Type diffs
  const oldTypes = new Map(astA.types.map((t) => [t.name.name, t]));
  const newTypes = new Map(astB.types.map((t) => [t.name.name, t]));
  const allTypeNames = new Set([...oldTypes.keys(), ...newTypes.keys()]);
  const sortedTypeNames = Array.from(allTypeNames).sort();

  const typeDiffs: TypeDiff[] = [];
  for (const name of sortedTypeNames) {
    const diff = diffType(oldTypes.get(name), newTypes.get(name));
    if (diff) {
      typeDiffs.push(diff);
    }
  }

  // Calculate summary
  const summary = calculateSummary(entityDiffs, behaviorDiffs, typeDiffs);

  return {
    domainName,
    versionChange,
    entityDiffs,
    behaviorDiffs,
    typeDiffs,
    summary,
    isEmpty: summary.totalChanges === 0 && !versionChange,
  };
}
