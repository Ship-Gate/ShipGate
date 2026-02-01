/**
 * Custom Health Checks
 * 
 * Utilities for creating custom health checks.
 */

import type {
  HealthCheckConfig,
  CheckResult,
  CustomCheckConfig,
  HealthStatus,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Custom Check Factory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a custom health check
 */
export function createCustomCheck(config: CustomCheckConfig): HealthCheckConfig {
  return {
    name: config.name,
    critical: config.critical ?? false,
    timeout: config.timeout ?? 5000,
    tags: config.tags,
    check: async () => {
      const start = Date.now();

      try {
        const result = await Promise.race([
          config.check(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Check timeout')), config.timeout ?? 5000)
          ),
        ]);

        const latency = Date.now() - start;

        if (typeof result === 'boolean') {
          return {
            status: result ? 'healthy' : 'unhealthy',
            latency,
            timestamp: Date.now(),
          };
        }

        return {
          status: result.status ? 'healthy' : 'unhealthy',
          latency,
          message: result.message,
          details: result.details,
          timestamp: Date.now(),
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          latency: Date.now() - start,
          message: error instanceof Error ? error.message : 'Check failed',
          timestamp: Date.now(),
        };
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Disk Space Check
// ═══════════════════════════════════════════════════════════════════════════

export interface DiskSpaceOptions {
  path?: string;
  warningThreshold?: number; // Percentage (0-100)
  criticalThreshold?: number; // Percentage (0-100)
  critical?: boolean;
}

/**
 * Create a disk space health check
 */
export function createDiskSpaceCheck(
  name: string = 'disk-space',
  options: DiskSpaceOptions = {}
): HealthCheckConfig {
  const warningThreshold = options.warningThreshold ?? 80;
  const criticalThreshold = options.criticalThreshold ?? 95;

  return createCustomCheck({
    name,
    critical: options.critical ?? false,
    check: async () => {
      const { statfs } = await import('node:fs/promises');
      const stats = await statfs(options.path ?? '/');
      
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bfree * stats.bsize;
      const usedBytes = totalBytes - freeBytes;
      const usedPercent = (usedBytes / totalBytes) * 100;

      let status = true;
      let message: string | undefined;

      if (usedPercent >= criticalThreshold) {
        status = false;
        message = `Disk usage critical: ${usedPercent.toFixed(1)}%`;
      } else if (usedPercent >= warningThreshold) {
        message = `Disk usage warning: ${usedPercent.toFixed(1)}%`;
      }

      return {
        status,
        message,
        details: {
          path: options.path ?? '/',
          totalBytes,
          freeBytes,
          usedBytes,
          usedPercent: `${usedPercent.toFixed(1)}%`,
        },
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Memory Check
// ═══════════════════════════════════════════════════════════════════════════

export interface MemoryOptions {
  heapWarningThreshold?: number; // MB
  heapCriticalThreshold?: number; // MB
  rssWarningThreshold?: number; // MB
  rssCriticalThreshold?: number; // MB
  critical?: boolean;
}

/**
 * Create a memory usage health check
 */
export function createMemoryCheck(
  name: string = 'memory',
  options: MemoryOptions = {}
): HealthCheckConfig {
  const heapWarning = (options.heapWarningThreshold ?? 500) * 1024 * 1024;
  const heapCritical = (options.heapCriticalThreshold ?? 1000) * 1024 * 1024;
  const rssWarning = (options.rssWarningThreshold ?? 1000) * 1024 * 1024;
  const rssCritical = (options.rssCriticalThreshold ?? 2000) * 1024 * 1024;

  return createCustomCheck({
    name,
    critical: options.critical ?? false,
    check: async () => {
      const mem = process.memoryUsage();
      const messages: string[] = [];
      let status = true;

      if (mem.heapUsed >= heapCritical) {
        status = false;
        messages.push(`Heap critical: ${formatBytes(mem.heapUsed)}`);
      } else if (mem.heapUsed >= heapWarning) {
        messages.push(`Heap warning: ${formatBytes(mem.heapUsed)}`);
      }

      if (mem.rss >= rssCritical) {
        status = false;
        messages.push(`RSS critical: ${formatBytes(mem.rss)}`);
      } else if (mem.rss >= rssWarning) {
        messages.push(`RSS warning: ${formatBytes(mem.rss)}`);
      }

      return {
        status,
        message: messages.length > 0 ? messages.join('; ') : undefined,
        details: {
          heapUsed: formatBytes(mem.heapUsed),
          heapTotal: formatBytes(mem.heapTotal),
          rss: formatBytes(mem.rss),
          external: formatBytes(mem.external),
        },
      };
    },
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CPU Check
// ═══════════════════════════════════════════════════════════════════════════

export interface CpuOptions {
  warningThreshold?: number; // Percentage (0-100)
  criticalThreshold?: number; // Percentage (0-100)
  sampleDuration?: number; // ms
  critical?: boolean;
}

/**
 * Create a CPU usage health check
 */
export function createCpuCheck(
  name: string = 'cpu',
  options: CpuOptions = {}
): HealthCheckConfig {
  const warningThreshold = options.warningThreshold ?? 80;
  const criticalThreshold = options.criticalThreshold ?? 95;
  const sampleDuration = options.sampleDuration ?? 100;

  return createCustomCheck({
    name,
    critical: options.critical ?? false,
    check: async () => {
      const os = await import('node:os');
      
      // Sample CPU usage
      const startCpus = os.cpus();
      await new Promise(resolve => setTimeout(resolve, sampleDuration));
      const endCpus = os.cpus();

      let totalIdle = 0;
      let totalTick = 0;

      for (let i = 0; i < startCpus.length; i++) {
        const startCpu = startCpus[i];
        const endCpu = endCpus[i];

        const idleDiff = endCpu.times.idle - startCpu.times.idle;
        const totalDiff =
          (endCpu.times.user - startCpu.times.user) +
          (endCpu.times.nice - startCpu.times.nice) +
          (endCpu.times.sys - startCpu.times.sys) +
          (endCpu.times.idle - startCpu.times.idle) +
          (endCpu.times.irq - startCpu.times.irq);

        totalIdle += idleDiff;
        totalTick += totalDiff;
      }

      const cpuPercent = totalTick > 0 ? ((1 - totalIdle / totalTick) * 100) : 0;
      
      let status = true;
      let message: string | undefined;

      if (cpuPercent >= criticalThreshold) {
        status = false;
        message = `CPU critical: ${cpuPercent.toFixed(1)}%`;
      } else if (cpuPercent >= warningThreshold) {
        message = `CPU warning: ${cpuPercent.toFixed(1)}%`;
      }

      return {
        status,
        message,
        details: {
          cpuPercent: `${cpuPercent.toFixed(1)}%`,
          cores: os.cpus().length,
          loadAvg: os.loadavg(),
        },
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Loop Lag Check
// ═══════════════════════════════════════════════════════════════════════════

export interface EventLoopOptions {
  warningThreshold?: number; // ms
  criticalThreshold?: number; // ms
  critical?: boolean;
}

/**
 * Create an event loop lag health check
 */
export function createEventLoopCheck(
  name: string = 'event-loop',
  options: EventLoopOptions = {}
): HealthCheckConfig {
  const warningThreshold = options.warningThreshold ?? 100;
  const criticalThreshold = options.criticalThreshold ?? 500;

  return createCustomCheck({
    name,
    critical: options.critical ?? true,
    check: async () => {
      const start = Date.now();
      
      // Measure event loop lag
      const lag = await new Promise<number>(resolve => {
        const expected = Date.now() + 1;
        setImmediate(() => {
          resolve(Date.now() - expected);
        });
      });

      let status = true;
      let message: string | undefined;

      if (lag >= criticalThreshold) {
        status = false;
        message = `Event loop lag critical: ${lag}ms`;
      } else if (lag >= warningThreshold) {
        message = `Event loop lag warning: ${lag}ms`;
      }

      return {
        status,
        message,
        details: {
          lagMs: lag,
          uptime: process.uptime(),
        },
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// File Existence Check
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a file existence health check
 */
export function createFileExistsCheck(
  name: string,
  filePath: string,
  options: { critical?: boolean } = {}
): HealthCheckConfig {
  return createCustomCheck({
    name,
    critical: options.critical ?? false,
    check: async () => {
      const { access, constants } = await import('node:fs/promises');
      
      try {
        await access(filePath, constants.F_OK);
        return { status: true, details: { path: filePath } };
      } catch {
        return {
          status: false,
          message: `File not found: ${filePath}`,
          details: { path: filePath },
        };
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Composite Check
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a composite health check from multiple checks
 */
export function createCompositeCheck(
  name: string,
  checks: HealthCheckConfig[],
  options: {
    allRequired?: boolean;
    critical?: boolean;
  } = {}
): HealthCheckConfig {
  return {
    name,
    critical: options.critical ?? false,
    check: async () => {
      const start = Date.now();
      const results: Array<{ name: string; result: CheckResult }> = [];

      await Promise.all(
        checks.map(async check => {
          const result = await check.check();
          results.push({ name: check.name, result });
        })
      );

      const latency = Date.now() - start;
      const allRequired = options.allRequired ?? true;

      let overallStatus: HealthStatus = 'healthy';
      const unhealthyChecks: string[] = [];
      const degradedChecks: string[] = [];

      for (const { name: checkName, result } of results) {
        if (result.status === 'unhealthy') {
          unhealthyChecks.push(checkName);
        } else if (result.status === 'degraded') {
          degradedChecks.push(checkName);
        }
      }

      if (allRequired && unhealthyChecks.length > 0) {
        overallStatus = 'unhealthy';
      } else if (unhealthyChecks.length > results.length / 2) {
        overallStatus = 'unhealthy';
      } else if (unhealthyChecks.length > 0 || degradedChecks.length > 0) {
        overallStatus = 'degraded';
      }

      return {
        status: overallStatus,
        latency,
        message:
          unhealthyChecks.length > 0
            ? `Unhealthy: ${unhealthyChecks.join(', ')}`
            : degradedChecks.length > 0
            ? `Degraded: ${degradedChecks.join(', ')}`
            : undefined,
        details: Object.fromEntries(
          results.map(({ name: n, result }) => [n, result])
        ),
        timestamp: Date.now(),
      };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Threshold-based Check
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a threshold-based health check
 */
export function createThresholdCheck<T extends number>(
  name: string,
  getValue: () => T | Promise<T>,
  options: {
    warningMin?: T;
    warningMax?: T;
    criticalMin?: T;
    criticalMax?: T;
    unit?: string;
    critical?: boolean;
  }
): HealthCheckConfig {
  return createCustomCheck({
    name,
    critical: options.critical ?? false,
    check: async () => {
      const value = await getValue();
      let status = true;
      let message: string | undefined;

      if (
        (options.criticalMin !== undefined && value < options.criticalMin) ||
        (options.criticalMax !== undefined && value > options.criticalMax)
      ) {
        status = false;
        message = `Value ${value}${options.unit ?? ''} outside critical range`;
      } else if (
        (options.warningMin !== undefined && value < options.warningMin) ||
        (options.warningMax !== undefined && value > options.warningMax)
      ) {
        message = `Value ${value}${options.unit ?? ''} outside warning range`;
      }

      return {
        status,
        message,
        details: {
          value: `${value}${options.unit ?? ''}`,
          warningMin: options.warningMin,
          warningMax: options.warningMax,
          criticalMin: options.criticalMin,
          criticalMax: options.criticalMax,
        },
      };
    },
  });
}
