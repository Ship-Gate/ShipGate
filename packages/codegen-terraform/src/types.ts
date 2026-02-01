// ============================================================================
// Terraform Generator Types
// ============================================================================

import type * as AST from '../../../master_contracts/ast';

export type CloudProvider = 'aws' | 'gcp' | 'azure';

export type InfraFeature = 'database' | 'queue' | 'storage' | 'cache' | 'cdn' | 'api' | 'compute';

export interface GenerateOptions {
  provider: CloudProvider;
  environment?: string;
  features?: InfraFeature[];
  region?: string;
  multiAz?: boolean;
  enableEncryption?: boolean;
  enableLogging?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'main' | 'variables' | 'outputs' | 'module' | 'data';
}

export interface TerraformBlock {
  type: 'resource' | 'data' | 'module' | 'variable' | 'output' | 'locals';
  resourceType?: string;
  name: string;
  attributes: Record<string, TerraformValue>;
}

export type TerraformValue =
  | string
  | number
  | boolean
  | TerraformValue[]
  | Record<string, TerraformValue>
  | TerraformReference
  | TerraformExpression;

export interface TerraformReference {
  _type: 'reference';
  value: string;
}

export interface TerraformExpression {
  _type: 'expression';
  value: string;
}

export interface InfrastructureRequirements {
  database: DatabaseRequirements | null;
  queue: QueueRequirements | null;
  storage: StorageRequirements | null;
  cache: CacheRequirements | null;
  compute: ComputeRequirements[];
  network: NetworkRequirements;
  security: SecurityRequirements;
  monitoring: MonitoringRequirements;
}

export interface DatabaseRequirements {
  engine: 'postgres' | 'mysql' | 'mongodb' | 'dynamodb';
  encrypted: boolean;
  multiAz: boolean;
  backupRetention: number;
  performanceInsights: boolean;
}

export interface QueueRequirements {
  type: 'standard' | 'fifo';
  encrypted: boolean;
  deadLetterQueue: boolean;
  visibilityTimeout: number;
}

export interface StorageRequirements {
  encrypted: boolean;
  versioning: boolean;
  replication: boolean;
  lifecycle: boolean;
}

export interface CacheRequirements {
  engine: 'redis' | 'memcached';
  encrypted: boolean;
  multiAz: boolean;
}

export interface ComputeRequirements {
  name: string;
  runtime: string;
  timeout: number;
  memory: number;
  vpcEnabled: boolean;
  tracingEnabled: boolean;
}

export interface NetworkRequirements {
  vpcRequired: boolean;
  privateSubnets: boolean;
  publicSubnets: boolean;
  natGateway: boolean;
  flowLogs: boolean;
}

export interface SecurityRequirements {
  waf: boolean;
  rateLimiting: RateLimitConfig | null;
  encryption: boolean;
  compliance: string[];
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
}

export interface MonitoringRequirements {
  alarms: AlarmConfig[];
  dashboards: boolean;
  tracing: boolean;
  logging: boolean;
}

export interface AlarmConfig {
  name: string;
  metric: string;
  threshold: number;
  unit: string;
  statistic: string;
}

export interface VariableDefinition {
  name: string;
  type: string;
  description: string;
  default?: TerraformValue;
  sensitive?: boolean;
  validation?: {
    condition: string;
    error_message: string;
  };
}

export interface OutputDefinition {
  name: string;
  value: string;
  description: string;
  sensitive?: boolean;
}
