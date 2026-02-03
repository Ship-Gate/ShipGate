// ============================================================================
// Shrinker - Find minimal failing inputs
// ============================================================================

import type { ShrinkResult, ShrinkStep, PBTConfig } from './types.js';

// ============================================================================
// MAIN SHRINKING ALGORITHM
// ============================================================================

/**
 * Shrink a failing input to find the minimal failing case
 */
export async function shrinkInput(
  originalInput: Record<string, unknown>,
  testFn: (input: Record<string, unknown>) => Promise<boolean>,
  config: Partial<PBTConfig> = {}
): Promise<ShrinkResult> {
  const { maxShrinks = 100 } = config;
  
  const history: ShrinkStep[] = [];
  let current = originalInput;
  let currentSize = computeSize(current);
  let attempts = 0;
  
  // Keep shrinking while we can find smaller failing inputs
  while (attempts < maxShrinks) {
    const candidates = generateShrinkCandidates(current);
    let foundSmaller = false;
    
    for (const candidate of candidates) {
      attempts++;
      if (attempts > maxShrinks) break;
      
      const candidateSize = computeSize(candidate);
      
      // Only try if candidate is smaller
      if (candidateSize >= currentSize) continue;
      
      try {
        const passed = await testFn(candidate);
        
        history.push({
          input: candidate,
          passed,
          size: candidateSize,
        });
        
        if (!passed) {
          // Found a smaller failing input
          current = candidate;
          currentSize = candidateSize;
          foundSmaller = true;
          break;
        }
      } catch {
        // Error counts as failure
        history.push({
          input: candidate,
          passed: false,
          size: candidateSize,
        });
        
        current = candidate;
        currentSize = candidateSize;
        foundSmaller = true;
        break;
      }
    }
    
    if (!foundSmaller) {
      // No smaller failing input found, we're done
      break;
    }
  }
  
  return {
    original: originalInput,
    minimal: current,
    shrinkAttempts: attempts,
    history,
  };
}

// ============================================================================
// SHRINK CANDIDATE GENERATION
// ============================================================================

/**
 * Generate shrink candidates for an input object
 */
function* generateShrinkCandidates(
  input: Record<string, unknown>
): Generator<Record<string, unknown>> {
  // Try removing optional fields
  for (const key of Object.keys(input)) {
    if (input[key] !== undefined && input[key] !== null) {
      yield { ...input, [key]: undefined };
    }
  }
  
  // Try shrinking each field
  for (const [key, value] of Object.entries(input)) {
    for (const shrunk of shrinkValue(value)) {
      yield { ...input, [key]: shrunk };
    }
  }
  
  // Try shrinking multiple fields at once
  const keys = Object.keys(input);
  if (keys.length > 1) {
    // Try keeping only first half of fields
    const halfKeys = keys.slice(0, Math.ceil(keys.length / 2));
    const halfInput: Record<string, unknown> = {};
    for (const key of halfKeys) {
      halfInput[key] = input[key];
    }
    yield halfInput;
  }
}

/**
 * Shrink a single value
 */
function* shrinkValue(value: unknown): Generator<unknown> {
  if (value === null || value === undefined) {
    return;
  }
  
  if (typeof value === 'string') {
    yield* shrinkString(value);
  } else if (typeof value === 'number') {
    yield* shrinkNumber(value);
  } else if (typeof value === 'boolean') {
    yield* shrinkBoolean(value);
  } else if (Array.isArray(value)) {
    yield* shrinkArray(value);
  } else if (typeof value === 'object') {
    yield* shrinkObject(value as Record<string, unknown>);
  }
}

/**
 * Shrink a string
 */
function* shrinkString(value: string): Generator<string> {
  if (value.length === 0) return;
  
  // Empty string
  yield '';
  
  // Single character
  if (value.length > 1) {
    yield value[0]!;
  }
  
  // Half length
  if (value.length > 2) {
    yield value.slice(0, Math.ceil(value.length / 2));
  }
  
  // Remove characters from end
  for (let i = value.length - 1; i > 0; i--) {
    yield value.slice(0, i);
  }
  
  // Remove characters from beginning
  for (let i = 1; i < value.length; i++) {
    yield value.slice(i);
  }
  
  // Replace with simpler characters
  if (/[^a-z]/.test(value)) {
    yield value.toLowerCase().replace(/[^a-z]/g, 'a');
  }
}

