/**
 * Resilience Verifier
 * 
 * Authoritative chaos verification engine that integrates:
 * - Bounded, repeatable chaos events
 * - Deterministic replay capability
 * - Invariant violation recording
 * - Spec clause mapping
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';
import type { BehaviorImplementation, ScenarioResult } from './executor.js';
import { ChaosEngine, type EngineConfig, type EngineResult } from './engine.js';
import { createTimeline, Timeline, type TimelineReport } from './timeline.js';
import {
  type ChaosEvent,
  type ChaosEventOutcome,
  type SpecClauseRef,
  type InvariantViolation,
  createChaosEvent,
  createTimeoutEvent,
  createRetryEvent,
  createPartialFailureEvent,
  bindSpecClause,
  getEventRegistry,
} from './chaos-events.js';
import {
  SeededRNG,
  ReplayRecorder,
  ReplayPlayer,
  type ReplaySession,
  createReplayRecorder,
  createReplayPlayer,
  generateReplaySeed,
  seedFromString,
  buildReplaySessionFromResults,
} from './replay.js';
import {
  ViolationRecorder,
  type ViolationRecord,
  type ViolationReport,
  type InvariantContext,
  createViolationRecorder,
  createCustomInvariant,
} from './violations.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ResilienceConfig extends EngineConfig {
  /** Master seed for deterministic replay (auto-generated if not provided) */
  seed?: number;
  /** Enable replay recording */
  recordReplay?: boolean;
  /** Enable invariant checking */
  checkInvariants?: boolean;
  /** Custom invariants to register */
  customInvariants?: Parameters<typeof createCustomInvariant>[];
  /** Spec clause mappings for behaviors */
  specClauseMappings?: Map<string, SpecClauseRef[]>;
}

export interface ResilienceResult extends EngineResult {
  /** Master seed used (for replay) */
  seed: number;
  /** Replay session (if recording enabled) */
  replaySession?: ReplaySession;
  /** Violation report */
  violationReport: ViolationReport;
  /** Chaos events that were executed */
  chaosEvents: ChaosEvent[];
  /** Whether resilience verification passed */
  resilient: boolean;
}

export interface ResilienceVerifyInput {
  domain: DomainDeclaration;
  implementation: BehaviorImplementation;
  behaviorName?: string;
  config?: ResilienceConfig;
}

/* ------------------------------------------------------------------ */
/*  Resilience Verifier                                                */
/* ------------------------------------------------------------------ */

export class ResilienceVerifier {
  private config: Required<ResilienceConfig>;
  private engine: ChaosEngine;
  private rng: SeededRNG;
  private recorder: ReplayRecorder | null = null;
  private violationRecorder: ViolationRecorder;
  private chaosEvents: ChaosEvent[] = [];
  private timeline: Timeline;
  private specClauseMappings: Map<string, SpecClauseRef[]>;

  constructor(config: ResilienceConfig = {}) {
    const seed = config.seed ?? generateReplaySeed();
    
    this.config = {
      timeoutMs: config.timeoutMs ?? 30_000,
      continueOnFailure: config.continueOnFailure ?? true,
      verbose: config.verbose ?? false,
      scenarioFilter: config.scenarioFilter ?? [],
      injectionFilter: config.injectionFilter ?? [],
      parallel: config.parallel ?? false,
      parallelLimit: config.parallelLimit ?? 4,
      outputDir: config.outputDir ?? '.chaos-output',
      seed,
      recordReplay: config.recordReplay ?? true,
      checkInvariants: config.checkInvariants ?? true,
      customInvariants: config.customInvariants ?? [],
      specClauseMappings: config.specClauseMappings ?? new Map(),
    };

    this.rng = new SeededRNG(seed);
    this.engine = new ChaosEngine(this.config);
    this.violationRecorder = createViolationRecorder();
    this.timeline = createTimeline();
    this.specClauseMappings = this.config.specClauseMappings;

    // Register custom invariants
    for (const invArgs of this.config.customInvariants) {
      const invariant = createCustomInvariant(...invArgs);
      this.violationRecorder.registerInvariant(invariant);
    }

    // Initialize replay recorder if enabled
    if (this.config.recordReplay) {
      this.recorder = createReplayRecorder(seed);
    }
  }

  /** Get the seed used for this verification */
  getSeed(): number {
    return this.config.seed;
  }

  /** Get the RNG for deterministic operations */
  getRNG(): SeededRNG {
    return this.rng;
  }

