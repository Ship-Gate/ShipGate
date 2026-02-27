/**
 * Temporal Fix Strategy
 * 
 * Fixes temporal violations by adding timeouts, retries, and caching.
 */

import type { AnalysisResult, CodeSegment } from '../analyzer.js';
import type { Patch, PatchContext } from '../patcher.js';

export interface TemporalFix {
  type: 'add_timeout' | 'add_retry' | 'add_cache' | 'optimize_query';
  targetDuration?: number;
  unit?: 'ms' | 's' | 'm';
  retryCount?: number;
  cacheKey?: string;
  cacheTTL?: number;
}

/**
 * Generate patches to fix temporal violations
 */
export function generateTemporalPatches(
  analysis: AnalysisResult,
  context: PatchContext
): Patch[] {
  const patches: Patch[] = [];
  const { failure, relatedCode } = analysis;

  // Parse the predicate to understand what temporal fix is needed
  const fix = parseTemporalPredicate(failure.predicate, failure.expected, failure.actual);
  
  if (!fix) {
    return patches;
  }

  // Find async operations that need to be wrapped
  const asyncOps = findAsyncOperations(relatedCode, context.implementation);

  switch (fix.type) {
    case 'add_timeout':
      patches.push(...generateTimeoutPatches(fix, asyncOps, context, analysis.confidence));
      break;
    case 'add_retry':
      patches.push(...generateRetryPatches(fix, asyncOps, context, analysis.confidence));
      break;
    case 'add_cache':
      patches.push(...generateCachePatches(fix, asyncOps, context, analysis.confidence));
      break;
    case 'optimize_query':
      patches.push(...generateOptimizationPatches(fix, asyncOps, context, analysis.confidence));
      break;
  }

  return patches;
}

/**
 * Parse temporal predicate to determine the fix needed
 */
function parseTemporalPredicate(
  predicate: string,
  _expected?: unknown,
  actual?: unknown
): TemporalFix | null {
  // Pattern: response within 200ms or within 1.seconds
  const withinMatch = predicate.match(/within\s+(\d+)(?:\.?(ms|milliseconds|s|seconds|m|minutes))?/i);
  if (withinMatch) {
    const duration = parseInt(withinMatch[1]!, 10);
    const unit = normalizeUnit(withinMatch[2] ?? 'ms');
    const targetMs = toMilliseconds(duration, unit);

    // If actual time is known and significantly over, suggest caching
    if (typeof actual === 'number' && actual > targetMs * 2) {
      return {
        type: 'add_cache',
        targetDuration: targetMs,
        unit,
        cacheTTL: 60000, // 1 minute default
      };
    }

    // Otherwise add timeout
    return {
      type: 'add_timeout',
      targetDuration: targetMs,
      unit,
    };
  }

  // Pattern: eventually within duration
  const eventuallyMatch = predicate.match(/eventually\s+(?:within\s+)?(\d+)(?:\.?(ms|s|m))?/i);
  if (eventuallyMatch) {
    const duration = parseInt(eventuallyMatch[1]!, 10);
    const unit = normalizeUnit(eventuallyMatch[2] ?? 's');
    return {
      type: 'add_retry',
      targetDuration: toMilliseconds(duration, unit),
      unit,
      retryCount: 3,
    };
  }

  // Pattern: immediately (strict timeout)
  if (predicate.includes('immediately')) {
    return {
      type: 'add_timeout',
      targetDuration: 100, // 100ms for "immediate"
      unit: 'ms',
    };
  }

  // Pattern: p99 or percentile mentions (likely need caching)
  if (predicate.includes('p99') || predicate.includes('p95')) {
    return {
      type: 'add_cache',
      targetDuration: 200,
      unit: 'ms',
      cacheTTL: 30000,
    };
  }

  return null;
}

/**
 * Normalize time unit
 */
