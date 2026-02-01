/**
 * @intentos/health-check
 * Type definitions for health check system
 */

// ═══════════════════════════════════════════════════════════════════════════
// Health Status Types
// ═══════════════════════════════════════════════════════════════════════════

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface CheckResult {
  status: HealthStatus;
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface HealthCheckConfig {
  name: string;
  check: () => Promise<CheckResult>;
  critical: boolean;
  timeout?: number;
  interval?: number;
  retries?: number;
  tags?: string[];
}

export interface HealthCheckResponse {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  checks: Record<string, CheckResult>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Dependency Types (from ISL analysis)
// ═══════════════════════════════════════════════════════════════════════════

export type DependencyType = 
  | 'database'
  | 'cache'
  | 'queue'
  | 'external-api'
  | 'internal-service'
  | 'storage'
  | 'custom';

export interface DependencyInfo {
  type: DependencyType;
  name: string;
  critical: boolean;
  source: DependencySource;
  config?: DependencyConfig;
}

export interface DependencySource {
  entity?: string;
  behavior?: string;
  view?: string;
  annotation?: string;
}

export interface DependencyConfig {
  // Database
  connectionString?: string;
  poolSize?: number;
  
  // Cache
  host?: string;
  port?: number;
  ttl?: number;
  
  // Queue
  queueName?: string;
  exchangeName?: string;
  
  // External API
  url?: string;
  healthEndpoint?: string;
  apiKey?: string;
  
  // Generic
  timeout?: number;
  retries?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Database Check Types
// ═══════════════════════════════════════════════════════════════════════════

export interface DatabaseCheckConfig {
  name: string;
  type: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite';
  connectionString?: string;
  query?: string;
  timeout?: number;
  critical?: boolean;
}

export interface DatabaseConnection {
  query: (sql: string) => Promise<unknown>;
  end?: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cache Check Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CacheCheckConfig {
  name: string;
  type: 'redis' | 'memcached' | 'in-memory';
  host?: string;
  port?: number;
  timeout?: number;
  critical?: boolean;
}

export interface CacheConnection {
  ping: () => Promise<string>;
  quit?: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Queue Check Types
// ═══════════════════════════════════════════════════════════════════════════

export interface QueueCheckConfig {
  name: string;
  type: 'rabbitmq' | 'kafka' | 'sqs' | 'redis-queue';
  connectionString?: string;
  queueName?: string;
  timeout?: number;
  critical?: boolean;
}

export interface QueueConnection {
  checkQueue?: () => Promise<{ messageCount: number }>;
  close?: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// External API Check Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ExternalApiCheckConfig {
  name: string;
  url: string;
  healthEndpoint?: string;
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  expectedStatus?: number[];
  timeout?: number;
  critical?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Custom Check Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CustomCheckConfig {
  name: string;
  check: () => Promise<boolean | { status: boolean; message?: string; details?: Record<string, unknown> }>;
  timeout?: number;
  critical?: boolean;
  tags?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Generator Types
// ═══════════════════════════════════════════════════════════════════════════

export interface GeneratorConfig {
  version: string;
  serviceName: string;
  includeDetails?: boolean;
  customHeaders?: Record<string, string>;
}

export interface KubernetesProbeConfig extends GeneratorConfig {
  livenessPath?: string;
  readinessPath?: string;
  startupPath?: string;
  includeStartupProbe?: boolean;
}

export interface ExpressMiddlewareConfig extends GeneratorConfig {
  basePath?: string;
  enableCors?: boolean;
  rateLimitWindow?: number;
  rateLimitMax?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Aggregator Types
// ═══════════════════════════════════════════════════════════════════════════

export interface AggregatorConfig {
  timeout?: number;
  parallel?: boolean;
  failFast?: boolean;
  cacheResults?: boolean;
  cacheTtl?: number;
}

export interface AggregatedResult {
  status: HealthStatus;
  checks: Map<string, CheckResult>;
  criticalFailures: string[];
  nonCriticalFailures: string[];
  duration: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Types
// ═══════════════════════════════════════════════════════════════════════════

export type HealthEventType = 
  | 'check-started'
  | 'check-completed'
  | 'status-changed'
  | 'threshold-exceeded';

export interface HealthEvent {
  type: HealthEventType;
  checkName: string;
  timestamp: number;
  previousStatus?: HealthStatus;
  currentStatus?: HealthStatus;
  result?: CheckResult;
}

export type HealthEventHandler = (event: HealthEvent) => void;
