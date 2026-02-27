/**
 * ISL Policy Engine - Explainer
 *
 * Formats policy decisions into human-readable explanations
 * for terminal, JSON, and markdown output.
 *
 * @module @isl-lang/isl-policy-engine
 */

import type { PolicyEngineResult, PolicyDecisionEntry, EvidenceRef } from './types.js';

// ============================================================================
// Terminal Formatter
// ============================================================================

/**
 * Format a policy engine result for terminal output (ANSI-free).
 */
export function formatTerminal(result: PolicyEngineResult): string {
  const lines: string[] = [];

  if (result.allowed) {
    lines.push('');
    lines.push('  +-------------------------------------+');
    lines.push('  |        POLICY CHECK: PASSED          |');
    lines.push('  +-------------------------------------+');
  } else {
    lines.push('');
    lines.push('  +-------------------------------------+');
    lines.push('  |        POLICY CHECK: BLOCKED         |');
    lines.push('  +-------------------------------------+');
  }

  lines.push('');
  lines.push(`  ${result.summary}`);
  lines.push('');

  // Blockers
  if (result.blockers.length > 0) {
    lines.push('  BLOCKERS:');
    for (const b of result.blockers) {
      lines.push(`    [BLOCK] ${b.policyName} (${b.policyId})`);
      lines.push(`            ${b.explanation}`);
      if (b.evidenceRefs.length > 0) {
        lines.push(`            Evidence:`);
        for (const ref of b.evidenceRefs) {
          lines.push(`              - ${ref.label}: ${ref.detail}`);
        }
      }
      lines.push('');
    }
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('  WARNINGS:');
    for (const w of result.warnings) {
      lines.push(`    [WARN]  ${w.policyName} (${w.policyId})`);
      lines.push(`            ${w.explanation}`);
      lines.push('');
    }
  }

  // Stats
  lines.push(`  Policies evaluated: ${result.metadata.policiesEvaluated}`);
  lines.push(`  Policies triggered: ${result.metadata.policiesTriggered}`);
  lines.push(`  Duration: ${result.durationMs}ms`);
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Markdown Formatter
// ============================================================================

/**
 * Format a policy engine result as Markdown.
 */
export function formatMarkdown(result: PolicyEngineResult): string {
  const lines: string[] = [];

  const status = result.allowed ? 'PASSED' : 'BLOCKED';
  lines.push(`# Policy Check: ${status}`);
  lines.push('');
  lines.push(result.summary);
  lines.push('');

  if (result.blockers.length > 0) {
    lines.push('## Blockers');
    lines.push('');
    for (const b of result.blockers) {
      lines.push(`### ${b.policyName}`);
      lines.push('');
      lines.push(`- **Policy ID**: \`${b.policyId}\``);
      lines.push(`- **Severity**: ${b.severity}`);
      lines.push(`- **Tier**: ${b.tier}`);
      lines.push(`- **Explanation**: ${b.explanation}`);
      if (b.file) {
        lines.push(`- **File**: \`${b.file}\``);
      }
      if (b.evidenceRefs.length > 0) {
        lines.push('- **Evidence**:');
        for (const ref of b.evidenceRefs) {
          lines.push(`  - ${ref.label}: ${ref.detail}`);
        }
      }
      lines.push('');
    }
  }

  if (result.warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const w of result.warnings) {
      lines.push(`- **${w.policyName}** (\`${w.policyId}\`): ${w.explanation}`);
    }
    lines.push('');
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Policies evaluated | ${result.metadata.policiesEvaluated} |`);
  lines.push(`| Policies triggered | ${result.metadata.policiesTriggered} |`);
  lines.push(`| Blockers | ${result.metadata.blockerCount} |`);
  lines.push(`| Warnings | ${result.metadata.warningCount} |`);
  lines.push(`| Duration | ${result.durationMs}ms |`);
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// JSON Formatter
// ============================================================================

/**
 * Format a policy engine result as a JSON string (pretty-printed).
 */
export function formatJSON(result: PolicyEngineResult): string {
  return JSON.stringify(result, null, 2);
}

// ============================================================================
// Single Decision Explainer
// ============================================================================

/**
 * Format a single decision into a human-readable string.
 * Useful for inline diagnostics ("blocked because X").
 */
export function explainDecision(decision: PolicyDecisionEntry): string {
  const prefix = decision.action === 'block'
    ? 'blocked because'
    : decision.action === 'warn'
      ? 'warning:'
      : 'allowed by';

  const evidenceSummary = decision.evidenceRefs.length > 0
    ? ` [evidence: ${decision.evidenceRefs.map(r => r.label).join(', ')}]`
    : '';

  return `${prefix} ${decision.explanation}${evidenceSummary}`;
}

/**
 * Format a compact one-liner for CI output.
 */
export function formatCILine(result: PolicyEngineResult): string {
  if (result.allowed) {
    return `policy-engine: PASS (${result.metadata.policiesEvaluated} policies, ${result.metadata.warningCount} warnings)`;
  }
  const blockerNames = result.blockers.map(b => b.policyId).join(', ');
  return `policy-engine: FAIL (${result.metadata.blockerCount} blockers: ${blockerNames})`;
}
