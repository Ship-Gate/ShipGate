/**
 * ISL Linter V2 - Main Entry Point
 *
 * Provides the lint() function for analyzing ISL ASTs with auto-fix support.
 */

import type { Domain, ASTNode, SourceLocation } from '@isl-lang/parser';

import type {
  LintResult,
  LintDiagnostic,
  LintOptions,
  LintContext,
  LintRuleConfig,
  DiagnosticParams,
  LintSeverity,
  LintCategory,
  LintFix,
  PatchFactory,
} from './types.js';

import { SEVERITY_LEVEL } from './types.js';
import { ALL_RULES, RULES_BY_ID, RULES_BY_NAME } from './rules.js';
import { patchFactory, createFixFactory } from './fixes.js';

// ============================================================================
// Main Lint Function
// ============================================================================

/**
 * Lint an ISL domain AST for potential issues
 *
 * @param domain - The parsed ISL domain to lint
 * @param options - Optional configuration for lint rules
 * @returns Lint result with diagnostics and auto-fix suggestions
 *
 * @example
 * ```typescript
 * import { parse } from '@isl-lang/parser';
 * import { lint, applyFix } from '@isl-lang/core/isl-lint-v2';
 *
 * const { domain } = parse(source);
 * const result = lint(domain, { includeFixes: true });
 *
 * for (const diag of result.diagnostics) {
 *   console.log(`[${diag.severity}] ${diag.ruleId}: ${diag.message}`);
 *
 *   if (diag.fixes && diag.fixes.length > 0) {
 *     console.log(`  Fix available: ${diag.fixes[0].title}`);
 *   }
 * }
 * ```
 */
