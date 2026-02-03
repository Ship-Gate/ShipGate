/**
 * Honesty Guard - Detects and refuses cheating attempts
 *
 * The Honesty Guard is the final line of defense against attempts to
 * circumvent ISL intent enforcement. It inspects patch sets and rejects
 * any edits that would weaken the contract.
 *
 * Forbidden operations:
 * - Removing intents from ISL spec files
 * - Adding islstudio-ignore or similar suppression directives
 * - Lowering severity levels or disabling policy packs
 * - Weakening redirect allowlists or auth hardening
 *
 * @module @isl-lang/healer/honesty-guard
 */

import type {
  PatchSet,
  PatchFile,
  ForbiddenEdit,
  PatchInspectionResult,
  HonestyGuardConfig,
  HonestyGuardResult,
  HonestyVerdict,
  WeakeningPattern,
} from './types';

import {
  inspectPatchSet,
  parseDiff,
  quickScan,
  isISLSpecFile,
  isConfigFile,
} from './patch-inspector';

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default Honesty Guard configuration
 */
export const DEFAULT_HONESTY_CONFIG: HonestyGuardConfig = {
  islSpecPatterns: ['**/*.isl', '**/specs/**', '**/intent/**', '**/contracts/**'],
  configPatterns: ['**/.islrc*', '**/islstudio.config.*', '**/gate.config.*'],
  strictMode: true, // In strict mode, ANY edit to ISL specs is forbidden
  customPatterns: [],
  allowedSuppressions: [],
};

// ============================================================================
// HonestyGuard Class
// ============================================================================

/**
 * Honesty Guard - Main class for detecting and refusing cheating attempts
 *
 * @example
 * ```typescript
 * const guard = new HonestyGuard();
 *
 * // Check a patch set
 * const result = guard.check(patchSet);
 * if (result.shouldAbort) {
 *   console.error(result.summary);
 *   process.exit(result.exitCode);
 * }
 *
 * // Or use the static method
 * const diff = await execSync('git diff HEAD~1');
 * const result = HonestyGuard.checkDiff(diff.toString());
 * ```
 */
export class HonestyGuard {
  private config: HonestyGuardConfig;

  constructor(config: Partial<HonestyGuardConfig> = {}) {
    this.config = { ...DEFAULT_HONESTY_CONFIG, ...config };
  }

  /**
   * Check a patch set for forbidden edits
   */
  check(patchSet: PatchSet): HonestyGuardResult {
    // First, check if any ISL spec files are being modified in strict mode
    const strictModeViolations = this.checkStrictMode(patchSet);

    // Inspect for all forbidden patterns
    const inspection = inspectPatchSet(
      patchSet,
      this.config.customPatterns || []
    );

    // Merge strict mode violations with pattern-based violations
    const allEdits = [...strictModeViolations, ...inspection.edits];

    // Remove duplicates based on file+line+type
    const uniqueEdits = this.dedupeEdits(allEdits);

    // Check for allowed suppressions
    const filteredEdits = this.filterAllowedSuppressions(uniqueEdits);

    // Build result
    const verdict: HonestyVerdict =
      filteredEdits.length > 0 ? 'UNSAFE_PATCH_ATTEMPT' : 'CLEAN';

    const summary = this.buildSummary(filteredEdits, patchSet);

    return {
      verdict,
      inspection: {
        ...inspection,
        edits: filteredEdits,
        forbidden: filteredEdits.length > 0,
      },
      summary,
      shouldAbort: filteredEdits.length > 0,
      exitCode: filteredEdits.length > 0 ? 1 : 0,
    };
  }

