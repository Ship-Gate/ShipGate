/**
 * Proof Method Classifier
 *
 * Maps verification evidence sources to their corresponding ProofMethod.
 * Used when building proof certificates from heterogeneous verification outputs.
 *
 * @module @isl-lang/proof
 */

import type { ProofMethod } from './manifest.js';

export interface EvidenceDescriptor {
  /** Evidence type label (e.g. 'smt-check', 'runtime-probe', 'regex-match') */
  type: string;
  /** Source tool or subsystem that produced the evidence */
  source: string;
}

const SMT_KEYWORDS = ['smt', 'z3', 'cvc5', 'solver', 'smt-lib', 'smtlib', 'formal-verification'];
const PBT_KEYWORDS = ['pbt', 'property-based', 'quickcheck', 'fast-check', 'exhaustive', 'hypothesis'];
const STATIC_KEYWORDS = ['tsc', 'typescript', 'ast', 'static', 'eslint', 'semgrep', 'compiler', 'type-check'];
const RUNTIME_KEYWORDS = ['http', 'runtime', 'probe', 'trace', 'request', 'response', 'integration', 'e2e'];

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some(kw => text.includes(kw));
}

/**
 * Classify evidence into a ProofMethod based on its type and source.
 *
 * Classification rules (checked in order of proof strength):
 * 1. SMT-based evidence (z3, cvc5, smt-lib) -> 'smt-proof'
 * 2. Property-based testing with exhaustive coverage -> 'pbt-exhaustive'
 * 3. TypeScript compiler / AST / static analysis tools -> 'static-analysis'
 * 4. HTTP probes / runtime checks / integration tests -> 'runtime-trace'
 * 5. Everything else (regex, pattern matching, heuristics) -> 'heuristic'
 */
export function classifyMethod(evidence: EvidenceDescriptor): ProofMethod {
  const src = evidence.source.toLowerCase();
  const typ = evidence.type.toLowerCase();
  const combined = `${typ} ${src}`;

  if (matchesAny(combined, SMT_KEYWORDS)) {
    return 'smt-proof';
  }
  if (matchesAny(combined, PBT_KEYWORDS)) {
    return 'pbt-exhaustive';
  }
  if (matchesAny(combined, STATIC_KEYWORDS)) {
    return 'static-analysis';
  }
  if (matchesAny(combined, RUNTIME_KEYWORDS)) {
    return 'runtime-trace';
  }
  return 'heuristic';
}

/**
 * Batch-classify an array of evidence descriptors.
 */
export function classifyMethods(evidence: EvidenceDescriptor[]): Map<EvidenceDescriptor, ProofMethod> {
  const result = new Map<EvidenceDescriptor, ProofMethod>();
  for (const e of evidence) {
    result.set(e, classifyMethod(e));
  }
  return result;
}

/**
 * Returns the strongest proof method from a list (lower index = stronger).
 */
export function strongestMethod(methods: ProofMethod[]): ProofMethod | undefined {
  const STRENGTH_ORDER: ProofMethod[] = ['smt-proof', 'pbt-exhaustive', 'static-analysis', 'runtime-trace', 'heuristic'];
  let best: number = STRENGTH_ORDER.length;
  for (const m of methods) {
    const idx = STRENGTH_ORDER.indexOf(m);
    if (idx < best) {
      best = idx;
    }
  }
  return best < STRENGTH_ORDER.length ? STRENGTH_ORDER[best] : undefined;
}