export function lint(domain: Domain, options: LintOptions = {}): LintResult {
  const startTime = Date.now();
  const diagnostics: LintDiagnostic[] = [];
  const skippedRules: string[] = [];
  const includeFixes = options.includeFixes ?? true;

  // Get min severity threshold
  const minSeverity = options.minSeverity ?? 'hint';
  const minSeverityLevel = SEVERITY_LEVEL[minSeverity];

  // Create fix factory
  const fixFactory = createFixFactory();

  // Process each rule
  for (const rule of ALL_RULES) {
    // Check if rule is enabled
    const ruleConfig = getRuleConfig(rule.id, options);

    if (!ruleConfig.enabled) {
      skippedRules.push(rule.id);
      continue;
    }

    // Check category filters
    if (options.includeCategories && !options.includeCategories.includes(rule.category)) {
      skippedRules.push(rule.id);
      continue;
    }

    if (options.excludeCategories && options.excludeCategories.includes(rule.category)) {
      skippedRules.push(rule.id);
      continue;
    }

    // Check tag filters
    if (options.includeTags && options.includeTags.length > 0) {
      const ruleTags = rule.tags ?? [];
      if (!options.includeTags.some((tag) => ruleTags.includes(tag))) {
        skippedRules.push(rule.id);
        continue;
      }
    }

    if (options.excludeTags && options.excludeTags.length > 0) {
      const ruleTags = rule.tags ?? [];
      if (options.excludeTags.some((tag) => ruleTags.includes(tag))) {
        skippedRules.push(rule.id);
        continue;
      }
    }

    // Get effective severity
    const severity = ruleConfig.severity ?? rule.severity;
    const severityLevel = SEVERITY_LEVEL[severity];

    // Skip if below min severity
    if (severityLevel > minSeverityLevel) {
      skippedRules.push(rule.id);
      continue;
    }

    // Create context for rule
    const context: LintContext = {
      domain,
      config: ruleConfig,
      report: (params: DiagnosticParams) => createDiagnostic(rule, severity, params, includeFixes),
      getLocation: (node: ASTNode) => node.location,
      createPatch: patchFactory,
      createFix: fixFactory,
    };

    // Run rule
    try {
      const ruleDiagnostics = rule.check(context);

      // Apply severity override
      for (const diag of ruleDiagnostics) {
        diag.severity = severity;

        // Strip fixes if not requested
        if (!includeFixes) {
          delete diag.fixes;
        }

        diagnostics.push(diag);
      }

      // Fail fast if requested and we have errors
      if (options.failFast && ruleDiagnostics.some((d) => d.severity === 'error')) {
        break;
      }
    } catch (error) {
      // Rule threw an error - report as internal issue
      diagnostics.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: 'error',
        category: 'correctness',
        message: `Internal lint error in rule ${rule.id}: ${error instanceof Error ? error.message : String(error)}`,
        location: domain.location,
      });
    }
  }

  // Sort diagnostics by location then severity
  diagnostics.sort((a, b) => {
    // First by file
    const fileCompare = a.location.file.localeCompare(b.location.file);
    if (fileCompare !== 0) return fileCompare;

    // Then by line
    if (a.location.line !== b.location.line) {
      return a.location.line - b.location.line;
    }

    // Then by column
    if (a.location.column !== b.location.column) {
      return a.location.column - b.location.column;
    }

    // Then by severity (errors first)
    return SEVERITY_LEVEL[a.severity] - SEVERITY_LEVEL[b.severity];
  });

  // Count by severity
  const counts = {
    error: 0,
    warning: 0,
    info: 0,
    hint: 0,
  };

  let fixableCount = 0;
  for (const diag of diagnostics) {
    counts[diag.severity]++;
    if (diag.fixes && diag.fixes.length > 0) {
      fixableCount++;
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    success: counts.error === 0,
    diagnostics,
    counts,
    fixableCount,
    domainName: domain.name.name,
    durationMs,
    skippedRules: skippedRules.length > 0 ? skippedRules : undefined,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get configuration for a rule
 */
function getRuleConfig(ruleId: string, options: LintOptions): LintRuleConfig {
  const rules = options.rules ?? {};

  // Check by ID
  if (ruleId in rules) {
    const config = rules[ruleId];
    if (typeof config === 'boolean') {
      return { enabled: config };
    }
    return config;
  }

  // Check by name
  const rule = RULES_BY_ID.get(ruleId);
  if (rule && rule.name in rules) {
    const config = rules[rule.name];
    if (typeof config === 'boolean') {
      return { enabled: config };
    }
    return config;
  }

  // Default: enabled
  return { enabled: true };
}

/**
 * Create a diagnostic from rule and params
 */
function createDiagnostic(
  rule: { id: string; name: string; category: LintCategory; tags?: string[] },
  severity: LintSeverity,
  params: DiagnosticParams,
  includeFixes: boolean
): LintDiagnostic {
  const diag: LintDiagnostic = {
    ruleId: rule.id,
    ruleName: rule.name,
    severity,
    category: rule.category,
    message: params.message,
    location: params.node.location,
    elementName: params.elementName,
    relatedLocations: params.relatedLocations,
    meta: params.meta,
    tags: params.tags ?? rule.tags,
  };

  if (includeFixes && params.fixes) {
    diag.fixes = params.fixes;
  }

  return diag;
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format a lint result as a string
 */
export function formatLintResult(result: LintResult, options: { color?: boolean; verbose?: boolean } = {}): string {
  const lines: string[] = [];
  const { color = false, verbose = false } = options;

  if (result.domainName) {
    lines.push(`Linting domain: ${result.domainName}`);
    lines.push('');
  }

  if (result.diagnostics.length === 0) {
    lines.push(color ? '\x1b[32mNo issues found\x1b[0m' : 'No issues found');
    return lines.join('\n');
  }

  // Group by file
  const byFile = new Map<string, LintDiagnostic[]>();
  for (const diag of result.diagnostics) {
    const file = diag.location.file;
    if (!byFile.has(file)) {
      byFile.set(file, []);
    }
    byFile.get(file)!.push(diag);
  }

  for (const [file, diagnostics] of byFile) {
    lines.push(color ? `\x1b[4m${file}\x1b[0m` : file);

    for (const diag of diagnostics) {
      const loc = `${diag.location.line}:${diag.location.column}`;
      const icon = getSeverityIcon(diag.severity, color);
      const ruleInfo = verbose ? ` [${diag.ruleId}]` : '';
      lines.push(`  ${loc} ${icon} ${diag.message}${ruleInfo}`);

      // Show fixes if verbose
      if (verbose && diag.fixes && diag.fixes.length > 0) {
        lines.push(`       💡 ${diag.fixes.length} fix(es) available:`);
        for (const fix of diag.fixes) {
          const safeIndicator = fix.isAutomaticallySafe ? ' (auto-safe)' : '';
          lines.push(`          - ${fix.title}${safeIndicator}`);
        }
      }
    }

    lines.push('');
  }

  // Summary
  const parts: string[] = [];
  if (result.counts.error > 0) {
    parts.push(color ? `\x1b[31m${result.counts.error} error(s)\x1b[0m` : `${result.counts.error} error(s)`);
  }
  if (result.counts.warning > 0) {
    parts.push(color ? `\x1b[33m${result.counts.warning} warning(s)\x1b[0m` : `${result.counts.warning} warning(s)`);
  }
  if (result.counts.info > 0) {
    parts.push(`${result.counts.info} info`);
  }
  if (result.counts.hint > 0) {
    parts.push(`${result.counts.hint} hint(s)`);
  }

  lines.push(`Summary: ${parts.join(', ')}`);

  if (result.fixableCount > 0) {
    lines.push(
      color
        ? `\x1b[36m${result.fixableCount} issue(s) have auto-fix suggestions\x1b[0m`
        : `${result.fixableCount} issue(s) have auto-fix suggestions`
    );
  }

  if (result.durationMs !== undefined) {
    lines.push(`Completed in ${result.durationMs}ms`);
  }

  return lines.join('\n');
}

function getSeverityIcon(severity: LintSeverity, color: boolean): string {
  if (color) {
    switch (severity) {
      case 'error':
        return '\x1b[31m✗\x1b[0m';
      case 'warning':
        return '\x1b[33m⚠\x1b[0m';
      case 'info':
        return '\x1b[34mℹ\x1b[0m';
      case 'hint':
        return '\x1b[36m💡\x1b[0m';
    }
  }
  switch (severity) {
    case 'error':
      return '✗';
    case 'warning':
      return '⚠';
    case 'info':
      return 'ℹ';
    case 'hint':
      return '💡';
  }
}

/**
 * Convert lint result to JSON for tooling integration
 */
export function lintResultToJSON(result: LintResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Convert lint result to SARIF format for VS Code integration
 */
export function lintResultToSARIF(result: LintResult): object {
  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'isl-lint-v2',
            version: '1.0.0',
            informationUri: 'https://github.com/intent-os/isl',
            rules: ALL_RULES.map((rule) => ({
              id: rule.id,
              name: rule.name,
              shortDescription: { text: rule.description },
              defaultConfiguration: {
                level: severityToSARIFLevel(rule.severity),
              },
            })),
          },
        },
        results: result.diagnostics.map((diag) => ({
          ruleId: diag.ruleId,
          level: severityToSARIFLevel(diag.severity),
          message: { text: diag.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: diag.location.file,
                },
                region: {
                  startLine: diag.location.line,
                  startColumn: diag.location.column,
                  endLine: diag.location.endLine,
                  endColumn: diag.location.endColumn,
                },
              },
            },
          ],
          fixes: diag.fixes?.map((fix) => ({
            description: { text: fix.title },
            artifactChanges: fix.patches.map((patch) => ({
              artifactLocation: { uri: diag.location.file },
              replacements: [
                {
                  deletedRegion: {
                    startLine: diag.location.line,
                    startColumn: diag.location.column,
                  },
                  insertedContent: { text: patch.description },
                },
              ],
            })),
          })),
        })),
      },
    ],
  };
}

