// ============================================================================
// Verification Report Generator
// Generates human-readable reports from verification results
// ============================================================================

import { FormalVerifyResult, PropertyResult, Counterexample } from './translator';
import { formatCounterexample, minimizeCounterexample } from './counterexample';

// ============================================================================
// TYPES
// ============================================================================

export interface ReportOptions {
  format: 'text' | 'markdown' | 'json' | 'html';
  verbose?: boolean;
  includeSmtLib?: boolean;
}

// ============================================================================
// MAIN REPORT GENERATOR
// ============================================================================

/**
 * Generate a verification report
 */
export function generateReport(
  result: FormalVerifyResult,
  options: ReportOptions = { format: 'text' }
): string {
  switch (options.format) {
    case 'markdown':
      return generateMarkdownReport(result, options);
    case 'json':
      return generateJsonReport(result, options);
    case 'html':
      return generateHtmlReport(result, options);
    default:
      return generateTextReport(result, options);
  }
}

// ============================================================================
// TEXT REPORT
// ============================================================================

function generateTextReport(result: FormalVerifyResult, options: ReportOptions): string {
  const lines: string[] = [];
  
  // Header
  lines.push('═══════════════════════════════════════════════════════════════════════');
  lines.push('                      FORMAL VERIFICATION REPORT                        ');
  lines.push('═══════════════════════════════════════════════════════════════════════');
  lines.push('');
  
  // Summary
  const verdict = result.verified ? '✓ VERIFIED' : '✗ NOT VERIFIED';
  const validCount = result.properties.filter(p => p.result === 'valid').length;
  const totalCount = result.properties.length;
  
  lines.push(`Verdict: ${verdict}`);
  lines.push(`Properties: ${validCount}/${totalCount} valid`);
  lines.push(`Time: ${result.smtTime}ms`);
  lines.push('');
  
  // Properties by category
  const byCategory = groupByCategory(result.properties);
  
  for (const [category, props] of Object.entries(byCategory)) {
    lines.push(`─── ${formatCategoryName(category)} ───`);
    lines.push('');
    
    for (const prop of props) {
      const icon = getResultIcon(prop.result);
      lines.push(`  ${icon} ${prop.name}`);
      
      if (options.verbose) {
        lines.push(`      Formula: ${prop.formula}`);
        lines.push(`      Time: ${prop.time}ms`);
      }
      
      if (prop.counterexample && options.verbose) {
        lines.push('      Counterexample:');
        const ce = minimizeCounterexample(prop.counterexample);
        for (const line of ce.trace) {
          lines.push(`        ${line}`);
        }
      }
    }
    lines.push('');
  }
  
  // Counterexamples
  if (result.counterexamples.length > 0 && !options.verbose) {
    lines.push('─── Counterexamples ───');
    lines.push('');
    
    for (const ce of result.counterexamples) {
      lines.push(`  Property: ${ce.property}`);
      for (const line of ce.trace.slice(0, 5)) {
        lines.push(`    ${line}`);
      }
      lines.push('');
    }
  }
  
  // Footer
  lines.push('═══════════════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

// ============================================================================
// MARKDOWN REPORT
// ============================================================================

function generateMarkdownReport(result: FormalVerifyResult, options: ReportOptions): string {
  const lines: string[] = [];
  
  // Header
  lines.push('# Formal Verification Report');
  lines.push('');
  
  // Summary
  const verdict = result.verified ? '✅ **VERIFIED**' : '❌ **NOT VERIFIED**';
  const validCount = result.properties.filter(p => p.result === 'valid').length;
  const totalCount = result.properties.length;
  
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Verdict | ${verdict} |`);
  lines.push(`| Valid Properties | ${validCount}/${totalCount} |`);
  lines.push(`| Verification Time | ${result.smtTime}ms |`);
  lines.push('');
  
  // Properties
  lines.push('## Properties');
  lines.push('');
  
  const byCategory = groupByCategory(result.properties);
  
  for (const [category, props] of Object.entries(byCategory)) {
    lines.push(`### ${formatCategoryName(category)}`);
    lines.push('');
    lines.push('| Property | Result | Time |');
    lines.push('|----------|--------|------|');
    
    for (const prop of props) {
      const icon = getResultIcon(prop.result);
      lines.push(`| ${prop.name} | ${icon} ${prop.result} | ${prop.time}ms |`);
    }
    lines.push('');
  }
  
  // Counterexamples
  if (result.counterexamples.length > 0) {
    lines.push('## Counterexamples');
    lines.push('');
    
    for (const ce of result.counterexamples) {
      lines.push(`### ${ce.property}`);
      lines.push('');
      
      if (Object.keys(ce.inputs).length > 0) {
        lines.push('**Inputs:**');
        lines.push('```json');
        lines.push(JSON.stringify(ce.inputs, null, 2));
        lines.push('```');
        lines.push('');
      }
      
      if (ce.trace.length > 0) {
        lines.push('**Trace:**');
        lines.push('```');
        lines.push(ce.trace.join('\n'));
        lines.push('```');
        lines.push('');
      }
    }
  }
  
  // SMT-LIB
  if (options.includeSmtLib && result.smtLib) {
    lines.push('## SMT-LIB Encoding');
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Click to expand</summary>');
    lines.push('');
    lines.push('```smt2');
    lines.push(result.smtLib);
    lines.push('```');
    lines.push('');
    lines.push('</details>');
  }
  
  return lines.join('\n');
}

// ============================================================================
// JSON REPORT
// ============================================================================

function generateJsonReport(result: FormalVerifyResult, options: ReportOptions): string {
  const report = {
    verified: result.verified,
    summary: {
      totalProperties: result.properties.length,
      validProperties: result.properties.filter(p => p.result === 'valid').length,
      invalidProperties: result.properties.filter(p => p.result === 'invalid').length,
      unknownProperties: result.properties.filter(p => p.result === 'unknown').length,
      timeoutProperties: result.properties.filter(p => p.result === 'timeout').length,
      verificationTimeMs: result.smtTime,
    },
    properties: result.properties.map(p => ({
      name: p.name,
      category: p.category,
      formula: p.formula,
      result: p.result,
      timeMs: p.time,
      counterexample: p.counterexample ? {
        inputs: p.counterexample.inputs,
        state: p.counterexample.state,
        trace: p.counterexample.trace,
      } : undefined,
    })),
    counterexamples: result.counterexamples.map(ce => ({
      property: ce.property,
      inputs: ce.inputs,
      state: ce.state,
      trace: ce.trace,
    })),
  };

  return JSON.stringify(report, null, 2);
}

// ============================================================================
// HTML REPORT
// ============================================================================

function generateHtmlReport(result: FormalVerifyResult, options: ReportOptions): string {
  const validCount = result.properties.filter(p => p.result === 'valid').length;
  const totalCount = result.properties.length;
  const percentage = Math.round((validCount / totalCount) * 100);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Formal Verification Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .verified { background: #d4edda; border: 1px solid #28a745; }
    .not-verified { background: #f8d7da; border: 1px solid #dc3545; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px; }
    .stat { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { color: #6c757d; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
    th { background: #f8f9fa; }
    .valid { color: #28a745; }
    .invalid { color: #dc3545; }
    .unknown { color: #ffc107; }
    .category { margin-top: 30px; }
    .category h3 { color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 10px; }
    .counterexample { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 10px 0; }
    pre { background: #f8f9fa; padding: 15px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="header ${result.verified ? 'verified' : 'not-verified'}">
    <h1>${result.verified ? '✓ Verified' : '✗ Not Verified'}</h1>
    <p>${validCount} of ${totalCount} properties valid</p>
  </div>

  <div class="summary">
    <div class="stat">
      <div class="stat-value">${percentage}%</div>
      <div class="stat-label">Properties Valid</div>
    </div>
    <div class="stat">
      <div class="stat-value">${result.counterexamples.length}</div>
      <div class="stat-label">Counterexamples</div>
    </div>
    <div class="stat">
      <div class="stat-value">${result.smtTime}ms</div>
      <div class="stat-label">Verification Time</div>
    </div>
  </div>

  <h2>Properties</h2>
  <table>
    <thead>
      <tr>
        <th>Property</th>
        <th>Category</th>
        <th>Result</th>
        <th>Time</th>
      </tr>
    </thead>
    <tbody>
      ${result.properties.map(p => `
        <tr>
          <td>${p.name}</td>
          <td>${formatCategoryName(p.category)}</td>
          <td class="${p.result}">${getResultIcon(p.result)} ${p.result}</td>
          <td>${p.time}ms</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${result.counterexamples.length > 0 ? `
    <h2>Counterexamples</h2>
    ${result.counterexamples.map(ce => `
      <div class="counterexample">
        <h4>${ce.property}</h4>
        <pre>${ce.trace.join('\n')}</pre>
      </div>
    `).join('')}
  ` : ''}
</body>
</html>`;
}

// ============================================================================
// HELPERS
// ============================================================================

function groupByCategory(properties: PropertyResult[]): Record<string, PropertyResult[]> {
  const groups: Record<string, PropertyResult[]> = {};
  
  for (const prop of properties) {
    if (!groups[prop.category]) {
      groups[prop.category] = [];
    }
    groups[prop.category].push(prop);
  }
  
  return groups;
}

function formatCategoryName(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getResultIcon(result: PropertyResult['result']): string {
  switch (result) {
    case 'valid':
      return '✓';
    case 'invalid':
      return '✗';
    case 'unknown':
      return '?';
    case 'timeout':
      return '⏱';
    default:
      return '•';
  }
}

// ============================================================================
// SUMMARY GENERATORS
// ============================================================================

/**
 * Generate a one-line summary
 */
export function generateSummary(result: FormalVerifyResult): string {
  const validCount = result.properties.filter(p => p.result === 'valid').length;
  const totalCount = result.properties.length;
  const verdict = result.verified ? 'VERIFIED' : 'NOT VERIFIED';
  
  return `[${verdict}] ${validCount}/${totalCount} properties valid (${result.smtTime}ms)`;
}

/**
 * Generate a CI-friendly exit code
 */
export function getExitCode(result: FormalVerifyResult): number {
  if (result.verified) return 0;
  
  const hasInvalid = result.properties.some(p => p.result === 'invalid');
  const hasTimeout = result.properties.some(p => p.result === 'timeout');
  const hasUnknown = result.properties.some(p => p.result === 'unknown');
  
  if (hasInvalid) return 1;
  if (hasTimeout) return 2;
  if (hasUnknown) return 3;
  
  return 1;
}