function normalizeUnit(unit: string): 'ms' | 's' | 'm' {
  switch (unit.toLowerCase()) {
    case 'ms':
    case 'milliseconds':
      return 'ms';
    case 's':
    case 'seconds':
      return 's';
    case 'm':
    case 'minutes':
      return 'm';
    default:
      return 'ms';
  }
}

/**
 * Convert duration to milliseconds
 */
function toMilliseconds(value: number, unit: 'ms' | 's' | 'm'): number {
  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'm': return value * 60000;
    default: return value;
  }
}

/**
 * Find async operations in the code
 */
function findAsyncOperations(
  _relatedCode: CodeSegment[],
  implementation: string
): Array<{ line: number; code: string; operation: string }> {
  const operations: Array<{ line: number; code: string; operation: string }> = [];
  const lines = implementation.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Find await expressions
    const awaitMatch = line.match(/await\s+(\w+(?:\.\w+)*)\s*\(/);
    if (awaitMatch) {
      operations.push({
        line: i,
        code: line,
        operation: awaitMatch[1]!,
      });
      continue;
    }

    // Find .then() chains
    const thenMatch = line.match(/(\w+(?:\.\w+)*)\s*\(\s*\)\s*\.then/);
    if (thenMatch) {
      operations.push({
        line: i,
        code: line,
        operation: thenMatch[1]!,
      });
    }
  }

  return operations;
}

/**
 * Generate timeout wrapper patches
 */
function generateTimeoutPatches(
  fix: TemporalFix,
  asyncOps: Array<{ line: number; code: string; operation: string }>,
  _context: PatchContext,
  confidence: number
): Patch[] {
  const patches: Patch[] = [];
  const timeout = fix.targetDuration ?? 5000;

  // Add timeout utility function at the top (if not exists)
  patches.push({
    type: 'insert',
    file: 'implementation',
    line: 1,
    column: 0,
    content: `// Timeout utility
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), ms))
  ]);
};

`,
    description: 'Add timeout utility function',
    confidence: confidence * 0.9,
  });

  // Wrap each async operation with timeout
  for (const op of asyncOps.slice(0, 3)) { // Limit to first 3 to avoid over-patching
    const awaitMatch = op.code.match(/(await\s+)([^;]+)/);
    if (awaitMatch) {
      const [, , expression] = awaitMatch;
      patches.push({
        type: 'replace',
        file: 'implementation',
        line: op.line + 1,
        original: op.code.trim(),
        replacement: op.code.replace(
          `await ${expression}`,
          `await withTimeout(${expression!.trim()}, ${timeout})`
        ).trim(),
        description: `Add ${timeout}ms timeout to ${op.operation}`,
        confidence: confidence * 0.85,
      });
    }
  }

  return patches;
}

/**
 * Generate retry wrapper patches
 */
function generateRetryPatches(
  fix: TemporalFix,
  asyncOps: Array<{ line: number; code: string; operation: string }>,
  _context: PatchContext,
  confidence: number
): Patch[] {
  const patches: Patch[] = [];
  const retryCount = fix.retryCount ?? 3;
  const delay = Math.min(1000, (fix.targetDuration ?? 5000) / retryCount);

  // Add retry utility function at the top
  patches.push({
    type: 'insert',
    file: 'implementation',
    line: 1,
    column: 0,
    content: `// Retry utility with exponential backoff
const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = ${retryCount},
  baseDelay: number = ${delay}
): Promise<T> => {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError ?? new Error('Max retries exceeded');
};

`,
    description: 'Add retry utility function',
    confidence: confidence * 0.9,
  });

  // Wrap primary async operation with retry
  if (asyncOps.length > 0) {
    const primaryOp = asyncOps[0]!;
    const awaitMatch = primaryOp.code.match(/await\s+([^;]+)/);
    
    if (awaitMatch) {
      patches.push({
        type: 'replace',
        file: 'implementation',
        line: primaryOp.line + 1,
        original: primaryOp.code.trim(),
        replacement: primaryOp.code.replace(
          `await ${awaitMatch[1]}`,
          `await withRetry(async () => ${awaitMatch[1]!.trim()})`
        ).trim(),
        description: `Add retry wrapper to ${primaryOp.operation}`,
        confidence: confidence * 0.85,
      });
    }
  }

  return patches;
}

