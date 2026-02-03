// ============================================================================
// ISL Standard Library - Rate Limit Types
// @stdlib/rate-limit/types
// Version: 1.0.0
// ============================================================================

// ============================================================================
// CORE TYPES
// ============================================================================

export type BucketId = string;
export type RateLimitKey = string;

// ============================================================================
// ENUMS
// ============================================================================

export enum RateLimitAction {
  ALLOW = 'ALLOW',
  WARN = 'WARN',
  THROTTLE = 'THROTTLE',
  DENY = 'DENY',
  CAPTCHA = 'CAPTCHA',
}

export enum RateLimitAlgorithm {
  TOKEN_BUCKET = 'TOKEN_BUCKET',
  SLIDING_WINDOW = 'SLIDING_WINDOW',
  FIXED_WINDOW = 'FIXED_WINDOW',
  LEAKY_BUCKET = 'LEAKY_BUCKET',
}

export enum IdentifierType {
  IP = 'IP',
  USER_ID = 'USER_ID',
  API_KEY = 'API_KEY',
  SESSION = 'SESSION',
  CUSTOM = 'CUSTOM',
}

export enum RateLimitScope {
  GLOBAL = 'GLOBAL',
  PER_ENDPOINT = 'PER_ENDPOINT',
  PER_USER = 'PER_USER',
  PER_IP = 'PER_IP',
  COMPOSITE = 'COMPOSITE',
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface RateLimitConfig {
  name: string;
  limit: number;
  windowMs: number;
  algorithm?: RateLimitAlgorithm;
  scope?: RateLimitScope;
  
  // Thresholds
  warnThreshold?: number;
  throttleThreshold?: number;
  
  // Burst handling
  burstLimit?: number;
  burstWindowMs?: number;
  
  // Penalty configuration
  blockDurationMs?: number;
  escalationMultiplier?: number;
  
  // Bypass rules
  bypassRoles?: string[];
  bypassIps?: string[];
  
  // Metadata
  description?: string;
  tags?: string[];
}

// ============================================================================
// BUCKET STATE
// ============================================================================

export interface BucketState {
  key: RateLimitKey;
  configName: string;
  currentCount: number;
  remaining: number;
  limit: number;
  windowStart: Date;
  windowEnd: Date;
  lastRequest: Date;
  blockedUntil?: Date;
  violationCount: number;
}

export interface RateLimitBucket {
  id: BucketId;
  key: RateLimitKey;
  identifierType: IdentifierType;
  configName: string;
  currentCount: number;
  totalRequests: number;
  windowStart: Date;
  windowSizeMs: number;
  limit: number;
  blockedUntil?: Date;
  violationCount: number;
  lastViolation?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CHECK RESULT
// ============================================================================

export interface CheckResult {
  action: RateLimitAction;
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfterMs?: number;
  headers?: Record<string, string>;
  bucketKey: BucketId;
  configName: string;
  violationCount?: number;
}

// ============================================================================
// BLOCK
// ============================================================================

export interface RateLimitBlock {
  id: string;
  key: RateLimitKey;
  identifierType: IdentifierType;
  reason: string;
  blockedAt: Date;
  blockedUntil: Date;
  autoUnblock: boolean;
  createdBy?: string;
  metadata?: Record<string, string>;
}

// ============================================================================
// VIOLATION
// ============================================================================

export interface Violation {
  id: string;
  key: RateLimitKey;
  identifierType: IdentifierType;
  configName: string;
  timestamp: Date;
  requestCount: number;
  limit: number;
  actionTaken: RateLimitAction;
  metadata?: Record<string, string>;
}

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

export interface CheckInput {
  key: RateLimitKey;
  identifierType: IdentifierType;
  configName: string;
  weight?: number;
  metadata?: Record<string, string>;
}

export interface IncrementInput {
  key: RateLimitKey;
  identifierType: IdentifierType;
  configName: string;
  amount?: number;
  success?: boolean;
}

export interface IncrementResult {
  newCount: number;
  remaining: number;
  action: RateLimitAction;
}

export interface BlockInput {
  key: RateLimitKey;
  identifierType: IdentifierType;
  durationMs: number;
  reason: string;
  autoUnblock?: boolean;
  createdBy?: string;
  metadata?: Record<string, string>;
}

export interface UnblockInput {
  key: RateLimitKey;
  identifierType: IdentifierType;
  reason?: string;
}

// ============================================================================
// STORAGE INTERFACE
// ============================================================================

export interface RateLimitStorage {
  // Bucket operations
  getBucket(bucketId: BucketId): Promise<RateLimitBucket | null>;
  setBucket(bucket: RateLimitBucket): Promise<void>;
  incrementBucket(bucketId: BucketId, amount: number): Promise<RateLimitBucket>;
  deleteBucket(bucketId: BucketId): Promise<boolean>;
  
  // Block operations
  getBlock(key: RateLimitKey, identifierType: IdentifierType): Promise<RateLimitBlock | null>;
  setBlock(block: RateLimitBlock): Promise<void>;
  removeBlock(key: RateLimitKey, identifierType: IdentifierType): Promise<boolean>;
  listBlocks(options?: {
    identifierType?: IdentifierType;
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ blocks: RateLimitBlock[]; total: number }>;
  
  // Violation operations
  recordViolation(violation: Violation): Promise<void>;
  getViolations(options?: {
    key?: RateLimitKey;
    identifierType?: IdentifierType;
    configName?: string;
    since?: Date;
    limit?: number;
  }): Promise<{ violations: Violation[]; total: number }>;
  
  // Health
  healthCheck(): Promise<boolean>;
  
  // Cleanup
  cleanup(olderThanMs: number): Promise<number>;
}

// ============================================================================
// LIMITER OPTIONS
// ============================================================================

export interface RateLimiterOptions {
  storage: RateLimitStorage;
  configs: RateLimitConfig[];
  
  // Default config name
  defaultConfig?: string;
  
  // Key generation
  keyGenerator?: (input: CheckInput) => BucketId;
  
  // Headers
  includeHeaders?: boolean;
  headerPrefix?: string;
  
  // Escalation
  enableEscalation?: boolean;
  maxEscalationLevel?: number;
  
  // Events
  onViolation?: (violation: Violation) => void | Promise<void>;
  onBlock?: (block: RateLimitBlock) => void | Promise<void>;
  
  // Error handling
  onError?: (error: Error, context: string) => void;
  
  // Skip conditions
  skip?: (input: CheckInput) => boolean | Promise<boolean>;
}
