/**
 * Clock Skew Injector
 *
 * Tampers with `Date.now()` and `new Date()` to simulate clock drift,
 * jumps, and NTP corrections.  Verifies that implementations using
 * wall-clock time (timeouts, TTLs, token expiry, cache invalidation)
 * behave correctly when the system clock is unreliable.
 * 
 * Enhanced with time provider dependency injection pattern for better
 * testability and control.
 */

import type { Timeline } from '../timeline.js';

/**
 * Time provider interface for dependency injection
 */
export interface TimeProvider {
  now(): number;
  createDate(): Date;
}

/**
 * Default time provider using system clock
 */
export class SystemTimeProvider implements TimeProvider {
  now(): number {
    return Date.now();
  }
  
  createDate(): Date {
    return new Date();
  }
}

export type ClockSkewMode = 'fixed' | 'drift' | 'jump' | 'oscillate';

export interface ClockSkewConfig {
  /** Offset in milliseconds (positive = future, negative = past). */
  offsetMs: number;
  /** How the skew is applied. */
  mode?: ClockSkewMode;
  /** For drift mode: ms added per real second. */
  driftRateMs?: number;
  /** For oscillate mode: period in ms for one full cycle. */
  oscillatePeriodMs?: number;
  /** Optional time provider for dependency injection (defaults to SystemTimeProvider). */
  timeProvider?: TimeProvider;
}

export interface ClockSkewState {
  active: boolean;
  currentOffsetMs: number;
  peakOffsetMs: number;
  dateNowCallCount: number;
  newDateCallCount: number;
  startedAt: number;
  stoppedAt: number;
}

/**
 * Clock skew injector for chaos testing.
 */
export class ClockSkewInjector {
  private config: Required<Omit<ClockSkewConfig, 'timeProvider'>> & { timeProvider: TimeProvider };
  private state: ClockSkewState;
  private timeline: Timeline | null = null;
  private timeProvider: TimeProvider;

  private originalDateNow: typeof Date.now | null = null;
  private OriginalDate: DateConstructor | null = null;
  private activationRealTime: number = 0;

  constructor(config: ClockSkewConfig) {
    this.timeProvider = config.timeProvider ?? new SystemTimeProvider();
    this.config = {
      offsetMs: config.offsetMs,
      mode: config.mode ?? 'fixed',
      driftRateMs: config.driftRateMs ?? 0,
      oscillatePeriodMs: config.oscillatePeriodMs ?? 60_000,
      timeProvider: this.timeProvider,
    };
    this.state = this.createInitialState();
  }

  private createInitialState(): ClockSkewState {
    return {
      active: false,
      currentOffsetMs: 0,
      peakOffsetMs: 0,
      dateNowCallCount: 0,
      newDateCallCount: 0,
      startedAt: 0,
      stoppedAt: 0,
    };
  }

  attachTimeline(timeline: Timeline): void {
    this.timeline = timeline;
  }

  activate(): void {
    if (this.state.active) return;

    this.state = this.createInitialState();
    this.state.active = true;
    this.state.startedAt = this.timeProvider.now();
    this.activationRealTime = this.timeProvider.now();

    // Capture originals
    this.originalDateNow = Date.now;
    this.OriginalDate = Date;

    // Monkey-patch Date.now
    const self = this;
    Date.now = function skewedNow(): number {
      self.state.dateNowCallCount++;
      const real = self.originalDateNow!.call(Date);
      const offset = self.computeOffset(real);
      self.state.currentOffsetMs = offset;
      self.state.peakOffsetMs = Math.max(
        self.state.peakOffsetMs,
        Math.abs(offset),
      );
      const skewed = real + offset;
      
      self.timeline?.record('injection_start', {
        injector: 'clock_skew',
        realTime: real,
        skewedTime: skewed,
        offsetMs: offset,
      });
      
      return skewed;
    };

    this.timeline?.record('injection_start', {
      injector: 'clock_skew',
      config: this.config,
    });
  }

  deactivate(): void {
    if (!this.state.active) return;

    // Restore originals
    if (this.originalDateNow) {
      Date.now = this.originalDateNow;
      this.originalDateNow = null;
    }

    this.state.active = false;
    this.state.stoppedAt = this.timeProvider.now();

    this.timeline?.record('injection_end', {
      injector: 'clock_skew',
      state: { ...this.state },
    });
  }

  getState(): ClockSkewState {
    return { ...this.state };
  }

  /**
   * Wrap an operation so it executes with a skewed clock.
   */
  async withSkew<T>(operation: () => Promise<T>): Promise<T> {
    this.activate();
    try {
      return await operation();
    } finally {
      this.deactivate();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Internal offset computation                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Get the time provider (for testing)
   */
  getTimeProvider(): TimeProvider {
    return this.timeProvider;
  }

  private computeOffset(realNow: number): number {
    const elapsed = realNow - this.activationRealTime;

    switch (this.config.mode) {
      case 'fixed':
        return this.config.offsetMs;

      case 'drift': {
        const driftSeconds = elapsed / 1000;
        return this.config.offsetMs + driftSeconds * this.config.driftRateMs;
      }

      case 'jump':
        // One-time jump: return offset for the first call, 0 after.
        // We approximate "first call" as the first 10ms after activation.
        return elapsed < 10 ? this.config.offsetMs : 0;

      case 'oscillate': {
        const phase =
          (2 * Math.PI * elapsed) / this.config.oscillatePeriodMs;
        return Math.round(this.config.offsetMs * Math.sin(phase));
      }

      default:
        return this.config.offsetMs;
    }
  }
}

/**
 * Create a fixed clock-skew injector.
 */
export function createFixedClockSkew(offsetMs: number): ClockSkewInjector {
  return new ClockSkewInjector({ offsetMs, mode: 'fixed' });
}

/**
 * Create a drifting clock injector.
 */
export function createDriftingClock(
  initialOffsetMs: number,
  driftRateMs: number,
): ClockSkewInjector {
  return new ClockSkewInjector({
    offsetMs: initialOffsetMs,
    mode: 'drift',
    driftRateMs,
  });
}

/**
 * Create a clock-jump injector (one-time discontinuity).
 */
export function createClockJump(jumpMs: number): ClockSkewInjector {
  return new ClockSkewInjector({ offsetMs: jumpMs, mode: 'jump' });
}

/**
 * Create an oscillating clock injector (simulates NTP corrections).
 */
export function createOscillatingClock(
  amplitudeMs: number,
  periodMs: number,
): ClockSkewInjector {
  return new ClockSkewInjector({
    offsetMs: amplitudeMs,
    mode: 'oscillate',
    oscillatePeriodMs: periodMs,
  });
}
