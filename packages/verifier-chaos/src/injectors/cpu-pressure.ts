/**
 * CPU Pressure Injector
 *
 * Simulates CPU pressure by consuming compute cycles.
 * Forces the event loop to contend with busy-work, exposing
 * timeout / scheduling issues in the implementation under test.
 */

import type { Timeline } from '../timeline.js';

export interface CpuPressureConfig {
  /** Target CPU utilisation percentage (0-100). Drives duty-cycle of the spin loop. */
  percentage: number;
  /** How long to sustain pressure (ms). 0 = until deactivate(). */
  durationMs?: number;
  /** Length of each spin burst (ms). Shorter = more cooperative with the event loop. */
  burstMs?: number;
  /** Length of each yield gap between bursts (ms). */
  yieldMs?: number;
}

export interface CpuPressureState {
  active: boolean;
  totalSpinMs: number;
  totalYieldMs: number;
  bursts: number;
  startedAt: number;
  stoppedAt: number;
}

/**
 * CPU pressure injector for chaos testing.
 */
export class CpuPressureInjector {
  private config: Required<CpuPressureConfig>;
  private state: CpuPressureState;
  private timeline: Timeline | null = null;
  private abortController: AbortController | null = null;
  private runPromise: Promise<void> | null = null;

  constructor(config: CpuPressureConfig) {
    this.config = {
      percentage: Math.max(0, Math.min(100, config.percentage)),
      durationMs: config.durationMs ?? 0,
      burstMs: config.burstMs ?? 50,
      yieldMs: config.yieldMs ?? 10,
    };
    this.state = this.createInitialState();
  }

  private createInitialState(): CpuPressureState {
    return {
      active: false,
      totalSpinMs: 0,
      totalYieldMs: 0,
      bursts: 0,
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
    this.state.startedAt = Date.now();
    this.abortController = new AbortController();

    this.timeline?.record('injection_start', {
      injector: 'cpu_pressure',
      config: this.config,
    });

    this.runPromise = this.pressureLoop(this.abortController.signal);
  }

  deactivate(): void {
    if (!this.state.active) return;

    this.abortController?.abort();
    this.abortController = null;
    this.state.active = false;
    this.state.stoppedAt = Date.now();

    this.timeline?.record('injection_end', {
      injector: 'cpu_pressure',
      state: { ...this.state },
    });
  }

  getState(): CpuPressureState {
    return { ...this.state };
  }

  /**
   * Wrap an operation so it executes under CPU pressure.
   */
  async withPressure<T>(operation: () => Promise<T>): Promise<T> {
    this.activate();
    try {
      return await operation();
    } finally {
      this.deactivate();
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Internal pressure loop                                            */
  /* ------------------------------------------------------------------ */

  private async pressureLoop(signal: AbortSignal): Promise<void> {
    const dutyCycle = this.config.percentage / 100;
    const spinMs = Math.max(1, Math.round(this.config.burstMs * dutyCycle));
    const yieldMs = Math.max(1, this.config.yieldMs);
    const deadline =
      this.config.durationMs > 0
        ? Date.now() + this.config.durationMs
        : Infinity;

    while (!signal.aborted && Date.now() < deadline) {
      // Spin (consume CPU)
      const spinStart = Date.now();
      while (Date.now() - spinStart < spinMs && !signal.aborted) {
        // busy-wait
        Math.random();
      }
      this.state.totalSpinMs += Date.now() - spinStart;
      this.state.bursts++;

      // Yield back to the event loop
      if (!signal.aborted) {
        const yieldStart = Date.now();
        await new Promise<void>((resolve) => setTimeout(resolve, yieldMs));
        this.state.totalYieldMs += Date.now() - yieldStart;
      }
    }
  }
}

/**
 * Create a CPU pressure injector.
 */
export function createCpuPressure(
  percentage: number,
  durationMs?: number,
): CpuPressureInjector {
  return new CpuPressureInjector({ percentage, durationMs });
}

/**
 * Create a moderate CPU pressure injector (50 %).
 */
export function createModerateCpuPressure(durationMs?: number): CpuPressureInjector {
  return new CpuPressureInjector({ percentage: 50, durationMs });
}

/**
 * Create a heavy CPU pressure injector (90 %).
 */
export function createHeavyCpuPressure(durationMs?: number): CpuPressureInjector {
  return new CpuPressureInjector({ percentage: 90, durationMs });
}