function severityToSARIFLevel(severity: LintSeverity): string {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'note';
    case 'hint':
      return 'note';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all available lint rules
 */
export function getRules() {
  return [...ALL_RULES];
}

/**
 * Get a rule by ID or name
 */
export function getRule(idOrName: string) {
  return RULES_BY_ID.get(idOrName) ?? RULES_BY_NAME.get(idOrName);
}

/**
 * Get diagnostics filtered by severity
 */
export function getDiagnosticsBySeverity(result: LintResult, severity: LintSeverity): LintDiagnostic[] {
  return result.diagnostics.filter((d) => d.severity === severity);
}

/**
 * Get diagnostics filtered by category
 */
export function getDiagnosticsByCategory(result: LintResult, category: LintCategory): LintDiagnostic[] {
  return result.diagnostics.filter((d) => d.category === category);
}

/**
 * Get all fixable diagnostics
 */
export function getFixableDiagnostics(result: LintResult): LintDiagnostic[] {
  return result.diagnostics.filter((d) => d.fixes && d.fixes.length > 0);
}

/**
 * Get all auto-fixable diagnostics (safe to apply automatically)
 */
export function getAutoFixableDiagnostics(result: LintResult): LintDiagnostic[] {
  return result.diagnostics.filter((d) => d.fixes?.some((f) => f.isAutomaticallySafe));
}
