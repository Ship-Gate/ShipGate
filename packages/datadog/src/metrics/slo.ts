// ============================================================================
// SLO (Service Level Objective) Metrics
// ============================================================================

import type { DatadogClient } from '../client.js';
import type { SLOMetric, Domain, TemporalSpec } from '../types.js';

/**
 * SLO definition
 */
export interface SLODefinition {
  name: string;
  description?: string;
  target: number;
  windowDays: number;
  type: 'availability' | 'latency' | 'error_rate' | 'throughput' | 'coverage';
  thresholds?: {
    warning?: number;
    critical?: number;
  };
}

/**
 * SLO status
 */
export interface SLOStatus {
  name: string;
  target: number;
  current: number;
  errorBudget: number;
  errorBudgetRemaining: number;
  status: 'healthy' | 'warning' | 'critical' | 'breached';
  burnRate: number;
}

/**
 * SLO event window
 */
interface SLOWindow {
  goodEvents: number;
  totalEvents: number;
  startTime: Date;
}

/**
 * SLO metrics collector
 * 
 * Tracks Service Level Objectives for ISL verification including:
 * - Verification success rate SLOs
 * - Latency SLOs (from temporal specs)
 * - Coverage SLOs
 * - Error budget tracking
 * 
 * @example
 * ```typescript
 * const slo = new SLOMetrics(client);
 * 
 * slo.defineVerificationSLO('auth', 'login', {
 *   name: 'login-verification-success',
 *   target: 99.9,
 *   windowDays: 30,
 *   type: 'availability',
 * });
 * 
 * slo.recordEvent('auth', 'login', 'login-verification-success', true);
 * ```
 */
export class SLOMetrics {
  private client: DatadogClient;
  private slos: Map<string, SLODefinition> = new Map();
  private windows: Map<string, SLOWindow> = new Map();

  constructor(client: DatadogClient) {
    this.client = client;
  }

  /**
   * Define a verification SLO
   */
  defineVerificationSLO(
    domain: string,
    behavior: string,
    definition: SLODefinition
  ): void {
    const key = this.buildKey(domain, behavior, definition.name);
    this.slos.set(key, definition);
    
    // Initialize window
    this.windows.set(key, {
      goodEvents: 0,
      totalEvents: 0,
      startTime: new Date(),
    });

    // Record SLO definition as metric
    const tags = [
      `domain:${domain}`,
      `behavior:${behavior}`,
      `slo:${definition.name}`,
      `type:${definition.type}`,
    ];
    
    this.client.gauge('slo.target', definition.target, tags);
    this.client.gauge('slo.window_days', definition.windowDays, tags);
  }

  /**
   * Generate SLOs from ISL domain temporal specs
   */
  generateFromDomain(domain: Domain): SLODefinition[] {
    const slos: SLODefinition[] = [];

    for (const behavior of domain.behaviors) {
      // Create default verification SLO
      slos.push({
        name: `${behavior.name}-verification`,
        description: `Verification success rate for ${behavior.name}`,
        target: 99.9,
        windowDays: 30,
        type: 'availability',
      });

      // Create latency SLOs from temporal specs
      if (behavior.temporal) {
        for (const temporal of behavior.temporal) {
          const latencySLO = this.temporalToSLO(behavior.name, temporal);
          if (latencySLO) {
            slos.push(latencySLO);
            this.defineVerificationSLO(domain.name, behavior.name, latencySLO);
          }
        }
      }

      // Register the verification SLO
      this.defineVerificationSLO(domain.name, behavior.name, slos[slos.length - 1]!);
    }

    return slos;
  }

  /**
   * Record an SLO event
   */
  recordEvent(
    domain: string,
    behavior: string,
    sloName: string,
    isGood: boolean
  ): void {
    const key = this.buildKey(domain, behavior, sloName);
    const window = this.windows.get(key);
    const slo = this.slos.get(key);

    if (!window || !slo) {
      return;
    }

    // Update window
    window.totalEvents++;
    if (isGood) {
      window.goodEvents++;
    }

    // Check if window needs rotation
    this.maybeRotateWindow(key, slo.windowDays);

    // Calculate and record current SLI
    const current = window.totalEvents > 0 
      ? (window.goodEvents / window.totalEvents) * 100 
      : 100;

    const tags = [
      `domain:${domain}`,
      `behavior:${behavior}`,
      `slo:${sloName}`,
    ];

    this.client.gauge('slo.current', current, tags);
    this.client.gauge('slo.good_events', window.goodEvents, tags);
    this.client.gauge('slo.total_events', window.totalEvents, tags);

    // Error budget
    const errorBudget = 100 - slo.target;
    const errorBudgetUsed = Math.max(0, slo.target - current);
    const errorBudgetRemaining = Math.max(0, errorBudget - errorBudgetUsed);

    this.client.gauge('slo.error_budget', errorBudget, tags);
    this.client.gauge('slo.error_budget_used', errorBudgetUsed, tags);
    this.client.gauge('slo.error_budget_remaining', errorBudgetRemaining, tags);

    // Burn rate (how fast we're consuming error budget)
    const windowMs = slo.windowDays * 24 * 60 * 60 * 1000;
    const elapsedMs = Date.now() - window.startTime.getTime();
    const expectedBurnRate = elapsedMs / windowMs;
    const actualBurnRate = errorBudgetUsed / errorBudget;
    const burnRate = expectedBurnRate > 0 ? actualBurnRate / expectedBurnRate : 0;

    this.client.gauge('slo.burn_rate', burnRate, tags);

    // Status tracking
    this.recordStatus(domain, behavior, sloName, slo, current, burnRate);
  }

