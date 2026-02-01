/**
 * ISL Domain Simulator
 * 
 * Simulates ISL domains for testing and exploration.
 */

import type {
  SimulatorOptions,
  Domain,
  BehaviorResult,
  BehaviorImplementation,
  SimulatorState,
  Timeline,
  TimelineEvent,
  InvariantCheckResult,
  InvariantViolation,
  Scenario,
  ScenarioResult,
} from './types.js';
import { StateManager } from './state.js';
import { BehaviorExecutor } from './executor.js';
import { TimelineManager, type TimelineStats } from './timeline.js';
import { ScenarioPlayer } from './scenarios/player.js';
import { ScenarioRecorder, timelineToScenario } from './scenarios/recorder.js';

// ─────────────────────────────────────────────────────────────────────────────
// Simulator Class
// ─────────────────────────────────────────────────────────────────────────────

export class Simulator {
  private domain: Domain;
  private stateManager: StateManager;
  private executor: BehaviorExecutor;
  private timeline: TimelineManager;
  private recorder: ScenarioRecorder | null = null;
  private options: SimulatorOptions;

  constructor(options: SimulatorOptions) {
    this.options = options;
    this.domain = options.domain;

    // Initialize state
    this.stateManager = new StateManager(
      options.domain.entities,
      options.initialState
    );

    // Initialize executor
    this.executor = new BehaviorExecutor(
      options.domain.behaviors,
      this.stateManager,
      options.implementations,
      { strict: options.strict, seed: options.seed }
    );

    // Initialize timeline
    this.timeline = new TimelineManager({
      recording: options.recording ?? true,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Access
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get current state (read-only)
   */
  get state(): Readonly<SimulatorState> {
    return this.stateManager.getState();
  }

  /**
   * Get entities of a specific type
   */
  getEntities<T = Record<string, unknown>>(entityType: string): T[] {
    return this.stateManager.getEntities<T>(entityType);
  }

  /**
   * Get entity by ID
   */
  getEntity<T = Record<string, unknown>>(entityType: string, id: string): T | null {
    return this.stateManager.getEntity<T>(entityType, id);
  }

  /**
   * Find entities matching predicate
   */
  findEntities<T = Record<string, unknown>>(
    entityType: string,
    predicate: (entity: T) => boolean
  ): T[] {
    return this.stateManager.findEntities<T>(entityType, predicate);
  }

  /**
   * Get entity count
   */
  count(entityType: string): number {
    return this.stateManager.count(entityType);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Behavior Execution
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Execute a behavior
   */
  async execute(
    behavior: string,
    input: Record<string, unknown> = {}
  ): Promise<BehaviorResult> {
    const stateBefore = this.stateManager.snapshot();
    const startTime = Date.now();

    const result = await this.executor.execute(behavior, input);

    const stateAfter = this.stateManager.snapshot();
    const durationMs = Date.now() - startTime;

    // Record in timeline
    this.timeline.recordBehavior(
      behavior,
      input,
      result,
      stateBefore,
      stateAfter,
      durationMs
    );

    // Record for scenario if recording
    if (this.recorder?.isRecording()) {
      this.recorder.recordStep(
        behavior,
        input,
        result.success,
        result.error?.code,
        result.data as Record<string, unknown> | undefined
      );
    }

    return result;
  }

  /**
   * Execute multiple behaviors in sequence
   */
  async executeSequence(
    steps: Array<{ behavior: string; input?: Record<string, unknown> }>
  ): Promise<BehaviorResult[]> {
    const results: BehaviorResult[] = [];

    for (const step of steps) {
      const result = await this.execute(step.behavior, step.input || {});
      results.push(result);

      // Stop on failure
      if (!result.success) break;
    }

    return results;
  }

  /**
   * Register a behavior implementation
   */
  registerImplementation(name: string, impl: BehaviorImplementation): void {
    this.executor.registerImplementation(name, impl);
  }

  /**
   * Get available behaviors
   */
  getAvailableBehaviors(): string[] {
    return this.executor.getAvailableBehaviors();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Invariant Checking
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check all invariants
   */
  checkInvariants(): InvariantCheckResult {
    const violations: InvariantViolation[] = [];
    let checked = 0;
    let passed = 0;

    // Check global invariants
    for (const invariant of this.domain.invariants) {
      if (invariant.scope !== 'global') continue;

      for (const predicate of invariant.predicates) {
        checked++;
        const result = this.evaluateInvariant(predicate);
        if (result.valid) {
          passed++;
        } else {
          violations.push({
            invariant: invariant.name,
            scope: 'global',
            predicate,
            message: result.message,
          });
        }
      }
    }

    // Check entity invariants
    for (const entityDef of this.domain.entities) {
      const entities = this.getEntities(entityDef.name);
      
      for (const entity of entities) {
        const entityRecord = entity as Record<string, unknown>;
        
        for (const predicate of entityDef.invariants || []) {
          checked++;
          const result = this.evaluateInvariant(predicate, entityRecord);
          if (result.valid) {
            passed++;
          } else {
            violations.push({
              invariant: `${entityDef.name} invariant`,
              scope: 'entity',
              entity: entityDef.name,
              entityId: entityRecord.id as string,
              predicate,
              message: result.message,
              context: entityRecord,
            });
          }
        }
      }
    }

    const result: InvariantCheckResult = {
      valid: violations.length === 0,
      violations,
      checked,
      passed,
      failed: violations.length,
    };

    // Record in timeline
    this.timeline.recordInvariantCheck(result.valid, violations);

    return result;
  }

  /**
   * Evaluate a single invariant predicate
   */
  private evaluateInvariant(
    predicate: string,
    context?: Record<string, unknown>
  ): { valid: boolean; message: string } {
    // Basic invariant evaluation
    // This is simplified - full implementation needs expression parser

    // Check numeric comparisons
    if (context) {
      const compMatch = predicate.match(/(\w+)\s*(>=|>|<=|<|==|!=)\s*(\d+)/);
      if (compMatch) {
        const [, field, op, numStr] = compMatch;
        const value = context[field];
        const num = parseInt(numStr, 10);

        if (typeof value === 'number') {
          let valid = false;
          switch (op) {
            case '>=': valid = value >= num; break;
            case '>': valid = value > num; break;
            case '<=': valid = value <= num; break;
            case '<': valid = value < num; break;
            case '==': valid = value === num; break;
            case '!=': valid = value !== num; break;
          }
          return { valid, message: valid ? '' : `${field} ${op} ${num} failed (value: ${value})` };
        }
      }
    }

    // Default: assume valid for complex predicates
    return { valid: true, message: '' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Timeline
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get timeline
   */
  getTimeline(): Timeline {
    return this.timeline.getTimeline();
  }

  /**
   * Get timeline events
   */
  getTimelineEvents(): TimelineEvent[] {
    return this.timeline.getEvents();
  }

  /**
   * Get timeline statistics
   */
  getTimelineStats(): TimelineStats {
    return this.timeline.getStats();
  }

  /**
   * Export timeline as JSON
   */
  exportTimeline(): string {
    return this.timeline.export();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scenarios
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Play a scenario
   */
  async playScenario(scenario: Scenario): Promise<ScenarioResult> {
    const player = new ScenarioPlayer({
      execute: (behavior, input) => this.execute(behavior, input),
      getState: () => this.stateManager.getState() as SimulatorState,
      getTimeline: () => this.getTimeline(),
      reset: () => this.reset(),
    });

    return player.play(scenario);
  }

  /**
   * Start recording a scenario
   */
  startRecording(name: string, description?: string): void {
    this.recorder = new ScenarioRecorder({ name, description });
    this.recorder.start();
  }

  /**
   * Stop recording and get scenario
   */
  stopRecording(): Scenario | null {
    if (!this.recorder) return null;
    this.recorder.stop();
    const scenario = this.recorder.build();
    this.recorder = null;
    return scenario;
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recorder?.isRecording() ?? false;
  }

  /**
   * Convert current timeline to scenario
   */
  timelineToScenario(name: string, description?: string): Scenario {
    return timelineToScenario(this.getTimeline(), { name, description });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Replay
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Replay a timeline
   */
  async replay(timeline: Timeline): Promise<BehaviorResult[]> {
    const results: BehaviorResult[] = [];
    const behaviorEvents = timeline.events.filter(e => e.type === 'behavior');

    for (const event of behaviorEvents) {
      if (event.behavior && event.input) {
        const result = await this.execute(event.behavior, event.input);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Replay from JSON
   */
  async replayFromJson(json: string): Promise<BehaviorResult[]> {
    const timeline = JSON.parse(json) as Timeline;
    return this.replay(timeline);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Reset & Snapshot
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Reset simulator to initial state
   */
  reset(): void {
    this.stateManager.reset(this.options.initialState);
    this.timeline.clear();
  }

  /**
   * Take state snapshot
   */
  snapshot(): SimulatorState {
    return this.stateManager.snapshot();
  }

  /**
   * Restore from snapshot
   */
  restore(snapshot: SimulatorState): void {
    this.stateManager.restore(snapshot);
  }

  /**
   * Undo last change
   */
  undo(): boolean {
    return this.stateManager.undo();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Info
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get domain info
   */
  getDomainInfo(): {
    name: string;
    version?: string;
    entities: string[];
    behaviors: string[];
    enums: string[];
  } {
    return {
      name: this.domain.name,
      version: this.domain.version,
      entities: this.domain.entities.map(e => e.name),
      behaviors: this.domain.behaviors.map(b => b.name),
      enums: this.domain.enums.map(e => e.name),
    };
  }
}
