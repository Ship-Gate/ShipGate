/**
 * ISL Pipeline Module
 *
 * Provides the core verification pipeline that orchestrates:
 * context extraction → translation → validation → generation → verification → scoring
 */

// Main pipeline function
export { runPipeline, runPipelineWithAst, runPipelineWithPrompt } from './runPipeline.js';

// Types
export type {
  PipelineInput,
  PipelineInputMode,
  PipelineOptions,
  PipelineResult,
  PipelineState,
  PipelineStatus,
  StepResult,
  ContextStepResult,
  TranslateStepResult,
  ValidateStepResult,
  GenerateStepResult,
  VerifyStepResult,
  ScoreStepResult,
  AnyStepResult,
  ClauseInfo,
} from './pipelineTypes.js';

// Step functions (for advanced usage)
export {
  runContextStep,
  runTranslateStep,
  runValidateStep,
  runGenerateStep,
  runVerifyStep,
  runScoreStep,
  isValidDomainAst,
} from './steps/index.js';
