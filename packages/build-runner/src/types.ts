// ============================================================================
// Build Runner Types
// ============================================================================

import type { DomainDeclaration } from '@isl-lang/parser';
import type { Diagnostic } from '@isl-lang/typechecker';
import type { VerifyResult } from '@isl-lang/verifier-runtime';

/**
 * Target languages for code generation
 */
export type BuildTarget = 'typescript' | 'python' | 'graphql' | 'openapi';

/**
 * Test framework to generate tests for
 */
export type TestFramework = 'vitest' | 'jest';

/**
 * Options for buildRunner.run()
 */
export interface BuildOptions {
  /** Path to the ISL specification file */
  specPath: string;
  
  /** Output directory for generated files */
  outDir: string;
  
  /** Target language for code generation */
  target: BuildTarget;
  
  /** Test framework to use (default: vitest) */
  testFramework?: TestFramework;
  
  /** Whether to run verification (default: true) */
  verify?: boolean;
  
  /** Whether to generate HTML report (default: true) */
  htmlReport?: boolean;
  
  /** Include chaos tests in generation (default: true) */
  includeChaosTests?: boolean;
  
  /** Include helper files in generation (default: true) */
  includeHelpers?: boolean;
  
  /** Enable temporal verification (default: true) */
  verifyTemporal?: boolean;
  
  /** Minimum samples required for temporal verification (default: 10) */
  temporalMinSamples?: number;

  /** Run tests after generation and include in verdict (default: true) */
  runTests?: boolean;

  /** Max fix iterations for failing tests (default: 2) */
  maxTestFixIterations?: number;

  /** Generate Next.js + shadcn/ui frontend (default: false) */
  generateFrontend?: boolean;

  /** Frontend output subdirectory within outDir (default: 'frontend') */
  frontendOutDir?: string;

  /** API-only mode: generate OpenAPI spec + backend, no frontend */
  apiOnly?: boolean;
}

/**
 * A file to be written to the output directory
 */
export interface OutputFile {
  /** Relative path from outDir */
  path: string;
  
  /** File contents */
  content: string;
  
  /** File type for categorization */
  type: 'types' | 'test' | 'helper' | 'config' | 'fixture' | 'evidence' | 'report' | 'openapi';
}

/**
 * Pipeline stage result
 */
export interface StageResult<T> {
  success: boolean;
  data?: T;
  errors: StageError[];
  durationMs: number;
}

/**
 * Error from a pipeline stage
 */
export interface StageError {
  stage: string;
  code: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

/**
 * Result of parsing stage
 */
export interface ParseStageData {
  domain: DomainDeclaration;
  source: string;
}

/**
 * Result of type checking stage
 */
export interface CheckStageData {
  diagnostics: Diagnostic[];
}

/**
 * Result of import resolution stage
 */
export interface ImportStageData {
  resolvedSource: string;
  imports: string[];
}

/**
 * Result of codegen stage
 */
export interface CodegenStageData {
  files: OutputFile[];
}

/**
 * Result of testgen stage
 */
export interface TestgenStageData {
  files: OutputFile[];
  testReport?: {
    passed: number;
    failed: number;
    total: number;
    passRate: number;
    verdict: 'PASS' | 'WARN' | 'FAIL';
    message: string;
    failures: Array<{ file: string; name: string; error: string }>;
  };
}

/**
 * Result of verification stage
 */
export interface VerifyStageData {
  results: VerifyResult[];
  evidence: BuildEvidence;
}

/**
 * Evidence structure for verification results
 */
export interface BuildEvidence {
  /** Version of the build runner */
  version: string;
  
  /** Build identifier (deterministic hash) */
  buildId: string;
  
  /** Input spec path */
  specPath: string;
  
  /** Spec content hash */
  specHash: string;
  
  /** Domain name from spec */
  domainName: string;
  
  /** Domain version from spec */
  domainVersion: string;
  
  /** Summary statistics */
  summary: EvidenceSummary;
  
  /** Individual behavior results */
  behaviors: BehaviorEvidence[];
  
  /** Pipeline timing breakdown */
  timing: PipelineTiming;

  /** Test execution report (X/Y passing, verdict) */
  testReport?: {
    passed: number;
    failed: number;
    total: number;
    passRate: number;
    verdict: 'PASS' | 'WARN' | 'FAIL';
    message: string;
    failures: Array<{ file: string; name: string; error: string }>;
  };
}

/**
 * Summary of verification evidence
 */
export interface EvidenceSummary {
  totalBehaviors: number;
  passedBehaviors: number;
  failedBehaviors: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  overallScore: number;
  verdict: 'verified' | 'risky' | 'unsafe';
  /** Temporal clause summary */
  temporal?: {
    total: number;
    proven: number;
    notProven: number;
    incomplete: number;
    unknown: number;
  };
}

/**
 * Evidence for a single behavior
 */
export interface BehaviorEvidence {
  name: string;
  success: boolean;
  score: number;
  verdict: string;
  preconditions: CheckEvidence[];
  postconditions: CheckEvidence[];
  invariants: CheckEvidence[];
  temporal: TemporalEvidence[];
  inputUsed: string;
  executionDurationMs: number;
}

/**
 * Evidence for a temporal clause verification
 */
export interface TemporalEvidence {
  /** Clause identifier */
  clauseId: string;
  /** Clause type (within, eventually_within, always, never) */
  type: 'within' | 'eventually_within' | 'always' | 'never';
  /** Original clause text */
  clauseText: string;
  /** Verification verdict */
  verdict: 'PROVEN' | 'NOT_PROVEN' | 'INCOMPLETE_PROOF' | 'UNKNOWN';
  /** Whether clause was satisfied */
  passed: boolean;
  /** Timing information */
  timing?: {
    thresholdMs: number;
    percentile?: number;
    actualMs?: number;
    sampleCount?: number;
  };
  /** Error message if any */
  error?: string;
}

/**
 * Evidence for a single check
 */
export interface CheckEvidence {
  expression: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  error?: string;
}

/**
 * Timing breakdown for pipeline stages
 */
export interface PipelineTiming {
  parse: number;
  check: number;
  importResolve: number;
  codegen: number;
  testgen: number;
  verify: number;
  total: number;
}

/**
 * Complete build result
 */
export interface BuildResult {
  /** Whether the build was successful */
  success: boolean;
  
  /** All generated files */
  files: OutputFile[];
  
  /** Evidence JSON if verification was run */
  evidence?: BuildEvidence;
  
  /** All errors from all stages */
  errors: StageError[];
  
  /** Pipeline timing */
  timing: PipelineTiming;
  
  /** Output directory used */
  outDir: string;
  
  /** Manifest of all output files */
  manifest: OutputManifest;
}

/**
 * Manifest of output directory structure
 */
export interface OutputManifest {
  /** Root output directory */
  root: string;
  
  /** All files in deterministic order */
  files: ManifestEntry[];
  
  /** Total file count by type */
  counts: Record<OutputFile['type'], number>;
}

/**
 * Entry in the output manifest
 */
export interface ManifestEntry {
  path: string;
  type: OutputFile['type'];
  sizeBytes: number;
  hash: string;
}
