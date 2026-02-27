/**
 * Proof Generation Module
 * 
 * Generates meaningful test cases from ISL specification clauses.
 * Supports:
 * - Precondition violation tests (invalid inputs should throw)
 * - Postcondition assertion tests (returned structures asserted)
 * - Invariant verification tests
 * - Domain-specific strategies (OAuth, Payments, Uploads)
 * 
 * Output is framework-agnostic templates with vitest/jest adapters.
 */

// Core exports
export { TestGenerator, createTestGenerator } from './testGenerator.js';

// Type exports
export type {
  GeneratedTestCase,
  GeneratedTestSuite,
  TestType,
  TestPriority,
  TestInput,
  TestExpectation,
  TestValue,
  MockSetup,
  ClauseReference,
  ResultAssertion,
  StateAssertion,
  AssertionOperator,
  TestContext,
  ActorContext,
  ValueGenerator,
  TestSetupTemplate,
  TestTeardownTemplate,
  ImportSpec,
  SuiteMetadata,
  TestGenerationStrategy,
  StrategyContext,
  FieldInfo,
  TypeInfo,
  ConstraintInfo,
  ClauseInfo,
  PostconditionInfo,
  ErrorInfo,
  TestFrameworkAdapter,
  RenderedTestOutput,
  TestGeneratorConfig,
} from './testGenTypes.js';

export { DEFAULT_CONFIG } from './testGenTypes.js';

// Strategy exports
export {
  oauthStrategy,
  paymentsStrategy,
  uploadsStrategy,
  allStrategies,
  getStrategy,
  getStrategiesForDomain,
} from './strategies/index.js';
