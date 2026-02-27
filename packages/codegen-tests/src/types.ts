// ============================================================================
// Test Generator Types
// ============================================================================

import type * as AST from '@isl-lang/parser';

export type TestFramework = 'jest' | 'vitest';

export interface GenerateOptions {
  framework: TestFramework;
  outputDir?: string;
  includeHelpers?: boolean;
  includePropertyTests?: boolean;
  includeChaosTests?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'test' | 'fixture' | 'helper' | 'config';
}

export interface GenerateResult {
  success: boolean;
  files: GeneratedFile[];
  errors: GeneratorError[];
}

export interface GeneratorError {
  message: string;
  location?: AST.SourceLocation;
  code: string;
}

export interface TestBlock {
  name: string;
  type: 'describe' | 'it' | 'test';
  body: string;
  children?: TestBlock[];
}

export interface AssertionContext {
  inputFields: AST.Field[];
  outputType: AST.TypeDefinition;
  errorSpecs: AST.ErrorSpec[];
}

export interface ScenarioContext {
  behaviorName: string;
  scenarioName: string;
  givenStatements: AST.Statement[];
  whenStatements: AST.Statement[];
  thenExpressions: AST.Expression[];
}

export interface ChaosContext {
  behaviorName: string;
  scenarioName: string;
  injections: AST.Injection[];
  whenStatements: AST.Statement[];
  thenExpressions: AST.Expression[];
}

export interface PreconditionTest {
  name: string;
  expression: AST.Expression;
  testCode: string;
}

export interface PostconditionTest {
  name: string;
  condition: string;
  expressions: AST.Expression[];
  testCode: string;
}
