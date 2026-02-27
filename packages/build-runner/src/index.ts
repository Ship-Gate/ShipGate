// ============================================================================
// ISL Build Runner - Public API
// ============================================================================

/**
 * End-to-end build runner for ISL specifications.
 * 
 * Performs: parse -> check -> import-resolve -> codegen -> testgen -> verify
 * Outputs: TypeScript types, tests, evidence JSON, HTML report
 * 
 * All outputs are deterministic with stable ordering and no timestamps.
 * 
 * @example
 * ```typescript
 * import { buildRunner } from '@isl-lang/build-runner';
 * 
 * const result = await buildRunner.run({
 *   specPath: './spec.isl',
 *   outDir: './generated',
 *   target: 'typescript',
 * });
 * 
 * if (result.success) {
 *   console.log(`Generated ${result.files.length} files`);
 *   console.log(`Overall score: ${result.evidence?.summary.overallScore}`);
 * }
 * ```
 */

// Main runner
export { run, buildRunner, default as buildRunnerDefault } from './runner.js';

// Types
export type {
  // Options
  BuildOptions,
  BuildTarget,
  TestFramework,
  
  // Results
  BuildResult,
  OutputFile,
  OutputManifest,
  ManifestEntry,
  
  // Evidence
  BuildEvidence,
  EvidenceSummary,
  BehaviorEvidence,
  CheckEvidence,
  PipelineTiming,
  
  // Stage types
  StageResult,
  StageError,
  ParseStageData,
  CheckStageData,
  ImportStageData,
  CodegenStageData,
  TestgenStageData,
  VerifyStageData,
} from './types.js';

// Pipeline stages (for advanced usage)
export {
  parseStage,
  checkStage,
  importResolveStage,
  codegenStage,
  testgenStage,
  verifyStage,
} from './pipeline.js';

// Output utilities
export {
  OUTPUT_STRUCTURE,
  hashContent,
  createDeterministicBuildId,
  sortFilesDeterministically,
  writeOutputFiles,
  generateManifestContent,
  cleanOutputDir,
  getOutputPath,
  normalizePath,
} from './output.js';

// Evidence generation
export {
  generateEvidenceJson,
  generateEvidenceHtml,
} from './evidence.js';
