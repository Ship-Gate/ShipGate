/**
 * ISL Pipeline
 * 
 * Complete flow: NL → ISL → Code → Gate → Proof
 * 
 * Includes self-healing: keeps iterating until code passes the gate.
 * 
 * @module @isl-lang/pipeline
 */

export {
  ISLPipeline,
  createPipeline,
  runPipeline,
} from './pipeline.js';

export type {
  PipelineInput,
  PipelineOptions,
  PipelineResult,
} from './pipeline.js';

// Self-healing pipeline
export {
  SelfHealingPipeline,
  selfHeal,
} from './self-healing.js';

export type {
  HealingResult,
  HealingIteration,
  HealingOptions,
} from './self-healing.js';

// Re-export from dependencies for convenience
export { createTranslator, type ISLAST, type RepoContext, type TranslationResult } from '@isl-lang/translator';
export { createGenerator, type GenerationResult, type ProofLink, type FileDiff } from '@isl-lang/generator';
export { createProofBundle, formatProofBundle, type ProofBundle } from '@isl-lang/proof';
