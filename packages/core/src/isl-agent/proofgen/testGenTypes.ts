/**
 * Test Generation Types
 * 
 * Types for generating framework-agnostic test cases from ISL specifications.
 * Supports precondition violation tests, postcondition assertion tests,
 * and invariant verification tests.
 */

// ============================================================================
// Core Test Types
// ============================================================================

/**
 * Test case generated from ISL specification
 */
export interface GeneratedTestCase {
  /** Unique identifier for the test */
  id: string;
  /** Human-readable name for the test */
  name: string;
  /** Description of what the test verifies */
  description: string;
  /** The behavior being tested */
  behaviorName: string;
  /** Type of test */
  testType: TestType;
  /** Source clause that generated this test */
  sourceClause: ClauseReference;
  /** Test input values */
  input: TestInput;
  /** Expected outcome */
  expected: TestExpectation;
  /** Tags for filtering/categorization */
  tags: string[];
  /** Priority level */
  priority: TestPriority;
}

/**
 * Type of test being generated
 */
export type TestType =
  | 'precondition_violation'  // Test that invalid inputs throw
  | 'postcondition_success'   // Test that valid inputs produce expected state
  | 'postcondition_failure'   // Test error case postconditions
  | 'invariant_hold'          // Test that invariants are maintained
  | 'scenario'                // Test from defined scenario
  | 'boundary'                // Boundary value test
  | 'negative';               // Negative/error path test

/**
 * Priority levels for tests
 */
export type TestPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Reference to the source clause in the ISL spec
 */
export interface ClauseReference {
  /** Type of clause */
  clauseType: 'precondition' | 'postcondition' | 'invariant' | 'scenario' | 'temporal';
  /** Index within the clause array */
  index: number;
  /** Original expression as string */
  expression: string;
  /** Line number in source */
  line?: number;
}

// ============================================================================
// Test Input Types
// ============================================================================

/**
 * Input values for a test case
 */
export interface TestInput {
  /** Named parameters */
  params: Record<string, TestValue>;
  /** Mock entities to set up */
  mocks?: MockSetup[];
  /** Context/environment setup */
  context?: TestContext;
}

/**
 * A value used in testing
 */
export type TestValue =
  | { type: 'literal'; value: string | number | boolean | null | Record<string, unknown> | unknown[] }
  | { type: 'generated'; generator: ValueGenerator }
  | { type: 'reference'; path: string }
  | { type: 'invalid'; reason: string; value?: unknown };

/**
 * Value generator for dynamic test values
 */
export interface ValueGenerator {
  kind: 'uuid' | 'timestamp' | 'random_string' | 'random_number' | 'email' | 'custom';
  constraints?: Record<string, unknown>;
}

/**
 * Mock entity setup
 */
export interface MockSetup {
  /** Entity name */
  entity: string;
  /** Method to mock (exists, lookup, etc.) */
  method: string;
  /** Arguments to match */
  args?: Record<string, TestValue>;
  /** Return value */
  returns: TestValue;
}

/**
 * Test context/environment
 */
export interface TestContext {
  /** Authenticated actor */
  actor?: ActorContext;
  /** Config overrides */
  config?: Record<string, unknown>;
  /** Time overrides */
  time?: { now?: string };
}

/**
 * Actor context for auth-required behaviors
 */
export interface ActorContext {
  type: string;
  id?: string;
  authenticated: boolean;
  roles?: string[];
  permissions?: string[];
}

// ============================================================================
// Test Expectation Types
// ============================================================================

/**
 * Expected outcome of a test
 */
export interface TestExpectation {
  /** Expected outcome type */
  outcome: 'success' | 'error' | 'throw';
  /** For success: assertions on result */
  assertions?: ResultAssertion[];
  /** For error: expected error code */
  errorCode?: string;
  /** For throw: expected exception type */
  exceptionType?: string;
  /** State changes to verify */
  stateChanges?: StateAssertion[];
}

/**
 * Assertion on a result value
 */
export interface ResultAssertion {
  /** Path to value (e.g., 'result.id', 'result.status') */
  path: string;
  /** Assertion operator */
  operator: AssertionOperator;
  /** Expected value */
  expected: TestValue;
}

/**
 * Assertion operators
 */
export type AssertionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'matches'
  | 'is_truthy'
  | 'is_falsy'
  | 'is_null'
  | 'is_not_null'
  | 'has_length'
  | 'has_property';

/**
 * State change assertion
 */
export interface StateAssertion {
  /** Entity name */
  entity: string;
  /** Lookup method/key */
  lookup: Record<string, TestValue>;
  /** Property to check */
  property: string;
  /** Expected value after operation */
  expected: TestValue;
}

// ============================================================================
// Test Suite Types
// ============================================================================

/**
 * A suite of generated tests for a behavior
 */
