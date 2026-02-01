/**
 * @isl-lang/health-check
 * 
 * Generate health check endpoints from ISL dependencies.
 * Supports Kubernetes probes, Express middleware, and custom health checks.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type {
  // Health status
  HealthStatus,
  CheckResult,
  HealthCheckConfig,
  HealthCheckResponse,
  
  // Dependencies
  DependencyType,
  DependencyInfo,
  DependencySource,
  DependencyConfig,
  
  // Check configs
  DatabaseCheckConfig,
  DatabaseConnection,
  CacheCheckConfig,
  CacheConnection,
  QueueCheckConfig,
  QueueConnection,
  ExternalApiCheckConfig,
  CustomCheckConfig,
  
  // Generator configs
  GeneratorConfig,
  KubernetesProbeConfig,
  ExpressMiddlewareConfig,
  
  // Aggregator
  AggregatorConfig,
  AggregatedResult,
  
  // Events
  HealthEventType,
  HealthEvent,
  HealthEventHandler,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Analyzer
// ═══════════════════════════════════════════════════════════════════════════

export {
  ISLDependencyAnalyzer,
  createDependencyAnalyzer,
  analyzeDomain,
  analyzeISLSource,
  type AnalyzerConfig,
  type DependencyRule,
  type DependencyAnalysisSummary,
} from './analyzer.js';

// ═══════════════════════════════════════════════════════════════════════════
// Health Checks
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Database
  createDatabaseCheck,
  createDatabaseCheckWithConnection,
  createPoolHealthCheck,
  type PoolStats,
  
  // Cache
  createCacheCheck,
  createCacheCheckWithConnection,
  createCacheStatsCheck,
  type CacheStats,
  
  // Queue
  createQueueCheck,
  createQueueCheckWithConnection,
  createQueueBacklogCheck,
  type QueueBacklogStats,
  
  // External API
  createExternalApiCheck,
  createStripeCheck,
  createPayPalCheck,
  createTwilioCheck,
  createSendGridCheck,
  createS3Check,
  createServiceChecks,
  createInternalServiceCheck,
  createGraphQLCheck,
  createGrpcCheck,
  type ServiceEndpoint,
  
  // Custom
  createCustomCheck,
  createDiskSpaceCheck,
  createMemoryCheck,
  createCpuCheck,
  createEventLoopCheck,
  createFileExistsCheck,
  createCompositeCheck,
  createThresholdCheck,
  type DiskSpaceOptions,
  type MemoryOptions,
  type CpuOptions,
  type EventLoopOptions,
} from './checks/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Generators
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Kubernetes
  KubernetesProbeGenerator,
  createKubernetesProbes,
  livenessProbe,
  readinessProbe,
  generateProbeYaml,
  type ProbeResponse,
  type ProbeBody,
  type ProbeHandlers,
  type ProbeYamlConfig,
  
  // Express
  ExpressHealthGenerator,
  healthMiddleware,
  healthRouter,
  createHealthHandler,
  attachHealthChecks,
  pingMiddleware,
  versionMiddleware,
  type HealthMiddleware,
  type HealthRouterFactory,
} from './generators/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// Aggregator
// ═══════════════════════════════════════════════════════════════════════════

export {
  HealthAggregator,
  createHealthAggregator,
  quickHealthCheck,
  areCriticalServicesHealthy,
} from './aggregator.js';

// ═══════════════════════════════════════════════════════════════════════════
// Main Export: Health Check Generator from ISL
// ═══════════════════════════════════════════════════════════════════════════

import { ISLDependencyAnalyzer, type AnalyzerConfig } from './analyzer.js';
import { HealthAggregator } from './aggregator.js';
import {
  createDatabaseCheck,
  createCacheCheck,
  createQueueCheck,
  createExternalApiCheck,
} from './checks/index.js';
import type {
  HealthCheckConfig,
  DependencyInfo,
  GeneratorConfig,
} from './types.js';

/**
 * Configuration for the health check generator
 */
export interface HealthCheckGeneratorConfig extends GeneratorConfig {
  analyzerConfig?: AnalyzerConfig;
  defaultTimeout?: number;
}

/**
 * Generated health checks result
 */
export interface GeneratedHealthChecks {
  checks: Record<string, HealthCheckConfig>;
  aggregator: HealthAggregator;
  dependencies: DependencyInfo[];
}

/**
 * Generate health checks from ISL domain
 */
export function generateHealthChecks(
  domain: unknown,
  config: HealthCheckGeneratorConfig
): GeneratedHealthChecks {
  // Analyze domain for dependencies
  const analyzer = new ISLDependencyAnalyzer(config.analyzerConfig);
  const dependencies = analyzer.analyze(domain as Parameters<typeof analyzer.analyze>[0]);

  // Create health checks from dependencies
  const checks: Record<string, HealthCheckConfig> = {};

  for (const dep of dependencies) {
    const check = createCheckFromDependency(dep, config.defaultTimeout);
    if (check) {
      checks[dep.name] = check;
    }
  }

  // Create aggregator
  const aggregator = new HealthAggregator(Object.values(checks));

  return {
    checks,
    aggregator,
    dependencies,
  };
}

/**
 * Create a health check from a dependency
 */
function createCheckFromDependency(
  dep: DependencyInfo,
  defaultTimeout?: number
): HealthCheckConfig | null {
  switch (dep.type) {
    case 'database':
      return createDatabaseCheck({
        name: dep.name,
        type: 'postgresql', // Default to PostgreSQL
        connectionString: dep.config?.connectionString,
        timeout: dep.config?.timeout ?? defaultTimeout,
        critical: dep.critical,
      });

    case 'cache':
      return createCacheCheck({
        name: dep.name,
        type: 'redis', // Default to Redis
        host: dep.config?.host,
        port: dep.config?.port,
        timeout: dep.config?.timeout ?? defaultTimeout,
        critical: dep.critical,
      });

    case 'queue':
      return createQueueCheck({
        name: dep.name,
        type: 'rabbitmq', // Default to RabbitMQ
        connectionString: dep.config?.connectionString,
        queueName: dep.config?.queueName,
        timeout: dep.config?.timeout ?? defaultTimeout,
        critical: dep.critical,
      });

    case 'external-api':
      return createExternalApiCheck({
        name: dep.name,
        url: dep.config?.url ?? '',
        healthEndpoint: dep.config?.healthEndpoint,
        timeout: dep.config?.timeout ?? defaultTimeout,
        critical: dep.critical,
      });

    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Default Export
// ═══════════════════════════════════════════════════════════════════════════

export default {
  // Main generator
  generateHealthChecks,
  
  // Analyzer
  ISLDependencyAnalyzer,
  createDependencyAnalyzer,
  analyzeDomain,
  
  // Aggregator
  HealthAggregator,
  createHealthAggregator,
  quickHealthCheck,
  areCriticalServicesHealthy,
  
  // Generators
  KubernetesProbeGenerator,
  createKubernetesProbes,
  healthMiddleware,
  healthRouter,
  livenessProbe,
  readinessProbe,
  
  // Checks
  createDatabaseCheck,
  createCacheCheck,
  createQueueCheck,
  createExternalApiCheck,
  createCustomCheck,
};
