/**
 * Kubernetes Probe Generator
 * 
 * Generates Kubernetes-compatible health check endpoints.
 */

import type {
  HealthCheckConfig,
  CheckResult,
  KubernetesProbeConfig,
} from '../types.js';
import { HealthAggregator } from '../aggregator.js';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ProbeResponse {
  status: number;
  body: ProbeBody;
}

export interface ProbeBody {
  status: 'ok' | 'fail';
  checks?: Record<string, CheckResult>;
}

export interface ProbeHandlers {
  liveness: () => Promise<ProbeResponse>;
  readiness: () => Promise<ProbeResponse>;
  startup?: () => Promise<ProbeResponse>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes Probe Generator
// ═══════════════════════════════════════════════════════════════════════════

export class KubernetesProbeGenerator {
  private aggregator: HealthAggregator;
  private config: Required<KubernetesProbeConfig>;
  private startupComplete: boolean = false;

  constructor(
    checks: HealthCheckConfig[],
    config: KubernetesProbeConfig
  ) {
    this.aggregator = new HealthAggregator(checks);
    this.config = {
      version: config.version,
      serviceName: config.serviceName,
      includeDetails: config.includeDetails ?? false,
      customHeaders: config.customHeaders ?? {},
      livenessPath: config.livenessPath ?? '/health/live',
      readinessPath: config.readinessPath ?? '/health/ready',
      startupPath: config.startupPath ?? '/health/startup',
      includeStartupProbe: config.includeStartupProbe ?? false,
    };
  }

  /**
   * Get probe handlers
   */
  getHandlers(): ProbeHandlers {
    const handlers: ProbeHandlers = {
      liveness: () => this.handleLiveness(),
      readiness: () => this.handleReadiness(),
    };

    if (this.config.includeStartupProbe) {
      handlers.startup = () => this.handleStartup();
    }

    return handlers;
  }

  /**
   * Liveness probe - checks if the process is running
   * Should be lightweight and always succeed unless the process is truly dead
   */
  async handleLiveness(): Promise<ProbeResponse> {
    // Optional: Check event loop responsiveness
    const eventLoopLag = await this.measureEventLoopLag();
    const lagThreshold = 5000; // 5 seconds

    if (eventLoopLag > lagThreshold) {
      return {
        status: 503,
        body: {
          status: 'fail',
          checks: this.config.includeDetails ? {
            eventLoop: {
              status: 'unhealthy',
              message: `Event loop blocked for ${eventLoopLag}ms`,
              timestamp: Date.now(),
            },
          } : undefined,
        },
      };
    }

    return {
      status: 200,
      body: {
        status: 'ok',
        checks: this.config.includeDetails ? {
          process: {
            status: 'healthy',
            details: {
              uptime: process.uptime(),
              pid: process.pid,
            },
            timestamp: Date.now(),
          },
        } : undefined,
      },
    };
  }

  /**
   * Readiness probe - checks if the service can accept traffic
   * Verifies all critical dependencies are available
   */
  async handleReadiness(): Promise<ProbeResponse> {
    const result = await this.aggregator.checkAll();

    // Ready if all critical checks pass
    const isReady = result.criticalFailures.length === 0;

    return {
      status: isReady ? 200 : 503,
      body: {
        status: isReady ? 'ok' : 'fail',
        checks: this.config.includeDetails
          ? Object.fromEntries(result.checks)
          : undefined,
      },
    };
  }

  /**
   * Startup probe - checks if the application has started
   * Used during initial startup to allow time for initialization
   */
  async handleStartup(): Promise<ProbeResponse> {
    if (this.startupComplete) {
      return {
        status: 200,
        body: { status: 'ok' },
      };
    }

    // Perform startup checks
    const result = await this.aggregator.checkAll();
    const isStarted = result.criticalFailures.length === 0;

    if (isStarted) {
      this.startupComplete = true;
    }

    return {
      status: isStarted ? 200 : 503,
      body: {
        status: isStarted ? 'ok' : 'fail',
        checks: this.config.includeDetails
          ? Object.fromEntries(result.checks)
          : undefined,
      },
    };
  }

