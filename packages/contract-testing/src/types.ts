/**
 * Contract Testing Types
 */

// ============================================================================
// Contract Types
// ============================================================================

export interface ContractMetadata {
  version: string;
  consumer: string;
  provider: string;
  domain: string;
  generatedAt: string;
  islVersion: string;
  branch?: string;
  commitHash?: string;
  tags?: string[];
}

export interface ContractSpec {
  behaviors: ContractBehavior[];
  types: ContractType[];
  interactions: ContractInteraction[];
}

export interface ContractBehavior {
  name: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  preconditions?: string[];
  postconditions?: string[];
}

export interface ContractType {
  name: string;
  type: string;
  fields?: Record<string, unknown>;
}

export interface ContractInteraction {
  id: string;
  description: string;
  request: ContractRequest;
  response: ContractResponse;
}

export interface ContractRequest {
  behavior: string;
  input: Record<string, unknown>;
}

export interface ContractResponse {
  status: 'success' | 'failure';
  output?: Record<string, unknown>;
  error?: { code: string; message: string };
}

export interface BodyMatcher {
  path: string;
  type: string;
  value?: unknown;
  min?: number;
}

/**
 * Contract class with methods for validation and serialization
 */
export class Contract {
  metadata: ContractMetadata;
  spec: ContractSpec;
  interactions: Interaction[];

  constructor(metadata: ContractMetadata, interactions: Interaction[] = []) {
    this.metadata = metadata;
    this.spec = {
      behaviors: [],
      types: [],
      interactions: [],
    };
    this.interactions = interactions;
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.metadata.consumer) {
      errors.push('Missing consumer');
    }
    if (!this.metadata.provider) {
      errors.push('Missing provider');
    }
    if (!this.metadata.version) {
      errors.push('Missing version');
    }

    return { valid: errors.length === 0, errors };
  }

  toJSON(): Record<string, unknown> {
    return {
      metadata: this.metadata,
      spec: this.spec,
      interactions: this.interactions,
    };
  }

  static fromJSON(data: Record<string, unknown>): Contract {
    const metadata = data.metadata as ContractMetadata;
    const interactions = data.interactions as Interaction[] || [];
    const contract = new Contract(metadata, interactions);
    contract.spec = data.spec as ContractSpec || { behaviors: [], types: [], interactions: [] };
    return contract;
  }
}

// ============================================================================
// Contract Diff Types
// ============================================================================

export interface ContractDiff {
  breaking: ContractChange[];
  nonBreaking: ContractChange[];
  summary: string;
}

export interface ContractChange {
  type: 'added' | 'removed' | 'modified';
  path: string;
  description: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Compare two contracts and return differences
 */
export function compareContracts(oldContract: Contract, newContract: Contract): ContractDiff {
  const breaking: ContractChange[] = [];
  const nonBreaking: ContractChange[] = [];

  // Compare behaviors
  const oldBehaviors = new Set(oldContract.spec.behaviors.map(b => b.name));
  const newBehaviors = new Set(newContract.spec.behaviors.map(b => b.name));

  // Check for removed behaviors (breaking)
  for (const name of oldBehaviors) {
    if (!newBehaviors.has(name)) {
      breaking.push({
        type: 'removed',
        path: `behaviors.${name}`,
        description: `Behavior '${name}' was removed`,
      });
    }
  }

  // Check for added behaviors (non-breaking)
  for (const name of newBehaviors) {
    if (!oldBehaviors.has(name)) {
      nonBreaking.push({
        type: 'added',
        path: `behaviors.${name}`,
        description: `Behavior '${name}' was added`,
      });
    }
  }

  const summary = breaking.length > 0
    ? `${breaking.length} breaking change(s), ${nonBreaking.length} non-breaking change(s)`
    : `${nonBreaking.length} non-breaking change(s)`;

  return { breaking, nonBreaking, summary };
}

// ============================================================================
// Legacy Contract Interface (for backward compatibility)
// ============================================================================

export interface LegacyContract {
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
  behavior: string;
  request: RequestSpec;
  response: ResponseSpec;
  providerState?: ProviderState;
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
