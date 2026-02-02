// ============================================================================
// @isl-lang/test-generator
// Generate executable tests with domain-specific assertions from ISL specs
// ============================================================================

// Main generator
export { generate } from './generator';

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