/**
 * Shrink a number
 */
function* shrinkNumber(value: number): Generator<number> {
  if (value === 0) return;
  
  // Zero
  yield 0;
  
  // Positive version
  if (value < 0) {
    yield Math.abs(value);
  }
  
  // Integer version
  if (!Number.isInteger(value)) {
    yield Math.trunc(value);
  }
  
  // Binary search towards zero
  let current = value;
  while (Math.abs(current) > 1) {
    current = Math.trunc(current / 2);
    yield current;
  }
  
  // Adjacent values
  if (value > 0) {
    yield value - 1;
  } else {
    yield value + 1;
  }
  
  // Small positive integers
  if (Math.abs(value) > 1) {
    yield 1;
    yield -1;
  }
}

/**
 * Shrink a boolean
 */
function* shrinkBoolean(value: boolean): Generator<boolean> {
  // Shrink true to false
  if (value) {
    yield false;
  }
}

/**
 * Shrink an array
 */
function* shrinkArray(value: unknown[]): Generator<unknown[]> {
  if (value.length === 0) return;
  
  // Empty array
  yield [];
  
  // Single element
  if (value.length > 1) {
    yield [value[0]];
  }
  
  // First half
  if (value.length > 2) {
    yield value.slice(0, Math.ceil(value.length / 2));
  }
  
  // Remove each element
  for (let i = 0; i < value.length; i++) {
    yield [...value.slice(0, i), ...value.slice(i + 1)];
  }
  
  // Shrink individual elements
  for (let i = 0; i < value.length; i++) {
    for (const shrunk of shrinkValue(value[i])) {
      yield [...value.slice(0, i), shrunk, ...value.slice(i + 1)];
    }
  }
}

/**
 * Shrink an object
 */
function* shrinkObject(value: Record<string, unknown>): Generator<Record<string, unknown>> {
  const keys = Object.keys(value);
  if (keys.length === 0) return;
  
  // Empty object
  yield {};
  
  // Remove each key
  for (const key of keys) {
    const copy = { ...value };
    delete copy[key];
    yield copy;
  }
  
  // Shrink individual values
  for (const key of keys) {
    for (const shrunk of shrinkValue(value[key])) {
      yield { ...value, [key]: shrunk };
    }
  }
  
  // Keep only first key
  if (keys.length > 1) {
    yield { [keys[0]!]: value[keys[0]!] };
  }
}

// ============================================================================
// SIZE COMPUTATION
// ============================================================================

/**
 * Compute the "size" of a value for comparison during shrinking
 */
function computeSize(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  
  if (typeof value === 'number') {
    return Math.abs(value);
  }
  
  if (typeof value === 'string') {
    return value.length;
  }
  
  if (Array.isArray(value)) {
    return value.length + value.reduce((sum, el) => sum + computeSize(el), 0);
  }
  
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    return keys.length + keys.reduce((sum, key) => sum + computeSize(obj[key]), 0);
  }
  
  return 1;
}

// ============================================================================
// SPECIFIC SHRINKERS
// ============================================================================

/**
 * Shrink an email while keeping it valid
 */
export function* shrinkEmail(email: string): Generator<string> {
  const [local, domain] = email.split('@');
  if (!local || !domain) return;
  
  // Shortest valid email with same domain
  if (local.length > 1) {
    yield `${local[0]}@${domain}`;
  }
  
  // Shrink local part
  if (local.length > 2) {
    yield `${local.slice(0, Math.ceil(local.length / 2))}@${domain}`;
  }
  
  // Use simpler domain
  if (domain !== 'example.com') {
    yield `${local}@example.com`;
  }
  
  // Simplest possible email
  yield 'a@b.co';
}

/**
 * Shrink a password while keeping it valid (min 8 chars)
 */