  /**
   * Check for strict mode violations (any ISL spec modification)
   */
  private checkStrictMode(patchSet: PatchSet): ForbiddenEdit[] {
    if (!this.config.strictMode) {
      return [];
    }

    const violations: ForbiddenEdit[] = [];

    for (const file of patchSet.files) {
      if (this.isProtectedISLSpec(file.path)) {
        // In strict mode, ANY edit to ISL spec is forbidden
        if (file.hunks.length > 0 || file.type === 'delete') {
          violations.push({
            type: 'isl_spec_modification',
            file: file.path,
            content: `File modified: ${file.type}`,
            description:
              'ISL specification files are immutable. No edits are allowed in strict mode.',
            severity: 'critical',
            remediation:
              'Revert changes to ISL spec files. Specs should only be modified through controlled processes.',
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check if a file is a protected ISL spec
   */
  private isProtectedISLSpec(path: string): boolean {
    // Check against configured patterns
    for (const pattern of this.config.islSpecPatterns) {
      if (this.matchGlob(path, pattern)) {
        return true;
      }
    }
    // Also use built-in detection
    return isISLSpecFile(path);
  }

  /**
   * Simple glob matching (supports ** and *)
   */
  private matchGlob(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/\./g, '\\.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path) || regex.test('/' + path);
  }

  /**
   * Deduplicate edits by file+line+type
   */
  private dedupeEdits(edits: ForbiddenEdit[]): ForbiddenEdit[] {
    const seen = new Set<string>();
    const unique: ForbiddenEdit[] = [];

    for (const edit of edits) {
      const key = `${edit.file}:${edit.line || 0}:${edit.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(edit);
      }
    }

    return unique;
  }

  /**
   * Filter out allowed suppressions with valid justifications
   */
  private filterAllowedSuppressions(
    edits: ForbiddenEdit[]
  ): ForbiddenEdit[] {
    if (!this.config.allowedSuppressions?.length) {
      return edits;
    }

    const now = new Date();

    return edits.filter((edit) => {
      // Only filter suppressions
      if (edit.type !== 'suppression_insertion') {
        return true;
      }

      // Check if this suppression is allowed
      for (const allowed of this.config.allowedSuppressions!) {
        // Check if pattern matches
        if (edit.content.includes(allowed.pattern)) {
          // Check expiration
          if (allowed.expires) {
            const expiresDate = new Date(allowed.expires);
            if (expiresDate < now) {
              // Allowed suppression has expired
              return true;
            }
          }
          // This suppression is allowed
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Build human-readable summary
   */
  private buildSummary(edits: ForbiddenEdit[], patchSet: PatchSet): string {
    if (edits.length === 0) {
      return `✓ Patch set is clean (${patchSet.files.length} files inspected)`;
    }

    const lines: string[] = [
      '╔════════════════════════════════════════════════════════════════╗',
      '║           🛡️  HONESTY GUARD: UNSAFE PATCH DETECTED            ║',
      '╠════════════════════════════════════════════════════════════════╣',
    ];

    // Group by type
    const byType = new Map<string, ForbiddenEdit[]>();
    for (const edit of edits) {
      const existing = byType.get(edit.type) || [];
      existing.push(edit);
      byType.set(edit.type, existing);
    }

    for (const [type, typeEdits] of byType) {
      lines.push(`║ ${this.formatEditType(type)} (${typeEdits.length})`);
      for (const edit of typeEdits.slice(0, 3)) {
        lines.push(`║   • ${edit.file}${edit.line ? `:${edit.line}` : ''}`);
        lines.push(`║     ${edit.description}`);
      }
      if (typeEdits.length > 3) {
        lines.push(`║   ... and ${typeEdits.length - 3} more`);
      }
    }

    lines.push('╠════════════════════════════════════════════════════════════════╣');
    lines.push('║ These changes violate the ISL Honesty Contract.                ║');
    lines.push('║ Fix the underlying issues instead of bypassing enforcement.    ║');
    lines.push('╚════════════════════════════════════════════════════════════════╝');

    return lines.join('\n');
  }

  /**
   * Format edit type for display
   */
  private formatEditType(type: string): string {
    const labels: Record<string, string> = {
      isl_spec_modification: '🔒 ISL SPEC MODIFICATION',
      suppression_insertion: '🚫 SUPPRESSION DIRECTIVE',
      pack_disable: '⚠️  POLICY PACK DISABLED',
      severity_downgrade: '⬇️  SEVERITY DOWNGRADE',
      allowlist_weaken: '🌐 ALLOWLIST WEAKENED',
      auth_bypass: '🔓 AUTH BYPASS',
      gate_config_weaken: '⚙️  GATE CONFIG WEAKENED',
    };
    return labels[type] || type;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Static Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check a raw unified diff for forbidden edits
   */
  static checkDiff(
    diff: string,
    config?: Partial<HonestyGuardConfig>
  ): HonestyGuardResult {
    const guard = new HonestyGuard(config);
    const patchSet = parseDiff(diff, 'git');
    return guard.check(patchSet);
  }

  /**
   * Check file changes directly (without parsing a diff)
   */
  static checkFiles(
    files: PatchFile[],
    config?: Partial<HonestyGuardConfig>
  ): HonestyGuardResult {
    const guard = new HonestyGuard(config);
    const patchSet: PatchSet = {
      source: 'manual',
      files,
    };
    return guard.check(patchSet);
  }

  /**
   * Quick validation - returns true if content appears clean
   */
  static quickValidate(content: string): boolean {
    return !quickScan(content);
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check a patch set and abort if unsafe
 *
 * @param patchSet - The patch set to check
 * @param config - Optional configuration
 * @throws Error with detailed message if unsafe patch detected
 */
export function assertCleanPatch(
  patchSet: PatchSet,
  config?: Partial<HonestyGuardConfig>
): void {
  const guard = new HonestyGuard(config);
  const result = guard.check(patchSet);

  if (result.shouldAbort) {
    const error = new Error(result.summary);
    error.name = 'UnsafePatchAttempt';
    throw error;
  }
}

/**
 * Check a diff string and abort if unsafe
 *
 * @param diff - Raw unified diff string
 * @param config - Optional configuration
 * @throws Error with detailed message if unsafe patch detected
 */
export function assertCleanDiff(
  diff: string,
  config?: Partial<HonestyGuardConfig>
): void {
  const patchSet = parseDiff(diff, 'git');
  assertCleanPatch(patchSet, config);
}

/**
 * Create a pre-commit hook validator
 *
 * @param config - Optional configuration
 * @returns Function that validates staged changes
 */
export function createPreCommitValidator(
  config?: Partial<HonestyGuardConfig>
): (diff: string) => HonestyGuardResult {
  const guard = new HonestyGuard(config);

  return (diff: string) => {
    const patchSet = parseDiff(diff, 'git');
    return guard.check(patchSet);
  };
}

/**
 * Create a healer patch validator
 *
 * Used by the healer to ensure its own patches don't introduce weakening
 *
 * @param config - Optional configuration
 * @returns Function that validates healer patches
 */
export function createHealerPatchValidator(
  config?: Partial<HonestyGuardConfig>
): (patches: PatchFile[]) => HonestyGuardResult {
  // Healers should NEVER modify ISL specs, so always use strict mode
  const guard = new HonestyGuard({
    ...config,
    strictMode: true,
    allowedSuppressions: [], // No suppressions allowed for healer
  });

  return (patches: PatchFile[]) => {
    const patchSet: PatchSet = {
      source: 'healer',
      files: patches,
    };
    return guard.check(patchSet);
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  DEFAULT_HONESTY_CONFIG,
  inspectPatchSet,
  parseDiff,
  quickScan,
  isISLSpecFile,
  isConfigFile,
};
