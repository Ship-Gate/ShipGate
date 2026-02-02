// ============================================================================
// Crash Minimizer
// Minimize crashing inputs to find the smallest reproducing case
// ============================================================================

import { MinimizeResult, FuzzTarget } from './types.js';

/**
 * Minimizer configuration
 */
export interface MinimizerConfig {
  /** Maximum minimization steps */
  maxSteps?: number;
  
  /** Timeout per step in milliseconds */
  stepTimeout?: number;
  
  /** Verify the crash is reproducible first */
  verifyFirst?: boolean;
  
  /** Try multiple minimization strategies */
  multiStrategy?: boolean;
}

/**
 * Minimize a crashing input
 */
export async function minimize<T>(
  input: T,
  target: FuzzTarget<T, unknown>,
  config: MinimizerConfig = {}
): Promise<MinimizeResult> {
  const maxSteps = config.maxSteps ?? 100;
  const verifyFirst = config.verifyFirst ?? true;

  // Verify the crash is reproducible
  if (verifyFirst) {
    const reproduces = await verifyCrash(input, target);
    if (!reproduces) {
      return {
        original: input,
        minimized: input,
        reductionPercent: 0,
        steps: 0,
      };
    }
  }

  let current = input;
  let steps = 0;

  // Try different minimization strategies
  const strategies: MinimizationStrategy<T>[] = [
    binaryReduction,
    incrementalDeletion,
    fieldRemoval,
    valueSimplification,
  ];

  for (const strategy of strategies) {
    if (steps >= maxSteps) break;

    const result = await strategy(current, target, maxSteps - steps);
    if (result.reduced) {
      current = result.value;
      steps += result.steps;
    }
  }

  // Calculate reduction
  const originalSize = measureSize(input);
  const minimizedSize = measureSize(current);
  const reductionPercent = originalSize > 0 
    ? ((originalSize - minimizedSize) / originalSize) * 100 
    : 0;

  return {
    original: input,
    minimized: current,
    reductionPercent,
    steps,
  };
}

/**
 * Minimization strategy function type
 */
type MinimizationStrategy<T> = (
  input: T,
  target: FuzzTarget<T, unknown>,
  maxSteps: number
) => Promise<{ value: T; reduced: boolean; steps: number }>;

/**
 * Binary reduction strategy (for strings and arrays)
 */
async function binaryReduction<T>(
  input: T,
  target: FuzzTarget<T, unknown>,
  maxSteps: number
): Promise<{ value: T; reduced: boolean; steps: number }> {
  if (typeof input === 'string') {
    return binaryReduceString(input, target as FuzzTarget<string, unknown>, maxSteps) as Promise<{ value: T; reduced: boolean; steps: number }>;
  }
  
  if (Array.isArray(input)) {
    return binaryReduceArray(input, target as FuzzTarget<unknown[], unknown>, maxSteps) as Promise<{ value: T; reduced: boolean; steps: number }>;
  }

  return { value: input, reduced: false, steps: 0 };
}

/**
 * Binary reduce a string
 */
async function binaryReduceString(
  input: string,
  target: FuzzTarget<string, unknown>,
  maxSteps: number
): Promise<{ value: string; reduced: boolean; steps: number }> {
  let current = input;
  let steps = 0;
  let reduced = false;

  while (steps < maxSteps && current.length > 1) {
    // Try first half
    const firstHalf = current.slice(0, Math.floor(current.length / 2));
    if (await verifyCrash(firstHalf, target)) {
      current = firstHalf;
      reduced = true;
      steps++;
      continue;
    }

    // Try second half
    const secondHalf = current.slice(Math.floor(current.length / 2));
    if (await verifyCrash(secondHalf, target)) {
      current = secondHalf;
      reduced = true;
      steps++;
      continue;
    }

    // Neither half works alone, try removing chunks
    const chunkSize = Math.max(1, Math.floor(current.length / 4));
    let chunkReduced = false;
    
    for (let i = 0; i < current.length && steps < maxSteps; i += chunkSize) {
      const without = current.slice(0, i) + current.slice(i + chunkSize);
      if (await verifyCrash(without, target)) {
        current = without;
        reduced = true;
        chunkReduced = true;
        steps++;
        break;
      }
    }

    if (!chunkReduced) break;
  }

  return { value: current, reduced, steps };
}

/**
 * Binary reduce an array
 */
async function binaryReduceArray<T>(
  input: T[],
  target: FuzzTarget<T[], unknown>,
  maxSteps: number
): Promise<{ value: T[]; reduced: boolean; steps: number }> {
  let current = [...input];
  let steps = 0;
  let reduced = false;

  while (steps < maxSteps && current.length > 1) {
    // Try first half
    const firstHalf = current.slice(0, Math.floor(current.length / 2));
    if (await verifyCrash(firstHalf, target)) {
      current = firstHalf;
      reduced = true;
      steps++;
      continue;
    }

    // Try second half
    const secondHalf = current.slice(Math.floor(current.length / 2));
    if (await verifyCrash(secondHalf, target)) {
      current = secondHalf;
      reduced = true;
      steps++;
      continue;
    }

    // Try removing individual elements
    let elementReduced = false;
    for (let i = 0; i < current.length && steps < maxSteps; i++) {
      const without = [...current.slice(0, i), ...current.slice(i + 1)];
      if (await verifyCrash(without, target)) {
        current = without;
        reduced = true;
        elementReduced = true;
        steps++;
        break;
      }
    }

    if (!elementReduced) break;
  }

  return { value: current, reduced, steps };
}

/**
 * Incremental deletion strategy
 */
