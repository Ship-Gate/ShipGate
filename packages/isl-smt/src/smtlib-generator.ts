/**
 * SMT-LIB Generator with Source Mapping
 *
 * Generates SMT-LIB2 scripts from ISL pre/post/invariant conditions with
 * traceable source mapping so that solver results can be mapped back to
 * the original ISL source locations.
 *
 * Each assertion is tagged with a named annotation:
 *   (assert (! <expr> :named <tag>))
 *
 * The tag encodes: kind (pre/post/inv), behavior name, and condition index.
 * An accompanying SourceMap lets callers resolve tags → ISL source locations.
 */

import type { SMTExpr, SMTDecl } from '@isl-lang/prover';
import { toSMTLib, declToSMTLib, Expr, Decl, Sort } from '@isl-lang/prover';
import type {
  ConditionStatement,
  ConditionBlock,
  TypeConstraint,
} from '@isl-lang/isl-core/ast';
import {
  encodeCondition,
  encodeTypeConstraint,
  createContext,
  islTypeToSort,
  type EncodingContext,
} from './encoder.js';

// ============================================================================
// Source Mapping Types
// ============================================================================

/**
 * A single source-mapped assertion in the generated SMT-LIB.
 */
export interface SourceMappedAssertion {
  /** Unique tag used in (assert (! ... :named <tag>)) */
  tag: string;
  /** Kind of ISL condition */
  kind: 'precondition' | 'postcondition' | 'invariant' | 'refinement';
  /** Behavior or type name this assertion belongs to */
  ownerName: string;
  /** Zero-based index within its group */
  index: number;
  /** Original ISL source text (best-effort) */
  islSource?: string;
  /** Source location in the ISL file */
  location?: { line: number; column: number };
  /** The SMT-LIB expression string for this assertion */
  smtLib: string;
  /** The encoded SMTExpr (for downstream analysis) */
  expr?: SMTExpr;
}

/**
 * Complete source map for a generated SMT-LIB script.
 */
export interface SMTSourceMap {
  /** All source-mapped assertions, keyed by tag */
  assertions: Map<string, SourceMappedAssertion>;
  /** Lookup by kind */
  byKind(kind: SourceMappedAssertion['kind']): SourceMappedAssertion[];
  /** Lookup by owner name */
  byOwner(name: string): SourceMappedAssertion[];
  /** Resolve a tag to its source mapping */
  resolve(tag: string): SourceMappedAssertion | undefined;
}

/**
 * Result of SMT-LIB generation.
 */
export interface GeneratedSMTLib {
  /** The complete SMT-LIB2 script */
  script: string;
  /** Source map for tracing results back to ISL */
  sourceMap: SMTSourceMap;
  /** Encoding errors encountered (non-fatal) */
  errors: string[];
}

// ============================================================================
// Generator Options
// ============================================================================

export interface SMTLibGeneratorOptions {
  /** Timeout hint for the solver (ms). Embedded as (set-option :timeout N). */
  timeoutMs?: number;
  /** Logic to declare. Default: 'ALL' */
  logic?: string;
  /** Whether to request models. Default: true */
  produceModels?: boolean;
  /** Whether to produce unsat cores (requires named assertions). Default: true */
  produceUnsatCores?: boolean;
}

