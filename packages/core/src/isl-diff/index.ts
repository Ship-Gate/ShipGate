/**
 * ISL Diff Engine
 *
 * Deterministic diff calculation between two ISL ASTs.
 *
 * @example
 * ```typescript
 * import { diffSpec, formatDiff } from '@isl-lang/core/isl-diff';
 *
 * const diff = diffSpec(oldDomain, newDomain);
 * console.log(formatDiff(diff, { colors: true }));
 * ```
 */

export { diffSpec } from './diff.js';
export { formatDiff, formatDiffJson, formatDiffOneLine } from './formatDiff.js';
export type { FormatOptions } from './formatDiff.js';

export type {
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
