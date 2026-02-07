/**
 * Memory Pressure Injector
 *
 * Simulates memory pressure by allocating buffers that consume heap space.
 * Useful for verifying that implementations degrade gracefully under
 * low-memory conditions instead of crashing or losing data.
 */

import type { Timeline } from '../timeline.js';

export interface MemoryPressureConfig {
  /** Target memory allocation in megabytes. */
  allocationMb: number;
  /** Allocate incrementally over this many steps (1 = all at once). */
  steps?: number;
  /** Delay between allocation steps (ms). */
  stepDelayMs?: number;
  /** Whether to release memory on deactivate. */
  releaseOnDeactivate?: boolean;
}

export interface MemoryPressureState {
  active: boolean;
  allocatedMb: number;
  allocationSteps: number;
  peakAllocatedMb: number;
  startedAt: number;
  stoppedAt: number;
}

/**
 * Memory pressure injector for chaos testing.
 */
export class MemoryPressureInjector {
  private config: Required<MemoryPressureConfig>;
  private state: MemoryPressureState;
  private timeline: Timeline | null = null;
  private allocations: Buffer[] = [];

  constructor(config: MemoryPressureConfig) {
    this.config = {
      allocationMb: Math.max(1, config.allocationMb),
      steps: config.steps ?? 1,
      stepDelayMs: config.stepDelayMs ?? 0,
      releaseOnDeactivate: config.releaseOnDeactivate ?? true,
    };
    this.state = this.createInitialState();
  }

  private createInitialState(): MemoryPressureState {
    return {
      active: false,
      allocatedMb: 0,
      allocationSteps: 0,
      peakAllocatedMb: 0,
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

    this.timeline?.record('injection_start', {
      injector: 'memory_pressure',
      config: {
        allocationMb: this.config.allocationMb,
        steps: this.config.steps,
      },
    });

    // Perform synchronous (step-0) allocation
    this.allocateSync();
  }

  deactivate(): void {
    if (!this.state.active) return;

    if (this.config.releaseOnDeactivate) {
      this.release();
    }

    this.state.active = false;
    this.state.stoppedAt = Date.now();

    this.timeline?.record('injection_end', {
      injector: 'memory_pressure',
      state: { ...this.state },
    });
  }

  getState(): MemoryPressureState {
    return { ...this.state };
  }

  /**
   * Perform a gradual allocation (async).
   * Call after activate() if you want to ramp up over time.
   */
  async rampUp(): Promise<void> {
    if (!this.state.active) return;

    const perStepMb = this.config.allocationMb / this.config.steps;

    // We already did step-0 in activate
    for (let step = 1; step < this.config.steps; step++) {
      if (!this.state.active) break;
      if (this.config.stepDelayMs > 0) {
        await new Promise<void>((r) => setTimeout(r, this.config.stepDelayMs));
      }
      this.allocateChunk(perStepMb);
    }
  }

  /**
   * Wrap an operation so it executes under memory pressure.
   */
  async withPressure<T>(operation: () => Promise<T>): Promise<T> {
    this.activate();
    await this.rampUp();
    try {
      return await operation();
    } finally {
      this.deactivate();
    }
  }

  /**
   * Release all allocated memory.
   */
  release(): void {
    this.allocations.length = 0;
    this.state.allocatedMb = 0;

    this.timeline?.record('recovery', {
      injector: 'memory_pressure',
      detail: 'memory released',
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Internal helpers                                                  */
  /* ------------------------------------------------------------------ */

  private allocateSync(): void {
    const perStepMb = this.config.allocationMb / this.config.steps;
    this.allocateChunk(perStepMb);
  }

  private allocateChunk(mb: number): void {
    const bytes = Math.round(mb * 1024 * 1024);
    try {
      const buf = Buffer.alloc(bytes, 0xaa);
      this.allocations.push(buf);
      this.state.allocatedMb += mb;
      this.state.allocationSteps++;
      this.state.peakAllocatedMb = Math.max(
        this.state.peakAllocatedMb,
        this.state.allocatedMb,
      );

      this.timeline?.record('injection_start', {
        injector: 'memory_pressure',
        stepMb: mb,
        totalMb: this.state.allocatedMb,
      });
    } catch {
      this.timeline?.recordError(
        new Error(`Memory allocation failed at ${this.state.allocatedMb}MB`),
        { injector: 'memory_pressure' },
      );
    }
  }
}

/**
 * Create a memory pressure injector.
 */
export function createMemoryPressure(
  allocationMb: number,
  steps?: number,
): MemoryPressureInjector {
  return new MemoryPressureInjector({ allocationMb, steps });
}

/**
 * Create a moderate memory pressure injector (128 MB).
 */
export function createModerateMemoryPressure(): MemoryPressureInjector {
  return new MemoryPressureInjector({ allocationMb: 128, steps: 4, stepDelayMs: 100 });
}

/**
 * Create a heavy memory pressure injector (512 MB).
 */
export function createHeavyMemoryPressure(): MemoryPressureInjector {
  return new MemoryPressureInjector({ allocationMb: 512, steps: 8, stepDelayMs: 50 });
}
