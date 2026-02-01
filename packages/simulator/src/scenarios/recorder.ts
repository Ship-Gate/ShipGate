/**
 * Scenario Recorder
 * 
 * Records simulator interactions into replayable scenarios.
 */

import type {
  Scenario,
  ScenarioStep,
  ScenarioAssertion,
  Timeline,
  TimelineEvent,
  SimulatorState,
} from '../types.js';

export interface RecorderOptions {
  /** Scenario name */
  name: string;
  /** Description */
  description?: string;
  /** Tags for the scenario */
  tags?: string[];
  /** Include timing in steps */
  includeDelays?: boolean;
  /** Minimum delay to record (ms) */
  minDelay?: number;
}

export class ScenarioRecorder {
  private steps: RecordedStep[] = [];
  private options: RecorderOptions;
  private recording: boolean = false;
  private lastEventTime: number = 0;

  constructor(options: RecorderOptions) {
    this.options = {
      includeDelays: true,
      minDelay: 100,
      ...options,
    };
  }

  /**
   * Start recording
   */
  start(): void {
    this.steps = [];
    this.recording = true;
    this.lastEventTime = Date.now();
  }

  /**
   * Stop recording
   */
  stop(): void {
    this.recording = false;
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
  recordStep(
    behavior: string,
    input: Record<string, unknown>,
    success: boolean,
    errorCode?: string,
    data?: Record<string, unknown>
  ): void {
    if (!this.recording) return;

    const now = Date.now();
    const delay = now - this.lastEventTime;
    this.lastEventTime = now;

    this.steps.push({
      behavior,
      input,
      success,
      errorCode,
      data,
      delay: this.options.includeDelays && delay >= (this.options.minDelay || 0) 
        ? delay 
        : undefined,
    });
  }

  /**
   * Build scenario from recorded steps
   */
  build(): Scenario {
    const steps: ScenarioStep[] = this.steps.map(s => ({
      name: `${s.behavior}`,
      behavior: s.behavior,
      input: s.input,
      expect: {
        success: s.success,
        errorCode: s.errorCode,
        data: s.data,
      },
      delay: s.delay,
    }));

    return {
      name: this.options.name,
      description: this.options.description,
      steps,
      tags: this.options.tags,
    };
  }

  /**
   * Export as JSON
   */
  export(): string {
    return JSON.stringify(this.build(), null, 2);
  }

  /**
   * Get step count
   */
  getStepCount(): number {
    return this.steps.length;
  }

  /**
   * Clear recorded steps
   */
  clear(): void {
    this.steps = [];
    this.lastEventTime = Date.now();
  }
}

interface RecordedStep {
  behavior: string;
  input: Record<string, unknown>;
  success: boolean;
  errorCode?: string;
  data?: Record<string, unknown>;
  delay?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline to Scenario Converter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a timeline into a replayable scenario
 */
export function timelineToScenario(
  timeline: Timeline,
  options: { name: string; description?: string; tags?: string[] }
): Scenario {
  const behaviorEvents = timeline.events.filter(e => e.type === 'behavior');
  
  const steps: ScenarioStep[] = behaviorEvents.map((event, index) => {
    const prevEvent = behaviorEvents[index - 1];
    const delay = prevEvent 
      ? event.relativeTime - prevEvent.relativeTime 
      : 0;

    return {
      name: event.behavior,
      behavior: event.behavior!,
      input: event.input || {},
      expect: event.output ? {
        success: event.output.success,
        errorCode: event.output.error?.code,
      } : undefined,
      delay: delay > 100 ? delay : undefined,
    };
  });

  return {
    name: options.name,
    description: options.description,
    steps,
    tags: options.tags,
  };
}

/**
 * Create assertions from state snapshot
 */
export function createAssertionsFromState(
  state: SimulatorState
): ScenarioAssertion[] {
  const assertions: ScenarioAssertion[] = [];

  // Add entity count assertions
  for (const [entityType, store] of Object.entries(state.entities)) {
    assertions.push({
      type: 'entity_count',
      entityType,
      expected: store.count,
    });
  }

  return assertions;
}

/**
 * Merge multiple scenarios into one
 */
export function mergeScenarios(
  scenarios: Scenario[],
  options: { name: string; description?: string }
): Scenario {
  const allSteps: ScenarioStep[] = [];
  const allTags = new Set<string>();

  for (const scenario of scenarios) {
    allSteps.push(...scenario.steps);
    scenario.tags?.forEach(t => allTags.add(t));
  }

  return {
    name: options.name,
    description: options.description,
    steps: allSteps,
    tags: Array.from(allTags),
  };
}
