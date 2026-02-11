/**
 * Funnel analyzer — computes conversion rates across ordered steps.
 */

import { FunnelError } from '../errors.js';
import type { FunnelStep, FunnelEvent, FunnelResult, FunnelStepResult, FunnelConfig, EventPropertyFilter } from './types.js';

export class FunnelAnalyzer {
  private readonly steps: FunnelStep[];
  private readonly config: FunnelConfig;

  constructor(steps: FunnelStep[], config: Partial<FunnelConfig> = {}) {
    if (steps.length < 2) {
      throw new FunnelError('A funnel must have at least 2 steps.');
    }
    this.steps = steps;
    this.config = {
      conversionWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days default
      ...config,
    };
  }

  /**
   * Analyze a set of events against the funnel definition.
   * Events must include userId and timestamp.
   */
  analyze(events: FunnelEvent[]): FunnelResult {
    // Group events by user
    const byUser = new Map<string, FunnelEvent[]>();
    for (const e of events) {
      let list = byUser.get(e.userId);
      if (!list) {
        list = [];
        byUser.set(e.userId, list);
      }
      list.push(e);
    }

    // Sort each user's events by timestamp
    for (const list of byUser.values()) {
      list.sort((a, b) => a.timestamp - b.timestamp);
    }

    const stepCounts: number[] = new Array(this.steps.length).fill(0);
    const timesFromPrevious: number[][] = this.steps.map(() => []);
    const conversionTimes: number[] = [];

    for (const [, userEvents] of byUser) {
      const stepTimestamps = this.matchUser(userEvents);
      if (!stepTimestamps) continue;

      for (let i = 0; i < stepTimestamps.length; i++) {
        if (stepTimestamps[i] !== null) {
          stepCounts[i]++;
          if (i > 0 && stepTimestamps[i - 1] !== null) {
            timesFromPrevious[i].push(stepTimestamps[i]! - stepTimestamps[i - 1]!);
          }
        }
      }

      // Overall conversion time (first → last)
      const firstTs = stepTimestamps[0];
      const lastTs = stepTimestamps[stepTimestamps.length - 1];
      if (firstTs !== null && lastTs !== null) {
        conversionTimes.push(lastTs - firstTs);
      }
    }

    const entryCount = stepCounts[0] || 0;

    const stepResults: FunnelStepResult[] = this.steps.map((step, i) => {
      const count = stepCounts[i];
      const conversionRate = entryCount > 0 ? count / entryCount : 0;
      const prevCount = i > 0 ? stepCounts[i - 1] : entryCount;
      const dropOffRate = prevCount > 0 ? 1 - (count / prevCount) : 0;
      const medianTime = timesFromPrevious[i].length > 0 ? median(timesFromPrevious[i]) : null;

      return {
        name: step.name,
        count,
        conversionRate: round4(conversionRate),
        dropOffRate: round4(Math.max(0, dropOffRate)),
        medianTimeFromPreviousMs: medianTime,
      };
    });

    return {
      steps: stepResults,
      overallConversion: round4(entryCount > 0 ? (stepCounts[stepCounts.length - 1] / entryCount) : 0),
      medianTimeToConvertMs: conversionTimes.length > 0 ? median(conversionTimes) : null,
    };
  }

  /**
   * For a single user, find timestamps at which they completed each funnel step (in order).
   * Returns null array slots for steps not reached.
   */
  private matchUser(userEvents: FunnelEvent[]): (number | null)[] | null {
    const timestamps: (number | null)[] = new Array(this.steps.length).fill(null);
    let searchFrom = 0;
    let firstStepTs: number | null = null;

    for (let si = 0; si < this.steps.length; si++) {
      const step = this.steps[si];
      let found = false;

      for (let ei = searchFrom; ei < userEvents.length; ei++) {
        const ev = userEvents[ei];
        if (ev.eventName !== step.eventName) continue;
        if (step.filter && !matchFilter(ev, step.filter)) continue;

        // Check conversion window
        if (si === 0) {
          firstStepTs = ev.timestamp;
        } else if (firstStepTs !== null && ev.timestamp - firstStepTs > this.config.conversionWindowMs) {
          break;
        }

        timestamps[si] = ev.timestamp;
        searchFrom = ei + 1;
        found = true;
        break;
      }

      if (!found) break;
    }

    // User must have at least completed step 0 to count
    if (timestamps[0] === null) return null;
    return timestamps;
  }
}

function matchFilter(event: FunnelEvent, filter: EventPropertyFilter): boolean {
  const val = event.properties?.[filter.property];

  switch (filter.operator) {
    case 'equals': return val === filter.value;
    case 'not_equals': return val !== filter.value;
    case 'contains': return typeof val === 'string' && typeof filter.value === 'string' && val.includes(filter.value);
    case 'not_contains': return typeof val === 'string' && typeof filter.value === 'string' && !val.includes(filter.value);
    case 'greater_than': return typeof val === 'number' && typeof filter.value === 'number' && val > filter.value;
    case 'less_than': return typeof val === 'number' && typeof filter.value === 'number' && val < filter.value;
    case 'is_set': return val !== undefined && val !== null;
    case 'is_not_set': return val === undefined || val === null;
    default: return true;
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
