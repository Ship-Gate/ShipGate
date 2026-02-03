// ============================================================================
// @isl-lang/test-generator
// Generate executable tests with domain-specific assertions from ISL specs
// ============================================================================

// Main generators
export { generate, generateWithSynthesis } from './generator';
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
  GeneratedFile,
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