/**
 * Generate caching patches
 */
function generateCachePatches(
  fix: TemporalFix,
  asyncOps: Array<{ line: number; code: string; operation: string }>,
  _context: PatchContext,
  confidence: number
): Patch[] {
  const patches: Patch[] = [];
  const ttl = fix.cacheTTL ?? 60000;

  // Add simple cache implementation
  patches.push({
    type: 'insert',
    file: 'implementation',
    line: 1,
    column: 0,
    content: `// Simple cache for performance optimization
const cache = new Map<string, { value: unknown; expires: number }>();

const withCache = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = ${ttl}
): Promise<T> => {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.value as T;
  }
  const value = await fn();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
};

`,
    description: 'Add caching utility',
    confidence: confidence * 0.85,
  });

  // Wrap database queries with cache
  for (const op of asyncOps) {
    if (op.operation.includes('find') || op.operation.includes('get') || op.operation.includes('query')) {
      const awaitMatch = op.code.match(/await\s+([^;]+)/);
      if (awaitMatch) {
        const cacheKey = `'${op.operation}_' + JSON.stringify(input)`;
        patches.push({
          type: 'replace',
          file: 'implementation',
          line: op.line + 1,
          original: op.code.trim(),
          replacement: op.code.replace(
            `await ${awaitMatch[1]}`,
            `await withCache(${cacheKey}, async () => ${awaitMatch[1]!.trim()})`
          ).trim(),
          description: `Add caching to ${op.operation}`,
          confidence: confidence * 0.8,
        });
        break; // Only cache one operation to avoid complexity
      }
    }
  }

  return patches;
}

/**
 * Generate optimization patches
 */
function generateOptimizationPatches(
  _fix: TemporalFix,
  asyncOps: Array<{ line: number; code: string; operation: string }>,
  context: PatchContext,
  confidence: number
): Patch[] {
  const patches: Patch[] = [];
  const indent = context.indentation ?? '  ';

  // Add optimization comments and suggestions
  patches.push({
    type: 'insert',
    file: 'implementation',
    line: 1,
    column: 0,
    content: `// Performance optimization suggestions:
// 1. Consider adding database indexes for frequently queried fields
// 2. Use batch operations instead of sequential queries
// 3. Consider implementing pagination for large result sets
// 4. Add connection pooling if not already configured

`,
    description: 'Add performance optimization suggestions',
    confidence: confidence * 0.7,
  });

  // Look for sequential async operations that could be parallelized
  const sequentialOps = asyncOps.filter((op, i) => 
    i > 0 && asyncOps[i - 1]!.line === op.line - 1
  );

  if (sequentialOps.length >= 2) {
    patches.push({
      type: 'insert',
      file: 'implementation',
      line: sequentialOps[0]!.line,
      column: 0,
      content: `${indent}// TODO: Consider parallelizing these operations with Promise.all
`,
      description: 'Suggest parallelizing sequential operations',
      confidence: confidence * 0.6,
    });
  }

  return patches;
}

/**
 * Generate a complete temporal fix wrapper
 */
export function generateTemporalWrapper(
  code: string,
  requirements: { timeout?: number; retries?: number; cache?: boolean },
  context: PatchContext
): string {
  const indent = context.indentation ?? '  ';
  let wrapped = code;

  if (requirements.timeout) {
    wrapped = `await withTimeout(async () => {
${wrapped.split('\n').map(l => indent + l).join('\n')}
}, ${requirements.timeout})`;
  }

  if (requirements.retries) {
    wrapped = `await withRetry(async () => {
${wrapped.split('\n').map(l => indent + l).join('\n')}
}, ${requirements.retries})`;
  }

  return wrapped;
}
