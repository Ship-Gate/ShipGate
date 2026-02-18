import type { BenchmarkResults, Issue } from '../types.js';
import { categorizeUniqueIssues } from '../metrics/calculate-metrics.js';

export async function generateReport(results: BenchmarkResults): Promise<string> {
  const lines: string[] = [];

  lines.push('# ISL Verify Benchmark Results');
  lines.push('');
  lines.push(`**Total Ground Truth Issues**: ${results.totalGroundTruthIssues}`);
  lines.push('');
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push('');

  // Comparison Table
  lines.push('## Tool Comparison');
  lines.push('');
  lines.push('| Metric | ISL Verify | ESLint | TypeScript | Semgrep |');
  lines.push('|--------|-----------|--------|-----------|---------|');
  
  for (const row of results.comparisonTable) {
    lines.push(`| ${row.metric} | ${row.islVerify} | ${row.eslint} | ${row.tsc} | ${row.semgrep} |`);
  }
  lines.push('');

  // Detailed Results
  lines.push('## Detailed Results');
  lines.push('');
  
  for (const toolResult of results.toolResults) {
    lines.push(`### ${toolResult.tool}`);
    lines.push('');
    lines.push(`- **True Positives**: ${toolResult.truePositives}`);
    lines.push(`- **False Positives**: ${toolResult.falsePositives}`);
    lines.push(`- **False Negatives**: ${toolResult.falseNegatives}`);
    lines.push(`- **Precision**: ${(toolResult.precision * 100).toFixed(1)}%`);
    lines.push(`- **Recall**: ${(toolResult.recall * 100).toFixed(1)}%`);
    lines.push(`- **F1 Score**: ${toolResult.f1.toFixed(2)}`);
    lines.push('');
  }

  // Unique to ISL Verify
  lines.push('## Issues Caught ONLY by ISL Verify');
  lines.push('');
  lines.push(`**Total Unique Catches**: ${results.uniqueToIslVerify.length} issues`);
  lines.push('');

  if (results.uniqueToIslVerify.length > 0) {
    const categorized = categorizeUniqueIssues(results.uniqueToIslVerify);
    
    lines.push('### By Category');
    lines.push('');
    lines.push('| Category | Subcategory | Count |');
    lines.push('|----------|------------|-------|');
    
    for (const cat of categorized) {
      lines.push(`| ${cat.category} | ${cat.subcategory} | ${cat.count} |`);
    }
    lines.push('');

    // Sample unique issues
    lines.push('### Sample Unique Issues');
    lines.push('');
    
    const samples = results.uniqueToIslVerify.slice(0, 10);
    for (const issue of samples) {
      lines.push(`- **${issue.file}:${issue.line}** (${issue.severity})`);
      lines.push(`  - Category: ${issue.category} / ${issue.subcategory}`);
      lines.push(`  - ${issue.description}`);
      lines.push(`  - ${issue.planted ? '🧪 Planted' : '🤖 AI-generated'}`);
      lines.push('');
    }
  }

  // Marketing Claims
  lines.push('## Marketing-Ready Claims');
  lines.push('');
  
  for (const claim of results.marketingClaims) {
    lines.push(`- ✅ ${claim}`);
  }
  lines.push('');

  // Methodology
  lines.push('## Methodology');
  lines.push('');
  lines.push('This benchmark evaluates ISL Verify against industry-standard tools:');
  lines.push('');
  lines.push('- **ISL Verify**: Tier 1 verification pipeline');
  lines.push('- **ESLint**: Recommended config');
  lines.push('- **TypeScript**: Strict mode (`tsc --noEmit --strict`)');
  lines.push('- **Semgrep**: Auto config');
  lines.push('');
  lines.push('Each of 10 test projects contains:');
  lines.push('- AI-generated code with natural issues');
  lines.push('- 5 additional planted issues per category');
  lines.push('- Manually verified ground truth');
  lines.push('');
  lines.push('**Matching criteria**: File match + line within ±5 + semantic similarity');
  lines.push('');

  return lines.join('\n');
}
