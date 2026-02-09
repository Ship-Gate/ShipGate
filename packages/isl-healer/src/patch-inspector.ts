/**
 * Patch Inspector - Detects forbidden edits in patch sets
 *
 * This module inspects code changes (patches) for cheating attempts:
 * - Removing intents from ISL specs
 * - Adding suppression directives (islstudio-ignore, @ts-ignore, etc.)
 * - Disabling policy packs in configuration
 * - Weakening security (allowlists, auth bypasses)
 * - Lowering severity levels
 *
 * @module @isl-lang/healer/patch-inspector
 */

import type {
  PatchSet,
  PatchFile,
  DiffHunk,
  ForbiddenEdit,
  ForbiddenEditType,
  PatchInspectionResult,
  WeakeningPattern,
} from './types';

// ============================================================================
// Forbidden Patterns
// ============================================================================

/**
 * Patterns that indicate suppression insertions
 */
const SUPPRESSION_PATTERNS: WeakeningPattern[] = [
  {
    pattern: /islstudio-ignore/i,
    description: 'ISL Studio suppression directive',
    category: 'suppression',
  },
  {
    pattern: /isl-ignore/i,
    description: 'ISL ignore directive',
    category: 'suppression',
  },
  {
    pattern: /@ts-ignore/,
    description: 'TypeScript ignore directive',
    category: 'suppression',
  },
  {
    pattern: /@ts-expect-error/,
    description: 'TypeScript expect-error directive',
    category: 'suppression',
  },
  {
    pattern: /@ts-nocheck/,
    description: 'TypeScript nocheck directive',
    category: 'suppression',
  },
  {
    pattern: /eslint-disable(?!-line\s+@typescript-eslint\/)/,
    description: 'ESLint disable directive',
    category: 'suppression',
  },
  {
    pattern: /\/\/ *noqa/i,
    description: 'noqa suppression comment',
    category: 'suppression',
  },
  {
    pattern: /NOSONAR/,
    description: 'SonarQube suppression',
    category: 'suppression',
  },
];

/**
 * Patterns that indicate severity downgrade attempts
 */
