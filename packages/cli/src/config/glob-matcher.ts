/**
 * ShipGate Glob Matcher
 *
 * Matches file paths against ignore and requireIsl patterns from config.
 * Uses picomatch for reliable, cross-platform glob matching.
 */

import picomatch from 'picomatch';
import type { ShipGateConfig } from './schema.js';
import { DEFAULT_CI_CONFIG } from './schema.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ShouldVerifyResult {
  /** Whether the file should be verified */
  verify: boolean;
  /** Whether the file is required to have an ISL spec */
  requireIsl: boolean;
  /** Human-readable reason explaining the decision */
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a file path for consistent matching:
 * - Convert backslashes to forward slashes (Windows)
 * - Remove leading "./"
 */
function normalizePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Matcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine whether a file should be verified and/or requires an ISL spec.
 *
 * @param filePath - Relative file path (from project root)
 * @param config - Loaded ShipGate configuration
 */
export function shouldVerify(filePath: string, config: ShipGateConfig): ShouldVerifyResult {
  const normalizedPath = normalizePath(filePath);
  const ci = config.ci ?? {};

  const ignorePatterns = ci.ignore ?? DEFAULT_CI_CONFIG.ignore;
  const requireIslPatterns = ci.requireIsl ?? DEFAULT_CI_CONFIG.requireIsl;

  // Check ignore patterns first
  if (ignorePatterns.length > 0) {
    const isIgnored = picomatch.isMatch(normalizedPath, ignorePatterns, {
      dot: true,
      // Enable bash-style brace expansion
      bash: true,
    });

    if (isIgnored) {
      return {
        verify: false,
        requireIsl: false,
        reason: `Ignored by pattern in ci.ignore`,
      };
    }
  }

  // Check requireIsl patterns
  let matchedRequireIsl = false;
  if (requireIslPatterns.length > 0) {
    matchedRequireIsl = picomatch.isMatch(normalizedPath, requireIslPatterns, {
      dot: true,
      bash: true,
    });
  }

  return {
    verify: true,
    requireIsl: matchedRequireIsl,
    reason: matchedRequireIsl
      ? `Matched ci.requireIsl pattern — ISL spec required`
      : undefined,
  };
}

/**
 * Filter a list of file paths, returning only those that should be verified.
 *
 * @param filePaths - Array of relative file paths
 * @param config - Loaded ShipGate configuration
 */
export function filterVerifiableFiles(
  filePaths: string[],
  config: ShipGateConfig,
): { path: string; requireIsl: boolean }[] {
  const results: { path: string; requireIsl: boolean }[] = [];

  for (const fp of filePaths) {
    const result = shouldVerify(fp, config);
    if (result.verify) {
      results.push({ path: fp, requireIsl: result.requireIsl });
    }
  }

  return results;
}

/**
 * Find files that are required to have ISL specs but are missing them.
 *
 * @param codeFiles - Array of code file paths (relative)
 * @param specMap - Map of code file paths to their matching spec paths
 * @param config - Loaded ShipGate configuration
 */
export function findMissingRequiredSpecs(
  codeFiles: string[],
  specMap: Map<string, string>,
  config: ShipGateConfig,
): string[] {
  const missing: string[] = [];

  for (const fp of codeFiles) {
    const result = shouldVerify(fp, config);
    if (result.verify && result.requireIsl && !specMap.has(fp)) {
      missing.push(fp);
    }
  }

  return missing;
}
