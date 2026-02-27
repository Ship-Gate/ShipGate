/**
 * Health Check Aggregator
 * 
 * Aggregates multiple health checks and computes overall health status.
 */

import type {
  HealthCheckConfig,
  CheckResult,
  HealthStatus,
  AggregatorConfig,
  AggregatedResult,
  HealthEvent,
  HealthEventHandler,
  HealthEventType,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Health Check Aggregator
// ═══════════════════════════════════════════════════════════════════════════

export class HealthAggregator {
  private checks: Map<string, HealthCheckConfig> = new Map();
  private config: Required<AggregatorConfig>;
  private cachedResults: Map<string, CheckResult> = new Map();
  private cacheTimestamp: number = 0;
  private eventHandlers: Set<HealthEventHandler> = new Set();
  private previousStatus: Map<string, HealthStatus> = new Map();

  constructor(
    checks: HealthCheckConfig[],
    config: AggregatorConfig = {}
  ) {
    this.config = {
      timeout: config.timeout ?? 30000,
      parallel: config.parallel ?? true,
      failFast: config.failFast ?? false,
      cacheResults: config.cacheResults ?? false,
      cacheTtl: config.cacheTtl ?? 5000,
    };

    for (const check of checks) {
      this.checks.set(check.name, check);
    }
  }

  /**
   * Run all health checks and aggregate results
   */
  async checkAll(): Promise<AggregatedResult> {
    const start = Date.now();

    // Return cached results if valid
    if (this.config.cacheResults && this.isCacheValid()) {
      return this.buildResult(this.cachedResults, start);
    }

    const results = new Map<string, CheckResult>();
    const checks = Array.from(this.checks.values());

    if (this.config.parallel) {
      await this.runParallel(checks, results);
    } else {
      await this.runSequential(checks, results);
    }

    // Update cache
    if (this.config.cacheResults) {
      this.cachedResults = new Map(results);
      this.cacheTimestamp = Date.now();
    }

    return this.buildResult(results, start);
  }

  /**
   * Run checks in parallel
   */
  private async runParallel(
    checks: HealthCheckConfig[],
    results: Map<string, CheckResult>
  ): Promise<void> {
    const promises = checks.map(async check => {
      const result = await this.runCheck(check);
      results.set(check.name, result);
      
      // Emit status change event if needed
      this.checkStatusChange(check.name, result);
    });

    await Promise.all(promises);
  }

  /**
   * Run checks sequentially
   */
  private async runSequential(
    checks: HealthCheckConfig[],
    results: Map<string, CheckResult>
  ): Promise<void> {
    for (const check of checks) {
      const result = await this.runCheck(check);
      results.set(check.name, result);
      
      // Emit status change event if needed
      this.checkStatusChange(check.name, result);

      // Fail fast on critical failure
      if (this.config.failFast && check.critical && result.status === 'unhealthy') {
        break;
      }
    }
  }

  /**
   * Run a single health check with timeout
   */
  private async runCheck(check: HealthCheckConfig): Promise<CheckResult> {
    const timeout = check.timeout ?? this.config.timeout;
    this.emitEvent('check-started', check.name);

    try {
      const result = await Promise.race([
        check.check(),
        this.createTimeout(timeout, check.name),
      ]);

      this.emitEvent('check-completed', check.name, result);
      return result;
    } catch (error) {
      const result: CheckResult = {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Check failed',
        timestamp: Date.now(),
      };

      this.emitEvent('check-completed', check.name, result);
      return result;
    }
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number, checkName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check "${checkName}" timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Build aggregated result from individual check results
   */
  private buildResult(
    results: Map<string, CheckResult>,
    startTime: number
  ): AggregatedResult {
    const criticalFailures: string[] = [];
    const nonCriticalFailures: string[] = [];
    let hasUnhealthy = false;
    let hasDegraded = false;

    for (const [name, result] of results) {
      const check = this.checks.get(name);
      
      if (result.status === 'unhealthy') {
        hasUnhealthy = true;
        if (check?.critical) {
          criticalFailures.push(name);
        } else {
          nonCriticalFailures.push(name);
        }
      } else if (result.status === 'degraded') {
        hasDegraded = true;
        nonCriticalFailures.push(name);
      }
    }

    // Determine overall status
    let status: HealthStatus;
    if (criticalFailures.length > 0) {
      status = 'unhealthy';
    } else if (hasUnhealthy || hasDegraded) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      checks: results,
      criticalFailures,
      nonCriticalFailures,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return (
      this.cachedResults.size > 0 &&
      Date.now() - this.cacheTimestamp < this.config.cacheTtl
    );
  }

  /**
   * Check for status changes and emit events
   */
  private checkStatusChange(checkName: string, result: CheckResult): void {
    const previousStatus = this.previousStatus.get(checkName);
    
    if (previousStatus && previousStatus !== result.status) {
      this.emitEvent('status-changed', checkName, result, previousStatus);
    }

    this.previousStatus.set(checkName, result.status);
  }

  /**
   * Emit a health event
   */
  private emitEvent(
    type: HealthEventType,
    checkName: string,
    result?: CheckResult,
    previousStatus?: HealthStatus
  ): void {
    const event: HealthEvent = {
      type,
      checkName,
      timestamp: Date.now(),
      previousStatus,
      currentStatus: result?.status,
      result,
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add a health check
   */
  addCheck(check: HealthCheckConfig): void {
    this.checks.set(check.name, check);
  }

  /**
   * Remove a health check
   */
  removeCheck(name: string): boolean {
    return this.checks.delete(name);
  }

  /**
   * Get a health check by name
   */
  getCheck(name: string): HealthCheckConfig | undefined {
    return this.checks.get(name);
  }

  /**
   * Get all health checks
   */
  getChecks(): HealthCheckConfig[] {
    return Array.from(this.checks.values());
  }

  /**
   * Check if a specific check exists
   */
  hasCheck(name: string): boolean {
    return this.checks.has(name);
  }

  /**
   * Run a specific health check
   */
  async checkOne(name: string): Promise<CheckResult | undefined> {
    const check = this.checks.get(name);
    if (!check) {
      return undefined;
    }

    return this.runCheck(check);
  }

  /**
   * Subscribe to health events
   */
  onEvent(handler: HealthEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Clear cached results
   */
  clearCache(): void {
    this.cachedResults.clear();
    this.cacheTimestamp = 0;
  }

  /**
   * Get last cached results
   */
  getLastResults(): Map<string, CheckResult> | undefined {
    if (this.cachedResults.size === 0) {
      return undefined;
    }
    return new Map(this.cachedResults);
  }

  /**
   * Get check names by status
   */
  getChecksByStatus(status: HealthStatus): string[] {
    return Array.from(this.previousStatus.entries())
      .filter(([_, s]) => s === status)
      .map(([name]) => name);
  }

  /**
   * Get critical checks
   */
  getCriticalChecks(): HealthCheckConfig[] {
    return Array.from(this.checks.values()).filter(c => c.critical);
  }

  /**
   * Get non-critical checks
   */
  getNonCriticalChecks(): HealthCheckConfig[] {
    return Array.from(this.checks.values()).filter(c => !c.critical);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a health aggregator
 */
export function createHealthAggregator(
  checks: HealthCheckConfig[],
  config?: AggregatorConfig
): HealthAggregator {
  return new HealthAggregator(checks, config);
}

// ═══════════════════════════════════════════════════════════════════════════
// Quick Health Check
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quick health check function
 */
export async function quickHealthCheck(
  checks: HealthCheckConfig[]
): Promise<HealthStatus> {
  const aggregator = new HealthAggregator(checks, { 
    parallel: true,
    timeout: 5000,
  });
  
  const result = await aggregator.checkAll();
  return result.status;
}

/**
 * Check if all critical dependencies are healthy
 */
export async function areCriticalServicesHealthy(
  checks: HealthCheckConfig[]
): Promise<boolean> {
  const aggregator = new HealthAggregator(checks, {
    parallel: true,
    failFast: true,
  });

  const result = await aggregator.checkAll();
  return result.criticalFailures.length === 0;
}