export interface GeneratedTestSuite {
  /** Behavior name */
  behaviorName: string;
  /** Domain name */
  domainName: string;
  /** Domain version */
  version: string;
  /** All generated tests */
  tests: GeneratedTestCase[];
  /** Setup code template */
  setup?: TestSetupTemplate;
  /** Teardown code template */
  teardown?: TestTeardownTemplate;
  /** Generation metadata */
  metadata: SuiteMetadata;
}

/**
 * Setup template for test suite
 */
export interface TestSetupTemplate {
  /** Imports needed */
  imports: ImportSpec[];
  /** Mock factory calls */
  mocks: string[];
  /** Setup statements */
  statements: string[];
}

/**
 * Teardown template
 */
export interface TestTeardownTemplate {
  /** Cleanup statements */
  statements: string[];
}

/**
 * Import specification
 */
export interface ImportSpec {
  module: string;
  imports: string[];
  isDefault?: boolean;
}

/**
 * Suite generation metadata
 */
export interface SuiteMetadata {
  /** When the suite was generated */
  generatedAt: string;
  /** Generator version */
  generatorVersion: string;
  /** Source spec fingerprint */
  specFingerprint: string;
  /** Statistics */
  stats: {
    preconditionTests: number;
    postconditionTests: number;
    invariantTests: number;
    scenarioTests: number;
    totalTests: number;
  };
}

// ============================================================================
// Strategy Types
// ============================================================================

/**
 * Domain-specific test generation strategy
 */
export interface TestGenerationStrategy {
  /** Strategy identifier */
  id: string;
  /** Strategy name */
  name: string;
  /** Domains this strategy applies to */
  appliesTo: string[];
  /** Generate additional test cases */
  generateTests(context: StrategyContext): GeneratedTestCase[];
  /** Generate domain-specific mocks */
  generateMocks(context: StrategyContext): MockSetup[];
  /** Get domain-specific imports */
  getImports(): ImportSpec[];
}

/**
 * Context provided to strategies
 */
export interface StrategyContext {
  /** Domain name */
  domainName: string;
  /** Behavior being tested */
  behaviorName: string;
  /** Input fields */
  inputFields: FieldInfo[];
  /** Output type */
  outputType: TypeInfo;
  /** Preconditions */
  preconditions: ClauseInfo[];
  /** Postconditions */
  postconditions: PostconditionInfo[];
  /** Invariants */
  invariants: ClauseInfo[];
  /** Errors */
  errors: ErrorInfo[];
}

/**
 * Field information for strategy
 */
export interface FieldInfo {
  name: string;
  typeName: string;
  optional: boolean;
  constraints: ConstraintInfo[];
  annotations: string[];
}

/**
 * Type information
 */
export interface TypeInfo {
  kind: 'primitive' | 'entity' | 'struct' | 'list' | 'map' | 'enum' | 'reference';
  name: string;
  fields?: FieldInfo[];
}

/**
 * Constraint information
 */
export interface ConstraintInfo {
  name: string;
  value: unknown;
}

/**
 * Clause information
 */
export interface ClauseInfo {
  index: number;
  expression: string;
  line?: number;
}

/**
 * Postcondition information
 */
export interface PostconditionInfo {
  condition: 'success' | 'failure' | string;
  predicates: ClauseInfo[];
}

/**
 * Error information
 */
export interface ErrorInfo {
  name: string;
  when?: string;
  retriable: boolean;
}

// ============================================================================
// Output Template Types
// ============================================================================

/**
 * Framework adapter for rendering tests
 */
export interface TestFrameworkAdapter {
  /** Framework name */
  name: 'vitest' | 'jest' | 'mocha' | 'custom';
  /** Render a test suite to code */
  render(suite: GeneratedTestSuite): string;
  /** Get framework-specific imports */
  getFrameworkImports(): ImportSpec[];
}

/**
 * Rendered test output
 */
export interface RenderedTestOutput {
  /** File path for the test */
  filePath: string;
  /** File content */
  content: string;
  /** Framework used */
  framework: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Test generator configuration
 */
export interface TestGeneratorConfig {
  /** Include precondition violation tests */
  includePreconditionTests: boolean;
  /** Include postcondition assertion tests */
  includePostconditionTests: boolean;
  /** Include invariant tests */
  includeInvariantTests: boolean;
  /** Include scenario-based tests */
  includeScenarioTests: boolean;
  /** Generate boundary value tests */
  generateBoundaryTests: boolean;
  /** Strategies to apply */
  strategies: string[];
  /** Framework adapter */
  framework: 'vitest' | 'jest' | 'mocha';
  /** Output directory */
  outputDir: string;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: TestGeneratorConfig = {
  includePreconditionTests: true,
  includePostconditionTests: true,
  includeInvariantTests: true,
  includeScenarioTests: true,
  generateBoundaryTests: true,
  strategies: ['oauth', 'payments', 'uploads'],
  framework: 'vitest',
  outputDir: '.shipgate/tests',
};
