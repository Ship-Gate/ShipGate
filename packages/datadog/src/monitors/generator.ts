// ============================================================================
// Monitor Generator
// ============================================================================

import type { DatadogMonitor, Domain, Behavior, TemporalSpec } from '../types.js';
import {
  verificationScoreMonitor,
  verificationFailureMonitor,
  verificationLatencyMonitor,
  coverageDropMonitor,
  sloBurnRateMonitor,
  sloBreachMonitor,
  type TemplateParams,
} from './templates.js';

/**
 * Monitor generation options
 */
export interface MonitorGeneratorOptions {
  /** Default alert channel */
  alertChannel?: string;
  /** Critical alert channel (PagerDuty, etc.) */
  criticalChannel?: string;
  /** Additional tags to apply to all monitors */
  tags?: string[];
  /** Include latency monitors (default: true) */
  includeLatency?: boolean;
  /** Include SLO monitors (default: true) */
  includeSLO?: boolean;
  /** Include coverage monitors (default: true) */
  includeCoverage?: boolean;
  /** Include anomaly detection monitors (default: false) */
  includeAnomalyDetection?: boolean;
  /** Default SLO target percentage (default: 99.9) */
  defaultSLOTarget?: number;
  /** Default latency threshold in ms (default: 500) */
  defaultLatencyThresholdMs?: number;
}

/**
 * Monitor generator result
 */
export interface MonitorGeneratorResult {
  monitors: DatadogMonitor[];
  summary: {
    total: number;
    byType: Record<string, number>;
    byDomain: Record<string, number>;
    byBehavior: Record<string, number>;
  };
}

const DEFAULT_OPTIONS: Required<MonitorGeneratorOptions> = {
  alertChannel: '@slack-platform-alerts',
  criticalChannel: '@pagerduty-platform',
  tags: [],
  includeLatency: true,
  includeSLO: true,
  includeCoverage: true,
  includeAnomalyDetection: false,
  defaultSLOTarget: 99.9,
  defaultLatencyThresholdMs: 500,
};

/**
 * Monitor Generator
 * 
 * Generates Datadog monitors from ISL domain specifications including:
 * - Verification score monitors
 * - Failure rate monitors
 * - Latency monitors (from temporal specs)
 * - SLO monitors
 * - Coverage monitors
 * 
 * @example
 * ```typescript
 * const generator = new MonitorGenerator({
 *   alertChannel: '@slack-engineering',
 *   criticalChannel: '@pagerduty-oncall',
 * });
 * 
 * const result = generator.generateForDomain(authDomain);
 * console.log(`Generated ${result.summary.total} monitors`);
 * 
 * // Export as JSON for Terraform/API
 * const json = generator.toJSON(result.monitors);
 * ```
 */
export class MonitorGenerator {
  private options: Required<MonitorGeneratorOptions>;

