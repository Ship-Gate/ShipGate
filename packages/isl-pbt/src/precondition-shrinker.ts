// ============================================================================
// Precondition-Aware Shrinker
// ============================================================================
//
// Enhanced shrinker that finds minimal failing inputs while ensuring
// shrunk values still satisfy ISL preconditions.
//
// Key features:
// - Shrinks inputs while preserving precondition satisfaction
// - Smart shrinking for domain-specific types (email, password)
// - Delta debugging with precondition filtering
// - Trace emission for debugging shrinking process
// ============================================================================

import type { ShrinkResult, ShrinkStep, PBTConfig } from './types.js';
import { shrinkInput as baseShrinkInput, deltaDebug as baseDeltaDebug } from './shrinker.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Precondition checker function
 * Returns true if the input satisfies all preconditions
 */
export type PreconditionChecker = (input: Record<string, unknown>) => boolean;

/**
 * Test function that returns true if test passes
 */
export type TestFunction = (input: Record<string, unknown>) => Promise<boolean>;

/**
 * Configuration for precondition-aware shrinking
 */
export interface PreconditionShrinkConfig extends Partial<PBTConfig> {
  /** Function to check if input satisfies preconditions */
  preconditionChecker: PreconditionChecker;
  
  /** Whether to emit traces during shrinking */
  emitTraces?: boolean;
  
  /** Maximum precondition check attempts before giving up on a candidate */
  maxPreconditionAttempts?: number;
}

/**
 * Extended shrink result with trace information
 */
export interface TracedShrinkResult extends ShrinkResult {
  /** Number of candidates that violated preconditions */
  preconditionViolations: number;
  
  /** Trace of shrinking steps with precondition info */
  tracedHistory: TracedShrinkStep[];
}

/**
 * Shrink step with precondition satisfaction info
 */
export interface TracedShrinkStep extends ShrinkStep {
  /** Whether this candidate satisfied preconditions */
  satisfiesPreconditions: boolean;
  
  /** If precondition failed, which one */
  preconditionViolation?: string;
}

// ============================================================================
// PRECONDITION-AWARE SHRINKING
// ============================================================================

/**
 * Shrink a failing input while preserving preconditions
 * 
 * This shrinker only considers candidates that satisfy all preconditions,
 * ensuring the minimal counterexample is still a valid test case.
 * 
 * @example
 * ```typescript
 * const result = await shrinkWithPreconditions(
 *   failingInput,
 *   testFn,
 *   {
 *     preconditionChecker: (input) => {
 *       const email = input.email as string;
 *       const password = input.password as string;
 *       return isValidEmailFormat(email) && 
 *              password.length >= 8 && 
 *              password.length <= 128;
 *     },
 *     maxShrinks: 100,
 *   }
 * );
 * 
 * console.log('Minimal failing input:', result.minimal);
 * console.log('Precondition violations skipped:', result.preconditionViolations);
 * ```
 */
