/**
 * Stable Fingerprint for NO_SHIP State & Stuck Detection
 * 
 * The fingerprint must be:
 * 1. Stable across runs (same violations → same fingerprint)
 * 2. Independent of ordering (violations in any order produce same result)
 * 3. Sensitive to meaningful changes (different message → different fingerprint)
 * 
 * @module @isl-lang/pipeline
 */

import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ViolationLike {
  ruleId: string;
  file: string;
  message: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface FingerprintOptions {
  /** Include message in fingerprint (default: true) */
  includeMessage?: boolean;
  /** Include span (line/column) in fingerprint (default: true) */
  includeSpan?: boolean;
  /** Normalize whitespace in messages (default: true) */
  normalizeWhitespace?: boolean;
  /** Hash algorithm (default: 'sha256') */
  algorithm?: 'sha256' | 'sha1' | 'md5';
  /** Output length in hex chars (default: 16) */
  outputLength?: number;
}

export interface StuckDetectionConfig {
  /** Number of repeated fingerprints before declaring stuck (default: 2) */
  repeatThreshold: number;
  /** Maximum iterations before aborting (default: 10) */
  maxIterations: number;
  /** Whether to track partial matches (default: false) */
  trackPartialMatches?: boolean;
}

export type AbortReason = 
  | 'stuck'           // Same fingerprint repeated N times
  | 'max_iterations'  // Exceeded max iteration count
  | 'oscillating'     // Alternating between two fingerprints
  | 'partial_stuck';  // Core violations not changing

export interface AbortCondition {
  shouldAbort: boolean;
  reason?: AbortReason;
  details?: string;
}

// ============================================================================
// Message Normalization
// ============================================================================

/**
 * Normalize a violation message for consistent fingerprinting.
 * 
 * - Collapses multiple whitespace to single space
 * - Trims leading/trailing whitespace
 * - Removes variable values that might differ between runs (timestamps, IDs)
 * - Lowercases for case-insensitive matching
 */
export function normalizeMessage(message: string): string {
  let normalized = message
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    // Trim
    .trim()
    // Remove common variable patterns (UUIDs, timestamps, numbers in context)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?\b/g, '<TIMESTAMP>')
    .replace(/\bline \d+\b/gi, 'line <N>')
    .replace(/\bcolumn \d+\b/gi, 'column <N>')
    // Lowercase for case-insensitive comparison
    .toLowerCase();
  
  return normalized;
}

/**
 * Normalize a span (line/column range) for fingerprinting.
 * Returns a stable string representation.
 */
export function normalizeSpan(
  line?: number,
  column?: number,
  endLine?: number,
  endColumn?: number
): string {
  // If no line info, return empty (span not considered)
  if (line === undefined) return '';
  
  // Format: L<line>[:C<column>][-L<endLine>[:C<endColumn>]]
  let span = `L${line}`;
  if (column !== undefined) span += `:C${column}`;
  if (endLine !== undefined && endLine !== line) {
    span += `-L${endLine}`;
    if (endColumn !== undefined) span += `:C${endColumn}`;
  }
  return span;
}

// ============================================================================
// Core Fingerprint Function
// ============================================================================

/**
 * Compute a single violation's contribution to the fingerprint.
 * This is the atomic unit that gets sorted and hashed.
 */
function violationKey(violation: ViolationLike, options: Required<FingerprintOptions>): string {
  const parts: string[] = [
    violation.ruleId,
    violation.file,
  ];
  
  if (options.includeMessage) {
    const msg = options.normalizeWhitespace 
      ? normalizeMessage(violation.message)
      : violation.message;
    parts.push(msg);
  }
  
  if (options.includeSpan) {
    const span = normalizeSpan(
      violation.line,
      violation.column,
      violation.endLine,
      violation.endColumn
    );
    if (span) parts.push(span);
  }
  
  // Join with null character to prevent collisions
  // e.g., "a|b" vs "a" + "|b" would collide with simple concatenation
  return parts.join('\0');
}

/**
 * Compute a stable fingerprint for a set of violations.
 * 
 * The fingerprint is:
 * 1. Deterministic: Same input → same output
 * 2. Order-independent: [v1, v2] and [v2, v1] produce same result
 * 3. Collision-resistant: Different violations → different fingerprints (high probability)
 * 
 * @param violations - Array of violations to fingerprint
 * @param options - Fingerprint configuration
 * @returns Hex string fingerprint
 */
export function stableFingerprint(
  violations: ViolationLike[],
  options: FingerprintOptions = {}
): string {
  const opts: Required<FingerprintOptions> = {
    includeMessage: options.includeMessage ?? true,
    includeSpan: options.includeSpan ?? true,
    normalizeWhitespace: options.normalizeWhitespace ?? true,
    algorithm: options.algorithm ?? 'sha256',
    outputLength: options.outputLength ?? 16,
  };
  
  // Empty violations → empty fingerprint
  if (violations.length === 0) {
    return '0'.repeat(opts.outputLength);
  }
  
  // Generate keys for all violations
  const keys = violations.map(v => violationKey(v, opts));
  
  // Sort for order independence
  keys.sort();
  
  // Join with separator and hash
  const combined = keys.join('\n');
  const hash = crypto.createHash(opts.algorithm).update(combined).digest('hex');
  
  // Truncate to desired length
  return hash.slice(0, opts.outputLength);
}

/**
 * Compute fingerprint with default options (convenience function).
 */
export function computeViolationFingerprint(violations: ViolationLike[]): string {
  return stableFingerprint(violations);
}

// ============================================================================
// Fingerprint Tracker (for Stuck Detection)
// ============================================================================

/**
 * Tracks fingerprints across healing iterations to detect stuck states.
 */
export class FingerprintTracker {
  private fingerprints: Map<string, number> = new Map();
  private history: string[] = [];
  private config: Required<StuckDetectionConfig>;
  
  constructor(config: Partial<StuckDetectionConfig> = {}) {
    this.config = {
      repeatThreshold: config.repeatThreshold ?? 2,
      maxIterations: config.maxIterations ?? 10,
      trackPartialMatches: config.trackPartialMatches ?? false,
    };
  }
  
  /**
   * Record a new fingerprint and check if we should abort.
   * 
   * @param fingerprint - The fingerprint from current iteration
   * @returns Abort condition (shouldAbort: true if stuck/max iterations)
   */
  record(fingerprint: string): AbortCondition {
    // Track in history
    this.history.push(fingerprint);
    
    // Increment count
    const count = (this.fingerprints.get(fingerprint) ?? 0) + 1;
    this.fingerprints.set(fingerprint, count);
    
    // Check max iterations
    if (this.history.length > this.config.maxIterations) {
      return {
        shouldAbort: true,
        reason: 'max_iterations',
        details: `Exceeded ${this.config.maxIterations} iterations without resolution`,
      };
    }
    
    // Check repeat threshold (stuck)
    if (count >= this.config.repeatThreshold) {
      return {
        shouldAbort: true,
        reason: 'stuck',
        details: `Fingerprint ${fingerprint.slice(0, 8)}... repeated ${count} times`,
      };
    }
    
    // Check oscillation (A → B → A → B pattern)
    if (this.history.length >= 4) {
      const recent = this.history.slice(-4);
      if (recent[0] === recent[2] && recent[1] === recent[3] && recent[0] !== recent[1]) {
        return {
          shouldAbort: true,
          reason: 'oscillating',
          details: `Oscillating between fingerprints ${recent[0].slice(0, 8)}... and ${recent[1].slice(0, 8)}...`,
        };
      }
    }
    
    return { shouldAbort: false };
  }
  
  /**
   * Check if a specific fingerprint has been seen before.
   */
  hasSeen(fingerprint: string): boolean {
    return this.fingerprints.has(fingerprint);
  }
  
  /**
   * Get count for a specific fingerprint.
   */
  getCount(fingerprint: string): number {
    return this.fingerprints.get(fingerprint) ?? 0;
  }
  
  /**
   * Get the full history of fingerprints.
   */
  getHistory(): readonly string[] {
    return this.history;
  }
  
  /**
   * Get iteration count.
   */
  getIterationCount(): number {
    return this.history.length;
  }
  
  /**
   * Get unique fingerprint count.
   */
  getUniqueCount(): number {
    return this.fingerprints.size;
  }
  
  /**
   * Reset the tracker.
   */
  reset(): void {
    this.fingerprints.clear();
    this.history = [];
  }
  
  /**
   * Get a summary of the tracking state.
   */
  getSummary(): {
    iterations: number;
    uniqueFingerprints: number;
    mostCommon: { fingerprint: string; count: number } | null;
    isStuck: boolean;
  } {
    let mostCommon: { fingerprint: string; count: number } | null = null;
    
    for (const [fp, count] of this.fingerprints) {
      if (!mostCommon || count > mostCommon.count) {
        mostCommon = { fingerprint: fp, count };
      }
    }
    
    return {
      iterations: this.history.length,
      uniqueFingerprints: this.fingerprints.size,
      mostCommon,
      isStuck: mostCommon !== null && mostCommon.count >= this.config.repeatThreshold,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compare two fingerprints for equality.
 */
export function fingerprintsEqual(fp1: string, fp2: string): boolean {
  return fp1 === fp2;
}

/**
 * Check if a set of violations has changed from previous.
 */
export function hasViolationsChanged(
  current: ViolationLike[],
  previousFingerprint: string,
  options?: FingerprintOptions
): boolean {
  const currentFingerprint = stableFingerprint(current, options);
  return currentFingerprint !== previousFingerprint;
}

/**
 * Create a human-readable diff summary between two violation sets.
 */
export function violationsDiffSummary(
  before: ViolationLike[],
  after: ViolationLike[]
): { added: ViolationLike[]; removed: ViolationLike[]; unchanged: number } {
  const beforeKeys = new Set(before.map(v => `${v.ruleId}:${v.file}:${v.line ?? 0}`));
  const afterKeys = new Set(after.map(v => `${v.ruleId}:${v.file}:${v.line ?? 0}`));
  
  const added = after.filter(v => !beforeKeys.has(`${v.ruleId}:${v.file}:${v.line ?? 0}`));
  const removed = before.filter(v => !afterKeys.has(`${v.ruleId}:${v.file}:${v.line ?? 0}`));
  const unchanged = after.length - added.length;
  
  return { added, removed, unchanged };
}
