// ============================================================================
// Edge Computing Types
// ============================================================================

// ============================================================================
// TARGETS
// ============================================================================

export type EdgeTarget =
  | 'cloudflare-workers'
  | 'cloudflare-pages'
  | 'deno-deploy'
  | 'vercel-edge'
  | 'netlify-edge'
  | 'fastly-compute'
  | 'aws-lambda-edge';

// ============================================================================
// GENERATED CODE
// ============================================================================

export interface GeneratedEdgeCode {
  files: EdgeFile[];
  config: EdgeConfig;
  manifest: EdgeManifest;
}

export interface EdgeFile {
  path: string;
  content: string;
  type: 'handler' | 'middleware' | 'types' | 'config' | 'test';
}

export interface EdgeConfig {
  target: EdgeTarget;
  entrypoint: string;
  bindings: EdgeBinding[];
  routes: EdgeRoute[];
  environment: Record<string, string>;
}

export interface EdgeBinding {
  name: string;
  type: BindingType;
  config: Record<string, unknown>;
}

export type BindingType =
  | 'kv'           // Key-value store
  | 'd1'           // SQLite database (Cloudflare)
  | 'r2'           // Object storage
  | 'durable-object'
  | 'service'      // Service binding
  | 'secret'
  | 'queue';

export interface EdgeRoute {
  pattern: string;
  handler: string;
  method?: string;
  middleware?: string[];
}

export interface EdgeManifest {
  name: string;
  version: string;
  target: EdgeTarget;
  behaviors: EdgeBehaviorInfo[];
  storage: StorageRequirement[];
  limits: EdgeLimits;
}

export interface EdgeBehaviorInfo {
  name: string;
  route: string;
  method: string;
  estimatedLatency: number;
  memoryUsage: number;
}

export interface StorageRequirement {
  type: BindingType;
  name: string;
  usage: string;
}

export interface EdgeLimits {
  cpuTime: number;      // ms
  memory: number;       // MB
  requestSize: number;  // bytes
  responseSize: number; // bytes
}

// ============================================================================
// CLOUDFLARE SPECIFIC
// ============================================================================

export interface CloudflareWorkerConfig {
  name: string;
  main: string;
  compatibilityDate: string;
  kvNamespaces?: Array<{ binding: string; id: string }>;
  d1Databases?: Array<{ binding: string; databaseId: string }>;
  r2Buckets?: Array<{ binding: string; bucketName: string }>;
  durableObjects?: Array<{ name: string; className: string }>;
  vars?: Record<string, string>;
  routes?: string[];
}

export interface CloudflareEnv {
  [key: string]: KVNamespace | D1Database | R2Bucket | DurableObjectNamespace | string;
}

// Type stubs for Cloudflare types
export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
}

export interface D1Result<T> {
  results?: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ArrayBuffer | string): Promise<R2Object>;
  delete(key: string): Promise<void>;
}

export interface R2Object {
  body: ReadableStream;
  key: string;
}

export interface DurableObjectNamespace {
  get(id: DurableObjectId): DurableObjectStub;
  idFromName(name: string): DurableObjectId;
}

export interface DurableObjectId {
  toString(): string;
}

export interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

// ============================================================================
// DENO SPECIFIC
// ============================================================================

export interface DenoConfig {
  name: string;
  version: string;
  exports: string;
  tasks: Record<string, string>;
  imports: Record<string, string>;
}

export interface DenoDeployConfig {
  project: string;
  entrypoint: string;
  exclude?: string[];
}

// ============================================================================
// VERCEL SPECIFIC
// ============================================================================

export interface VercelConfig {
  runtime: 'edge';
  regions?: string[];
  maxDuration?: number;
}

export interface VercelEdgeConfig {
  functions: Record<string, VercelConfig>;
  rewrites?: Array<{ source: string; destination: string }>;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface EdgeRequest {
  url: string;
  method: string;
  headers: Headers;
  body?: ReadableStream | null;
  cf?: CloudflareProperties;
}

export interface CloudflareProperties {
  country?: string;
  city?: string;
  continent?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  colo?: string;
}

export interface EdgeContext {
  request: EdgeRequest;
  env: Record<string, unknown>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException?: () => void;
}
