// ============================================================================
// Executable Test Types
// Types for binding tests to real implementations
// ============================================================================

import type * as AST from '@isl-lang/parser';

/** Supported target languages */
export type TargetLanguage = 'typescript' | 'go' | 'python';

/** Test framework per language */
export type TestFramework = 
  | 'vitest' | 'jest'           // TypeScript
  | 'go-test'                    // Go
  | 'pytest' | 'unittest';       // Python

/** Options for generating executable tests */
export interface ExecutableTestOptions {
  /** Target language */
  language: TargetLanguage;
  /** Test framework to use */
  framework: TestFramework;
  /** Output directory */
  outputDir: string;
  /** Path to implementation module */
  implementationPath: string;
  /** Whether to generate contract violation tests */
  generateViolationTests?: boolean;
  /** Whether to generate property-based tests */
  generatePropertyTests?: boolean;
  /** Custom import mappings */
  importMappings?: Record<string, string>;
}

/** Result of generating executable tests */
export interface ExecutableTestResult {
  success: boolean;
  files: ExecutableTestFile[];
  errors: TestGenerationError[];
  bindings: TestBinding[];
}

/** A generated executable test file */
export interface ExecutableTestFile {
  path: string;
  content: string;
  type: 'test' | 'helper' | 'fixture' | 'config';
  language: TargetLanguage;
}

/** Error during test generation */
export interface TestGenerationError {
  message: string;
  code: string;
  location?: AST.SourceLocation;
  severity: 'error' | 'warning';
}

/** Binding between ISL contract and implementation */
export interface TestBinding {
  /** Behavior name from ISL */
  behaviorName: string;
  /** Implementation function/method name */
  implementationName: string;
  /** Module path where implementation lives */
  modulePath: string;
  /** Input type binding */
  inputType: TypeBinding;
  /** Output type binding */
  outputType: TypeBinding;
  /** Bound postconditions */
  postconditions: PostconditionBinding[];
  /** Bound preconditions */
  preconditions: PreconditionBinding[];
  /** Bound error specifications */
  errors: ErrorBinding[];
}

/** Type binding between ISL and implementation */
export interface TypeBinding {
  /** ISL type name */
  islType: string;
  /** Implementation type */
  implType: string;
  /** Field mappings if struct/object */
  fieldMappings?: Record<string, string>;
}

/** Bound postcondition that can be asserted */
export interface PostconditionBinding {
  /** Original ISL expression */
  expression: AST.Expression;
  /** Compiled assertion code */
  assertionCode: string;
  /** Condition under which this postcondition applies */
  condition: 'success' | 'error' | string;
  /** Description for test output */
  description: string;
  /** Whether this assertion is expected to fail on contract violation */
  failsOnViolation: boolean;
}

/** Bound precondition */
export interface PreconditionBinding {
  /** Original ISL expression */
  expression: AST.Expression;
  /** Compiled validation code */
  validationCode: string;
  /** Description */
  description: string;
  /** Input that would violate this precondition */
  violatingInput?: string;
}

/** Bound error specification */
export interface ErrorBinding {
  /** Error name */
  name: string;
  /** When this error occurs */
  when: string;
  /** Whether error is retriable */
  retriable: boolean;
  /** Input that triggers this error */
  triggerInput: string;
  /** Assertion code for this error */
  assertionCode: string;
}

/** Contract assertion that fails when violated */
export interface ContractAssertion {
  /** Type of assertion */
  type: 'precondition' | 'postcondition' | 'invariant' | 'error';
  /** Assertion code */
  code: string;
  /** What it checks */
  description: string;
  /** Whether it should fail test on violation */
  failOnViolation: boolean;
}

/** Language-specific adapter interface */
export interface LanguageAdapter {
  /** Target language */
  language: TargetLanguage;
  
  /** Generate test file header/imports */
  generateHeader(options: ExecutableTestOptions, binding: TestBinding): string;
  
  /** Generate test setup/teardown */
  generateSetup(binding: TestBinding): string;
  
  /** Generate a postcondition assertion */
  generatePostconditionAssertion(
    postcondition: PostconditionBinding,
    binding: TestBinding
  ): string;
  
  /** Generate a precondition validation test */
  generatePreconditionTest(
    precondition: PreconditionBinding,
    binding: TestBinding
  ): string;
  
  /** Generate an error case test */
  generateErrorTest(
    error: ErrorBinding,
    binding: TestBinding
  ): string;
  
  /** Generate contract violation test that MUST fail */
  generateViolationTest(
    postcondition: PostconditionBinding,
    binding: TestBinding
  ): string;
  
  /** Generate the full test file */
  generateTestFile(
    behavior: AST.Behavior,
    domain: AST.Domain,
    binding: TestBinding,
    options: ExecutableTestOptions
  ): string;
  
  /** Compile ISL expression to target language */
  compileExpression(expr: AST.Expression, context: CompilationContext): string;
}

/** Context for expression compilation */
export interface CompilationContext {
  /** Entity names in scope */
  entityNames: string[];
  /** Whether inside old() expression */
  inOldExpr: boolean;
  /** Variable bindings */
  variables: Map<string, string>;
  /** Import statements needed */
  imports: Set<string>;
}

/** State capture for old() expressions */
export interface StateCaptureSpec {
  /** Variable name for captured state */
  variableName: string;
  /** Expression to capture */
  captureExpression: string;
  /** When to capture (before execution) */
  capturePoint: 'before' | 'after';
}
