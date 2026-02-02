// ============================================================================
// Observability Standard Library - Health Checks Implementation
// @isl-lang/stdlib-observability
// ============================================================================

/// <reference types="node" />

import {
  Duration,
  HealthCheckType,
  HealthStatus,
  HealthCheck,
  HealthCheckResult,
  CheckHealthInput,
  CheckHealthOutput,
  Result,
  success,
  failure,
} from './types';

// Declare globals that may or may not be available
declare const fetch: ((url: string, init?: RequestInit) => Promise<Response>) | undefined;
declare const AbortController: (new () => {
  signal: AbortSignal;
  abort(): void;
}) | undefined;

interface RequestInit {
  method?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface Response {
  status: number;
}

interface AbortSignal {
  aborted: boolean;
}

// ============================================================================
// Health Check Function Type
// ============================================================================

export type HealthCheckFunction = () => Promise<HealthCheckResult>;

// ============================================================================
// HTTP Health Check
// ============================================================================

export function createHttpHealthCheck(
  endpoint: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    expectedStatus?: number;
    timeout?: Duration;
  } = {}
): HealthCheckFunction {
  const {
    method = 'GET',
    headers = {},
    expectedStatus = 200,
    timeout = 5000,
  } = options;

  return async (): Promise<HealthCheckResult> => {
    const startTime = Date.now();

    try {
      // Check if fetch is available
      if (typeof fetch === 'undefined') {
        return {
          status: HealthStatus.UNHEALTHY,
          message: 'HTTP fetch not available in this environment',
          durationMs: Date.now() - startTime,
        };
      }

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let controller: { signal: AbortSignal; abort(): void } | undefined;

      if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller?.abort(), timeout);
      }

      const response = await fetch(endpoint, {
        method,
        headers,
        signal: controller?.signal,
      });

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      const durationMs = Date.now() - startTime;

      if (response.status === expectedStatus) {
        return {
          status: HealthStatus.HEALTHY,
          message: `HTTP ${response.status}`,
          durationMs,
        };
      }

      return {
        status: HealthStatus.UNHEALTHY,
        message: `Unexpected status: ${response.status}`,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message =
        error instanceof Error ? error.message : 'Health check failed';

      return {
        status: HealthStatus.UNHEALTHY,
        message,
        durationMs,
      };
    }
  };
}

// ============================================================================
// TCP Health Check
// ============================================================================

export function createTcpHealthCheck(
  _host: string,
  _port: number,
  options: {
    timeout?: Duration;
  } = {}
): HealthCheckFunction {
  const { timeout = 5000 } = options;

  return async (): Promise<HealthCheckResult> => {
    const startTime = Date.now();

    // In a browser environment, we can't do raw TCP connections
    // This would need to be implemented using Node.js net module
    // For now, return a simulated result
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), Math.min(100, timeout / 10));
    });

    const durationMs = Date.now() - startTime;

    return {
      status: HealthStatus.HEALTHY,
      message: 'TCP connection check (simulated)',
      durationMs,
    };
  };
}

// ============================================================================
// Custom Health Check
// ============================================================================

export function createCustomHealthCheck(
  check: () => Promise<boolean> | boolean,
  options: {
    timeout?: Duration;
    healthyMessage?: string;
    unhealthyMessage?: string;
  } = {}
): HealthCheckFunction {
  const {
    timeout = 5000,
    healthyMessage = 'Check passed',
    unhealthyMessage = 'Check failed',
  } = options;

  return async (): Promise<HealthCheckResult> => {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeout);
      });

      const checkPromise = Promise.resolve(check());
      const checkResult = await Promise.race([checkPromise, timeoutPromise]);

      const durationMs = Date.now() - startTime;

      return {
        status: checkResult ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        message: checkResult ? healthyMessage : unhealthyMessage,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message =
        error instanceof Error ? error.message : 'Health check failed';

      return {
        status: HealthStatus.UNHEALTHY,
        message,
        durationMs,
      };
    }
  };
}