async function incrementalDeletion<T>(
  input: T,
  target: FuzzTarget<T, unknown>,
  maxSteps: number
): Promise<{ value: T; reduced: boolean; steps: number }> {
  if (typeof input === 'string') {
    return incrementalDeleteString(input, target as FuzzTarget<string, unknown>, maxSteps) as Promise<{ value: T; reduced: boolean; steps: number }>;
  }

  return { value: input, reduced: false, steps: 0 };
}

/**
 * Incrementally delete characters from string
 */
async function incrementalDeleteString(
  input: string,
  target: FuzzTarget<string, unknown>,
  maxSteps: number
): Promise<{ value: string; reduced: boolean; steps: number }> {
  let current = input;
  let steps = 0;
  let reduced = false;
  let i = 0;

  while (i < current.length && steps < maxSteps) {
    const without = current.slice(0, i) + current.slice(i + 1);
    if (await verifyCrash(without, target)) {
      current = without;
      reduced = true;
      steps++;
      // Don't increment i, try same position again
    } else {
      i++;
    }
  }

  return { value: current, reduced, steps };
}

/**
 * Field removal strategy (for objects)
 */
async function fieldRemoval<T>(
  input: T,
  target: FuzzTarget<T, unknown>,
  maxSteps: number
): Promise<{ value: T; reduced: boolean; steps: number }> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { value: input, reduced: false, steps: 0 };
  }

  let current = { ...input } as Record<string, unknown>;
  let steps = 0;
  let reduced = false;
  const keys = Object.keys(current);

  for (const key of keys) {
    if (steps >= maxSteps) break;

    const without = { ...current };
    delete without[key];

    if (await verifyCrash(without as T, target)) {
      current = without;
      reduced = true;
      steps++;
    }
  }

  return { value: current as T, reduced, steps };
}

/**
 * Value simplification strategy
 */
async function valueSimplification<T>(
  input: T,
  target: FuzzTarget<T, unknown>,
  maxSteps: number
): Promise<{ value: T; reduced: boolean; steps: number }> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { value: input, reduced: false, steps: 0 };
  }

  let current = { ...input } as Record<string, unknown>;
  let steps = 0;
  let reduced = false;

  for (const [key, value] of Object.entries(current)) {
    if (steps >= maxSteps) break;

    // Try simplifying each value
    const simplifications = getSimplifications(value);
    
    for (const simple of simplifications) {
      if (steps >= maxSteps) break;

      const modified = { ...current, [key]: simple };
      if (await verifyCrash(modified as T, target)) {
        current = modified;
        reduced = true;
        steps++;
        break;
      }
    }
  }

  return { value: current as T, reduced, steps };
}

/**
 * Get possible simplifications for a value
 */
function getSimplifications(value: unknown): unknown[] {
  if (typeof value === 'string') {
    return [
      '',
      'a',
      value.slice(0, 1),
      value.slice(0, Math.floor(value.length / 2)),
    ];
  }

  if (typeof value === 'number') {
    return [0, 1, -1, Math.floor(value), Math.ceil(value)];
  }

  if (Array.isArray(value)) {
    return [
      [],
      value.slice(0, 1),
      value.slice(0, Math.floor(value.length / 2)),
    ];
  }

  if (typeof value === 'object' && value !== null) {
    return [
      {},
      null,
    ];
  }

  return [null];
}

/**
 * Verify that input causes a crash
 */
async function verifyCrash<T>(
  input: T,
  target: FuzzTarget<T, unknown>
): Promise<boolean> {
  try {
    await target(input);
    return false;
  } catch {
    return true;
  }
}

/**
 * Measure the "size" of a value
 */
function measureSize(value: unknown): number {
  if (typeof value === 'string') {
    return value.length;
  }

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + measureSize(item), value.length);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).reduce(
      (sum, [key, val]) => sum + key.length + measureSize(val),
      Object.keys(value).length
    );
  }

  try {
    return JSON.stringify(value).length;
  } catch {
    return 1;
  }
}

/**
 * Delta debugging algorithm (more aggressive minimization)
 */
export async function deltaDebug<T>(
  input: T,
  target: FuzzTarget<T, unknown>,
  maxSteps: number = 100
): Promise<MinimizeResult> {
  // Delta debugging works best on strings/arrays
  if (typeof input !== 'string' && !Array.isArray(input)) {
    return minimize(input, target, { maxSteps });
  }

  const items = typeof input === 'string' ? input.split('') : [...input];
  let n = 2; // Start with 2 partitions
  let current = items;
  let steps = 0;

  while (current.length >= 2 && steps < maxSteps) {
    const partitionSize = Math.ceil(current.length / n);
    let reduced = false;

    // Try removing each partition
    for (let i = 0; i < n && steps < maxSteps; i++) {
      const start = i * partitionSize;
      const end = Math.min((i + 1) * partitionSize, current.length);
      const without = [...current.slice(0, start), ...current.slice(end)];
      
      const candidate = typeof input === 'string' 
        ? without.join('') as T 
        : without as T;

      if (await verifyCrash(candidate, target)) {
        current = without;
        n = Math.max(2, n - 1);
        reduced = true;
        steps++;
        break;
      }
    }

    if (!reduced) {
      if (n >= current.length) {
        break;
      }
      n = Math.min(n * 2, current.length);
    }
  }

  const minimized = typeof input === 'string' 
    ? current.join('') as T 
    : current as T;

  const originalSize = measureSize(input);
  const minimizedSize = measureSize(minimized);

  return {
    original: input,
    minimized,
    reductionPercent: originalSize > 0 
      ? ((originalSize - minimizedSize) / originalSize) * 100 
      : 0,
    steps,
  };
}