const DEFAULT_OPTIONS: Required<SMTLibGeneratorOptions> = {
  timeoutMs: 10_000,
  logic: 'ALL',
  produceModels: true,
  produceUnsatCores: true,
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate SMT-LIB from a set of ISL preconditions.
 */
export function generateFromPreconditions(
  behaviorName: string,
  conditions: ConditionStatement[],
  ctx: EncodingContext,
  options: SMTLibGeneratorOptions = {},
): GeneratedSMTLib {
  return generateFromConditions('precondition', behaviorName, conditions, ctx, options);
}

/**
 * Generate SMT-LIB from a set of ISL postconditions (implication check).
 *
 * Encodes: (pre₁ ∧ ... ∧ preₙ) ⇒ (post₁ ∧ ... ∧ postₘ)
 * Checking validity = checking UNSAT of (pre ∧ ¬post).
 */
export function generateFromPostconditions(
  behaviorName: string,
  preconditions: ConditionStatement[],
  postconditions: ConditionStatement[],
  ctx: EncodingContext,
  options: SMTLibGeneratorOptions = {},
): GeneratedSMTLib {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const entries: SourceMappedAssertion[] = [];
  const errors: string[] = [];
  const lines: string[] = [];
  const declarations: SMTDecl[] = [];

  // Preamble
  lines.push(...preamble(opts, `postcondition implication for ${behaviorName}`));

  // Variable declarations
  for (const [name, sort] of ctx.variables) {
    const decl = Decl.const(name, sort);
    declarations.push(decl);
    lines.push(declToSMTLib(decl));
  }
  lines.push('');

  // Assert preconditions (assumptions)
  lines.push('; --- Preconditions (assumptions) ---');
  for (let i = 0; i < preconditions.length; i++) {
    const cond = preconditions[i]!;
    const encoded = encodeCondition(cond, ctx);
    if (!encoded.success) {
      errors.push(`pre[${i}]: ${encoded.error}`);
      continue;
    }
    const tag = makeTag('pre', behaviorName, i);
    const smtStr = toSMTLib(encoded.expr);
    lines.push(`(assert (! ${smtStr} :named ${tag}))`);

    entries.push({
      tag,
      kind: 'precondition',
      ownerName: behaviorName,
      index: i,
      islSource: extractSourceText(cond),
      location: extractLocation(cond),
      smtLib: smtStr,
      expr: encoded.expr,
    });
  }

  // Assert negated postconditions (counterexample search)
  lines.push('');
  lines.push('; --- Negated postconditions (counterexample search) ---');
  const postExprs: SMTExpr[] = [];
  for (let i = 0; i < postconditions.length; i++) {
    const cond = postconditions[i]!;
    const encoded = encodeCondition(cond, ctx);
    if (!encoded.success) {
      errors.push(`post[${i}]: ${encoded.error}`);
      continue;
    }
    postExprs.push(encoded.expr);

    const tag = makeTag('post', behaviorName, i);
    entries.push({
      tag,
      kind: 'postcondition',
      ownerName: behaviorName,
      index: i,
      islSource: extractSourceText(cond),
      location: extractLocation(cond),
      smtLib: toSMTLib(encoded.expr),
      expr: encoded.expr,
    });
  }

  if (postExprs.length > 0) {
    const postConj = postExprs.length === 1 ? postExprs[0]! : Expr.and(...postExprs);
    const negPost = Expr.not(postConj);
    const negTag = makeTag('neg_post', behaviorName, 0);
    lines.push(`(assert (! ${toSMTLib(negPost)} :named ${negTag}))`);
  }

  // Check-sat & get diagnostics
  lines.push('');
  lines.push('(check-sat)');
  if (opts.produceModels) lines.push('(get-model)');
  if (opts.produceUnsatCores) lines.push('(get-unsat-core)');

  return {
    script: lines.join('\n'),
    sourceMap: buildSourceMap(entries),
    errors,
  };
}

/**
 * Generate SMT-LIB from ISL type refinement constraints.
 */
export function generateFromRefinements(
  typeName: string,
  baseType: string,
  constraints: TypeConstraint[],
  options: SMTLibGeneratorOptions = {},
): GeneratedSMTLib {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const entries: SourceMappedAssertion[] = [];
  const errors: string[] = [];
  const lines: string[] = [];

  const ctx = createContext();
  const baseSort = islTypeToSort(baseType);
  ctx.variables.set('x', baseSort);

  lines.push(...preamble(opts, `refinement constraints for ${typeName}`));
  lines.push(declToSMTLib(Decl.const('x', baseSort)));
  lines.push('');

  for (let i = 0; i < constraints.length; i++) {
    const constraint = constraints[i]!;
    const encoded = encodeTypeConstraint(constraint, 'x', ctx);
    if (!encoded.success) {
      errors.push(`constraint[${i}]: ${encoded.error}`);
      continue;
    }
    const tag = makeTag('ref', typeName, i);
    const smtStr = toSMTLib(encoded.expr);
    lines.push(`(assert (! ${smtStr} :named ${tag}))`);

    entries.push({
      tag,
      kind: 'refinement',
      ownerName: typeName,
      index: i,
      islSource: constraint.name?.name,
      smtLib: smtStr,
      expr: encoded.expr,
    });
  }

  lines.push('');
  lines.push('(check-sat)');
  if (opts.produceModels) lines.push('(get-model)');
  if (opts.produceUnsatCores) lines.push('(get-unsat-core)');

  return {
    script: lines.join('\n'),
    sourceMap: buildSourceMap(entries),
    errors,
  };
}

/**
 * Generate SMT-LIB from ISL invariant expressions.
 */
export function generateFromInvariants(
  domainName: string,
  invariants: ConditionStatement[],
  ctx: EncodingContext,
  options: SMTLibGeneratorOptions = {},
): GeneratedSMTLib {
  return generateFromConditions('invariant', domainName, invariants, ctx, options);
}

// ============================================================================
// Internal Helpers
// ============================================================================

function generateFromConditions(
  kind: 'precondition' | 'postcondition' | 'invariant',
  ownerName: string,
  conditions: ConditionStatement[],
  ctx: EncodingContext,
  options: SMTLibGeneratorOptions,
): GeneratedSMTLib {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const entries: SourceMappedAssertion[] = [];
  const errors: string[] = [];
  const lines: string[] = [];

  const kindPrefix = kind === 'precondition' ? 'pre' : kind === 'postcondition' ? 'post' : 'inv';

  lines.push(...preamble(opts, `${kind}s for ${ownerName}`));

  // Variable declarations
  for (const [name, sort] of ctx.variables) {
    lines.push(declToSMTLib(Decl.const(name, sort)));
  }
  lines.push('');

  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i]!;
    const encoded = encodeCondition(cond, ctx);
    if (!encoded.success) {
      errors.push(`${kindPrefix}[${i}]: ${encoded.error}`);
      continue;
    }
    const tag = makeTag(kindPrefix, ownerName, i);
    const smtStr = toSMTLib(encoded.expr);
    lines.push(`(assert (! ${smtStr} :named ${tag}))`);

    entries.push({
      tag,
      kind,
      ownerName,
      index: i,
      islSource: extractSourceText(cond),
      location: extractLocation(cond),
      smtLib: smtStr,
      expr: encoded.expr,
    });
  }

  lines.push('');
  lines.push('(check-sat)');
  if (opts.produceModels) lines.push('(get-model)');
  if (opts.produceUnsatCores) lines.push('(get-unsat-core)');

  return {
    script: lines.join('\n'),
    sourceMap: buildSourceMap(entries),
    errors,
  };
}

