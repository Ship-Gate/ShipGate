// ============================================================================
// Edge Runtime Types
// ============================================================================

/**
 * Supported edge platforms
 */
export type EdgePlatform = 'cloudflare' | 'deno' | 'vercel' | 'netlify' | 'fastly';

/**
 * Edge runtime options
 */
export interface EdgeRuntimeOptions {
  /** Platform to target */
  platform: EdgePlatform;

  /** Enable ISL verification in edge */
  enableVerification: boolean;

  /** Verification mode */
  verificationMode: 'strict' | 'relaxed' | 'shadow';

  /** Cache verification results */
  cacheVerification: boolean;

  /** Cache TTL in seconds */
  cacheTTL: number;

  /** Enable tracing */
  enableTracing: boolean;

  /** Custom tracer */
  tracer?: EdgeTracer;

  /** KV store for state */
  kvStore?: EdgeKVStore;

  /** Durable objects (Cloudflare) */
  durableObjects?: Record<string, EdgeDurableObjectConfig>;

  /** Environment variables prefix */
  envPrefix: string;

  /** Debug mode */
  debug: boolean;
}

/**
 * Default options
 */
export const DEFAULT_OPTIONS: EdgeRuntimeOptions = {
  platform: 'cloudflare',
  enableVerification: true,
  verificationMode: 'relaxed',
  cacheVerification: true,
  cacheTTL: 300,
  enableTracing: false,
  envPrefix: 'ISL_',
  debug: false,
};

/**
 * Edge tracer interface
 */
export interface EdgeTracer {
  startSpan(name: string, options?: SpanOptions): EdgeSpan;
  getCurrentSpan(): EdgeSpan | null;
  inject(carrier: Record<string, string>): void;
  extract(carrier: Record<string, string>): void;
}

/**
 * Edge span
 */
export interface EdgeSpan {
  end(): void;
  setStatus(status: 'ok' | 'error'): void;
  setAttributes(attributes: Record<string, unknown>): void;
  addEvent(name: string, attributes?: Record<string, unknown>): void;
}

/**
 * Span options
 */
export interface SpanOptions {
  attributes?: Record<string, unknown>;
  parent?: EdgeSpan;
}

/**
 * Edge KV store interface
 */
export interface EdgeKVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: KVPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KVListOptions): Promise<KVListResult>;
}

/**
 * KV put options
 */
export interface KVPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: Record<string, unknown>;
}

/**
 * KV list options
 */
export interface KVListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

/**
 * KV list result
 */
export interface KVListResult {
  keys: Array<{ name: string; expiration?: number; metadata?: Record<string, unknown> }>;
  cursor?: string;
  list_complete: boolean;
}

/**
 * Durable Object config
 */
export interface EdgeDurableObjectConfig {
  className: string;
  scriptName?: string;
}

/**
 * Edge request context
 */
export interface EdgeRequestContext {
  /** Request ID */
  requestId: string;

  /** Request method */
  method: string;

  /** Request URL */
  url: string;

  /** Request headers */
  headers: Record<string, string>;

  /** Request body */
  body?: unknown;

  /** Geo information */
  geo?: EdgeGeoInfo;

  /** CF properties (Cloudflare) */
  cf?: CloudflareProperties;

  /** Start time */
  startTime: number;

  /** ISL domain (from header or route) */
  islDomain?: string;

  /** ISL behavior (from header or route) */
  islBehavior?: string;
}

/**
 * Geo information
 */
export interface EdgeGeoInfo {
  country?: string;
  region?: string;
  city?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
}

/**
 * Cloudflare-specific properties
 */
export interface CloudflareProperties {
  colo?: string;
  asn?: number;
  asOrganization?: string;
  tlsVersion?: string;
  httpProtocol?: string;
  botManagement?: {
    score: number;
    verifiedBot: boolean;
    corporateProxy: boolean;
  };
}

/**
 * Edge response
 */
export interface EdgeResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * ISL behavior definition for edge
 */
export interface EdgeBehaviorDefinition {
  domain: string;
  behavior: string;
  preconditions?: string[];
  postconditions?: string[];
  invariants?: string[];
  handler: EdgeBehaviorHandler;
}

/**
 * Edge behavior handler
 */
export type EdgeBehaviorHandler = (
  input: unknown,
  context: EdgeRequestContext
) => Promise<unknown>;

/**
 * Verification result
 */
export interface EdgeVerificationResult {
  passed: boolean;
  score: number;
  checks: EdgeCheckResult[];
  cached: boolean;
  duration: number;
}

/**
 * Check result
 */
export interface EdgeCheckResult {
  type: 'precondition' | 'postcondition' | 'invariant';
  expression: string;
  passed: boolean;
  error?: string;
}
