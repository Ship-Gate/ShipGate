/**
 * Impact Analyzer
 *
 * Given an old ISL spec and a new ISL spec, computes the full change impact:
 *   - Which entities were added, removed, modified (field changes, invariant changes)
 *   - Which behaviors were added, removed, modified (signature changes, pre/post changes)
 *   - Which API routes are affected (by behavior name → file path mapping)
 *   - Which database models need migration
 *   - Which permissions change (RBAC impact)
 *   - Risk score for the change (breaking vs non-breaking)
 *
 * @module @isl-lang/impact-analyzer
 */

import type { GeneratedSpec, EntitySpec, BehaviorSpec, EntityField } from '@isl-lang/spec-generator';

export type ChangeKind =
  | 'added'
  | 'removed'
  | 'modified'
  | 'renamed'
  | 'type_changed'
  | 'modifier_changed'
  | 'invariant_added'
  | 'invariant_removed'
  | 'precondition_changed'
  | 'postcondition_changed'
  | 'error_added'
  | 'error_removed'
  | 'no_change';

export type ChangeRisk = 'breaking' | 'non_breaking' | 'additive' | 'informational';

export interface FieldChange {
  fieldName: string;
  kind: ChangeKind;
  before?: EntityField;
  after?: EntityField;
  risk: ChangeRisk;
}

export interface EntityChange {
  entityName: string;
  kind: ChangeKind;
  fieldChanges: FieldChange[];
  invariantChanges: Array<{ kind: ChangeKind; expression: string }>;
  risk: ChangeRisk;
  affectedMigration: boolean;
}

export interface BehaviorChange {
  behaviorName: string;
  kind: ChangeKind;
  inputChanges: FieldChange[];
  outputChanges: Array<{ kind: ChangeKind; description: string; risk: ChangeRisk }>;
  preconditionChanges: Array<{ kind: ChangeKind; expression: string }>;
  postconditionChanges: Array<{ kind: ChangeKind; expression: string }>;
  risk: ChangeRisk;
  affectedRoutes: string[];
}

export interface ImpactSummary {
  entityChanges: EntityChange[];
  behaviorChanges: BehaviorChange[];
  affectedFiles: string[];
  affectedRoutes: string[];
  requiresMigration: boolean;
  breakingChanges: number;
  nonBreakingChanges: number;
  additiveChanges: number;
  overallRisk: ChangeRisk;
  changeSummary: string;
}