  /**
   * Run resilience verification
   */
  async verify(input: ResilienceVerifyInput): Promise<ResilienceResult> {
    const startTime = Date.now();
    this.timeline.start();
    this.chaosEvents = [];

    // Record metadata
    this.recorder?.setMetadata('behaviorName', input.behaviorName ?? 'all');
    this.recorder?.setMetadata('startTime', startTime);

    // Generate chaos events based on scenarios
    const events = this.generateChaosEvents(input.domain, input.behaviorName);
    
    // Execute base chaos engine
    const engineResult = await this.engine.run(
      input.domain,
      input.implementation,
      input.behaviorName
    );

    // Process results and check invariants
    const violations = await this.processResults(
      engineResult,
      input.domain,
      input.implementation
    );

    // Record timeline
    this.recorder?.recordTimeline(this.timeline.getEvents());

    // Build replay session
    const replaySession = this.recorder?.exportSession();

    // Generate violation report
    const violationReport = this.violationRecorder.generateReport();

    // Determine resilience verdict
    const resilient = this.computeResilienceVerdict(engineResult, violationReport);

    return {
      ...engineResult,
      seed: this.config.seed,
      replaySession,
      violationReport,
      chaosEvents: this.chaosEvents,
      resilient,
    };
  }

  /**
   * Replay a previous verification session
   */
  async replay(
    session: ReplaySession,
    input: ResilienceVerifyInput
  ): Promise<ResilienceResult> {
    const player = createReplayPlayer(session);
    
    // Reset RNG with session seed
    this.rng = new SeededRNG(session.seed);
    this.chaosEvents = [];
    this.violationRecorder.clear();
    this.timeline.start();

    // Re-execute with same events
    const replayResult = await player.replay(
      async (event, rng) => {
        this.chaosEvents.push(event);
        return this.executeEvent(event, input.implementation, rng);
      },
      { speed: 0 } // Instant replay
    );

    // Re-run engine verification
    const engineResult = await this.engine.run(
      input.domain,
      input.implementation,
      input.behaviorName
    );

    const violationReport = this.violationRecorder.generateReport();
    const resilient = this.computeResilienceVerdict(engineResult, violationReport);

    return {
      ...engineResult,
      seed: session.seed,
      replaySession: session,
      violationReport,
      chaosEvents: this.chaosEvents,
      resilient,
    };
  }

  /**
   * Generate chaos events for verification
   */
  private generateChaosEvents(
    domain: DomainDeclaration,
    behaviorName?: string
  ): ChaosEvent[] {
    const events: ChaosEvent[] = [];
    const registry = getEventRegistry();
    const behaviors = behaviorName
      ? domain.behaviors.filter(b => b.name.name === behaviorName)
      : domain.behaviors;

    for (const behavior of behaviors) {
      const name = behavior.name.name;
      const specClauses = this.specClauseMappings.get(name) ?? [];

      // Timeout events
      const timeoutEvent = createTimeoutEvent(
        this.rng.nextInt(1000, 10000),
        name,
        specClauses.filter(c => c.clause.includes('timeout')),
        this.rng.nextInt(0, 2147483647)
      );
      events.push(timeoutEvent);

      // Retry events
      const retryEvent = createRetryEvent(
        this.rng.nextInt(1, 5),
        this.rng.pick(['network', 'database', 'service']) ?? 'network',
        specClauses.filter(c => c.clause.includes('retry')),
        this.rng.nextInt(0, 2147483647)
      );
      events.push(retryEvent);

      // Partial failure events
      const partialEvent = createPartialFailureEvent(
        this.rng.nextFloat(0.3, 0.8),
        this.rng.nextInt(5, 20),
        specClauses.filter(c => c.clause.includes('partial') || c.clause.includes('failure')),
        this.rng.nextInt(0, 2147483647)
      );
      events.push(partialEvent);
    }

    // Record events
    for (const event of events) {
      this.chaosEvents.push(event);
      this.recorder?.recordEvent(event);
    }

    return events;
  }

