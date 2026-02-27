// ============================================================================
// API Client Generator Types
// ============================================================================

export type TargetLanguage = 'typescript' | 'python' | 'go' | 'rust' | 'java';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface GenerateOptions {
  /** Target programming language */
  language: TargetLanguage;
  /** Base URL for the API (can be overridden at runtime) */
  baseUrl?: string;
  /** Whether to generate async/await style code */
  async?: boolean;
  /** Whether to include request/response logging */
  includeLogging?: boolean;
  /** Whether to generate retry logic */
  includeRetry?: boolean;
  /** Whether to generate request validation */
  includeValidation?: boolean;
  /** Custom HTTP client to use (fetch, axios, etc.) */
  httpClient?: 'fetch' | 'axios' | 'ky' | 'got';
  /** Package/module name for the generated client */
  packageName?: string;
  /** Whether to generate individual files per behavior */
  splitFiles?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: TargetLanguage;
}

export interface ClientMethod {
  name: string;
  httpMethod: HttpMethod;
  path: string;
  description?: string;
  inputType: string;
  outputType: string;
  errorTypes: string[];
  validation?: string;
  retryConfig?: RetryConfig;
}

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  retryableErrors: string[];
}

export interface TypeDefinition {
  name: string;
  kind: 'interface' | 'type' | 'enum' | 'class';
  fields?: FieldDefinition[];
  values?: string[]; // For enums
  extends?: string;
}

export interface FieldDefinition {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
  validation?: string;
}

export interface ClientConfig {
  className: string;
  baseUrl: string;
  methods: ClientMethod[];
  types: TypeDefinition[];
  imports: string[];
}