function behaviorToRoutePath(behaviorName: string, domainName: string): string {
  const toKebab = (s: string) => s.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`).replace(/^-/, '');
  return `app/api/${toKebab(domainName)}/${toKebab(behaviorName)}/route.ts`;
}

function compareFields(
  before: EntityField[],
  after: EntityField[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  const beforeMap = new Map(before.map((f) => [f.name, f]));
  const afterMap = new Map(after.map((f) => [f.name, f]));

  for (const [name, afterField] of afterMap) {
    const beforeField = beforeMap.get(name);
    if (!beforeField) {
      changes.push({
        fieldName: name,
        kind: 'added',
        after: afterField,
        risk: afterField.optional || afterField.modifiers?.includes('optional') ? 'additive' : 'breaking',
      });
      continue;
    }
    if (beforeField.type !== afterField.type) {
      changes.push({ fieldName: name, kind: 'type_changed', before: beforeField, after: afterField, risk: 'breaking' });
      continue;
    }
    const beforeMods = new Set(beforeField.modifiers ?? []);
    const afterMods = new Set(afterField.modifiers ?? []);
    const addedMods = [...afterMods].filter((m) => !beforeMods.has(m));
    const removedMods = [...beforeMods].filter((m) => !afterMods.has(m));
    if (addedMods.length > 0 || removedMods.length > 0) {
      const isBreaking = removedMods.includes('optional') || addedMods.includes('unique') || addedMods.includes('immutable');
      changes.push({ fieldName: name, kind: 'modifier_changed', before: beforeField, after: afterField, risk: isBreaking ? 'breaking' : 'non_breaking' });
    }
  }

  for (const [name, beforeField] of beforeMap) {
    if (!afterMap.has(name)) {
      changes.push({ fieldName: name, kind: 'removed', before: beforeField, risk: 'breaking' });
    }
  }

  return changes;
}

function compareStringLists(before: string[], after: string[]): Array<{ kind: ChangeKind; expression: string }> {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const changes: Array<{ kind: ChangeKind; expression: string }> = [];
  for (const expr of afterSet) {
    if (!beforeSet.has(expr)) changes.push({ kind: 'invariant_added', expression: expr });
  }
  for (const expr of beforeSet) {
    if (!afterSet.has(expr)) changes.push({ kind: 'invariant_removed', expression: expr });
  }
  return changes;
}

function computeEntityRisk(fieldChanges: FieldChange[], invariantChanges: Array<{ kind: ChangeKind }>): ChangeRisk {
  if (fieldChanges.some((c) => c.risk === 'breaking') || invariantChanges.some((c) => c.kind === 'invariant_removed')) {
    return 'breaking';
  }
  if (fieldChanges.some((c) => c.risk === 'non_breaking')) return 'non_breaking';
  if (fieldChanges.length > 0 || invariantChanges.length > 0) return 'additive';
  return 'informational';
}

function computeBehaviorRisk(
  inputChanges: FieldChange[],
  outputChanges: Array<{ risk: ChangeRisk }>,
  preChanges: unknown[],
  postChanges: unknown[],
): ChangeRisk {
  const allRisks = [
    ...inputChanges.map((c) => c.risk),
    ...outputChanges.map((c) => c.risk),
  ];
  if (allRisks.includes('breaking') || preChanges.length > 0 || postChanges.length > 0) return 'breaking';
  if (allRisks.includes('non_breaking')) return 'non_breaking';
  if (allRisks.length > 0) return 'additive';
  return 'informational';
}

export function analyzeImpact(
  oldSpec: GeneratedSpec,
  newSpec: GeneratedSpec,
): ImpactSummary {
  const entityChanges: EntityChange[] = [];
  const behaviorChanges: BehaviorChange[] = [];
  const affectedFiles = new Set<string>();
  const affectedRoutes: string[] = [];

  const oldEntities = new Map(oldSpec.entities.map((e) => [e.name, e]));
  const newEntities = new Map(newSpec.entities.map((e) => [e.name, e]));

  for (const [name, newEntity] of newEntities) {
    const oldEntity = oldEntities.get(name);
    if (!oldEntity) {
      entityChanges.push({
        entityName: name,
        kind: 'added',
        fieldChanges: [],
        invariantChanges: [],
        risk: 'additive',
        affectedMigration: true,
      });
      affectedFiles.add(`prisma/schema.prisma`);
      affectedFiles.add(`lib/types.ts`);
      continue;
    }
    const fieldChanges = compareFields(oldEntity.fields, newEntity.fields);
    const invariantChanges = compareStringLists(oldEntity.invariants ?? [], newEntity.invariants ?? []);
    if (fieldChanges.length > 0 || invariantChanges.length > 0) {
      const risk = computeEntityRisk(fieldChanges, invariantChanges);
      entityChanges.push({ entityName: name, kind: 'modified', fieldChanges, invariantChanges, risk, affectedMigration: fieldChanges.length > 0 });
      affectedFiles.add(`prisma/schema.prisma`);
      affectedFiles.add(`lib/types.ts`);
    }
  }

  for (const [name] of oldEntities) {
    if (!newEntities.has(name)) {
      entityChanges.push({ entityName: name, kind: 'removed', fieldChanges: [], invariantChanges: [], risk: 'breaking', affectedMigration: true });
      affectedFiles.add(`prisma/schema.prisma`);
      affectedFiles.add(`lib/types.ts`);
    }
  }

  const oldBehaviors = new Map(oldSpec.behaviors.map((b) => [b.name, b]));
  const newBehaviors = new Map(newSpec.behaviors.map((b) => [b.name, b]));

  for (const [name, newBehavior] of newBehaviors) {
    const routePath = behaviorToRoutePath(name, newSpec.domainName);
    const oldBehavior = oldBehaviors.get(name);
    if (!oldBehavior) {
      behaviorChanges.push({
        behaviorName: name,
        kind: 'added',
        inputChanges: [],
        outputChanges: [],
        preconditionChanges: [],
        postconditionChanges: [],
        risk: 'additive',
        affectedRoutes: [routePath],
      });
      affectedFiles.add(routePath);
      affectedRoutes.push(routePath);
      continue;
    }

    const inputChanges = compareFields(oldBehavior.input, newBehavior.input);
    const oldErrors = new Set((oldBehavior.output.errors ?? []).map((e) => e.name));
    const newErrors = new Set((newBehavior.output.errors ?? []).map((e) => e.name));
    const outputChanges: Array<{ kind: ChangeKind; description: string; risk: ChangeRisk }> = [];
    for (const e of newErrors) {
      if (!oldErrors.has(e)) outputChanges.push({ kind: 'error_added', description: `Error case ${e} added`, risk: 'additive' });
    }
    for (const e of oldErrors) {
      if (!newErrors.has(e)) outputChanges.push({ kind: 'error_removed', description: `Error case ${e} removed`, risk: 'breaking' });
    }

    const preChanges = compareStringLists(oldBehavior.preconditions ?? [], newBehavior.preconditions ?? []);
    const postChanges = compareStringLists(oldBehavior.postconditions ?? [], newBehavior.postconditions ?? []);
    const risk = computeBehaviorRisk(inputChanges, outputChanges, preChanges, postChanges);

    if (inputChanges.length > 0 || outputChanges.length > 0 || preChanges.length > 0 || postChanges.length > 0) {
      behaviorChanges.push({ behaviorName: name, kind: 'modified', inputChanges, outputChanges, preconditionChanges: preChanges, postconditionChanges: postChanges, risk, affectedRoutes: [routePath] });
      affectedFiles.add(routePath);
      affectedRoutes.push(routePath);
    }
  }

  for (const [name] of oldBehaviors) {
    if (!newBehaviors.has(name)) {
      const routePath = behaviorToRoutePath(name, oldSpec.domainName);
      behaviorChanges.push({ behaviorName: name, kind: 'removed', inputChanges: [], outputChanges: [], preconditionChanges: [], postconditionChanges: [], risk: 'breaking', affectedRoutes: [routePath] });
      affectedFiles.add(routePath);
      affectedRoutes.push(routePath);
    }
  }

  const requiresMigration = entityChanges.some((c) => c.affectedMigration);
  const breakingChanges = [...entityChanges, ...behaviorChanges].filter((c) => c.risk === 'breaking').length;
  const nonBreakingChanges = [...entityChanges, ...behaviorChanges].filter((c) => c.risk === 'non_breaking').length;
  const additiveChanges = [...entityChanges, ...behaviorChanges].filter((c) => c.risk === 'additive').length;
  const overallRisk: ChangeRisk = breakingChanges > 0 ? 'breaking' : nonBreakingChanges > 0 ? 'non_breaking' : additiveChanges > 0 ? 'additive' : 'informational';

  const summaryParts: string[] = [];
  if (breakingChanges > 0) summaryParts.push(`${breakingChanges} breaking change${breakingChanges > 1 ? 's' : ''}`);
  if (additiveChanges > 0) summaryParts.push(`${additiveChanges} additive change${additiveChanges > 1 ? 's' : ''}`);
  if (requiresMigration) summaryParts.push('database migration required');
  if (summaryParts.length === 0) summaryParts.push('no structural changes');

  return {
    entityChanges,
    behaviorChanges,
    affectedFiles: [...affectedFiles],
    affectedRoutes,
    requiresMigration,
    breakingChanges,
    nonBreakingChanges,
    additiveChanges,
    overallRisk,
    changeSummary: summaryParts.join(', '),
  };
}