  constructor(options: MonitorGeneratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate all monitors for a domain
   */
  generateForDomain(domain: Domain): MonitorGeneratorResult {
    const monitors: DatadogMonitor[] = [];
    const summary = {
      total: 0,
      byType: {} as Record<string, number>,
      byDomain: {} as Record<string, number>,
      byBehavior: {} as Record<string, number>,
    };

    for (const behavior of domain.behaviors) {
      const behaviorMonitors = this.generateForBehavior(domain.name, behavior);
      monitors.push(...behaviorMonitors);

      // Update summary
      const behaviorKey = `${domain.name}.${behavior.name}`;
      summary.byBehavior[behaviorKey] = behaviorMonitors.length;
    }

    // Count by type and domain
    summary.total = monitors.length;
    summary.byDomain[domain.name] = monitors.length;

    for (const monitor of monitors) {
      const typeKey = monitor.type;
      summary.byType[typeKey] = (summary.byType[typeKey] ?? 0) + 1;
    }

    return { monitors, summary };
  }

  /**
   * Generate monitors for a specific behavior
   */
  generateForBehavior(domainName: string, behavior: Behavior): DatadogMonitor[] {
    const monitors: DatadogMonitor[] = [];
    const params: TemplateParams = {
      domain: domainName,
      behavior: behavior.name,
      alertChannel: this.options.alertChannel,
      criticalChannel: this.options.criticalChannel,
      tags: this.options.tags,
    };

    // Core verification monitors
    monitors.push(verificationScoreMonitor(params));
    monitors.push(verificationFailureMonitor(params));

    // Latency monitors from temporal specs
    if (this.options.includeLatency && behavior.temporal) {
      monitors.push(...this.generateLatencyMonitors(params, behavior.temporal));
    }

    // Coverage monitors
    if (this.options.includeCoverage) {
      monitors.push(coverageDropMonitor(params));
    }

    // SLO monitors
    if (this.options.includeSLO) {
      monitors.push(...this.generateSLOMonitors(params, behavior));
    }

    return monitors;
  }

  /**
   * Generate monitors for multiple domains
   */
  generateForDomains(domains: Domain[]): MonitorGeneratorResult {
    const allMonitors: DatadogMonitor[] = [];
    const summary = {
      total: 0,
      byType: {} as Record<string, number>,
      byDomain: {} as Record<string, number>,
      byBehavior: {} as Record<string, number>,
    };

    for (const domain of domains) {
      const result = this.generateForDomain(domain);
      allMonitors.push(...result.monitors);

      // Merge summaries
      summary.byDomain[domain.name] = result.summary.byDomain[domain.name] ?? 0;
      
      for (const [behavior, count] of Object.entries(result.summary.byBehavior)) {
        summary.byBehavior[behavior] = count;
      }

      for (const [type, count] of Object.entries(result.summary.byType)) {
        summary.byType[type] = (summary.byType[type] ?? 0) + count;
      }
    }

    summary.total = allMonitors.length;

    return { monitors: allMonitors, summary };
  }

  /**
   * Convert monitors to JSON for API/Terraform
   */
  toJSON(monitors: DatadogMonitor[]): string {
    return JSON.stringify(monitors, null, 2);
  }

  /**
   * Convert to Terraform format
   */
  toTerraform(monitors: DatadogMonitor[]): string {
    const resources: string[] = [];

    for (let i = 0; i < monitors.length; i++) {
      const monitor = monitors[i]!;
      const resourceName = this.sanitizeResourceName(monitor.name);

      resources.push(`
resource "datadog_monitor" "${resourceName}" {
  name    = ${JSON.stringify(monitor.name)}
  type    = ${JSON.stringify(monitor.type)}
  query   = ${JSON.stringify(monitor.query)}
  message = <<-EOT
${monitor.message}
  EOT

  tags = ${JSON.stringify(monitor.tags)}

  monitor_thresholds {
    ${monitor.options.thresholds.critical !== undefined ? `critical = ${monitor.options.thresholds.critical}` : ''}
    ${monitor.options.thresholds.warning !== undefined ? `warning  = ${monitor.options.thresholds.warning}` : ''}
  }

  ${monitor.options.notify_no_data !== undefined ? `notify_no_data    = ${monitor.options.notify_no_data}` : ''}
  ${monitor.options.no_data_timeframe !== undefined ? `no_data_timeframe = ${monitor.options.no_data_timeframe}` : ''}
  ${monitor.options.evaluation_delay !== undefined ? `evaluation_delay  = ${monitor.options.evaluation_delay}` : ''}
}
`);
    }

    return resources.join('\n');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateLatencyMonitors(
    params: TemplateParams,
    temporalSpecs: TemporalSpec[]
  ): DatadogMonitor[] {
    const monitors: DatadogMonitor[] = [];

    for (const temporal of temporalSpecs) {
      if (temporal.operator === 'within' && temporal.duration) {
        const thresholdMs = this.parseDuration(temporal.duration);
        const percentile = temporal.percentile ?? 99;

        monitors.push(verificationLatencyMonitor(params, thresholdMs, percentile));
      }
    }

    // Add default latency monitor if none generated
    if (monitors.length === 0) {
      monitors.push(
        verificationLatencyMonitor(params, this.options.defaultLatencyThresholdMs, 99)
      );
    }

    return monitors;
  }

  private generateSLOMonitors(params: TemplateParams, behavior: Behavior): DatadogMonitor[] {
    const monitors: DatadogMonitor[] = [];
    const sloName = `${behavior.name}-verification`;

    // Burn rate monitor
    monitors.push(sloBurnRateMonitor(params, sloName, {
      critical: 2,
      warning: 1,
    }));

    // Breach monitor
    monitors.push(sloBreachMonitor(params, sloName, this.options.defaultSLOTarget));

    return monitors;
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)(ms|s|m|h)$/);
    if (!match) return this.options.defaultLatencyThresholdMs;

    const value = parseInt(match[1]!, 10);
    const unit = match[2];

    switch (unit) {
      case 'ms': return value;
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return this.options.defaultLatencyThresholdMs;
    }
  }

  private sanitizeResourceName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}

/**
 * Create a monitor generator
 */
export function createMonitorGenerator(options?: MonitorGeneratorOptions): MonitorGenerator {
  return new MonitorGenerator(options);
}

/**
 * Generate monitors from a domain (convenience function)
 */
export function generateDatadogMonitors(
  domain: Domain,
  options?: MonitorGeneratorOptions
): DatadogMonitor[] {
  const generator = new MonitorGenerator(options);
  return generator.generateForDomain(domain).monitors;
}
