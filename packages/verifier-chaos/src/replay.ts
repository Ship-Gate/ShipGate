/**
 * Deterministic Replay Engine
 * 
 * Enables bounded, repeatable chaos verification through:
 * - Seeded random number generation
 * - Event recording and playback
 * - Timeline reconstruction
 */

import type { ChaosEvent, SerializedChaosEvent, ChaosEventOutcome } from './chaos-events.js';
import { deserializeChaosEvent, serializeChaosEvent } from './chaos-events.js';
import type { TimelineEvent, TimelineReport } from './timeline.js';
import type { ScenarioResult } from './executor.js';

/* ------------------------------------------------------------------ */
/*  Seeded Random Number Generator                                     */
/* ------------------------------------------------------------------ */

export class SeededRNG {
  private seed: number;
  private state: number;

  constructor(seed: number) {
    this.seed = seed;
    this.state = seed;
  }

  /** Get the seed used for this RNG */
  getSeed(): number {
    return this.seed;
  }

  /** Reset to initial state */
  reset(): void {
    this.state = this.seed;
  }

  /** Generate next random number in [0, 1) */
  next(): number {
    // Mulberry32 algorithm - fast, good distribution
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Generate integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Generate number in [min, max) */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Generate boolean with given probability of true */
  nextBool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /** Shuffle array in place */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j]!, array[i]!];
    }
    return array;
  }

  /** Pick random element from array */
  pick<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[this.nextInt(0, array.length - 1)];
  }

  /** Pick n random elements from array (without replacement) */
  pickN<T>(array: T[], n: number): T[] {
    const copy = [...array];
    this.shuffle(copy);
    return copy.slice(0, Math.min(n, copy.length));
  }
}

/* ------------------------------------------------------------------ */
/*  Replay Session                                                     */
/* ------------------------------------------------------------------ */

export interface ReplaySession {
  /** Unique session ID */
  id: string;
  /** Master seed for the session */
  seed: number;
  /** Session creation timestamp */
  createdAt: number;
  /** All chaos events in order */
  events: SerializedChaosEvent[];
  /** Timeline events from execution */
  timeline: TimelineEvent[];
  /** Scenario results */
  scenarioResults: ReplayScenarioResult[];
  /** Session metadata */
  metadata: Record<string, unknown>;
}

export interface ReplayScenarioResult {
  name: string;
  passed: boolean;
  duration: number;
  eventIds: string[];
}

/* ------------------------------------------------------------------ */
/*  Replay Recorder                                                    */
/* ------------------------------------------------------------------ */

export class ReplayRecorder {
  private session: ReplaySession;
  private rng: SeededRNG;
  private eventOrder: string[] = [];

  constructor(seed?: number) {
    const sessionSeed = seed ?? Math.floor(Math.random() * 2147483647);
    this.rng = new SeededRNG(sessionSeed);
    this.session = {
      id: `replay_${Date.now().toString(36)}_${sessionSeed.toString(16)}`,
      seed: sessionSeed,
      createdAt: Date.now(),
      events: [],
      timeline: [],
      scenarioResults: [],
      metadata: {},
    };
  }

  /** Get the RNG for deterministic operations */
  getRNG(): SeededRNG {
    return this.rng;
  }

  /** Get session seed */
  getSeed(): number {
    return this.session.seed;
  }

  /** Record a chaos event */
  recordEvent(event: ChaosEvent): void {
    this.session.events.push(serializeChaosEvent(event));
    this.eventOrder.push(event.id);
  }

  /** Record event outcome */
  recordOutcome(eventId: string, outcome: ChaosEventOutcome): void {
    const event = this.session.events.find(e => e.id === eventId);
    if (event) {
      event.outcome = {
        handled: outcome.handled,
        durationMs: outcome.durationMs,
        recoveryMechanism: outcome.recoveryMechanism,
        violations: outcome.violations,
        errorMessage: outcome.error?.message,
      };
    }
  }

  /** Record timeline events */
  recordTimeline(events: TimelineEvent[]): void {
    this.session.timeline.push(...events);
  }

