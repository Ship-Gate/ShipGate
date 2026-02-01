/**
 * ISL Dependency Analyzer
 * 
 * Analyzes ISL domain definitions to extract service dependencies
 * that require health checks.
 */

import type {
  DependencyInfo,
  DependencyType,
  DependencyConfig,
  DependencySource,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// ISL AST Type Imports (simplified for analysis)
// ═══════════════════════════════════════════════════════════════════════════

interface ISLDomain {
  kind: 'Domain';
  name: { name: string };
  entities: ISLEntity[];
  behaviors: ISLBehavior[];
  views: ISLView[];
}

interface ISLEntity {
  kind: 'Entity';
  name: { name: string };
  fields: ISLField[];
  lifecycle?: unknown;
}

interface ISLBehavior {
  kind: 'Behavior';
  name: { name: string };
  observability?: ISLObservabilitySpec;
  security?: ISLSecuritySpec[];
}

interface ISLView {
  kind: 'View';
  name: { name: string };
  cache?: ISLCacheSpec;
  forEntity: { name: { parts: Array<{ name: string }> } };
}

interface ISLField {
  name: { name: string };
  type: unknown;
  annotations: Array<{ name: { name: string }; value?: unknown }>;
}

interface ISLObservabilitySpec {
  metrics?: unknown[];
  traces?: unknown[];
}

interface ISLSecuritySpec {
  type: string;
  details?: unknown;
}

interface ISLCacheSpec {
  ttl: { value: number; unit: string };
  invalidateOn?: unknown[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Analyzer Configuration
// ═══════════════════════════════════════════════════════════════════════════

export interface AnalyzerConfig {
  /**
   * Include database dependencies from entity storage
   */
  includeDatabase?: boolean;

  /**
   * Include cache dependencies from view specs
   */
  includeCache?: boolean;

  /**
   * Include queue dependencies from async behaviors
   */
  includeQueue?: boolean;

  /**
   * Include external API dependencies from integrations
   */
  includeExternalApis?: boolean;

  /**
   * Custom dependency detection rules
   */
  customRules?: DependencyRule[];
}

export interface DependencyRule {
  name: string;
  detect: (domain: ISLDomain) => DependencyInfo[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Default Dependency Detection Rules
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_ANNOTATIONS = ['@persistent', '@stored', '@indexed', '@unique'];
const CACHE_ANNOTATIONS = ['@cached', '@memoized'];
const QUEUE_ANNOTATIONS = ['@async', '@queued', '@event'];
const EXTERNAL_API_ANNOTATIONS = ['@external', '@webhook', '@integration'];

// Known external service patterns
const EXTERNAL_SERVICE_PATTERNS: Record<string, Partial<DependencyConfig>> = {
  stripe: { url: 'https://api.stripe.com', healthEndpoint: '/v1/health' },
  paypal: { url: 'https://api.paypal.com', healthEndpoint: '/v1/health' },
  twilio: { url: 'https://api.twilio.com', healthEndpoint: '/healthcheck' },
  sendgrid: { url: 'https://api.sendgrid.com', healthEndpoint: '/v3/health' },
  aws_s3: { url: 'https://s3.amazonaws.com', healthEndpoint: '/' },
  firebase: { url: 'https://firebase.googleapis.com', healthEndpoint: '/v1beta1/health' },
};

// ═══════════════════════════════════════════════════════════════════════════
// ISL Dependency Analyzer
// ═══════════════════════════════════════════════════════════════════════════

export class ISLDependencyAnalyzer {
  private config: Required<AnalyzerConfig>;
  private customRules: DependencyRule[] = [];

  constructor(config: AnalyzerConfig = {}) {
    this.config = {
      includeDatabase: config.includeDatabase ?? true,
      includeCache: config.includeCache ?? true,
      includeQueue: config.includeQueue ?? true,
      includeExternalApis: config.includeExternalApis ?? true,
      customRules: config.customRules ?? [],
    };
    this.customRules = this.config.customRules;
  }

  /**
   * Analyze ISL domain for dependencies
   */
  analyze(domain: ISLDomain): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];

    // Analyze entities for storage dependencies
    if (this.config.includeDatabase) {
      dependencies.push(...this.analyzeEntities(domain));
    }

    // Analyze views for cache dependencies
    if (this.config.includeCache) {
      dependencies.push(...this.analyzeViews(domain));
    }

    // Analyze behaviors for queue and external API dependencies
    if (this.config.includeQueue || this.config.includeExternalApis) {
      dependencies.push(...this.analyzeBehaviors(domain));
    }

    // Run custom detection rules
    for (const rule of this.customRules) {
      try {
        dependencies.push(...rule.detect(domain));
      } catch (error) {
        // Log but continue with other rules
        console.warn(`Custom rule "${rule.name}" failed:`, error);
      }
    }

    // Deduplicate dependencies
    return this.deduplicateDependencies(dependencies);
  }

  /**
   * Analyze entities for database dependencies
   */
  private analyzeEntities(domain: ISLDomain): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];

    for (const entity of domain.entities) {
      const hasPersistence = this.entityRequiresPersistence(entity);
      
      if (hasPersistence) {
        dependencies.push({
          type: 'database',
          name: this.inferDatabaseName(entity, domain),
          critical: true,
          source: {
            entity: entity.name.name,
          },
          config: {
            query: 'SELECT 1',
            timeout: 5000,
          },
        });
      }
    }

    return dependencies;
  }

  /**
   * Check if entity requires persistence
   */
  private entityRequiresPersistence(entity: ISLEntity): boolean {
    // Check for storage annotations on fields
    for (const field of entity.fields) {
      for (const annotation of field.annotations) {
        if (STORAGE_ANNOTATIONS.includes(`@${annotation.name.name}`)) {
          return true;
        }
      }
    }

    // Entities with lifecycle states typically need persistence
    if (entity.lifecycle) {
      return true;
    }

    // Default: assume entities need storage
    return true;
  }

  /**
   * Infer database name from entity and domain
   */
  private inferDatabaseName(entity: ISLEntity, domain: ISLDomain): string {
    // Use domain name as database name
    return `${domain.name.name.toLowerCase()}_db`;
  }

  /**
   * Analyze views for cache dependencies
   */
  private analyzeViews(domain: ISLDomain): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    let hasCache = false;

    for (const view of domain.views) {
      if (view.cache) {
        hasCache = true;
        break;
      }
    }

    // Add single cache dependency if any views use caching
    if (hasCache) {
      dependencies.push({
        type: 'cache',
        name: 'redis',
        critical: false, // Cache is typically non-critical
        source: {
          view: domain.views.find(v => v.cache)?.name.name,
        },
        config: {
          host: 'localhost',
          port: 6379,
          timeout: 1000,
        },
      });
    }

    return dependencies;
  }

  /**
   * Analyze behaviors for queue and external API dependencies
   */
  private analyzeBehaviors(domain: ISLDomain): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    const detectedQueues = new Set<string>();
    const detectedApis = new Set<string>();

    for (const behavior of domain.behaviors) {
      // Check for queue dependencies
      if (this.config.includeQueue) {
        const queueDeps = this.detectQueueDependencies(behavior);
        for (const dep of queueDeps) {
          if (!detectedQueues.has(dep.name)) {
            detectedQueues.add(dep.name);
            dependencies.push(dep);
          }
        }
      }

      // Check for external API dependencies
      if (this.config.includeExternalApis) {
        const apiDeps = this.detectExternalApiDependencies(behavior);
        for (const dep of apiDeps) {
          if (!detectedApis.has(dep.name)) {
            detectedApis.add(dep.name);
            dependencies.push(dep);
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Detect queue dependencies from behavior
   */
  private detectQueueDependencies(behavior: ISLBehavior): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];

    // Check for async/queue annotations
    const behaviorName = behavior.name.name.toLowerCase();
    
    if (
      behaviorName.includes('async') ||
      behaviorName.includes('queue') ||
      behaviorName.includes('event') ||
      behaviorName.includes('publish') ||
      behaviorName.includes('subscribe')
    ) {
      dependencies.push({
        type: 'queue',
        name: 'rabbitmq',
        critical: true,
        source: {
          behavior: behavior.name.name,
        },
        config: {
          connectionString: 'amqp://localhost',
          timeout: 5000,
        },
      });
    }

    return dependencies;
  }

  /**
   * Detect external API dependencies from behavior
   */
  private detectExternalApiDependencies(behavior: ISLBehavior): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    const behaviorName = behavior.name.name.toLowerCase();

    // Check for known service patterns
    for (const [serviceName, config] of Object.entries(EXTERNAL_SERVICE_PATTERNS)) {
      if (behaviorName.includes(serviceName.replace('_', ''))) {
        dependencies.push({
          type: 'external-api',
          name: serviceName.replace('_', '-'),
          critical: this.isPaymentOrAuthService(serviceName),
          source: {
            behavior: behavior.name.name,
          },
          config: {
            url: config.url,
            healthEndpoint: config.healthEndpoint,
            timeout: 10000,
          },
        });
      }
    }

    // Check for payment-related behaviors
    if (
      behaviorName.includes('payment') ||
      behaviorName.includes('charge') ||
      behaviorName.includes('refund')
    ) {
      // Assume Stripe if not already detected
      if (!dependencies.some(d => d.name.includes('stripe') || d.name.includes('paypal'))) {
        dependencies.push({
          type: 'external-api',
          name: 'payment-gateway',
          critical: true,
          source: {
            behavior: behavior.name.name,
          },
          config: {
            url: 'https://api.stripe.com',
            healthEndpoint: '/v1/health',
            timeout: 10000,
          },
        });
      }
    }

    return dependencies;
  }

  /**
   * Check if service is payment or auth related (critical)
   */
  private isPaymentOrAuthService(serviceName: string): boolean {
    const criticalServices = ['stripe', 'paypal', 'auth0', 'firebase'];
    return criticalServices.some(s => serviceName.includes(s));
  }

  /**
   * Deduplicate dependencies by type and name
   */
  private deduplicateDependencies(dependencies: DependencyInfo[]): DependencyInfo[] {
    const seen = new Map<string, DependencyInfo>();

    for (const dep of dependencies) {
      const key = `${dep.type}:${dep.name}`;
      if (!seen.has(key)) {
        seen.set(key, dep);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Add custom detection rule
   */
  addRule(rule: DependencyRule): void {
    this.customRules.push(rule);
  }

  /**
   * Get analysis summary
   */
  getSummary(dependencies: DependencyInfo[]): DependencyAnalysisSummary {
    const byType = new Map<DependencyType, number>();
    let criticalCount = 0;

    for (const dep of dependencies) {
      byType.set(dep.type, (byType.get(dep.type) ?? 0) + 1);
      if (dep.critical) {
        criticalCount++;
      }
    }

    return {
      total: dependencies.length,
      critical: criticalCount,
      nonCritical: dependencies.length - criticalCount,
      byType: Object.fromEntries(byType),
    };
  }
}

export interface DependencyAnalysisSummary {
  total: number;
  critical: number;
  nonCritical: number;
  byType: Partial<Record<DependencyType, number>>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════

export function createDependencyAnalyzer(config?: AnalyzerConfig): ISLDependencyAnalyzer {
  return new ISLDependencyAnalyzer(config);
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quick analysis for a domain
 */
export function analyzeDomain(domain: ISLDomain, config?: AnalyzerConfig): DependencyInfo[] {
  const analyzer = createDependencyAnalyzer(config);
  return analyzer.analyze(domain);
}

/**
 * Extract dependencies from ISL source (requires parser)
 */
export async function analyzeISLSource(
  source: string,
  parseISL: (source: string) => { ast: ISLDomain | null; errors: unknown[] }
): Promise<DependencyInfo[]> {
  const { ast, errors } = parseISL(source);
  
  if (errors.length > 0 || !ast) {
    throw new Error(`Failed to parse ISL: ${errors.map(e => String(e)).join(', ')}`);
  }

  return analyzeDomain(ast as ISLDomain);
}