// ============================================================================
// Health Check Registry
// ============================================================================

export class HealthCheckRegistry {
  private readonly checks: Map<
    string,
    { config: HealthCheck; fn: HealthCheckFunction }
  > = new Map();
  private checkTimer?: ReturnType<typeof setInterval>;

  // ==========================================================================
  // Registration
  // ==========================================================================

  register(
    name: string,
    fn: HealthCheckFunction,
    options: {
      description?: string;
      type?: HealthCheckType;
      endpoint?: string;
      timeout?: Duration;
      interval?: Duration;
      unhealthyThreshold?: number;
      healthyThreshold?: number;
    } = {}
  ): void {
    const config: HealthCheck = {
      name,
      description: options.description,
      type: options.type ?? HealthCheckType.CUSTOM,
      endpoint: options.endpoint,
      timeout: options.timeout ?? 5000,
      interval: options.interval ?? 30000,
      status: HealthStatus.UNKNOWN,
      unhealthyThreshold: options.unhealthyThreshold ?? 3,
      healthyThreshold: options.healthyThreshold ?? 2,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
    };

    this.checks.set(name, { config, fn });
  }

  registerHttp(
    name: string,
    endpoint: string,
    options: {
      description?: string;
      method?: string;
      headers?: Record<string, string>;
      expectedStatus?: number;
      timeout?: Duration;
      interval?: Duration;
    } = {}
  ): void {
    const fn = createHttpHealthCheck(endpoint, {
      method: options.method,
      headers: options.headers,
      expectedStatus: options.expectedStatus,
      timeout: options.timeout,
    });

    this.register(name, fn, {
      ...options,
      type: HealthCheckType.HTTP,
      endpoint,
    });
  }

  registerCustom(
    name: string,
    check: () => Promise<boolean> | boolean,
    options: {
      description?: string;
      timeout?: Duration;
      interval?: Duration;
    } = {}
  ): void {
    const fn = createCustomHealthCheck(check, { timeout: options.timeout });
    this.register(name, fn, { ...options, type: HealthCheckType.CUSTOM });
  }

  unregister(name: string): boolean {
    return this.checks.delete(name);
  }

  // ==========================================================================
  // Health Check Execution
  // ==========================================================================