function preamble(opts: Required<SMTLibGeneratorOptions>, comment: string): string[] {
  return [
    `; ISL SMT-LIB — ${comment}`,
    `; Generated at ${new Date().toISOString()}`,
    `(set-logic ${opts.logic})`,
    ...(opts.produceModels ? ['(set-option :produce-models true)'] : []),
    ...(opts.produceUnsatCores ? ['(set-option :produce-unsat-cores true)'] : []),
    `(set-option :timeout ${opts.timeoutMs})`,
    '',
  ];
}

function makeTag(prefix: string, owner: string, index: number): string {
  // Sanitize owner name for SMT-LIB symbol rules (alphanumeric + _ only)
  const safe = owner.replace(/[^a-zA-Z0-9_]/g, '_');
  return `${prefix}_${safe}_${index}`;
}

function extractSourceText(cond: ConditionStatement): string | undefined {
  // Best-effort: if the expression has a raw property, use it
  const expr = cond.expression as any;
  if (expr?.raw) return expr.raw;
  if (expr?.kind === 'Identifier') return expr.name;
  return undefined;
}

function extractLocation(cond: ConditionStatement): { line: number; column: number } | undefined {
  const span = (cond as any).span ?? (cond as any).loc;
  if (span?.start) {
    return { line: span.start.line, column: span.start.column };
  }
  return undefined;
}

function buildSourceMap(entries: SourceMappedAssertion[]): SMTSourceMap {
  const map = new Map<string, SourceMappedAssertion>();
  for (const e of entries) {
    map.set(e.tag, e);
  }

  return {
    assertions: map,
    byKind(kind) {
      return entries.filter((e) => e.kind === kind);
    },
    byOwner(name) {
      return entries.filter((e) => e.ownerName === name);
    },
    resolve(tag) {
      return map.get(tag);
    },
  };
}