const SEVERITY_DOWNGRADE_PATTERNS: WeakeningPattern[] = [
  {
    pattern: /severity:\s*['"]?(warning|info|off)['"]?/i,
    description: 'Severity downgrade to warning/info/off',
    category: 'severity',
  },
  {
    pattern: /level:\s*['"]?(warn|info|none)['"]?/i,
    description: 'Level downgrade to warn/info/none',
    category: 'severity',
  },
  {
    pattern: /"error"\s*:\s*"(warn|off|0)"/,
    description: 'Error rule changed to warn/off',
    category: 'severity',
  },
];

/**
 * Patterns that indicate policy pack disabling
 */
const PACK_DISABLE_PATTERNS: WeakeningPattern[] = [
  {
    pattern: /enabled:\s*false/i,
    description: 'Policy pack disabled',
    category: 'pack_disable',
  },
  {
    pattern: /disable:\s*true/i,
    description: 'Policy pack disabled via disable flag',
    category: 'pack_disable',
  },
  {
    pattern: /skip[A-Z].*:\s*true/i,
    description: 'Skip flag enabled',
    category: 'pack_disable',
  },
  {
    pattern: /packs:\s*\[\s*\]/,
    description: 'Empty packs array (all packs disabled)',
    category: 'pack_disable',
  },
];

/**
 * Patterns that indicate allowlist weakening
 */
const ALLOWLIST_WEAKEN_PATTERNS: WeakeningPattern[] = [
  {
    pattern: /redirect.*:\s*['"]?\*['"]?/i,
    description: 'Wildcard redirect allowlist',
    category: 'allowlist',
  },
  {
    pattern: /allowedOrigins:\s*\[\s*['"]?\*['"]?\s*\]/i,
    description: 'Wildcard CORS origin',
    category: 'allowlist',
  },
  {
    pattern: /permitAll|allowAll/i,
    description: 'Permit/allow all pattern',
    category: 'allowlist',
  },
  {
    pattern: /cors:\s*true(?!\s*,)/i,
    description: 'Unrestricted CORS enabled',
    category: 'allowlist',
  },
  {
    pattern: /whitelist:\s*\[\s*['"]?\*['"]?\s*\]/i,
    description: 'Wildcard whitelist',
    category: 'allowlist',
  },
];

/**
 * Patterns that indicate auth bypass attempts
 */
const AUTH_BYPASS_PATTERNS: WeakeningPattern[] = [
  {
    pattern: /skipAuth/i,
    description: 'Auth skip flag',
    category: 'auth_bypass',
  },
  {
    pattern: /noAuth/i,
    description: 'No auth flag',
    category: 'auth_bypass',
  },
  {
    pattern: /bypassAuth/i,
    description: 'Auth bypass flag',
    category: 'auth_bypass',
  },
  {
    pattern: /authRequired:\s*false/i,
    description: 'Auth required set to false',
    category: 'auth_bypass',
  },
  {
    pattern: /requireAuth:\s*false/i,
    description: 'Require auth set to false',
    category: 'auth_bypass',
  },
  {
    pattern: /public:\s*true/i,
    description: 'Route marked as public',
    category: 'auth_bypass',
  },
  {
    pattern: /isAuthenticated.*=.*true/i,
    description: 'Hardcoded authentication bypass',
    category: 'auth_bypass',
  },
];

/**
 * Patterns that indicate intent removal from ISL specs
 */
const INTENT_REMOVAL_PATTERNS: WeakeningPattern[] = [
  {
    pattern: /^-\s*intent\s+/m,
    description: 'Intent declaration removed',
    category: 'intent_removal',
  },
  {
    pattern: /^-\s*@\w+-required/m,
    description: 'Required constraint removed',
    category: 'intent_removal',
  },
  {
    pattern: /^-\s*precondition\s+/m,
    description: 'Precondition removed',
    category: 'intent_removal',
  },
  {
    pattern: /^-\s*postcondition\s+/m,
    description: 'Postcondition removed',
    category: 'intent_removal',
  },
  {
    pattern: /^-\s*invariant\s+/m,
    description: 'Invariant removed',
    category: 'intent_removal',
  },
];

// ============================================================================
// File Pattern Matching
// ============================================================================

/**
 * Check if a file path matches an ISL spec pattern
 */
function isISLSpecFile(path: string): boolean {
  const patterns = [
    /\.isl$/i,
    /specs?\//i,
    /intent\//i,
    /contracts?\//i,
  ];
  return patterns.some((p) => p.test(path));
}

/**
 * Check if a file path is a configuration file
 */
function isConfigFile(path: string): boolean {
  const patterns = [
    /\.islrc/i,
    /islstudio\.config/i,
    /\.eslintrc/i,
    /eslint\.config/i,
    /tsconfig/i,
    /package\.json$/i,
    /\.shipgate/i,
    /firewall\.json$/i,
  ];
  return patterns.some((p) => p.test(path));
}

/**
 * Check if a file is a gate or policy configuration
 */
function isGateConfigFile(path: string): boolean {
  const patterns = [
    /gate\.config/i,
    /policy[-.]?packs/i,
    /rules\.json$/i,
    /\.islrc/i,
    /islstudio\.config/i,
  ];
  return patterns.some((p) => p.test(path));
}

// ============================================================================
// Inspection Functions
// ============================================================================

/**
 * Check a line for suppression patterns
 */
function checkForSuppressions(
  line: string,
  file: string,
  lineNum: number,
  customPatterns: WeakeningPattern[] = []
): ForbiddenEdit | null {
  const allPatterns = [...SUPPRESSION_PATTERNS, ...customPatterns];

  for (const pattern of allPatterns) {
    if (pattern.category === 'suppression' && pattern.pattern.test(line)) {
      return {
        type: 'suppression_insertion',
        file,
        line: lineNum,
        content: line.trim(),
        description: `Suppression directive detected: ${pattern.description}`,
        severity: 'critical',
        remediation:
          'Remove the suppression and fix the underlying issue instead',
      };
    }
  }
  return null;
}

/**
 * Check a line for severity downgrade patterns
 */
function checkForSeverityDowngrade(
  line: string,
  file: string,
  lineNum: number
): ForbiddenEdit | null {
  for (const pattern of SEVERITY_DOWNGRADE_PATTERNS) {
    if (pattern.pattern.test(line)) {
      return {
        type: 'severity_downgrade',
        file,
        line: lineNum,
        content: line.trim(),
        description: `Severity downgrade detected: ${pattern.description}`,
        severity: 'critical',
        remediation:
          'Keep severity at error/critical level; fix the code instead of lowering severity',
      };
    }
  }
  return null;
}

/**
 * Check a line for pack disable patterns
 */
function checkForPackDisable(
  line: string,
  file: string,
  lineNum: number
): ForbiddenEdit | null {
  // Only check config files
  if (!isConfigFile(file) && !isGateConfigFile(file)) {
    return null;
  }

  for (const pattern of PACK_DISABLE_PATTERNS) {
    if (pattern.pattern.test(line)) {
      return {
        type: 'pack_disable',
        file,
        line: lineNum,
        content: line.trim(),
        description: `Policy pack disable detected: ${pattern.description}`,
        severity: 'critical',
        remediation:
          'Keep all policy packs enabled; address violations directly',
      };
    }
  }
  return null;
}

/**
 * Check a line for allowlist weakening patterns
 */
function checkForAllowlistWeaken(
  line: string,
  file: string,
  lineNum: number
): ForbiddenEdit | null {
  for (const pattern of ALLOWLIST_WEAKEN_PATTERNS) {
    if (pattern.pattern.test(line)) {
      return {
        type: 'allowlist_weaken',
        file,
        line: lineNum,
        content: line.trim(),
        description: `Allowlist weakening detected: ${pattern.description}`,
        severity: 'high',
        remediation:
          'Use specific allowlist entries instead of wildcards or permitAll',
      };
    }
  }
  return null;
}

/**
 * Check a line for auth bypass patterns
 */
function checkForAuthBypass(
  line: string,
  file: string,
  lineNum: number
): ForbiddenEdit | null {
  for (const pattern of AUTH_BYPASS_PATTERNS) {
    if (pattern.pattern.test(line)) {
      return {
        type: 'auth_bypass',
        file,
        line: lineNum,
        content: line.trim(),
        description: `Auth bypass detected: ${pattern.description}`,
        severity: 'critical',
        remediation:
          'Implement proper authentication; do not bypass auth checks',
      };
    }
  }
  return null;
}

/**
 * Check ISL spec file for intent removal
 */
function checkForIntentRemoval(
  hunk: DiffHunk,
  file: string
): ForbiddenEdit[] {
  const edits: ForbiddenEdit[] = [];

  for (const removal of hunk.removals) {
    for (const pattern of INTENT_REMOVAL_PATTERNS) {
      // Adjust pattern to not require the leading dash (we already know it's a removal)
      const adjustedPattern = new RegExp(
        pattern.pattern.source.replace(/^\^-\\s\*/, '^\\s*'),
        pattern.pattern.flags
      );
      if (adjustedPattern.test(removal)) {
        edits.push({
          type: 'isl_spec_modification',
          file,
          line: hunk.oldStart,
          content: removal.trim(),
          description: `ISL intent modification: ${pattern.description}`,
          severity: 'critical',
          remediation:
            'ISL specifications are immutable; do not remove intents, preconditions, or postconditions',
        });
      }
    }
  }

  return edits;
}

/**
 * Inspect a single hunk for forbidden edits
 */
function inspectHunk(
  hunk: DiffHunk,
  file: string,
  customPatterns: WeakeningPattern[] = []
): ForbiddenEdit[] {
  const edits: ForbiddenEdit[] = [];
  let lineNum = hunk.newStart;

  // Check additions (new lines being added)
  for (const addition of hunk.additions) {
    const line = addition.replace(/^\+\s?/, '');

    const suppression = checkForSuppressions(line, file, lineNum, customPatterns);
    if (suppression) edits.push(suppression);

    const severity = checkForSeverityDowngrade(line, file, lineNum);
    if (severity) edits.push(severity);

    const packDisable = checkForPackDisable(line, file, lineNum);
    if (packDisable) edits.push(packDisable);

    const allowlist = checkForAllowlistWeaken(line, file, lineNum);
    if (allowlist) edits.push(allowlist);

    const authBypass = checkForAuthBypass(line, file, lineNum);
    if (authBypass) edits.push(authBypass);

    lineNum++;
  }

  // Check removals in ISL spec files
  if (isISLSpecFile(file)) {
    const intentRemovals = checkForIntentRemoval(hunk, file);
    edits.push(...intentRemovals);
  }

  return edits;
}

/**
 * Inspect a single file for forbidden edits
 */
function inspectFile(
  patchFile: PatchFile,
  customPatterns: WeakeningPattern[] = []
): ForbiddenEdit[] {
  const edits: ForbiddenEdit[] = [];

  // Check if editing an ISL spec file at all (in strict mode, any edit is forbidden)
  if (isISLSpecFile(patchFile.path)) {
    // In strict mode, any modification to ISL spec is forbidden
    // This is handled separately - here we just check for specific intent removals
    for (const hunk of patchFile.hunks) {
      edits.push(...inspectHunk(hunk, patchFile.path, customPatterns));
    }
  } else {
    // Regular code file - check for suppression insertions and other forbidden patterns
    for (const hunk of patchFile.hunks) {
      edits.push(...inspectHunk(hunk, patchFile.path, customPatterns));
    }
  }

  // If new content is available, do a full scan for patterns
  if (patchFile.newContent) {
    const lines = patchFile.newContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Only check if this line was added or modified
      const wasModified = patchFile.hunks.some(
        (h) =>
          lineNum >= h.newStart && lineNum < h.newStart + h.newLines
      );

      if (wasModified) {
        // Already checked in hunk inspection
        continue;
      }
    }
  }

  return edits;
}

// ============================================================================
// Main Inspection Function
// ============================================================================

/**
 * Inspect a patch set for forbidden edits
 *
 * @param patchSet - The set of patches to inspect
 * @param customPatterns - Additional patterns to check for
 * @returns Inspection result with any forbidden edits found
 */
export function inspectPatchSet(
  patchSet: PatchSet,
  customPatterns: WeakeningPattern[] = []
): PatchInspectionResult {
  const startTime = Date.now();
  const edits: ForbiddenEdit[] = [];
  const filesInspected: string[] = [];

  // Initialize counts
  const counts: Record<ForbiddenEditType, number> = {
    isl_spec_modification: 0,
    suppression_insertion: 0,
    pack_disable: 0,
    severity_downgrade: 0,
    allowlist_weaken: 0,
    auth_bypass: 0,
    gate_config_weaken: 0,
  };

  for (const file of patchSet.files) {
    filesInspected.push(file.path);
    const fileEdits = inspectFile(file, customPatterns);

    for (const edit of fileEdits) {
      edits.push(edit);
      counts[edit.type]++;
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    forbidden: edits.length > 0,
    edits,
    counts,
    filesInspected,
    durationMs,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Parse a unified diff into a PatchSet
 *
 * @param diff - Raw unified diff string
 * @param source - Source of the diff (git, healer, etc.)
 * @returns Parsed PatchSet
 */
export function parseDiff(
  diff: string,
  source: PatchSet['source'] = 'unknown'
): PatchSet {
  const files: PatchFile[] = [];
  const fileRegex = /^diff --git a\/(.+) b\/(.+)$/gm;
  const hunkRegex = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/gm;

  let match: RegExpExecArray | null;
  const fileSections = diff.split(/^diff --git/gm).slice(1);

  for (const section of fileSections) {
    const lines = ('diff --git' + section).split('\n');
    const headerMatch = lines[0].match(/^diff --git a\/(.+) b\/(.+)$/);

    if (!headerMatch) continue;

    const oldPath = headerMatch[1];
    const newPath = headerMatch[2];
    const hunks: DiffHunk[] = [];

    let isNewFile = false;
    let isDeletedFile = false;
    let currentHunk: DiffHunk | null = null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('new file mode')) {
        isNewFile = true;
      } else if (line.startsWith('deleted file mode')) {
        isDeletedFile = true;
      } else if (line.startsWith('@@')) {
        // Save previous hunk
        if (currentHunk) {
          hunks.push(currentHunk);
        }

        const hunkMatch = line.match(
          /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/
        );
        if (hunkMatch) {
          currentHunk = {
            oldPath,
            newPath,
            oldStart: parseInt(hunkMatch[1], 10),
            oldLines: parseInt(hunkMatch[2] || '1', 10),
            newStart: parseInt(hunkMatch[3], 10),
            newLines: parseInt(hunkMatch[4] || '1', 10),
            removals: [],
            additions: [],
            context: [],
          };
        }
      } else if (currentHunk) {
        if (line.startsWith('-') && !line.startsWith('---')) {
          currentHunk.removals.push(line);
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
          currentHunk.additions.push(line);
        } else if (line.startsWith(' ')) {
          currentHunk.context.push(line);
        }
      }
    }

    // Save last hunk
    if (currentHunk) {
      hunks.push(currentHunk);
    }

    files.push({
      path: newPath,
      type: isNewFile ? 'add' : isDeletedFile ? 'delete' : 'modify',
      oldPath: oldPath !== newPath ? oldPath : undefined,
      hunks,
    });
  }

  return {
    source,
    files,
    rawDiff: diff,
  };
}

/**
 * Quick check if content contains any forbidden patterns
 * Useful for pre-validation before detailed inspection
 */
export function quickScan(content: string): boolean {
  const allPatterns = [
    ...SUPPRESSION_PATTERNS,
    ...SEVERITY_DOWNGRADE_PATTERNS,
    ...PACK_DISABLE_PATTERNS,
    ...ALLOWLIST_WEAKEN_PATTERNS,
    ...AUTH_BYPASS_PATTERNS,
  ];

  return allPatterns.some((p) => p.pattern.test(content));
}

// ============================================================================
// Exports
// ============================================================================

export {
  SUPPRESSION_PATTERNS,
  SEVERITY_DOWNGRADE_PATTERNS,
  PACK_DISABLE_PATTERNS,
  ALLOWLIST_WEAKEN_PATTERNS,
  AUTH_BYPASS_PATTERNS,
  INTENT_REMOVAL_PATTERNS,
  isISLSpecFile,
  isConfigFile,
  isGateConfigFile,
};
