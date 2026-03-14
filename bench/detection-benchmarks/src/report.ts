import type { BenchmarkResult, FullReport } from './types.js';

export function generateMarkdownReport(results: BenchmarkResult[]): string {
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push('# Detection Benchmark Report');
  lines.push('');
  lines.push(`**Generated**: ${now}`);
  lines.push(`**Scanners evaluated**: ${results.length}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(
    '| Scanner | Cases | TP | FP | TN | FN | Precision | Recall | F1 |',
  );
  lines.push(
    '|---------|------:|---:|---:|---:|---:|----------:|-------:|---:|',
  );

  for (const r of results) {
    lines.push(
      `| ${r.scanner} | ${r.totalCases} | ${r.truePositives} | ${r.falsePositives} | ${r.trueNegatives} | ${r.falseNegatives} | ${fmt(r.precision)} | ${fmt(r.recall)} | ${fmt(r.f1Score)} |`,
    );
  }

  lines.push('');
  lines.push('## Per-Scanner Breakdown');
  lines.push('');

  for (const r of results) {
    lines.push(`### ${r.scanner}`);
    lines.push('');
    lines.push(`- **Total test cases**: ${r.totalCases}`);
    lines.push(`- **True positives**: ${r.truePositives}`);
    lines.push(`- **False positives**: ${r.falsePositives}`);
    lines.push(`- **True negatives**: ${r.trueNegatives}`);
    lines.push(`- **False negatives**: ${r.falseNegatives}`);
    lines.push(`- **Precision**: ${fmt(r.precision)} (${pct(r.precision)})`);
    lines.push(`- **Recall**: ${fmt(r.recall)} (${pct(r.recall)})`);
    lines.push(`- **F1 Score**: ${fmt(r.f1Score)} (${pct(r.f1Score)})`);
    lines.push('');
    lines.push(assessQuality(r));
    lines.push('');
  }

  lines.push('## Overall Metrics');
  lines.push('');

  const overall = computeOverall(results);
  lines.push(`- **Average Precision**: ${fmt(overall.averagePrecision)}`);
  lines.push(`- **Average Recall**: ${fmt(overall.averageRecall)}`);
  lines.push(`- **Average F1**: ${fmt(overall.averageF1)}`);
  lines.push('');

  lines.push('## Trend Comparison');
  lines.push('');
  lines.push(
    '> To track trends, commit the JSON report and compare across runs.',
  );
  lines.push(
    '> Use `generateJsonReport()` to produce machine-readable output.',
  );
  lines.push('');

  return lines.join('\n');
}

export function generateJsonReport(results: BenchmarkResult[]): FullReport {
  const overall = computeOverall(results);
  const suites: Record<string, BenchmarkResult[]> = {};

  for (const r of results) {
    const category = r.scanner.split('/')[0] ?? r.scanner;
    if (!suites[category]) suites[category] = [];
    suites[category].push(r);
  }

  return {
    timestamp: new Date().toISOString(),
    results,
    suites,
    overall,
  };
}

function computeOverall(results: BenchmarkResult[]) {
  if (results.length === 0) {
    return { averagePrecision: 0, averageRecall: 0, averageF1: 0 };
  }

  const sum = results.reduce(
    (acc, r) => ({
      precision: acc.precision + r.precision,
      recall: acc.recall + r.recall,
      f1: acc.f1 + r.f1Score,
    }),
    { precision: 0, recall: 0, f1: 0 },
  );

  return {
    averagePrecision:
      Math.round((sum.precision / results.length) * 10000) / 10000,
    averageRecall: Math.round((sum.recall / results.length) * 10000) / 10000,
    averageF1: Math.round((sum.f1 / results.length) * 10000) / 10000,
  };
}

function assessQuality(r: BenchmarkResult): string {
  if (r.f1Score >= 0.9) return '> Excellent detection quality.';
  if (r.f1Score >= 0.7) return '> Good detection quality with room for improvement.';
  if (r.f1Score >= 0.5) return '> Moderate detection quality — review false negatives.';
  return '> Poor detection quality — significant tuning needed.';
}

function fmt(n: number): string {
  return n.toFixed(4);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

if (process.argv[1]?.endsWith('report.ts') || process.argv[1]?.endsWith('report.js')) {
  console.log('Detection Benchmark Report Generator');
  console.log('Usage: import { generateMarkdownReport, generateJsonReport } from "./report.js"');
  console.log('Pass BenchmarkResult[] to generate reports.');
}