export function* shrinkPassword(password: string, minLength = 8): Generator<string> {
  if (password.length <= minLength) return;
  
  // Minimum length
  yield password.slice(0, minLength);
  
  // Progressive shrinking
  for (let i = password.length - 1; i > minLength; i--) {
    yield password.slice(0, i);
  }
  
  // Simple password at minimum length
  yield 'aA1!' + 'a'.repeat(minLength - 4);
}

/**
 * Shrink IP address
 */
export function* shrinkIP(ip: string): Generator<string> {
  if (ip === '0.0.0.0') return;
  
  yield '0.0.0.0';
  yield '1.1.1.1';
  yield '127.0.0.1';
}

// ============================================================================
// DELTA DEBUGGING
// ============================================================================

/**
 * Delta debugging - systematically reduce input while preserving failure
 * More thorough than simple shrinking but slower
 */
export async function deltaDebug(
  originalInput: Record<string, unknown>,
  testFn: (input: Record<string, unknown>) => Promise<boolean>,
  config: Partial<PBTConfig> = {}
): Promise<ShrinkResult> {
  const { maxShrinks = 500 } = config;
  
  const history: ShrinkStep[] = [];
  let current = originalInput;
  let attempts = 0;
  let n = 2; // Number of partitions
  
  const keys = Object.keys(originalInput);
  
  while (attempts < maxShrinks && keys.length >= 1) {
    // Split keys into n partitions
    const partitionSize = Math.ceil(keys.length / n);
    const partitions: string[][] = [];
    
    for (let i = 0; i < keys.length; i += partitionSize) {
      partitions.push(keys.slice(i, i + partitionSize));
    }
    
    let foundSmaller = false;
    
    // Try removing each partition
    for (const partition of partitions) {
      const candidate: Record<string, unknown> = {};
      for (const key of keys) {
        if (!partition.includes(key)) {
          candidate[key] = current[key];
        }
      }
      
      attempts++;
      if (attempts > maxShrinks) break;
      
      try {
        const passed = await testFn(candidate);
        
        history.push({
          input: candidate,
          passed,
          size: computeSize(candidate),
        });
        
        if (!passed) {
          // Removing partition still fails, keep smaller input
          current = candidate;
          keys.splice(0, keys.length, ...Object.keys(candidate));
          foundSmaller = true;
          n = Math.max(2, n - 1);
          break;
        }
      } catch {
        // Error counts as failure
        current = candidate;
        keys.splice(0, keys.length, ...Object.keys(candidate));
        foundSmaller = true;
        n = Math.max(2, n - 1);
        break;
      }
    }
    
    // Try keeping each partition (complement of removing)
    if (!foundSmaller) {
      for (const partition of partitions) {
        const candidate: Record<string, unknown> = {};
        for (const key of partition) {
          candidate[key] = current[key];
        }
        
        attempts++;
        if (attempts > maxShrinks) break;
        
        try {
          const passed = await testFn(candidate);
          
          history.push({
            input: candidate,
            passed,
            size: computeSize(candidate),
          });
          
          if (!passed) {
            current = candidate;
            keys.splice(0, keys.length, ...Object.keys(candidate));
            foundSmaller = true;
            n = Math.max(2, n - 1);
            break;
          }
        } catch {
          current = candidate;
          keys.splice(0, keys.length, ...Object.keys(candidate));
          foundSmaller = true;
          n = Math.max(2, n - 1);
          break;
        }
      }
    }
    
    if (!foundSmaller) {
      // No progress, increase granularity
      if (n >= keys.length) {
        // Maximum granularity reached, try value shrinking
        break;
      }
      n = Math.min(keys.length, n * 2);
    }
  }
  
  // Now shrink individual values
  const valueShrinkResult = await shrinkInput(current, testFn, {
    ...config,
    maxShrinks: maxShrinks - attempts,
  });
  
  return {
    original: originalInput,
    minimal: valueShrinkResult.minimal,
    shrinkAttempts: attempts + valueShrinkResult.shrinkAttempts,
    history: [...history, ...valueShrinkResult.history],
  };
}
