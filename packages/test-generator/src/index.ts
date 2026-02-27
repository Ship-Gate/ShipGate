// ============================================================================
// @isl-lang/test-generator
// Generate executable tests with domain-specific assertions from ISL specs
// ============================================================================

// Main generators
export { generate, generateTests, generateWithSynthesis } from './generator';
export type { EnhancedGenerateOptions } from './generator';

// Data synthesis
export {
  synthesizeInputs,
  generateSeed,
  SeededRandom,
  extractConstraints,
  generateTypicalValue,
} from './data-synthesizer';
export type {
  SynthesizedInput,
  DataTrace,
  ConstraintSummary,
  ExpectedOutcome,
  TypeConstraints,
  SynthesisOptions,
} from './data-synthesizer';

// Expected outcome synthesis
export {
  synthesizeExpectedOutcome,
  compilePostconditionExpression,
  compileToAssertion,
  compileBinaryToAssertion,
  compileQuantifierToAssertion,
  compileTemporalAssertion,
  compileSecurityAssertion,
  compileLifecycleAssertion,
  compileNegativeAssertion,
  durationToMs,
  expressionToDescription,
  inferResultTypeAssertions,
} from './expected-outcome';
export type {
  ComputedAssertion,
  ExpectedOutcomeResult,
} from './expected-outcome';

// Test code emission
export {
  emitTestFile,
  formatInputObject,
  formatValue,
  generateDataTraceComment,
} from './test-code-emitter';
export type {
  EmittedTest,
  EmittedTestFile,
  EmitOptions,
} from './test-code-emitter';

// Types
export type {
  TestFramework,
  DomainType,
  AssertionStatus,
  GenerateOptions,
  GenerateResult,
  GeneratorError,
  ErrorCode,
  GenerationMetadata,
  BehaviorMetadata,
  AssertionMetadata,
  AssertionPattern,
  OpenQuestion,
  CoverageInfo,
  GenerationStats,
  DomainStrategy,
  StrategyContext,
  GeneratedAssertion,
  TestBlock,
  PreconditionTest,
  PostconditionTest,
  ErrorTest,
  CompilerContext,
} from './types';

// Re-export GeneratedFile from types (not golden-adapter to avoid conflict)
export type { GeneratedFile } from './types';

// Strategies
export {
  getStrategy,
  getAllStrategies,
  registerStrategy,
  detectDomain,
  BaseDomainStrategy,
  AuthStrategy,
  PaymentsStrategy,
  UploadsStrategy,
  WebhooksStrategy,
  GenericStrategy,
} from './strategies';

// Golden testing harness adapter
export {
  createTestGeneratorAdapter,
  vitestGenerator,
  jestGenerator,
} from './golden-adapter';
export type { CodeGenerator as GoldenCodeGenerator, GeneratedFile as GoldenGeneratedFile } from './golden-adapter';

// File writer
export {
  writeFiles,
  generateSnapshotFile,
} from './file-writer';
export type { WriteOptions, WriteResult } from './file-writer';

// Scenario generator
export {
  generateScenarioTests,
} from './scenario-generator';
export type { ScenarioTest } from './scenario-generator';

// Execution verifier
export {
  verifyGeneratedTests,
} from './execution-verifier';
export type { VerificationOptions, VerificationResult } from './execution-verifier';