  /** Record scenario result */
  recordScenarioResult(name: string, passed: boolean, duration: number): void {
    this.session.scenarioResults.push({
      name,
      passed,
      duration,
      eventIds: [...this.eventOrder],
    });
    this.eventOrder = [];
  }

  /** Set session metadata */
  setMetadata(key: string, value: unknown): void {
    this.session.metadata[key] = value;
  }

  /** Export the session for replay */
  exportSession(): ReplaySession {
    return { ...this.session };
  }

  /** Serialize session to JSON */
  serialize(): string {
    return JSON.stringify(this.session, null, 2);
  }
}

/* ------------------------------------------------------------------ */
/*  Replay Player                                                      */
/* ------------------------------------------------------------------ */

export interface ReplayOptions {
  /** Speed multiplier (1 = real-time, 0 = instant) */
  speed?: number;
  /** Whether to actually execute or just verify */
  dryRun?: boolean;
  /** Callback for each event */
  onEvent?: (event: ChaosEvent, index: number) => void;
  /** Callback for timeline progress */
  onProgress?: (progress: number, total: number) => void;
}

export interface ReplayResult {
  /** Whether replay matched original session */
  matched: boolean;
  /** Events that differed from original */
  differences: ReplayDifference[];
  /** New timeline from replay */
  timeline: TimelineEvent[];
  /** Duration of replay */
  durationMs: number;
}

export interface ReplayDifference {
  eventId: string;
  field: string;
  original: unknown;
  replayed: unknown;
}

export class ReplayPlayer {
  private session: ReplaySession;
  private rng: SeededRNG;
  private currentIndex: number = 0;

  constructor(session: ReplaySession) {
    this.session = session;
    this.rng = new SeededRNG(session.seed);
  }

  /** Get the RNG (same seed as original) */
  getRNG(): SeededRNG {
    return this.rng;
  }

  /** Reset player to beginning */
  reset(): void {
    this.currentIndex = 0;
    this.rng.reset();
  }

  /** Get next event to replay */
  nextEvent(): ChaosEvent | null {
    if (this.currentIndex >= this.session.events.length) {
      return null;
    }
    const serialized = this.session.events[this.currentIndex++];
    return serialized ? deserializeChaosEvent(serialized) : null;
  }

  /** Peek at next event without advancing */
  peekEvent(): ChaosEvent | null {
    if (this.currentIndex >= this.session.events.length) {
      return null;
    }
    const serialized = this.session.events[this.currentIndex];
    return serialized ? deserializeChaosEvent(serialized) : null;
  }

  /** Check if there are more events */
  hasMore(): boolean {
    return this.currentIndex < this.session.events.length;
  }

  /** Get total event count */
  totalEvents(): number {
    return this.session.events.length;
  }

  /** Get current progress */
  progress(): number {
    return this.currentIndex;
  }

  /** Get original session metadata */
  getMetadata(): Record<string, unknown> {
    return { ...this.session.metadata };
  }

  /** Get original scenario results */
  getScenarioResults(): ReplayScenarioResult[] {
    return [...this.session.scenarioResults];
  }

  /** Verify replayed event matches original */
  verifyEvent(replayedEvent: ChaosEvent, originalIndex: number): ReplayDifference[] {
    const differences: ReplayDifference[] = [];
    const original = this.session.events[originalIndex];
    
    if (!original) {
      differences.push({
        eventId: replayedEvent.id,
        field: 'existence',
        original: undefined,
        replayed: replayedEvent,
      });
      return differences;
    }

    if (original.type !== replayedEvent.type) {
      differences.push({
        eventId: replayedEvent.id,
        field: 'type',
        original: original.type,
        replayed: replayedEvent.type,
      });
    }

    const originalParams = JSON.stringify(original.parameters);
    const replayedParams = JSON.stringify(replayedEvent.parameters);
    if (originalParams !== replayedParams) {
      differences.push({
        eventId: replayedEvent.id,
        field: 'parameters',
        original: original.parameters,
        replayed: replayedEvent.parameters,
      });
    }

    return differences;
  }

