/**
 * Temporal Monitor
 * 
 * Monitors temporal constraints and SLA compliance.
 */

import type { Logger } from './runtime.js';

// ============================================================================
// Types
// ============================================================================

export interface TemporalEvent {
  behavior: string;
  timestamp: Date;
  duration: number;
  percentile?: string;
}

export interface TemporalViolation {
  behavior: string;
  constraint: string;
  expected: number;
  actual: number;
  timestamp: Date;
}

export interface TemporalConstraint {
  behavior: string;
  type: 'response' | 'eventually' | 'always' | 'never';
  duration: number;
  percentile?: number;
  predicate?: string;
}

// ============================================================================
// Temporal Monitor
// ============================================================================

export class TemporalMonitor {
  private logger: Logger;
  private events: TemporalEvent[] = [];
  private violations: TemporalViolation[] = [];
  private constraints: Map<string, TemporalConstraint[]> = new Map();
  private durations: Map<string, number[]> = new Map();
  private pendingEvents: Map<string, { predicate: string; deadline: Date }[]> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register temporal constraint
   */
  registerConstraint(constraint: TemporalConstraint): void {
    const existing = this.constraints.get(constraint.behavior) || [];
    existing.push(constraint);
    this.constraints.set(constraint.behavior, existing);
  }

  /**
   * Record behavior execution
   */
  recordExecution(behavior: string, duration: number): void {
    const event: TemporalEvent = {
      behavior,
      timestamp: new Date(),
      duration,
    };
    this.events.push(event);

    // Track durations for percentile calculations
    const behaviorDurations = this.durations.get(behavior) || [];
    behaviorDurations.push(duration);
    this.durations.set(behavior, behaviorDurations);

    // Check constraints
    this.checkResponseConstraints(behavior, duration);
  }

  /**
   * Record an eventual event (for "eventually" constraints)
   */
  recordEvent(eventName: string): void {
    const pending = this.pendingEvents.get(eventName);
    if (pending) {
      // Clear pending events that are now satisfied
      this.pendingEvents.set(
        eventName,
        pending.filter(p => new Date() > p.deadline)
      );
    }
  }

  /**
   * Schedule an eventual event check
   */
  expectEventually(predicate: string, deadline: Date): void {
    const pending = this.pendingEvents.get(predicate) || [];
    pending.push({ predicate, deadline });
    this.pendingEvents.set(predicate, pending);
  }

  /**
   * Get all events
   */
  getEvents(): TemporalEvent[] {
    return [...this.events];
  }

  /**
   * Get all violations
   */
  getViolations(): TemporalViolation[] {
    return [...this.violations];
  }

  /**
   * Get percentile latency
   */
  getPercentileLatency(behavior: string, percentile: number): number | null {
    const durations = this.durations.get(behavior);
    if (!durations || durations.length === 0) return null;

    const sorted = [...durations].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? null;
  }

  /**
   * Get statistics for a behavior
   */
  getStatistics(behavior: string): {
    count: number;
    p50: number | null;
    p95: number | null;
    p99: number | null;
    min: number | null;
    max: number | null;
    avg: number | null;
  } {
    const durations = this.durations.get(behavior);
    if (!durations || durations.length === 0) {
      return { count: 0, p50: null, p95: null, p99: null, min: null, max: null, avg: null };
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: durations.length,
      p50: this.getPercentileLatency(behavior, 50),
      p95: this.getPercentileLatency(behavior, 95),
      p99: this.getPercentileLatency(behavior, 99),
      min: sorted[0] ?? null,
      max: sorted[sorted.length - 1] ?? null,
      avg: sum / durations.length,
    };
  }

  /**
   * Check response time constraints
   */
  private checkResponseConstraints(behavior: string, duration: number): void {
    const constraints = this.constraints.get(behavior) || [];

    for (const constraint of constraints) {
      if (constraint.type !== 'response') continue;

      if (constraint.percentile) {
        // Check percentile constraint
        const currentPercentile = this.getPercentileLatency(behavior, constraint.percentile);
        if (currentPercentile !== null && currentPercentile > constraint.duration) {
          this.recordViolation({
            behavior,
            constraint: `p${constraint.percentile} <= ${constraint.duration}ms`,
            expected: constraint.duration,
            actual: currentPercentile,
            timestamp: new Date(),
          });
        }
      } else {
        // Check absolute constraint
        if (duration > constraint.duration) {
          this.recordViolation({
            behavior,
            constraint: `response <= ${constraint.duration}ms`,
            expected: constraint.duration,
            actual: duration,
            timestamp: new Date(),
          });
        }
      }
    }
  }

  /**
   * Record a violation
   */
  private recordViolation(violation: TemporalViolation): void {
    this.violations.push(violation);
    this.logger.warn(`Temporal violation: ${violation.behavior}`, violation);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.events = [];
    this.violations = [];
    this.durations.clear();
    this.pendingEvents.clear();
  }
}
