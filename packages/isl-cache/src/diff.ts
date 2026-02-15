/**
 * Incremental diff logic for ISL specs
 * Identifies changed entities, behaviors, endpoints between two specs
 */

import type { DomainDeclaration } from '@isl-lang/parser';
import type { IncrementalDiffResult, ISLConstructDiff } from './types.js';

function extractNames<T extends { name?: { name?: string } }>(items: T[] | undefined): string[] {
  if (!items || !Array.isArray(items)) return [];
  return items
    .map((item) => item.name?.name ?? (item as { name?: string }).name)
    .filter((n): n is string => typeof n === 'string');
}

function diffSets(before: string[], after: string[]): ISLConstructDiff {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added = after.filter((n) => !beforeSet.has(n));
  const removed = before.filter((n) => !afterSet.has(n));
  const changed = after.filter((n) => beforeSet.has(n)); // Same name = potentially changed content
  return { added, removed, changed };
}

/**
 * Extract entity names from domain AST
 */
export function getEntityNames(domain: DomainDeclaration | null | undefined): string[] {
  return extractNames(domain?.entities ?? []);
}

/**
 * Extract behavior names from domain AST
 */
export function getBehaviorNames(domain: DomainDeclaration | null | undefined): string[] {
  return extractNames(domain?.behaviors ?? []);
}

/**
 * Extract API endpoint paths from domain AST
 * Handles ApiBlock with endpoints[] and EndpointDecl with path: StringLiteral
 */
export function getEndpointPaths(domain: DomainDeclaration | null | undefined): string[] {
  const apis = domain?.apis ?? [];
  if (!Array.isArray(apis)) return [];
  const paths: string[] = [];
  for (const api of apis) {
    const endpoints = (api as { endpoints?: unknown[] }).endpoints ?? [];
    for (const ep of endpoints) {
      const pathVal = (ep as { path?: { value?: string } | string }).path;
      const val = pathVal && typeof pathVal === 'object' && 'value' in pathVal
        ? (pathVal as { value?: string }).value
        : typeof pathVal === 'string'
        ? pathVal
        : null;
      if (val) paths.push(val);
    }
  }
  return paths;
}

/**
 * Diff two domain ASTs to find changed entities, behaviors, endpoints
 */
export function diffISLSpecs(
  beforeDomain: DomainDeclaration | null | undefined,
  afterDomain: DomainDeclaration | null | undefined
): IncrementalDiffResult {
  const entitiesBefore = getEntityNames(beforeDomain);
  const entitiesAfter = getEntityNames(afterDomain);
  const behaviorsBefore = getBehaviorNames(beforeDomain);
  const behaviorsAfter = getBehaviorNames(afterDomain);
  const endpointsBefore = getEndpointPaths(beforeDomain);
  const endpointsAfter = getEndpointPaths(afterDomain);

  const entities = diffSets(entitiesBefore, entitiesAfter);
  const behaviors = diffSets(behaviorsBefore, behaviorsAfter);
  const endpoints = diffSets(endpointsBefore, endpointsAfter);

  const hasChanges =
    entities.added.length > 0 ||
    entities.removed.length > 0 ||
    entities.changed.length > 0 ||
    behaviors.added.length > 0 ||
    behaviors.removed.length > 0 ||
    behaviors.changed.length > 0 ||
    endpoints.added.length > 0 ||
    endpoints.removed.length > 0 ||
    endpoints.changed.length > 0;

  return {
    entities,
    behaviors,
    endpoints,
    hasChanges,
  };
}
