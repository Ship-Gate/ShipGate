/**
 * Timeline - Record chaos events during verification
 * 
 * Tracks all injections, behaviors, and outcomes for debugging and analysis.
 */

export type EventType = 
  | 'injection_start'
  | 'injection_end'
  | 'behavior_start'
  | 'behavior_end'
  | 'assertion_start'
  | 'assertion_result'
  | 'error'
  | 'recovery'
  | 'cleanup';

export interface TimelineEvent {
  id: string;
  type: EventType;
  timestamp: number;
  duration?: number;
  data: Record<string, unknown>;
  parentId?: string;
}

export interface TimelineReport {
  events: TimelineEvent[];
  startTime: number;
  endTime: number;
  totalDuration: number;
  injectionCount: number;
  errorCount: number;
  recoveryCount: number;
}

/**
 * Timeline recorder for chaos verification
 */
export class Timeline {
  private events: TimelineEvent[] = [];
  private startTime: number = 0;
  private eventCounter: number = 0;
  private activeEvents: Map<string, TimelineEvent> = new Map();

  /**
   * Start the timeline recording
   */
  start(): void {
    this.events = [];
    this.startTime = Date.now();
    this.eventCounter = 0;
    this.activeEvents.clear();
  }

  /**
   * Record a point-in-time event
   */
  record(type: EventType, data: Record<string, unknown> = {}, parentId?: string): string {
    const id = this.generateId();
    const event: TimelineEvent = {
      id,
      type,
      timestamp: Date.now() - this.startTime,
      data,
      parentId,
    };
    this.events.push(event);
    return id;
  }

  /**
   * Start a duration-based event
   */
  startEvent(type: EventType, data: Record<string, unknown> = {}, parentId?: string): string {
    const id = this.generateId();
    const event: TimelineEvent = {
      id,
      type,
      timestamp: Date.now() - this.startTime,
      data,
      parentId,
    };
    this.activeEvents.set(id, event);
    return id;
  }

  /**
   * End a duration-based event
   */
  endEvent(id: string, additionalData: Record<string, unknown> = {}): void {
    const event = this.activeEvents.get(id);
    if (event) {
      event.duration = (Date.now() - this.startTime) - event.timestamp;
      event.data = { ...event.data, ...additionalData };
      this.events.push(event);
      this.activeEvents.delete(id);
    }
  }

  /**
   * Record an error event
   */
  recordError(error: Error, context: Record<string, unknown> = {}): string {
    return this.record('error', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      ...context,
    });
  }

  /**
   * Record a recovery event
   */
  recordRecovery(injectionType: string, details: Record<string, unknown> = {}): string {
    return this.record('recovery', {
      injectionType,
      ...details,
    });
  }

  /**
   * Get all recorded events
   */
  getEvents(): TimelineEvent[] {
    return [...this.events];
  }

  /**
   * Get events by type
   */
  getEventsByType(type: EventType): TimelineEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Generate the timeline report
   */
  generateReport(): TimelineReport {
    const endTime = Date.now();
    const injectionEvents = this.events.filter(e => e.type === 'injection_start');
    const errorEvents = this.events.filter(e => e.type === 'error');
    const recoveryEvents = this.events.filter(e => e.type === 'recovery');

    return {
      events: this.events,
      startTime: this.startTime,
      endTime,
      totalDuration: endTime - this.startTime,
      injectionCount: injectionEvents.length,
      errorCount: errorEvents.length,
      recoveryCount: recoveryEvents.length,
    };
  }

  /**
   * Format timeline as human-readable string
   */
  format(): string {
    const lines: string[] = ['=== Chaos Timeline ===', ''];
    
    for (const event of this.events) {
      const time = `[${event.timestamp.toString().padStart(6)}ms]`;
      const duration = event.duration ? ` (${event.duration}ms)` : '';
      const type = event.type.padEnd(18);
      const data = Object.keys(event.data).length > 0 
        ? ` ${JSON.stringify(event.data)}` 
        : '';
      
      lines.push(`${time} ${type}${duration}${data}`);
    }

    lines.push('');
    lines.push('=== Summary ===');
    const report = this.generateReport();
    lines.push(`Total Duration: ${report.totalDuration}ms`);
    lines.push(`Injections: ${report.injectionCount}`);
    lines.push(`Errors: ${report.errorCount}`);
    lines.push(`Recoveries: ${report.recoveryCount}`);

    return lines.join('\n');
  }

  private generateId(): string {
    return `evt_${++this.eventCounter}_${Date.now().toString(36)}`;
  }
}

/**
 * Create a new timeline instance
 */
export function createTimeline(): Timeline {
  const timeline = new Timeline();
  timeline.start();
  return timeline;
}