  async check(input: CheckHealthInput = {}): Promise<Result<CheckHealthOutput>> {
    try {
      const checkNames = input.checks ?? Array.from(this.checks.keys());
      const results: Record<string, HealthCheckResult> = {};
      let overallStatus = HealthStatus.HEALTHY;

      await Promise.all(
        checkNames.map(async (name) => {
          const entry = this.checks.get(name);
          if (!entry) {
            results[name] = {
              status: HealthStatus.UNKNOWN,
              message: 'Check not found',
              durationMs: 0,
            };
            return;
          }

          const { config, fn } = entry;
          const result = await fn();

          // Update consecutive counters
          if (result.status === HealthStatus.HEALTHY) {
            config.consecutiveSuccesses++;
            config.consecutiveFailures = 0;
            config.lastSuccessAt = new Date();
          } else {
            config.consecutiveFailures++;
            config.consecutiveSuccesses = 0;
            config.lastFailureAt = new Date();
          }

          config.lastCheckAt = new Date();

          // Determine effective status based on thresholds
          let effectiveStatus = config.status;

          if (result.status === HealthStatus.HEALTHY) {
            if (config.consecutiveSuccesses >= config.healthyThreshold) {
              effectiveStatus = HealthStatus.HEALTHY;
            }
          } else {
            if (config.consecutiveFailures >= config.unhealthyThreshold) {
              effectiveStatus = HealthStatus.UNHEALTHY;
            } else if (config.consecutiveFailures > 0) {
              effectiveStatus = HealthStatus.DEGRADED;
            }
          }

          config.status = effectiveStatus;
          results[name] = {
            status: effectiveStatus,
            message: result.message,
            durationMs: result.durationMs,
          };

          // Update overall status
          if (effectiveStatus === HealthStatus.UNHEALTHY) {
            overallStatus = HealthStatus.UNHEALTHY;
          } else if (
            effectiveStatus === HealthStatus.DEGRADED &&
            overallStatus !== HealthStatus.UNHEALTHY
          ) {
            overallStatus = HealthStatus.DEGRADED;
          } else if (
            effectiveStatus === HealthStatus.UNKNOWN &&
            overallStatus === HealthStatus.HEALTHY
          ) {
            overallStatus = HealthStatus.UNKNOWN;
          }
        })
      );

      return success({
        status: overallStatus,
        checks: results,
      });
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  async checkOne(name: string): Promise<Result<HealthCheckResult>> {
    try {
      const entry = this.checks.get(name);
      if (!entry) {
        return failure(new Error(`Health check not found: ${name}`));
      }

      const result = await entry.fn();
      return success(result);
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // ==========================================================================
  // Background Checking
  // ==========================================================================

  startBackgroundChecks(defaultInterval: Duration = 30000): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(async () => {
      await this.check();
    }, defaultInterval);
  }

  stopBackgroundChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  getStatus(name: string): HealthStatus | undefined {
    return this.checks.get(name)?.config.status;
  }

  getConfig(name: string): HealthCheck | undefined {
    return this.checks.get(name)?.config;
  }

  listChecks(): string[] {
    return Array.from(this.checks.keys());
  }

  getOverallStatus(): HealthStatus {
    let status = HealthStatus.HEALTHY;

    for (const { config } of this.checks.values()) {
      if (config.status === HealthStatus.UNHEALTHY) {
        return HealthStatus.UNHEALTHY;
      }
      if (config.status === HealthStatus.DEGRADED) {
        status = HealthStatus.DEGRADED;
      } else if (
        config.status === HealthStatus.UNKNOWN &&
        status === HealthStatus.HEALTHY
      ) {
        status = HealthStatus.UNKNOWN;
      }
    }

    return status;
  }
}

// ============================================================================
// Liveness and Readiness Probes (Kubernetes-style)
// ============================================================================

export class ProbeRegistry {
  private readonly liveness: HealthCheckRegistry;
  private readonly readiness: HealthCheckRegistry;

  constructor() {
    this.liveness = new HealthCheckRegistry();
    this.readiness = new HealthCheckRegistry();
  }

  registerLivenessCheck(
    name: string,
    fn: HealthCheckFunction,
    options?: Parameters<HealthCheckRegistry['register']>[2]
  ): void {
    this.liveness.register(name, fn, options);
  }

  registerReadinessCheck(
    name: string,
    fn: HealthCheckFunction,
    options?: Parameters<HealthCheckRegistry['register']>[2]
  ): void {
    this.readiness.register(name, fn, options);
  }

  async checkLiveness(): Promise<Result<CheckHealthOutput>> {
    return this.liveness.check();
  }

  async checkReadiness(): Promise<Result<CheckHealthOutput>> {
    return this.readiness.check();
  }

  isLive(): boolean {
    return this.liveness.getOverallStatus() !== HealthStatus.UNHEALTHY;
  }

  isReady(): boolean {
    return this.readiness.getOverallStatus() === HealthStatus.HEALTHY;
  }
}

// ============================================================================
// Default Registry
// ============================================================================

let defaultHealthRegistry: HealthCheckRegistry | null = null;

export function getDefaultHealthRegistry(): HealthCheckRegistry {
  if (!defaultHealthRegistry) {
    defaultHealthRegistry = new HealthCheckRegistry();
  }
  return defaultHealthRegistry;
}

export function setDefaultHealthRegistry(registry: HealthCheckRegistry): void {
  defaultHealthRegistry = registry;
}

// ============================================================================
// Module Exports
// ============================================================================

export default {
  HealthCheckRegistry,
  ProbeRegistry,
  createHttpHealthCheck,
  createTcpHealthCheck,
  createCustomHealthCheck,
  getDefaultHealthRegistry,
  setDefaultHealthRegistry,
};
