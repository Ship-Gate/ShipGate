/**
 * Fingerprint-based caching utilities
 * Provides deterministic serialization and fingerprint generation
 */

import { createHash } from 'node:crypto';
import type { Fingerprint } from './cacheTypes.js';

/**
 * Deterministically stringify an object with stable key ordering
 * Ensures the same object always produces the same string
 */
export function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, stableReplacer, 2);
}

/**
 * Custom replacer for stable JSON serialization
 * Sorts object keys alphabetically for deterministic output
 */
function stableReplacer(_key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value;
  }

  // Sort object keys alphabetically
  const sortedObj: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>).sort();

  for (const k of keys) {
    sortedObj[k] = (value as Record<string, unknown>)[k];
  }

  return sortedObj;
}

/**
 * Generate a fingerprint for any content
 * Uses SHA-256 hash of the stable-serialized content
 */
export function generateFingerprint(content: unknown): Fingerprint {
  const serialized = stableStringify(content);
  return createHash('sha256').update(serialized).digest('hex');
}

/**
 * Generate a fingerprint for a string directly
 */
export function generateFingerprintFromString(content: string): Fingerprint {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Validate that a string is a valid fingerprint format
 * Valid fingerprints are 64-character hex strings (SHA-256)
 */
export function isValidFingerprint(value: string): value is Fingerprint {
  return /^[a-f0-9]{64}$/.test(value);
}

/**
 * Create a composite fingerprint from multiple fingerprints
 * Useful for caching results that depend on multiple inputs
 */
export function combineFingerprints(...fingerprints: Fingerprint[]): Fingerprint {
  const combined = fingerprints.sort().join(':');
  return createHash('sha256').update(combined).digest('hex');
}

/**
 * Generate a fingerprint for an ISL spec
 * Takes the spec content and optional metadata into account
 */
export function generateSpecFingerprint(
  specContent: string,
  metadata?: {
    version?: string;
    name?: string;
    [key: string]: unknown;
  }
): Fingerprint {
  const payload = {
    content: specContent,
    metadata: metadata ?? {},
  };
  return generateFingerprint(payload);
}

/**
 * Cache key builder for common use cases
 */
export const CacheKeys = {
  /**
   * Create a cache key for parsed AST
   */
  parsedAst(specFingerprint: Fingerprint): string {
    return `ast:${specFingerprint}`;
  },

  /**
   * Create a cache key for generated tests
   */
  generatedTests(specFingerprint: Fingerprint, generator: string): string {
    return `tests:${generator}:${specFingerprint}`;
  },

  /**
   * Create a cache key for type checking results
   */
  typeCheckResult(specFingerprint: Fingerprint): string {
    return `typecheck:${specFingerprint}`;
  },

  /**
   * Create a cache key for verification results
   */
  verificationResult(specFingerprint: Fingerprint, configHash: string): string {
    return `verify:${configHash}:${specFingerprint}`;
  },
} as const;
