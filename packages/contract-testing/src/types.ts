/**
 * Contract Testing Types
 */

export interface Contract {
  id: string;
  name: string;
  version: string;
  consumer: ConsumerInfo;
  provider: ProviderInfo;
  interactions: Interaction[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumerInfo {
  name: string;
  version: string;
  tags?: string[];
}

export interface ProviderInfo {
  name: string;
  version?: string;
  baseUrl?: string;
}

export interface Interaction {
  id: string;
  description: string;
  request: RequestSpec;
  response: ResponseSpec;
  providerStates?: ProviderState[];
  metadata?: Record<string, unknown>;
}

export interface RequestSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  pathParams?: Record<string, ParamSpec>;
  queryParams?: Record<string, ParamSpec>;
  headers?: Record<string, string | ParamSpec>;
  body?: BodySpec;
}

export interface ResponseSpec {
  status: number;
  headers?: Record<string, string | ParamSpec>;
  body?: BodySpec;
}

export interface ParamSpec {
  type: 'string' | 'number' | 'boolean' | 'array';
  example?: unknown;
  regex?: string;
  required?: boolean;
  enum?: unknown[];
}

export interface BodySpec {
  contentType: string;
  schema?: JsonSchema;
  example?: unknown;
  matchers?: Matcher[];
}

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  additionalProperties?: boolean;
  $ref?: string;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface Matcher {
  path: string;
  type: MatcherType;
  value?: unknown;
  regex?: string;
}

export type MatcherType = 
  | 'type'
  | 'equality'
  | 'regex'
  | 'include'
  | 'integer'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'uuid'
  | 'email'
  | 'null'
  | 'arrayContains'
  | 'arrayLength'
  | 'eachLike';

export interface ProviderState {
  name: string;
  params?: Record<string, unknown>;
}

export interface VerificationResult {
  success: boolean;
  contractId: string;
  interactions: InteractionResult[];
  summary: VerificationSummary;
  timestamp: string;
}

export interface InteractionResult {
  interactionId: string;
  description: string;
  success: boolean;
  errors?: VerificationError[];
  warnings?: VerificationWarning[];
  duration: number;
}

export interface VerificationError {
  type: 'request' | 'response' | 'schema' | 'matcher';
  path?: string;
  expected?: unknown;
  actual?: unknown;
  message: string;
}

export interface VerificationWarning {
  type: string;
  message: string;
}

export interface VerificationSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  duration: number;
}

export interface ContractBrokerConfig {
  baseUrl: string;
  apiKey?: string;
  publishVerificationResults?: boolean;
  enablePending?: boolean;
  consumerVersionSelectors?: VersionSelector[];
}

export interface VersionSelector {
  tag?: string;
  branch?: string;
  latest?: boolean;
  consumer?: string;
  deployed?: boolean;
  released?: boolean;
  environment?: string;
}

export interface PublishOptions {
  consumerVersion: string;
  tags?: string[];
  branch?: string;
  buildUrl?: string;
}

export interface CanIDeployResult {
  canDeploy: boolean;
  reason: string;
  matrix: MatrixRow[];
}

export interface MatrixRow {
  consumer: { name: string; version: string };
  provider: { name: string; version: string };
  verificationResult?: {
    success: boolean;
    verifiedAt: string;
  };
}
