/**
 * Verdict Scoring Module
 * 
 * Provides deterministic, explainable scoring of ISL claims and evidence
 * to produce SHIP/WARN/NO_SHIP verdicts.
 * 
 * @module @isl-lang/gate/verdict-scoring
 */

export * from './types.js';
export * from './scorer.js';
export { scoreVerdicts } from './scorer.js';
export * from './report.js';