  /**
   * Record SLO metric directly
   */
  recordSLOMetric(metric: SLOMetric): void {
    this.client.recordSLO(metric);
  }

  /**
   * Get SLO status
   */
  getStatus(domain: string, behavior: string, sloName: string): SLOStatus | null {
    const key = this.buildKey(domain, behavior, sloName);
    const window = this.windows.get(key);
    const slo = this.slos.get(key);

    if (!window || !slo) {
      return null;
    }

    const current = window.totalEvents > 0 
      ? (window.goodEvents / window.totalEvents) * 100 
      : 100;

    const errorBudget = 100 - slo.target;
    const errorBudgetUsed = Math.max(0, slo.target - current);
    const errorBudgetRemaining = Math.max(0, errorBudget - errorBudgetUsed);

    const windowMs = slo.windowDays * 24 * 60 * 60 * 1000;
    const elapsedMs = Date.now() - window.startTime.getTime();
    const expectedBurnRate = elapsedMs / windowMs;
    const actualBurnRate = errorBudgetUsed / errorBudget;
    const burnRate = expectedBurnRate > 0 ? actualBurnRate / expectedBurnRate : 0;

    let status: SLOStatus['status'] = 'healthy';
    if (current < slo.target) {
      status = 'breached';
    } else if (burnRate > 2) {
      status = 'critical';
    } else if (burnRate > 1) {
      status = 'warning';
    }

    return {
      name: sloName,
      target: slo.target,
      current,
      errorBudget,
      errorBudgetRemaining,
      status,
      burnRate,
    };
  }

  /**
   * Get all SLO statuses for a domain
   */
  getDomainStatuses(domain: string): SLOStatus[] {
    const statuses: SLOStatus[] = [];

    for (const [key, slo] of this.slos) {
      if (key.startsWith(`${domain}.`)) {
        const parts = key.split('.');
        const behavior = parts[1];
        const sloName = parts.slice(2).join('.');
        
        if (behavior) {
          const status = this.getStatus(domain, behavior, sloName);
          if (status) {
            statuses.push(status);
          }
        }
      }
    }

    return statuses;
  }

  /**
   * Reset SLO window (for testing or manual reset)
   */
  resetWindow(domain: string, behavior: string, sloName: string): void {
    const key = this.buildKey(domain, behavior, sloName);
    
    if (this.windows.has(key)) {
      this.windows.set(key, {
        goodEvents: 0,
        totalEvents: 0,
        startTime: new Date(),
      });
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildKey(domain: string, behavior: string, sloName: string): string {
    return `${domain}.${behavior}.${sloName}`;
  }

  private temporalToSLO(behaviorName: string, temporal: TemporalSpec): SLODefinition | null {
    if (temporal.operator !== 'within' || !temporal.duration) {
      return null;
    }

    const durationMs = this.parseDuration(temporal.duration);
    const percentile = temporal.percentile ?? 99;

    return {
      name: `${behaviorName}-latency-p${percentile}`,
      description: `p${percentile} latency for ${behaviorName} within ${temporal.duration}`,
      target: percentile,
      windowDays: 30,
      type: 'latency',
      thresholds: {
        warning: durationMs * 0.8,
        critical: durationMs,
      },
    };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)(ms|s|m|h)$/);
    if (!match) return 1000;

    const value = parseInt(match[1]!, 10);
    const unit = match[2];

    switch (unit) {
      case 'ms': return value;
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      default: return 1000;
    }
  }

  private maybeRotateWindow(key: string, windowDays: number): void {
    const window = this.windows.get(key);
    if (!window) return;

    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - window.startTime.getTime();

    if (elapsed > windowMs) {
      this.windows.set(key, {
        goodEvents: 0,
        totalEvents: 0,
        startTime: new Date(),
      });
    }
  }

  private recordStatus(
    domain: string,
    behavior: string,
    sloName: string,
    slo: SLODefinition,
    current: number,
    burnRate: number
  ): void {
    const tags = [
      `domain:${domain}`,
      `behavior:${behavior}`,
      `slo:${sloName}`,
    ];

    // Status as numeric (for alerting)
    let statusValue = 0;
    if (current < slo.target) {
      statusValue = 3; // breached
    } else if (burnRate > 2) {
      statusValue = 2; // critical
    } else if (burnRate > 1) {
      statusValue = 1; // warning
    }

    this.client.gauge('slo.status', statusValue, tags);

    // Increment status counters
    const statusNames = ['healthy', 'warning', 'critical', 'breached'];
    this.client.increment(`slo.status.${statusNames[statusValue]}`, 1, tags);
  }
}

/**
 * Create an SLO metrics collector
 */
export function createSLOMetrics(client: DatadogClient): SLOMetrics {
  return new SLOMetrics(client);
}
