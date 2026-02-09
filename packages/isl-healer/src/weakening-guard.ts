/**
 * Weakening Guard - Prevent patches that weaken intent enforcement
 *
 * The healer is NOT allowed to:
 * - Remove intents from the ISL spec
 * - Add suppressions automatically
 * - Downgrade severity
 * - Change gate rules/packs
 * - Broaden allowlists / weaken security
 * - "Make it pass" by hiding violations
 *
 * @module @isl-lang/healer
 */

import type {
  WeakeningPattern,
  WeakeningCheckResult,
  PatchOperation,
} from './types.js';

// ============================================================================
// Weakening Patterns
// ============================================================================

/**
 * Built-in weakening patterns that should NEVER be added by the healer
 */
export const WEAKENING_PATTERNS: WeakeningPattern[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Suppression patterns - NEVER add these
  // ─────────────────────────────────────────────────────────────────────────
  {
    pattern: /\/\/\s*@ts-ignore/i,
    description: 'TypeScript @ts-ignore suppression',
    category: 'suppression',
  },
  {
    pattern: /\/\/\s*@ts-expect-error/i,
    description: 'TypeScript @ts-expect-error suppression',
    category: 'suppression',
  },
  {
    pattern: /\/\/\s*@ts-nocheck/i,
    description: 'TypeScript @ts-nocheck suppression',
    category: 'suppression',
  },
  {
    pattern: /eslint-disable(?!-next-line.*@isl)/i,
    description: 'ESLint disable comment',
    category: 'suppression',
  },
  {
    pattern: /eslint-disable-line/i,
    description: 'ESLint disable-line comment',
    category: 'suppression',
  },
  {
    pattern: /\/\/\s*isl-ignore/i,
    description: 'ISL ignore comment',
    category: 'suppression',
  },
  {
    pattern: /\/\/\s*islstudio-ignore/i,
    description: 'ISL Studio ignore comment',
    category: 'suppression',
  },
  {
    pattern: /\/\/\s*shipgate-ignore/i,
    description: 'Shipgate ignore comment',
    category: 'suppression',
  },
  {
    pattern: /\/\/\s*nocheck/i,
    description: 'Generic nocheck comment',
    category: 'suppression',
  },
  {
    pattern: /@suppress\s*\(/i,
    description: 'JSDoc suppress annotation',
    category: 'suppression',
  },
  {
    pattern: /noinspection/i,
    description: 'JetBrains noinspection comment',
    category: 'suppression',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Severity downgrades - NEVER reduce severity
  // ─────────────────────────────────────────────────────────────────────────
  {
    pattern: /severity:\s*['"]low['"]/i,
    description: 'Severity downgrade to low',
    category: 'severity',
  },
  {
    pattern: /severity:\s*['"]info['"]/i,
    description: 'Severity downgrade to info',
    category: 'severity',
  },
  {
    pattern: /level:\s*['"]off['"]/i,
    description: 'Rule level set to off',
    category: 'severity',
  },
  {
    pattern: /enabled:\s*false/i,
    description: 'Rule disabled via config',
    category: 'severity',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Auth bypass patterns - NEVER add auth bypasses
  // ─────────────────────────────────────────────────────────────────────────
  {
    pattern: /skipAuth\s*[:=]/i,
    description: 'Auth skip flag detected',
    category: 'auth_bypass',
  },
  {
    pattern: /noAuth\s*[:=]/i,
    description: 'No auth flag detected',
    category: 'auth_bypass',
  },
  {
    pattern: /bypassAuth/i,
    description: 'Auth bypass detected',
    category: 'auth_bypass',
  },
  {
    pattern: /skipValidation\s*[:=]/i,
    description: 'Validation skip flag detected',
    category: 'auth_bypass',
  },
  {
    pattern: /disableAuth/i,
    description: 'Auth disable flag detected',
    category: 'auth_bypass',
  },
  {
    pattern: /authRequired:\s*false/i,
    description: 'Auth requirement disabled',
    category: 'auth_bypass',
  },
  {
    pattern: /public:\s*true/i,
    description: 'Public endpoint flag (potential auth bypass)',
    category: 'auth_bypass',
  },
  {
    pattern: /skipRateLimit/i,
    description: 'Rate limit skip detected',
    category: 'auth_bypass',
  },
  {
    pattern: /disableRateLimit/i,
    description: 'Rate limit disable detected',
    category: 'auth_bypass',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Allowlist expansion - NEVER broaden access
  // ─────────────────────────────────────────────────────────────────────────
  {
    pattern: /allowAll\s*[:=]/i,
    description: 'Allow all flag detected',
    category: 'allowlist',
  },
  {
    pattern: /permitAll/i,
    description: 'Permit all detected',
    category: 'allowlist',
  },
  {
    pattern: /'\*\.\*'/,
    description: 'Wildcard extension pattern',
    category: 'allowlist',
  },
  {
    pattern: /"\*\.\*"/,
    description: 'Wildcard extension pattern (double quote)',
    category: 'allowlist',
  },
  {
    pattern: /cors:\s*\*/i,
    description: 'CORS wildcard origin',
    category: 'allowlist',
  },
  {
    pattern: /origin:\s*['"]?\*/,
    description: 'Wildcard origin',
    category: 'allowlist',
  },
  {
    pattern: /Access-Control-Allow-Origin.*\*/i,
    description: 'CORS header wildcard',
    category: 'allowlist',
  },
  {
    pattern: /trustProxy:\s*true/i,
    description: 'Trusting all proxies',
    category: 'allowlist',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Intent removal - NEVER remove intent declarations
  // ─────────────────────────────────────────────────────────────────────────
  {
    pattern: /\/\/\s*@intent.*DELETE/i,
    description: 'Intent deletion marker',
    category: 'intent_removal',
  },
  {
    pattern: /REMOVE_INTENT/i,
    description: 'Intent removal marker',
    category: 'intent_removal',
  },
  {
    pattern: /__isl_intents\s*=\s*\[\s*\]/,
    description: 'Empty intent array',
    category: 'intent_removal',
  },
];

// ============================================================================
// WeakeningGuard Class
// ============================================================================

/**
 * Options for weakening detection
 */
export interface WeakeningGuardOptions {
  /** Additional patterns to check */
  additionalPatterns?: WeakeningPattern[];
  /** Patterns to exclude from checking */
  excludePatterns?: RegExp[];
  /** Allow specific patterns (whitelist) */
  allowPatterns?: RegExp[];
  /** Strict mode - fail on any suspicious content */
  strictMode?: boolean;
}

/**
 * WeakeningGuard - Validates patches don't weaken intent enforcement
 *
 * This is a critical safety component. All patches MUST pass this guard
 * before being applied.
 */
export class WeakeningGuard {
  private patterns: WeakeningPattern[];
  private excludePatterns: RegExp[];
  private allowPatterns: RegExp[];

  constructor(options: WeakeningGuardOptions = {}) {
    this.patterns = [
      ...WEAKENING_PATTERNS,
      ...(options.additionalPatterns || []),
    ];
    this.excludePatterns = options.excludePatterns || [];
    this.allowPatterns = options.allowPatterns || [];
    // strictMode option is reserved for future use
  }

  /**
   * Check a single patch for weakening patterns
   */
  checkPatch(patch: PatchOperation): WeakeningCheckResult {
    const matches: WeakeningCheckResult['matches'] = [];

    // Check the content being added
    const contentToCheck = [patch.content, patch.wrapPrefix, patch.wrapSuffix]
      .filter(Boolean)
      .join('\n');

    // Skip if content matches allow patterns
    if (this.allowPatterns.some((p) => p.test(contentToCheck))) {
      return { detected: false, matches: [] };
    }

    // Check against all weakening patterns
    for (const pattern of this.patterns) {
      // Skip excluded patterns
      if (this.excludePatterns.some((ex) => ex.test(pattern.pattern.source))) {
        continue;
      }

      if (pattern.pattern.test(contentToCheck)) {
        // Find the matching snippet
        const match = contentToCheck.match(pattern.pattern);
        matches.push({
          pattern,
          location: patch.file,
          snippet: match ? match[0] : contentToCheck.slice(0, 100),
        });
      }
    }

    return {
      detected: matches.length > 0,
      matches,
    };
  }

  /**
   * Check multiple patches
   */
  checkPatches(patches: PatchOperation[]): WeakeningCheckResult {
    const allMatches: WeakeningCheckResult['matches'] = [];

    for (const patch of patches) {
      const result = this.checkPatch(patch);
      if (result.detected) {
        allMatches.push(...result.matches);
      }
    }

    return {
      detected: allMatches.length > 0,
      matches: allMatches,
    };
  }

  /**
   * Check raw content string for weakening
   */
  checkContent(content: string, location: string = 'unknown'): WeakeningCheckResult {
    const matches: WeakeningCheckResult['matches'] = [];

    // Skip if content matches allow patterns
    if (this.allowPatterns.some((p) => p.test(content))) {
      return { detected: false, matches: [] };
    }

    for (const pattern of this.patterns) {
      if (this.excludePatterns.some((ex) => ex.test(pattern.pattern.source))) {
        continue;
      }

      if (pattern.pattern.test(content)) {
        const match = content.match(pattern.pattern);
        matches.push({
          pattern,
          location,
          snippet: match ? match[0] : content.slice(0, 100),
        });
      }
    }

    return {
      detected: matches.length > 0,
      matches,
    };
  }

  /**
   * Validate that a patch is safe to apply
   * Throws an error if weakening is detected
   */
  validatePatch(patch: PatchOperation): void {
    const result = this.checkPatch(patch);
    if (result.detected) {
      const descriptions = result.matches
        .map((m) => `- ${m.pattern.description} (${m.pattern.category})`)
        .join('\n');
      throw new WeakeningError(
        `Patch would weaken intent enforcement:\n${descriptions}`,
        result
      );
    }
  }

  /**
   * Check if code diff introduces weakening
   * (Compare before and after content)
   */
  checkDiff(before: string, after: string, file: string): WeakeningCheckResult {
    // Check what's new in after that wasn't in before
    const beforeLines = new Set(before.split('\n'));
    const afterLines = after.split('\n');
    
    // Find newly added lines
    const newLines = afterLines.filter((line) => !beforeLines.has(line));
    const newContent = newLines.join('\n');

    return this.checkContent(newContent, file);
  }

  /**
   * Get all registered patterns
   */
  getPatterns(): readonly WeakeningPattern[] {
    return this.patterns;
  }

  /**
   * Add a custom weakening pattern
   */
  addPattern(pattern: WeakeningPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Get patterns by category
   */
  getPatternsByCategory(
    category: WeakeningPattern['category']
  ): WeakeningPattern[] {
    return this.patterns.filter((p) => p.category === category);
  }
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when weakening is detected
 */
export class WeakeningError extends Error {
  public readonly result: WeakeningCheckResult;

  constructor(message: string, result: WeakeningCheckResult) {
    super(message);
    this.name = 'WeakeningError';
    this.result = result;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a weakening guard with default settings
 */
export function createWeakeningGuard(
  options?: WeakeningGuardOptions
): WeakeningGuard {
  return new WeakeningGuard(options);
}

/**
 * Quick check if content contains weakening patterns
 */
export function containsWeakening(content: string): boolean {
  const guard = new WeakeningGuard();
  return guard.checkContent(content).detected;
}

/**
 * Validate patch is safe (throws if not)
 */
export function validatePatchSafe(patch: PatchOperation): void {
  const guard = new WeakeningGuard();
  guard.validatePatch(patch);
}