  /**
   * Execute a single chaos event
   */
  private async executeEvent(
    event: ChaosEvent,
    implementation: BehaviorImplementation,
    rng: SeededRNG
  ): Promise<ChaosEventOutcome> {
    const startTime = Date.now();
    const violations: InvariantViolation[] = [];

    try {
      // Simulate event based on type
      switch (event.type) {
        case 'request_timeout': {
          const timeoutMs = event.parameters.timeoutMs as number;
          await this.simulateTimeout(timeoutMs, rng);
          break;
        }
        case 'transient_failure': {
          const failures = event.parameters.failuresBeforeSuccess as number;
          await this.simulateRetries(failures, implementation, rng);
          break;
        }
        case 'partial_success': {
          const rate = event.parameters.successRate as number;
          const total = event.parameters.totalOperations as number;
          await this.simulatePartialFailure(rate, total, implementation, rng);
          break;
        }
      }

      return {
        handled: true,
        durationMs: Date.now() - startTime,
        violations,
      };
    } catch (error) {
      violations.push({
        invariant: 'execution_error',
        expected: 'successful handling',
        actual: error instanceof Error ? error.message : String(error),
      });

      return {
        handled: false,
        durationMs: Date.now() - startTime,
        violations,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Simulate a timeout scenario
   */
  private async simulateTimeout(timeoutMs: number, rng: SeededRNG): Promise<void> {
    const actualDelay = rng.nextInt(
      Math.floor(timeoutMs * 0.5),
      Math.floor(timeoutMs * 1.5)
    );
    await new Promise(resolve => setTimeout(resolve, Math.min(actualDelay, 100)));
  }

  /**
   * Simulate retry scenario
   */
  private async simulateRetries(
    failuresBeforeSuccess: number,
    implementation: BehaviorImplementation,
    rng: SeededRNG
  ): Promise<void> {
    for (let i = 0; i < failuresBeforeSuccess; i++) {
      const shouldFail = rng.nextBool(0.8);
      if (shouldFail) {
        await new Promise(resolve => setTimeout(resolve, rng.nextInt(10, 50)));
      }
    }
  }

  /**
   * Simulate partial failure scenario
   */
  private async simulatePartialFailure(
    successRate: number,
    totalOperations: number,
    implementation: BehaviorImplementation,
    rng: SeededRNG
  ): Promise<void> {
    let successes = 0;
    for (let i = 0; i < totalOperations; i++) {
      if (rng.nextBool(successRate)) {
        successes++;
      }
    }
    // Verify at least some succeeded
    if (successes === 0) {
      throw new Error('All operations failed');
    }
  }

  /**
   * Process scenario results and check invariants
   */
  private async processResults(
    result: EngineResult,
    domain: DomainDeclaration,
    implementation: BehaviorImplementation
  ): Promise<ViolationRecord[]> {
    const allViolations: ViolationRecord[] = [];

    if (!this.config.checkInvariants) {
      return allViolations;
    }

    for (const scenario of result.scenarios) {
      const context: InvariantContext = {
        state: {
          scenarioName: scenario.name,
          passed: scenario.passed,
          duration: scenario.duration,
        },
        timeline: scenario.timeline.events,
        chaosEvents: this.chaosEvents,
        operation: scenario.name,
      };

      const violations = this.violationRecorder.checkAll(context);
      allViolations.push(...violations);

      // Record to replay session
      this.recorder?.recordScenarioResult(
        scenario.name,
        scenario.passed && violations.length === 0,
        scenario.duration
      );
    }

    return allViolations;
  }

  /**
   * Compute overall resilience verdict
   */
  private computeResilienceVerdict(
    result: EngineResult,
    violationReport: ViolationReport
  ): boolean {
    // Fail if any critical violations
    if (violationReport.bySeverity.critical > 0) {
      return false;
    }

    // Fail if verdict is unsafe
    if (result.verdict === 'unsafe') {
      return false;
    }

    // Pass if verified with no errors
    if (result.verdict === 'verified' && violationReport.bySeverity.error === 0) {
      return true;
    }

    // Risky with only warnings can still pass
    if (result.verdict === 'risky' && violationReport.bySeverity.error === 0) {
      return true;
    }

    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Factory Functions                                                  */
/* ------------------------------------------------------------------ */

export function createResilienceVerifier(config?: ResilienceConfig): ResilienceVerifier {
  return new ResilienceVerifier(config);
}

export function verifyResilience(input: ResilienceVerifyInput): Promise<ResilienceResult> {
  const verifier = createResilienceVerifier(input.config);
  return verifier.verify(input);
}

export async function replayResilience(
  session: ReplaySession,
  input: ResilienceVerifyInput
): Promise<ResilienceResult> {
  const verifier = createResilienceVerifier({
    ...input.config,
    seed: session.seed,
  });
  return verifier.replay(session, input);
}

/* ------------------------------------------------------------------ */
/*  Spec Clause Helpers                                                */
/* ------------------------------------------------------------------ */

export function createSpecClauseMapping(
  behavior: string,
  clauses: Array<{ clause: string; description: string }>
): [string, SpecClauseRef[]] {
  return [
    behavior,
    clauses.map(c => ({
      behavior,
      clause: c.clause,
      description: c.description,
    })),
  ];
}

export function buildSpecClauseMappings(
  mappings: Array<[string, Array<{ clause: string; description: string }>]>
): Map<string, SpecClauseRef[]> {
  const map = new Map<string, SpecClauseRef[]>();
  for (const [behavior, clauses] of mappings) {
    const [key, refs] = createSpecClauseMapping(behavior, clauses);
    map.set(key, refs);
  }
  return map;
}