  /** Run full replay with verification */
  async replay(
    executor: (event: ChaosEvent, rng: SeededRNG) => Promise<ChaosEventOutcome>,
    options: ReplayOptions = {}
  ): Promise<ReplayResult> {
    const startTime = Date.now();
    const differences: ReplayDifference[] = [];
    const newTimeline: TimelineEvent[] = [];
    const speed = options.speed ?? 0;

    this.reset();
    let index = 0;

    while (this.hasMore()) {
      const event = this.nextEvent();
      if (!event) break;

      options.onEvent?.(event, index);
      options.onProgress?.(index + 1, this.totalEvents());

      if (!options.dryRun) {
        const outcome = await executor(event, this.rng);
        
        // Verify outcome matches original
        const original = this.session.events[index];
        if (original?.outcome) {
          if (original.outcome.handled !== outcome.handled) {
            differences.push({
              eventId: event.id,
              field: 'outcome.handled',
              original: original.outcome.handled,
              replayed: outcome.handled,
            });
          }
        }

        // Record timeline event
        newTimeline.push({
          id: `replay_${event.id}`,
          type: outcome.handled ? 'recovery' : 'error',
          timestamp: Date.now() - startTime,
          duration: outcome.durationMs,
          data: {
            eventType: event.type,
            handled: outcome.handled,
            violations: outcome.violations.length,
          },
        });
      }

      // Simulate timing if speed > 0
      if (speed > 0 && index < this.session.events.length - 1) {
        const nextEvent = this.session.events[index + 1];
        if (nextEvent) {
          const delay = (nextEvent.timestamp - event.timestamp) / speed;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      index++;
    }

    return {
      matched: differences.length === 0,
      differences,
      timeline: newTimeline,
      durationMs: Date.now() - startTime,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Replay Storage                                                     */
/* ------------------------------------------------------------------ */

export interface ReplayStorage {
  save(session: ReplaySession): Promise<void>;
  load(sessionId: string): Promise<ReplaySession | null>;
  list(): Promise<string[]>;
  delete(sessionId: string): Promise<boolean>;
}

export class InMemoryReplayStorage implements ReplayStorage {
  private sessions: Map<string, ReplaySession> = new Map();

  async save(session: ReplaySession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async load(sessionId: string): Promise<ReplaySession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async list(): Promise<string[]> {
    return Array.from(this.sessions.keys());
  }

  async delete(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }
}

/* ------------------------------------------------------------------ */
/*  Replay Utilities                                                   */
/* ------------------------------------------------------------------ */

export function createReplayRecorder(seed?: number): ReplayRecorder {
  return new ReplayRecorder(seed);
}

export function createReplayPlayer(session: ReplaySession): ReplayPlayer {
  return new ReplayPlayer(session);
}

export function parseReplaySession(json: string): ReplaySession {
  return JSON.parse(json) as ReplaySession;
}

export function generateReplaySeed(): number {
  return Math.floor(Math.random() * 2147483647);
}

/** Create a deterministic seed from a string (for named test cases) */
export function seedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/* ------------------------------------------------------------------ */
/*  Integration with ScenarioResult                                    */
/* ------------------------------------------------------------------ */

export function scenarioResultToReplay(
  result: ScenarioResult,
  events: ChaosEvent[],
  seed: number
): ReplayScenarioResult {
  return {
    name: result.name,
    passed: result.passed,
    duration: result.duration,
    eventIds: events.map(e => e.id),
  };
}

export function buildReplaySessionFromResults(
  results: ScenarioResult[],
  events: ChaosEvent[],
  timeline: TimelineReport,
  seed: number,
  metadata: Record<string, unknown> = {}
): ReplaySession {
  return {
    id: `replay_${Date.now().toString(36)}_${seed.toString(16)}`,
    seed,
    createdAt: Date.now(),
    events: events.map(serializeChaosEvent),
    timeline: timeline.events,
    scenarioResults: results.map(r => ({
      name: r.name,
      passed: r.passed,
      duration: r.duration,
      eventIds: [],
    })),
    metadata,
  };
}