  /**
   * Mark startup as complete
   */
  markStartupComplete(): void {
    this.startupComplete = true;
  }

  /**
   * Measure event loop lag
   */
  private measureEventLoopLag(): Promise<number> {
    const start = Date.now();
    return new Promise(resolve => {
      setImmediate(() => {
        resolve(Date.now() - start);
      });
    });
  }

  /**
   * Get probe paths for Kubernetes deployment config
   */
  getProbePaths(): {
    liveness: string;
    readiness: string;
    startup?: string;
  } {
    return {
      liveness: this.config.livenessPath,
      readiness: this.config.readinessPath,
      startup: this.config.includeStartupProbe ? this.config.startupPath : undefined,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes Deployment YAML Generator
// ═══════════════════════════════════════════════════════════════════════════

export interface ProbeYamlConfig {
  containerPort: number;
  initialDelaySeconds?: number;
  periodSeconds?: number;
  timeoutSeconds?: number;
  successThreshold?: number;
  failureThreshold?: number;
}

/**
 * Generate Kubernetes probe YAML configuration
 */
export function generateProbeYaml(
  paths: ReturnType<KubernetesProbeGenerator['getProbePaths']>,
  config: ProbeYamlConfig
): string {
  const defaultConfig = {
    initialDelaySeconds: config.initialDelaySeconds ?? 10,
    periodSeconds: config.periodSeconds ?? 10,
    timeoutSeconds: config.timeoutSeconds ?? 5,
    successThreshold: config.successThreshold ?? 1,
    failureThreshold: config.failureThreshold ?? 3,
  };

  let yaml = `livenessProbe:
  httpGet:
    path: ${paths.liveness}
    port: ${config.containerPort}
  initialDelaySeconds: ${defaultConfig.initialDelaySeconds}
  periodSeconds: ${defaultConfig.periodSeconds}
  timeoutSeconds: ${defaultConfig.timeoutSeconds}
  successThreshold: ${defaultConfig.successThreshold}
  failureThreshold: ${defaultConfig.failureThreshold}

readinessProbe:
  httpGet:
    path: ${paths.readiness}
    port: ${config.containerPort}
  initialDelaySeconds: ${defaultConfig.initialDelaySeconds}
  periodSeconds: ${defaultConfig.periodSeconds}
  timeoutSeconds: ${defaultConfig.timeoutSeconds}
  successThreshold: ${defaultConfig.successThreshold}
  failureThreshold: ${defaultConfig.failureThreshold}`;

  if (paths.startup) {
    yaml += `

startupProbe:
  httpGet:
    path: ${paths.startup}
    port: ${config.containerPort}
  initialDelaySeconds: 0
  periodSeconds: 5
  timeoutSeconds: ${defaultConfig.timeoutSeconds}
  successThreshold: 1
  failureThreshold: 30`;
  }

  return yaml;
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create Kubernetes probe generator
 */
export function createKubernetesProbes(
  checks: HealthCheckConfig[],
  config: KubernetesProbeConfig
): KubernetesProbeGenerator {
  return new KubernetesProbeGenerator(checks, config);
}

/**
 * Create standalone liveness probe function
 */
export function livenessProbe(): () => Promise<ProbeResponse> {
  return async () => ({
    status: 200,
    body: {
      status: 'ok',
      checks: {
        process: {
          status: 'healthy',
          details: {
            uptime: process.uptime(),
            pid: process.pid,
          },
          timestamp: Date.now(),
        },
      },
    },
  });
}

/**
 * Create standalone readiness probe function
 */
export function readinessProbe(
  checks: HealthCheckConfig[]
): () => Promise<ProbeResponse> {
  const aggregator = new HealthAggregator(checks);

  return async () => {
    const result = await aggregator.checkAll();
    const isReady = result.criticalFailures.length === 0;

    return {
      status: isReady ? 200 : 503,
      body: {
        status: isReady ? 'ok' : 'fail',
        checks: Object.fromEntries(result.checks),
      },
    };
  };
}
