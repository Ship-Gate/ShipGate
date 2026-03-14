export interface TestCase {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  expectedStatus: number;
  expectedShape?: Record<string, string>;
  expectedFields?: Record<string, unknown>;
  authRequired: boolean;
  description: string;
}

export interface TestSuite {
  name: string;
  baseUrl: string;
  tests: TestCase[];
}

export interface GeneratorConfig {
  framework: 'vitest' | 'jest';
  baseUrl: string;
  authToken?: string;
  outputDir: string;
}

export type FieldTypeKind =
  | 'String'
  | 'Int'
  | 'Decimal'
  | 'Boolean'
  | 'Timestamp'
  | 'UUID'
  | 'Duration'
  | 'Email'
  | 'URL'
  | 'Phone'
  | 'Date'
  | 'enum';

export interface FieldConstraints {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enumValues?: string[];
}
