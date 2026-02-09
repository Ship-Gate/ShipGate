/**
 * Unknown Result Formatter
 * 
 * Formats unknown results with categorization and remediation for CLI output.
 * 
 * @module @isl-lang/verify-pipeline
 */

import type {
  VerificationResult,
  UnknownReason,
} from './types.js';
import type {
  UnknownClassification,
  summarizeUnknowns,
} from './unknown-classifier.js';

// ============================================================================
// Text Formatting
// ============================================================================

/**
 * Format unknown reasons summary for CLI output
 */
export function formatUnknownSummary(
  result: VerificationResult,
  options: {
    colors?: boolean;
    detailed?: boolean;
  } = {}
): string {
  const lines: string[] = [];
  const useColors = options.colors !== false;
  
  if (result.unknownReasons.length === 0) {
    return '';
  }
  
  // Group by category
  const byCategory = new Map<string, UnknownReason[]>();
  for (const reason of result.unknownReasons) {
    const category = reason.category;
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(reason);
  }
  
  lines.push('');
  lines.push(useColors ? '\x1b[33m? Unknown Clauses\x1b[0m' : '? Unknown Clauses');
  lines.push('─'.repeat(80));
  lines.push(`Total: ${result.unknownReasons.length} unknown clause(s)`);
  lines.push('');
  
  // Summary by category
  lines.push('By Category:');
  for (const [category, reasons] of byCategory.entries()) {
    const categoryName = formatCategoryName(category);
    lines.push(`  ${categoryName}: ${reasons.length}`);
  }
  lines.push('');
  
  // Mitigatable count
  const mitigatable = result.unknownReasons.filter(r => r.mitigatable).length;
  if (mitigatable > 0) {
    lines.push(useColors
      ? `\x1b[36m${mitigatable} unknown(s) can potentially be resolved with mitigation strategies\x1b[0m`
      : `${mitigatable} unknown(s) can potentially be resolved with mitigation strategies`
    );
    lines.push('');
  }
  
  // Detailed breakdown if requested
  if (options.detailed) {
    for (const [category, reasons] of byCategory.entries()) {
      lines.push(formatCategorySection(category, reasons, useColors));
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Format a category section with remediation
 */
function formatCategorySection(
  category: string,
  reasons: UnknownReason[],
  useColors: boolean
): string {
  const lines: string[] = [];
  const categoryName = formatCategoryName(category);
  
  lines.push(useColors ? `\x1b[1m${categoryName}\x1b[0m` : categoryName);
  lines.push('─'.repeat(80));
  
  for (const reason of reasons.slice(0, 10)) { // Limit to 10 per category
    const clause = reason.clauseId;
    lines.push(`  Clause: ${clause}`);
    lines.push(`  Reason: ${reason.message}`);
    
    if (reason.remediation && reason.remediation.length > 0) {
      lines.push('  To Fix:');
      for (const step of reason.remediation.slice(0, 3)) { // Limit to 3 steps
        lines.push(`    • ${step}`);
      }
      if (reason.remediation.length > 3) {
        lines.push(`    ... and ${reason.remediation.length - 3} more`);
      }
    }
    
    if (reason.suggestedMitigations && reason.suggestedMitigations.length > 0) {
      const mitigations = reason.suggestedMitigations.join(', ');
      lines.push(`  Suggested Mitigations: ${mitigations}`);
    }
    
    lines.push('');
  }
  
  if (reasons.length > 10) {
    lines.push(`  ... and ${reasons.length - 10} more ${categoryName.toLowerCase()} unknowns`);
  }
  
  return lines.join('\n');
}

/**
 * Format category name for display
 */
function formatCategoryName(category: string): string {
  const names: Record<string, string> = {
    missing_bindings: 'Missing Bindings',
    unsupported_smt_fragment: 'Unsupported SMT Fragment',
    runtime_data_unavailable: 'Runtime Data Unavailable',
    evaluation_error: 'Evaluation Error',
    timeout: 'Timeout',
    smt_unknown: 'SMT Unknown',
    missing_trace: 'Missing Trace',
    missing_data: 'Missing Data',
    unsupported_expr: 'Unsupported Expression',
  };
  
  return names[category] || category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format a single unknown reason for detailed output
 */
export function formatUnknownReason(
  reason: UnknownReason,
  options: { colors?: boolean } = {}
): string {
  const lines: string[] = [];
  const useColors = options.colors !== false;
  
  lines.push(`Clause: ${reason.clauseId}`);
  lines.push(`Category: ${formatCategoryName(reason.category)}`);
  lines.push(`Message: ${reason.message}`);
  
  if (reason.remediation && reason.remediation.length > 0) {
    lines.push('');
    lines.push('Remediation Steps:');
    for (const step of reason.remediation) {
      lines.push(`  • ${step}`);
    }
  }
  
  if (reason.suggestedMitigations && reason.suggestedMitigations.length > 0) {
    lines.push('');
    lines.push('Suggested Mitigations:');
    for (const mitigation of reason.suggestedMitigations) {
      lines.push(`  • ${mitigation.replace(/_/g, ' ')}`);
    }
  }
  
  if (reason.mitigatable !== undefined) {
    lines.push('');
    lines.push(`Mitigatable: ${reason.mitigatable ? 'Yes' : 'No'}`);
  }
  
  if (reason.details && Object.keys(reason.details).length > 0) {
    lines.push('');
    lines.push('Details:');
    for (const [key, value] of Object.entries(reason.details)) {
      lines.push(`  ${key}: ${String(value)}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format unknown reasons as a compact list
 */
export function formatUnknownList(
  result: VerificationResult,
  options: { colors?: boolean; maxItems?: number } = {}
): string {
  const lines: string[] = [];
  const useColors = options.colors !== false;
  const maxItems = options.maxItems ?? 5;
  
  if (result.unknownReasons.length === 0) {
    return '';
  }
  
  lines.push('');
  lines.push(useColors ? '\x1b[33mUnknown Clauses:\x1b[0m' : 'Unknown Clauses:');
  
  for (const reason of result.unknownReasons.slice(0, maxItems)) {
    const category = formatCategoryName(reason.category);
    const icon = reason.mitigatable ? '🔧' : '❓';
    lines.push(`  ${icon} ${reason.clauseId} [${category}]`);
    if (reason.remediation && reason.remediation.length > 0) {
      lines.push(`     → ${reason.remediation[0]}`);
    }
  }
  
  if (result.unknownReasons.length > maxItems) {
    lines.push(`  ... and ${result.unknownReasons.length - maxItems} more`);
  }
  
  return lines.join('\n');
}
