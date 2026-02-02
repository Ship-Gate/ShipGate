/**
 * ISL Pipeline
 * 
 * Complete flow: NL → ISL → Code → Gate → Proof
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

// Re-export from dependencies for convenience
export { createTranslator, type ISLAST, type RepoContext, type TranslationResult } from '@isl-lang/translator';
export { createGenerator, type GenerationResult, type ProofLink } from '@isl-lang/generator';
export { createProofBundle, formatProofBundle, type ProofBundle } from '@isl-lang/proof';
