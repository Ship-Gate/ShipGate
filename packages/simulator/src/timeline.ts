/**
 * Timeline
 * 
 * Records simulation events for replay and analysis.
 */

import type {
  Timeline,
  TimelineEvent,
  BehaviorResult,
  SimulatorState,
} from './types.js';
import { generateId } from './state.js';

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Manager
// ─────────────────────────────────────────────────────────────────────────────

export class TimelineManager {
  private events: TimelineEvent[] = [];
  private startTime: Date;
  private endTime?: Date;
  private recording: boolean;
  private maxEvents: number;

  constructor(options?: { recording?: boolean; maxEvents?: number }) {
    this.startTime = new Date();
    this.recording = options?.recording ?? true;
    this.maxEvents = options?.maxEvents ?? 10000;
  }

  /**
   * Start recording (resets timeline)
   */
  start(): void {
    this.events = [];
    this.startTime = new Date();
    this.endTime = undefined;
    this.recording = true;
  }

  /**
   * Stop recording
   */
  stop(): void {
    this.endTime = new Date();
    this.recording = false;
  }

  /**
   * Pause recording
   */
  pause(): void {
    this.recording = false;
  }

  /**
   * Resume recording
   */
  resume(): void {
    this.recording = true;
  }

  /**
   * Check if recording
   */
  isRecording(): boolean {
    return this.recording;
  }

  /**
   * Record a behavior execution
   */
  recordBehavior(
    behavior: string,
    input: Record<string, unknown>,
    output: BehaviorResult,
    stateBefore: SimulatorState,
    stateAfter: SimulatorState,
    durationMs: number
  ): TimelineEvent | null {
    if (!this.recording) return null;

    const event: TimelineEvent = {
      id: generateId(),
      timestamp: new Date(),
      relativeTime: Date.now() - this.startTime.getTime(),
      type: 'behavior',
      behavior,
      input,
      output,
      stateBefore,
      stateAfter,
      durationMs,
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Record a state change
   */
  recordStateChange(
    description: string,
    stateBefore: SimulatorState,
    stateAfter: SimulatorState,
    metadata?: Record<string, unknown>
  ): TimelineEvent | null {
    if (!this.recording) return null;

    const event: TimelineEvent = {
      id: generateId(),
      timestamp: new Date(),
      relativeTime: Date.now() - this.startTime.getTime(),
      type: 'state_change',
      stateBefore,
      stateAfter,
      metadata: { description, ...metadata },
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Record an invariant check
   */
  recordInvariantCheck(
    valid: boolean,
    violations: unknown[],
    metadata?: Record<string, unknown>
  ): TimelineEvent | null {
    if (!this.recording) return null;

    const event: TimelineEvent = {
      id: generateId(),
      timestamp: new Date(),
      relativeTime: Date.now() - this.startTime.getTime(),
      type: 'invariant_check',
      output: { success: valid, data: { violations } },
      metadata,
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Record an error
   */
  recordError(
    error: string,
    context?: Record<string, unknown>
  ): TimelineEvent | null {
    if (!this.recording) return null;

    const event: TimelineEvent = {
      id: generateId(),
      timestamp: new Date(),
      relativeTime: Date.now() - this.startTime.getTime(),
      type: 'error',
      output: { success: false, error: { code: 'ERROR', message: error } },
      metadata: context,
    };

    this.addEvent(event);
    return event;
  }

  /**
   * Add event to timeline
   */
  private addEvent(event: TimelineEvent): void {
    this.events.push(event);
    
    // Trim if exceeds max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Get all events
   */
  getEvents(): TimelineEvent[] {
    return [...this.events];
  }

  /**
   * Get events by type
   */
  getEventsByType(type: TimelineEvent['type']): TimelineEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Get events by behavior
   */
  getEventsByBehavior(behavior: string): TimelineEvent[] {
    return this.events.filter(e => e.behavior === behavior);
  }

  /**
   * Get events in time range
   */
  getEventsInRange(startMs: number, endMs: number): TimelineEvent[] {
    return this.events.filter(
      e => e.relativeTime >= startMs && e.relativeTime <= endMs
    );
  }

  /**
   * Get timeline summary
   */
  getTimeline(): Timeline {
    const endTime = this.endTime ?? new Date();
    return {
      events: [...this.events],
      startTime: this.startTime,
      endTime,
      durationMs: endTime.getTime() - this.startTime.getTime(),
    };
  }

  /**
   * Get event by ID
   */
  getEvent(id: string): TimelineEvent | undefined {
    return this.events.find(e => e.id === id);
  }

  /**
   * Clear timeline
   */
  clear(): void {
    this.events = [];
    this.startTime = new Date();
    this.endTime = undefined;
  }

  /**
   * Export timeline as JSON
   */
  export(): string {
    return JSON.stringify(this.getTimeline(), null, 2);
  }

  /**
   * Import timeline from JSON
   */
  import(json: string): void {
    const data = JSON.parse(json) as Timeline;
    this.events = data.events;
    this.startTime = new Date(data.startTime);
    this.endTime = data.endTime ? new Date(data.endTime) : undefined;
  }

  /**
   * Get statistics
   */
  getStats(): TimelineStats {
    const behaviorEvents = this.getEventsByType('behavior');
    const successCount = behaviorEvents.filter(e => e.output?.success).length;
    const failureCount = behaviorEvents.filter(e => !e.output?.success).length;
    
    const durations = behaviorEvents
      .map(e => e.durationMs ?? 0)
      .filter(d => d > 0);
    
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const behaviorCounts: Record<string, number> = {};
    for (const event of behaviorEvents) {
      if (event.behavior) {
        behaviorCounts[event.behavior] = (behaviorCounts[event.behavior] || 0) + 1;
      }
    }

    return {
      totalEvents: this.events.length,
      behaviorExecutions: behaviorEvents.length,
      successCount,
      failureCount,
      successRate: behaviorEvents.length > 0 
        ? successCount / behaviorEvents.length 
        : 0,
      averageDurationMs: avgDuration,
      behaviorCounts,
      durationMs: (this.endTime ?? new Date()).getTime() - this.startTime.getTime(),
    };
  }
}

export interface TimelineStats {
  totalEvents: number;
  behaviorExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDurationMs: number;
  behaviorCounts: Record<string, number>;
  durationMs: number;
}
