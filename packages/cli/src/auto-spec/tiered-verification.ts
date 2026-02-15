/**
 * Tiered Verification System
 *
 * Tier 1 (Strict): Route handlers, services, business logic — must match ISL behaviors exactly
 * Tier 2 (Standard): Entity models, schemas — must match ISL entity definitions
 * Tier 3 (Relaxed): Utilities, config, middleware — export-only verification, no behavioral checks
 *
 * @module @isl-lang/cli/auto-spec
 */

import { readFile } from 'fs/promises';
import { isUtilityFile } from './auto-spec-generator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type VerificationTier = 1 | 2 | 3;

export interface TierConfig {
  /** Tier 1 weight (strict) */
  tier1Weight: number;
  /** Tier 2 weight (standard) */
  tier2Weight: number;
  /** Tier 3 weight (relaxed) */
  tier3Weight: number;
}

export const DEFAULT_TIER_CONFIG: TierConfig = {
  tier1Weight: 3,
  tier2Weight: 2,
  tier3Weight: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// Tier Classification
// ─────────────────────────────────────────────────────────────────────────────

/** Patterns for Tier 1 (strict): route handlers, services, business logic */
const TIER1_PATTERNS: RegExp[] = [
  /\/routes?\//i,
  /\/handlers?\//i,
  /\/services?\//i,
  /\/api\//i,
  /route\.ts$/i,
  /handler\.ts$/i,
  /service\.ts$/i,
];

/** Patterns for Tier 2 (standard): entity models, schemas */
const TIER2_PATTERNS: RegExp[] = [
  /\/models?\//i,
  /\/entities?\//i,
  /\/schemas?\//i,
  /\/schema\.ts$/i,
  /model\.ts$/i,
  /entity\.ts$/i,
];

/**
 * Classify a file into verification tier based on path and optionally spec content.
 */
export function classifyTier(
  filePath: string,
  specContent?: string
): VerificationTier {
  const normalized = filePath.replace(/\\/g, '/');

  // Check for @tier 3 marker in spec (auto-generated utility)
  if (specContent && /#\s*@tier\s+3/i.test(specContent)) {
    return 3;
  }

  // Utility files → Tier 3
  if (isUtilityFile(normalized)) {
    return 3;
  }

  // Tier 1 patterns (strict)
  if (TIER1_PATTERNS.some((p) => p.test(normalized))) {
    return 1;
  }

  // Tier 2 patterns (standard)
  if (TIER2_PATTERNS.some((p) => p.test(normalized))) {
    return 2;
  }

  // Default: Tier 2 (standard) for unknown files
  return 2;
}

/**
 * Check if a tier uses relaxed (export-only) verification.
 */
export function isRelaxedTier(tier: VerificationTier): boolean {
  return tier === 3;
}
