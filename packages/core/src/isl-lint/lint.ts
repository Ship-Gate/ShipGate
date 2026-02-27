/**
 * ISL Semantic Linter - Main Entry Point
 * 
 * Provides the lint() function for analyzing ISL ASTs.
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
} from './lintTypes.js';

import { ALL_RULES, RULES_BY_ID, RULES_BY_NAME } from './lintRules.js';

// ============================================================================
// Severity Ordering
// ============================================================================

const SEVERITY_ORDER: Record<LintSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
  hint: 3,
};

// ============================================================================
// Main Lint Function
// ============================================================================

/**
 * Lint an ISL domain AST for potential issues
 * 
 * @param domain - The parsed ISL domain to lint
 * @param options - Optional configuration for lint rules
 * @returns Lint result with diagnostics
 * 
 * @example
 * ```typescript
 * import { parse } from '@isl-lang/parser';
 * import { lint } from '@isl-lang/core/isl-lint';
 * 
 * const { domain } = parse(source);
 * const result = lint(domain);
 * 
 * if (!result.success) {
 *   console.log(`Found ${result.counts.error} errors`);
 *   for (const diag of result.diagnostics) {
 *     console.log(`${diag.ruleId}: ${diag.message}`);
 *   }
 * }
 * ```
 */
export function lint(domain: Domain, options: LintOptions = {}): LintResult {
  const startTime = Date.now();
  const diagnostics: LintDiagnostic[] = [];
  const skippedRules: string[] = [];
  
  // Get min severity threshold
  const minSeverity = options.minSeverity ?? 'hint';
  const minSeverityLevel = SEVERITY_ORDER[minSeverity];
  
  // Process each rule
  for (const rule of ALL_RULES) {
    // Check if rule is enabled
    const ruleConfig = getRuleConfig(rule.id, options);
    
    if (!ruleConfig.enabled) {
      skippedRules.push(rule.id);
      continue;
    }
    
    // Check category filters
    if (options.includeCategories && 
        !options.includeCategories.includes(rule.category)) {
      skippedRules.push(rule.id);
      continue;
    }
    
    if (options.excludeCategories && 
        options.excludeCategories.includes(rule.category)) {
      skippedRules.push(rule.id);
      continue;
    }
    
    // Get effective severity
    const severity = ruleConfig.severity ?? rule.severity;
    const severityLevel = SEVERITY_ORDER[severity];
    
    // Skip if below min severity
    if (severityLevel > minSeverityLevel) {
      skippedRules.push(rule.id);
      continue;
    }
    
    // Create context for rule
    const context: LintContext = {
      domain,
      config: ruleConfig,
      report: (params: DiagnosticParams) => createDiagnostic(rule, severity, params),
      getLocation: (node: ASTNode) => node.location,
    };
    
    // Run rule
    try {
      const ruleDiagnostics = rule.check(context);
      
      // Apply severity override
      for (const diag of ruleDiagnostics) {
        diag.severity = severity;
        diagnostics.push(diag);
      }
      
      // Fail fast if requested and we have errors
      if (options.failFast && 
          ruleDiagnostics.some(d => d.severity === 'error')) {
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
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });
  
  // Count by severity
  const counts = {
    error: 0,
    warning: 0,
    info: 0,
    hint: 0,
  };
  
  for (const diag of diagnostics) {
    counts[diag.severity]++;
  }
  
  const durationMs = Date.now() - startTime;
  
  return {
    success: counts.error === 0,
    diagnostics,
    counts,
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
  rule: { id: string; name: string; category: LintCategory },
  severity: LintSeverity,
  params: DiagnosticParams
): LintDiagnostic {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity,
    category: rule.category,
    message: params.message,
    location: params.node.location,
    elementName: params.elementName,
    suggestion: params.suggestion,
    relatedLocations: params.relatedLocations,
    meta: params.meta,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a lint result as a string
 */
export function formatLintResult(result: LintResult): string {
  const lines: string[] = [];
  
  if (result.domainName) {
    lines.push(`Linting domain: ${result.domainName}`);
    lines.push('');
  }
  
  if (result.diagnostics.length === 0) {
    lines.push('No issues found');
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
    lines.push(file);
    
    for (const diag of diagnostics) {
      const loc = `${diag.location.line}:${diag.location.column}`;
      const icon = getSeverityIcon(diag.severity);
      lines.push(`  ${loc} ${icon} ${diag.message} [${diag.ruleId}]`);
      
      if (diag.suggestion) {
        const suggestionLines = diag.suggestion.split('\n');
        for (const line of suggestionLines) {
          lines.push(`       ${line}`);
        }
      }
    }
    
    lines.push('');
  }
  
  // Summary
  const parts: string[] = [];
  if (result.counts.error > 0) parts.push(`${result.counts.error} error(s)`);
  if (result.counts.warning > 0) parts.push(`${result.counts.warning} warning(s)`);
  if (result.counts.info > 0) parts.push(`${result.counts.info} info`);
  if (result.counts.hint > 0) parts.push(`${result.counts.hint} hint(s)`);
  
  lines.push(`Summary: ${parts.join(', ')}`);
  
  if (result.durationMs !== undefined) {
    lines.push(`Completed in ${result.durationMs}ms`);
  }
  
  return lines.join('\n');
}

function getSeverityIcon(severity: LintSeverity): string {
  switch (severity) {
    case 'error': return '✗';
    case 'warning': return '⚠';
    case 'info': return 'ℹ';
    case 'hint': return '💡';
  }
}

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

// ============================================================================
// Re-exports
// ============================================================================

export { ALL_RULES, RULES_BY_ID, RULES_BY_NAME } from './lintRules.js';
export * from './lintTypes.js';
