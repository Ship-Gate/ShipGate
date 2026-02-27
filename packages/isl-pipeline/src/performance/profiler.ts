/**
 * Performance Profiler
 * 
 * Hotspot profiling for parse/check, gate, and heal operations.
 * 
 * @module @isl-lang/pipeline/performance
 */

// Using Date.now() for compatibility

// ============================================================================
// Types
// ============================================================================

export interface ProfileEntry {
  name: string;
  duration: number;
  memoryDelta: number;
  children: ProfileEntry[];
  startTime: number;
  endTime: number;
}

export interface ProfileReport {
  totalTime: number;
  totalMemory: number;
  entries: ProfileEntry[];
  hotspots: Hotspot[];
}

export interface Hotspot {
  name: string;
  totalTime: number;
  callCount: number;
  avgTime: number;
  percentage: number;
  stack: string[];
}

// ============================================================================
// Profiler
// ============================================================================

export class PerformanceProfiler {
  private entries: ProfileEntry[] = [];
  private stack: ProfileEntry[] = [];
  private memoryStart: number = 0;

  /**
   * Start profiling
   */
  start(): void {
    this.entries = [];
    this.stack = [];
    this.memoryStart = this.getMemoryUsage();
  }

  /**
   * Start a profiling section
   */
  startSection(name: string): void {
    const entry: ProfileEntry = {
      name,
      duration: 0,
      memoryDelta: 0,
      children: [],
      startTime: performance.now(),
      endTime: 0,
    };

    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1]!.children.push(entry);
    } else {
      this.entries.push(entry);
    }

    this.stack.push(entry);
  }

  /**
   * End a profiling section
   */
  endSection(name: string): void {
    const entry = this.stack.pop();
    if (!entry || entry.name !== name) {
      throw new Error(`Mismatched profile section: expected ${entry?.name}, got ${name}`);
    }

    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;
    entry.memoryDelta = this.getMemoryUsage() - this.memoryStart;
  }

  /**
   * Generate profile report
   */
  generateReport(): ProfileReport {
    const totalTime = this.entries.reduce((sum, e) => sum + this.getTotalTime(e), 0);
    const totalMemory = this.getMemoryUsage() - this.memoryStart;
    const hotspots = this.identifyHotspots();

    return {
      totalTime,
      totalMemory,
      entries: this.entries,
      hotspots,
    };
  }

  /**
   * Get total time for an entry including children
   */
  private getTotalTime(entry: ProfileEntry): number {
    const childrenTime = entry.children.reduce((sum, c) => sum + this.getTotalTime(c), 0);
    return entry.duration - childrenTime; // Self time
  }

  /**
   * Identify hotspots
   */
  private identifyHotspots(): Hotspot[] {
    const map = new Map<string, { totalTime: number; callCount: number; stack: string[] }>();

    const traverse = (entry: ProfileEntry, stack: string[] = []) => {
      const newStack = [...stack, entry.name];
      const key = entry.name;

      const existing = map.get(key);
      if (existing) {
        existing.totalTime += entry.duration;
        existing.callCount += 1;
      } else {
        map.set(key, {
          totalTime: entry.duration,
          callCount: 1,
          stack: newStack,
        });
      }

      for (const child of entry.children) {
        traverse(child, newStack);
      }
    };

    for (const entry of this.entries) {
      traverse(entry);
    }

    const totalTime = Array.from(map.values()).reduce((sum, v) => sum + v.totalTime, 0);

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        totalTime: data.totalTime,
        callCount: data.callCount,
        avgTime: data.totalTime / data.callCount,
        percentage: (data.totalTime / totalTime) * 100,
        stack: data.stack,
      }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 20); // Top 20 hotspots
  }

  /**
   * Get memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024;
    }
    return 0;
  }
}

// ============================================================================
// Profiling Decorators
// ============================================================================

/**
 * Profile a function call
 */
export function profile<T extends (...args: unknown[]) => unknown>(
  name: string,
  fn: T
): T {
  return ((...args: Parameters<T>) => {
    const start = performance.now();
    const memoryBefore = getMemoryUsage();
    
    try {
      const result = fn(...args);
      
      if (result instanceof Promise) {
        return result.finally(() => {
          const end = performance.now();
          const memoryAfter = getMemoryUsage();
          recordProfile(name, end - start, memoryAfter - memoryBefore);
        });
      }
      
      const end = performance.now();
      const memoryAfter = getMemoryUsage();
      recordProfile(name, end - start, memoryAfter - memoryBefore);
      
      return result;
    } catch (error) {
      const end = performance.now();
      const memoryAfter = getMemoryUsage();
      recordProfile(name, end - start, memoryAfter - memoryBefore);
      throw error;
    }
  }) as T;
}

/**
 * Profile an async function call
 */
export async function profileAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  name: string,
  fn: T
): Promise<ReturnType<T>> {
  const start = Date.now();
  const memoryBefore = getMemoryUsage();
  
  try {
    const result = await fn();
    const end = Date.now();
    const memoryAfter = getMemoryUsage();
    recordProfile(name, end - start, memoryAfter - memoryBefore);
    return result as ReturnType<T>;
  } catch (error) {
    const end = Date.now();
    const memoryAfter = getMemoryUsage();
    recordProfile(name, end - start, memoryAfter - memoryBefore);
    throw error;
  }
}

// ============================================================================
// Profile Recording
// ============================================================================

const profileData: Array<{ name: string; duration: number; memory: number }> = [];

function recordProfile(name: string, duration: number, memory: number): void {
  profileData.push({ name, duration, memory });
}

export function getProfileData(): typeof profileData {
  return [...profileData];
}

export function clearProfileData(): void {
  profileData.length = 0;
}

function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed / 1024 / 1024;
  }
  return 0;
}