export async function shrinkWithPreconditions(
  originalInput: Record<string, unknown>,
  testFn: TestFunction,
  config: PreconditionShrinkConfig
): Promise<TracedShrinkResult> {
  const {
    preconditionChecker,
    maxShrinks = 100,
    emitTraces = false,
    maxPreconditionAttempts = 1000,
  } = config;

  const tracedHistory: TracedShrinkStep[] = [];
  let preconditionViolations = 0;
  let current = originalInput;
  let currentSize = computeSize(current);
  let attempts = 0;

  // Verify original satisfies preconditions
  if (!preconditionChecker(originalInput)) {
    return {
      original: originalInput,
      minimal: originalInput,
      shrinkAttempts: 0,
      history: [],
      preconditionViolations: 1,
      tracedHistory: [{
        input: originalInput,
        passed: false,
        size: currentSize,
        satisfiesPreconditions: false,
        preconditionViolation: 'Original input does not satisfy preconditions',
      }],
    };
  }

  // Generate shrink candidates that satisfy preconditions
  while (attempts < maxShrinks) {
    const candidates = generateShrinkCandidates(current);
    let foundSmaller = false;
    let preconditionAttemptsInRound = 0;

    for (const candidate of candidates) {
      attempts++;
      if (attempts > maxShrinks) break;

      const candidateSize = computeSize(candidate);

      // Skip if not smaller
      if (candidateSize >= currentSize) continue;

      // Check preconditions first
      const satisfiesPreconditions = preconditionChecker(candidate);
      
      if (!satisfiesPreconditions) {
        preconditionViolations++;
        preconditionAttemptsInRound++;
        
        if (emitTraces) {
          tracedHistory.push({
            input: candidate,
            passed: false,
            size: candidateSize,
            satisfiesPreconditions: false,
            preconditionViolation: 'Precondition check failed',
          });
        }
        
        // Limit precondition failures per round
        if (preconditionAttemptsInRound > maxPreconditionAttempts) {
          break;
        }
        continue;
      }

      // Run the test
      try {
        const passed = await testFn(candidate);

        const step: TracedShrinkStep = {
          input: candidate,
          passed,
          size: candidateSize,
          satisfiesPreconditions: true,
        };
        tracedHistory.push(step);

        if (!passed) {
          // Found smaller failing input that satisfies preconditions
          current = candidate;
          currentSize = candidateSize;
          foundSmaller = true;
          break;
        }
      } catch (error) {
        // Error counts as failure
        const step: TracedShrinkStep = {
          input: candidate,
          passed: false,
          size: candidateSize,
          satisfiesPreconditions: true,
        };
        tracedHistory.push(step);

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
    history: tracedHistory.map(({ satisfiesPreconditions, preconditionViolation, ...rest }) => rest),
    preconditionViolations,
    tracedHistory,
  };
}

// ============================================================================
// DOMAIN-SPECIFIC SHRINKERS
// ============================================================================

/**
 * Shrink an email while keeping it valid
 * Respects the email.is_valid_format precondition
 */
export function* shrinkValidEmail(email: string): Generator<string> {
  const [local, domain] = email.split('@');
  if (!local || !domain) return;

  // All shrunk values must be valid emails
  
  // Shrink local part (min 1 char)
  if (local.length > 1) {
    yield `${local[0]}@${domain}`;
  }
  
  if (local.length > 2) {
    yield `${local.slice(0, 2)}@${domain}`;
  }
  
  if (local.length > 3) {
    yield `${local.slice(0, Math.ceil(local.length / 2))}@${domain}`;
  }

  // Try simpler domains (all valid)
  if (domain !== 'example.com') {
    yield `${local}@example.com`;
  }
  if (domain !== 'a.co' && local.length > 0) {
    yield `${local}@a.co`;
  }
  
  // Simplest valid email
  if (email !== 'a@a.co') {
    yield 'a@a.co';
  }
}

/**
 * Shrink a password while respecting length constraints
 * Ensures password.length >= minLength AND password.length <= maxLength
 */
export function* shrinkValidPassword(
  password: string,
  minLength: number = 8,
  maxLength: number = 128
): Generator<string> {
  // All shrunk values must satisfy length constraints
  if (password.length <= minLength) return;
  if (password.length > maxLength) {
    // First shrink to max length
    yield password.slice(0, maxLength);
  }

  // Shrink to minimum length (the smallest valid password)
  if (password.length > minLength) {
    yield password.slice(0, minLength);
  }

  // Progressive shrinking towards minimum
  for (let len = password.length - 1; len > minLength; len--) {
    yield password.slice(0, len);
  }

  // Try simplest password at minimum length
  const simple = 'a'.repeat(minLength);
  if (password !== simple && simple.length >= minLength && simple.length <= maxLength) {
    yield simple;
  }
}

/**
 * Shrink an IP address while keeping it valid
 */
export function* shrinkValidIP(ip: string): Generator<string> {
  if (ip === '0.0.0.0') return;
  
  // All valid IPs
  yield '0.0.0.0';
  yield '1.1.1.1';
  yield '127.0.0.1';
}

// ============================================================================
// DELTA DEBUGGING WITH PRECONDITIONS
// ============================================================================

/**
 * Delta debugging with precondition preservation
 * 
 * Systematically reduces input while preserving:
 * 1. The failure (test still fails)
 * 2. Precondition satisfaction
 */
export async function deltaDebugWithPreconditions(
  originalInput: Record<string, unknown>,
  testFn: TestFunction,
  config: PreconditionShrinkConfig
): Promise<TracedShrinkResult> {
  const {
    preconditionChecker,
    maxShrinks = 500,
    emitTraces = false,
  } = config;

  const tracedHistory: TracedShrinkStep[] = [];
  let preconditionViolations = 0;
  let current = originalInput;
  let attempts = 0;
  let n = 2;

  const keys = Object.keys(originalInput);

  // Phase 1: Remove fields (delta debugging on structure)
  while (attempts < maxShrinks && keys.length >= 1) {
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

      // Check preconditions
      const satisfiesPreconditions = preconditionChecker(candidate);
      if (!satisfiesPreconditions) {
        preconditionViolations++;
        if (emitTraces) {
          tracedHistory.push({
            input: candidate,
            passed: false,
            size: computeSize(candidate),
            satisfiesPreconditions: false,
          });
        }
        continue;
      }

      try {
        const passed = await testFn(candidate);

        tracedHistory.push({
          input: candidate,
          passed,
          size: computeSize(candidate),
          satisfiesPreconditions: true,
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

    if (!foundSmaller) {
      if (n >= keys.length) break;
      n = Math.min(keys.length, n * 2);
    }
  }

  // Phase 2: Shrink individual values with domain-specific shrinkers
  const valueShrinkResult = await shrinkWithPreconditions(current, testFn, {
    ...config,
    maxShrinks: maxShrinks - attempts,
  });

  return {
    original: originalInput,
    minimal: valueShrinkResult.minimal,
    shrinkAttempts: attempts + valueShrinkResult.shrinkAttempts,
    history: [
      ...tracedHistory.map(({ satisfiesPreconditions, preconditionViolation, ...rest }) => rest),
      ...valueShrinkResult.history,
    ],
    preconditionViolations: preconditionViolations + valueShrinkResult.preconditionViolations,
    tracedHistory: [...tracedHistory, ...valueShrinkResult.tracedHistory],
  };
}

// ============================================================================
// LOGIN-SPECIFIC SHRINKER
// ============================================================================

/**
 * Shrink login input while preserving preconditions:
 *   - email.is_valid_format
 *   - password.length >= 8
 *   - password.length <= 128
 */
export async function shrinkLoginInput(
  originalInput: { email: string; password: string; ip_address?: string },
  testFn: TestFunction,
  config: Partial<PBTConfig> & {
    passwordMinLength?: number;
    passwordMaxLength?: number;
  } = {}
): Promise<TracedShrinkResult> {
  const {
    passwordMinLength = 8,
    passwordMaxLength = 128,
    maxShrinks = 100,
    ...restConfig
  } = config;

  // Login precondition checker
  const preconditionChecker: PreconditionChecker = (input) => {
    const email = input.email as string;
    const password = input.password as string;

    // Check email format
    if (!email || typeof email !== 'string') return false;
    if (!email.includes('@')) return false;
    const [local, domain] = email.split('@');
    if (!local || !domain || !domain.includes('.')) return false;

    // Check password length
    if (!password || typeof password !== 'string') return false;
    if (password.length < passwordMinLength) return false;
    if (password.length > passwordMaxLength) return false;

    return true;
  };

  return deltaDebugWithPreconditions(originalInput as Record<string, unknown>, testFn, {
    ...restConfig,
    maxShrinks,
    preconditionChecker,
    emitTraces: true,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate shrink candidates for an input object
 * Includes domain-specific shrinking for known types
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

  // Shrink each field with domain-specific shrinkers
  for (const [key, value] of Object.entries(input)) {
    // Domain-specific shrinking
    if (key === 'email' && typeof value === 'string' && value.includes('@')) {
      for (const shrunk of shrinkValidEmail(value)) {
        yield { ...input, [key]: shrunk };
      }
    } else if (key === 'password' && typeof value === 'string') {
      // Use login password constraints
      for (const shrunk of shrinkValidPassword(value, 8, 128)) {
        yield { ...input, [key]: shrunk };
      }
    } else if ((key === 'ip_address' || key === 'ipAddress') && typeof value === 'string') {
      for (const shrunk of shrinkValidIP(value)) {
        yield { ...input, [key]: shrunk };
      }
    } else {
      // Generic shrinking
      for (const shrunk of shrinkValue(value)) {
        yield { ...input, [key]: shrunk };
      }
    }
  }
}

/**
 * Generic value shrinker
 */
function* shrinkValue(value: unknown): Generator<unknown> {
  if (value === null || value === undefined) return;

  if (typeof value === 'string') {
    if (value.length > 0) yield '';
    if (value.length > 1) yield value[0];
    if (value.length > 2) yield value.slice(0, Math.ceil(value.length / 2));
    for (let i = value.length - 1; i > 0; i--) {
      yield value.slice(0, i);
    }
  } else if (typeof value === 'number') {
    if (value !== 0) yield 0;
    if (value < 0) yield Math.abs(value);
    if (!Number.isInteger(value)) yield Math.trunc(value);
    let current = value;
    while (Math.abs(current) > 1) {
      current = Math.trunc(current / 2);
      yield current;
    }
  } else if (typeof value === 'boolean') {
    if (value) yield false;
  } else if (Array.isArray(value)) {
    if (value.length > 0) yield [];
    if (value.length > 1) yield [value[0]];
    if (value.length > 2) yield value.slice(0, Math.ceil(value.length / 2));
    for (let i = 0; i < value.length; i++) {
      yield [...value.slice(0, i), ...value.slice(i + 1)];
    }
  }
}

/**
 * Compute the "size" of a value for comparison
 */
function computeSize(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return Math.abs(value);
  if (typeof value === 'string') return value.length;
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
// EXPORTS
// ============================================================================

export {
  shrinkWithPreconditions,
  deltaDebugWithPreconditions,
  shrinkLoginInput,
  shrinkValidEmail,
  shrinkValidPassword,
  shrinkValidIP,
};
