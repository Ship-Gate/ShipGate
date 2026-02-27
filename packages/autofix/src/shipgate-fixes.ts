/**
 * Shipgate Fixes
 * 
 * Converts Shipgate findings into safe, minimal diffs (auto-fixes) with audit trails.
 * 
 * @example
 * ```typescript
 * import { suggestFixes } from '@isl-lang/autofix/shipgate-fixes';
 * 
 * const patches = await suggestFixes(claims, {
 *   projectRoot: './',
 *   truthpack: { routes: [...], env: [...] }
 * });
 * ```
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { Finding } from '@isl-lang/gate';
import type { Patch } from './patcher.js';
import { generateUnifiedDiff } from './diff-generator.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Context for fix suggestions
 */
export interface FixContext {
  /** Project root directory */
  projectRoot: string;
  /** Truthpack data */
  truthpack?: {
    routes?: Array<{
      path: string;
      method: string;
      file?: string;
      line?: number;
    }>;
    env?: Array<{
      name: string;
      file?: string;
      line?: number;
      required?: boolean;
      sensitive?: boolean;
    }>;
  };
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Only apply fixes for specific rules */
  onlyRules?: string[];
}

/**
 * A fix suggestion with patch information (shipgate/evidence-based fixes)
 */
export interface ShipgateFixSuggestion {
  /** Rule identifier */
  rule: string;
  /** Human-readable description */
  why: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Patch to apply */
  patch: Patch;
  /** Unified diff representation */
  diff: string;
}

/**
 * Result of suggesting fixes
 */
export interface SuggestFixesResult {
  /** All suggested fixes */
  suggestions: ShipgateFixSuggestion[];
  /** Counts by rule */
  counts: Record<string, number>;
  /** Total count */
  total: number;
}

// ============================================================================
// Fixer Registry
// ============================================================================

/**
 * A fixer function that generates patches for a finding
 */
export type Fixer = (
  finding: Finding,
  context: FixContext
) => Promise<ShipgateFixSuggestion[]>;

/**
 * Fixer registry entry
 */
interface FixerEntry {
  rule: string;
  description: string;
  fixer: Fixer;
  minConfidence: number;
}

/**
 * Global fixer registry
 */
const fixerRegistry = new Map<string, FixerEntry>();

/**
 * Register a fixer
 */
export function registerFixer(
  rule: string,
  description: string,
  fixer: Fixer,
  minConfidence: number = 0.6
): void {
  fixerRegistry.set(rule, {
    rule,
    description,
    fixer,
    minConfidence,
  });
}

/**
 * Get a fixer by rule name
 */
export function getFixer(rule: string): FixerEntry | undefined {
  return fixerRegistry.get(rule);
}

/**
 * List all registered fixers
 */
export function listFixers(): FixerEntry[] {
  return Array.from(fixerRegistry.values());
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Suggest fixes for Shipgate claims/findings
 * 
 * @param claims - Array of findings/claims from Shipgate
 * @param context - Context for fix generation
 * @returns Suggested fixes with patches
 */
export async function suggestFixes(
  claims: Finding[],
  context: FixContext
): Promise<SuggestFixesResult> {
  const {
    minConfidence = 0.6,
    onlyRules = [],
  } = context;

  const suggestions: ShipgateFixSuggestion[] = [];
  const counts: Record<string, number> = {};

  // Filter claims by rule if specified
  const filteredClaims = onlyRules.length > 0
    ? claims.filter(c => c.rule && onlyRules.includes(c.rule))
    : claims;

  // Group claims by rule
  const byRule = new Map<string, Finding[]>();
  for (const claim of filteredClaims) {
    const rule = claim.rule || 'unknown';
    const existing = byRule.get(rule) || [];
    existing.push(claim);
    byRule.set(rule, existing);
  }

  // Process each rule
  for (const [rule, ruleClaims] of byRule) {
    const fixerEntry = fixerRegistry.get(rule);
    if (!fixerEntry) {
      continue;
    }

    // Check confidence threshold
    const effectiveMinConfidence = Math.max(
      minConfidence,
      fixerEntry.minConfidence
    );

    for (const claim of ruleClaims) {
      try {
        const ruleSuggestions = await fixerEntry.fixer(claim, context);
        
        // Filter by confidence
        const filtered = ruleSuggestions.filter(
          s => s.confidence >= effectiveMinConfidence
        );

        suggestions.push(...filtered);
        counts[rule] = (counts[rule] || 0) + filtered.length;
      } catch (error) {
        // Log error but continue with other fixers
        console.error(`Error in fixer ${rule}:`, error);
      }
    }
  }

  return {
    suggestions,
    counts,
    total: suggestions.length,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Read file content safely
 */
export async function readFileSafe(
  filePath: string,
  projectRoot: string
): Promise<string | null> {
  const fullPath = resolve(projectRoot, filePath);
  if (!existsSync(fullPath)) {
    return null;
  }
  try {
    return await readFile(fullPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Write file content safely
 */
export async function writeFileSafe(
  filePath: string,
  content: string,
  projectRoot: string
): Promise<boolean> {
  const fullPath = resolve(projectRoot, filePath);
  try {
    await writeFile(fullPath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate unified diff for a patch
 */
export function generatePatchDiff(
  patch: Patch,
  originalContent: string,
  patchedContent: string
): string {
  return generateUnifiedDiff(
    patch.file,
    originalContent,
    patchedContent
  );
}
