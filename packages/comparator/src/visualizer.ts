/**
 * Diff Visualizer
 * 
 * Generate visual representations of comparison results.
 */

import type { Difference } from './equivalence.js';
import type { PerformanceResult, PerformanceMetrics } from './performance.js';
import type { CoverageResult } from './coverage.js';
import type { ComparisonResult } from './reporter.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Visualization options */
export interface VisualizationOptions {
  /** Width of ASCII visualizations */
  width?: number;
  /** Use colors (ANSI) */
  colors?: boolean;
  /** Include legends */
  legends?: boolean;
}

/** Color codes for terminal output */
const Colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

// ─────────────────────────────────────────────────────────────────────────────
// Bar Charts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a horizontal bar chart
 */
export function horizontalBarChart(
  data: Array<{ label: string; value: number; color?: string }>,
  options: VisualizationOptions = {}
): string {
  const width = options.width ?? 40;
  const useColors = options.colors ?? true;
  
  const maxValue = Math.max(...data.map(d => d.value));
  const maxLabel = Math.max(...data.map(d => d.label.length));
  const lines: string[] = [];

  for (const item of data) {
    const barWidth = maxValue > 0 ? Math.round((item.value / maxValue) * width) : 0;
    const bar = '█'.repeat(barWidth) + '░'.repeat(width - barWidth);
    const label = item.label.padEnd(maxLabel);
    const value = item.value.toFixed(1).padStart(8);
    
    if (useColors && item.color) {
      lines.push(`${label} │${item.color}${bar}${Colors.reset}│ ${value}`);
    } else {
      lines.push(`${label} │${bar}│ ${value}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create a grouped bar chart for comparing implementations
 */
export function groupedBarChart(
  data: Map<string, Map<string, number>>,
  options: VisualizationOptions = {}
): string {
  const width = options.width ?? 30;
  const useColors = options.colors ?? true;
  
  const lines: string[] = [];
  const metrics = Array.from(data.keys());
  const implNames = new Set<string>();
  
  for (const metricData of data.values()) {
    for (const impl of metricData.keys()) {
      implNames.add(impl);
    }
  }
  
  const impls = Array.from(implNames);
  const implColors = [Colors.green, Colors.blue, Colors.yellow, Colors.cyan];
  
  for (const metric of metrics) {
    lines.push(`${Colors.bold}${metric}${Colors.reset}`);
    const metricData = data.get(metric)!;
    const maxValue = Math.max(...Array.from(metricData.values()));
    
    for (let i = 0; i < impls.length; i++) {
      const impl = impls[i];
      const value = metricData.get(impl) ?? 0;
      const barWidth = maxValue > 0 ? Math.round((value / maxValue) * width) : 0;
      const bar = '█'.repeat(barWidth);
      const color = useColors ? implColors[i % implColors.length] : '';
      const reset = useColors ? Colors.reset : '';
      
      lines.push(`  ${impl.padEnd(15)} ${color}${bar}${reset} ${value.toFixed(1)}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Performance Visualization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Visualize performance comparison
 */
export function visualizePerformance(
  result: PerformanceResult,
  options: VisualizationOptions = {}
): string {
  const width = options.width ?? 40;
  const useColors = options.colors ?? true;
  const lines: string[] = [];

  lines.push(`${Colors.bold}Performance Comparison${Colors.reset}`);
  lines.push('═'.repeat(width + 30));
  lines.push('');

  // Latency P50
  lines.push(`${Colors.cyan}Latency (P50) - Lower is better${Colors.reset}`);
  const p50Data = Array.from(result.byImplementation.entries())
    .map(([name, m]) => ({
      label: name,
      value: m.latencyP50,
      color: name === result.winner ? Colors.green : Colors.gray,
    }))
    .sort((a, b) => a.value - b.value);
  lines.push(horizontalBarChart(p50Data, { width, colors: useColors }));
  lines.push('');

  // Latency P99
  lines.push(`${Colors.cyan}Latency (P99) - Lower is better${Colors.reset}`);
  const p99Data = Array.from(result.byImplementation.entries())
    .map(([name, m]) => ({
      label: name,
      value: m.latencyP99,
      color: name === result.winner ? Colors.green : Colors.gray,
    }))
    .sort((a, b) => a.value - b.value);
  lines.push(horizontalBarChart(p99Data, { width, colors: useColors }));
  lines.push('');

  // Throughput
  lines.push(`${Colors.cyan}Throughput (req/s) - Higher is better${Colors.reset}`);
  const throughputData = Array.from(result.byImplementation.entries())
    .map(([name, m]) => ({
      label: name,
      value: m.throughputRPS,
      color: name === result.winner ? Colors.green : Colors.gray,
    }))
    .sort((a, b) => b.value - a.value);
  lines.push(horizontalBarChart(throughputData, { width, colors: useColors }));
  lines.push('');

  // Winner summary
  lines.push('─'.repeat(width + 30));
  lines.push(`${Colors.bold}Winner: ${Colors.green}${result.winner}${Colors.reset} (${result.margin.toFixed(1)}% margin)`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage Visualization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Visualize coverage comparison
 */
export function visualizeCoverage(
  result: CoverageResult,
  options: VisualizationOptions = {}
): string {
  const width = options.width ?? 40;
  const useColors = options.colors ?? true;
  const lines: string[] = [];

  lines.push(`${Colors.bold}Coverage Comparison${Colors.reset}`);
  lines.push('═'.repeat(width + 30));
  lines.push('');

  // Pass rates
  lines.push(`${Colors.cyan}Pass Rate - Higher is better${Colors.reset}`);
  const passRateData = Array.from(result.byImplementation.entries())
    .map(([name, m]) => ({
      label: name,
      value: m.passRate,
      color: getPassRateColor(m.passRate, useColors),
    }))
    .sort((a, b) => b.value - a.value);
  lines.push(horizontalBarChart(passRateData, { width, colors: useColors }));
  lines.push('');

  // Test counts
  lines.push(`${Colors.cyan}Test Results${Colors.reset}`);
  for (const [name, metrics] of result.byImplementation) {
    const passed = metrics.passed;
    const failed = metrics.failed;
    const total = metrics.total;
    
    const passedBar = Colors.green + '█'.repeat(Math.round((passed / total) * width)) + Colors.reset;
    const failedBar = Colors.red + '█'.repeat(Math.round((failed / total) * width)) + Colors.reset;
    
    lines.push(`${name.padEnd(15)} ${passedBar}${failedBar} ${passed}/${total}`);
  }
  lines.push('');

  // Divergent tests
  if (result.divergentTests.length > 0) {
    lines.push(`${Colors.yellow}Divergent Tests (${result.divergentTests.length})${Colors.reset}`);
    for (const test of result.divergentTests.slice(0, 5)) {
      const passingImpls = Array.from(test.results.entries())
        .filter(([, passed]) => passed)
        .map(([name]) => name);
      lines.push(`  ${Colors.gray}${test.testName}${Colors.reset}`);
      lines.push(`    Passes: ${passingImpls.join(', ')}`);
    }
    if (result.divergentTests.length > 5) {
      lines.push(`  ... and ${result.divergentTests.length - 5} more`);
    }
  }

  return lines.join('\n');
}

function getPassRateColor(rate: number, useColors: boolean): string {
  if (!useColors) return '';
  if (rate >= 95) return Colors.green;
  if (rate >= 80) return Colors.cyan;
  if (rate >= 60) return Colors.yellow;
  return Colors.red;
}

// ─────────────────────────────────────────────────────────────────────────────
// Difference Visualization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Visualize differences between implementations
 */
export function visualizeDifferences(
  differences: Difference[],
  options: VisualizationOptions = {}
): string {
  const useColors = options.colors ?? true;
  const lines: string[] = [];

  if (differences.length === 0) {
    lines.push(`${Colors.green}✓ All implementations produce equivalent outputs${Colors.reset}`);
    return lines.join('\n');
  }

  lines.push(`${Colors.bold}Behavioral Differences (${differences.length})${Colors.reset}`);
  lines.push('═'.repeat(60));
  lines.push('');

  // Group by severity
  const bySeverity = new Map<string, Difference[]>();
  for (const diff of differences) {
    const existing = bySeverity.get(diff.severity) ?? [];
    existing.push(diff);
    bySeverity.set(diff.severity, existing);
  }

  // Show critical first
  const severityOrder = ['critical', 'warning', 'info'];
  for (const severity of severityOrder) {
    const diffs = bySeverity.get(severity);
    if (!diffs || diffs.length === 0) continue;

    const severityColor = severity === 'critical' ? Colors.red 
      : severity === 'warning' ? Colors.yellow 
      : Colors.gray;
    const icon = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️';

    lines.push(`${severityColor}${icon} ${severity.toUpperCase()} (${diffs.length})${Colors.reset}`);
    
    for (const diff of diffs.slice(0, 3)) {
      lines.push(`  ${Colors.gray}Category: ${diff.category}${Colors.reset}`);
      lines.push(`  ${diff.description}`);
      if (diff.path) {
        lines.push(`  ${Colors.gray}Path: ${diff.path}${Colors.reset}`);
      }
      
      // Show outputs
      lines.push(`  Outputs:`);
      for (const [impl, output] of diff.outputs) {
        const outputStr = JSON.stringify(output).slice(0, 50);
        lines.push(`    ${impl}: ${outputStr}`);
      }
      lines.push('');
    }
    
    if (diffs.length > 3) {
      lines.push(`  ... and ${diffs.length - 3} more ${severity} differences`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Heatmap
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a similarity heatmap
 */
export function similarityHeatmap(
  matrix: Map<string, Map<string, number>>,
  options: VisualizationOptions = {}
): string {
  const useColors = options.colors ?? true;
  const lines: string[] = [];
  const implNames = Array.from(matrix.keys());
  
  lines.push(`${Colors.bold}Similarity Matrix${Colors.reset}`);
  lines.push('');

  // Header row
  const maxNameLen = Math.max(...implNames.map(n => n.length), 6);
  let header = ' '.repeat(maxNameLen + 2);
  for (const name of implNames) {
    header += name.slice(0, 5).padStart(6) + ' ';
  }
  lines.push(header);
  lines.push('-'.repeat(header.length));

  // Data rows
  for (const name1 of implNames) {
    let row = name1.padEnd(maxNameLen) + ' │';
    const rowData = matrix.get(name1)!;
    
    for (const name2 of implNames) {
      const similarity = rowData.get(name2) ?? 0;
      const cell = getSimilarityCell(similarity, useColors);
      row += cell + ' ';
    }
    lines.push(row);
  }

  // Legend
  if (options.legends !== false) {
    lines.push('');
    lines.push('Legend:');
    lines.push(`  ${Colors.green}■${Colors.reset} 90-100%  ${Colors.cyan}■${Colors.reset} 70-90%  ${Colors.yellow}■${Colors.reset} 50-70%  ${Colors.red}■${Colors.reset} <50%`);
  }

  return lines.join('\n');
}

function getSimilarityCell(value: number, useColors: boolean): string {
  const display = value.toFixed(0).padStart(5);
  if (!useColors) return display;
  
  if (value >= 90) return `${Colors.green}${display}${Colors.reset}`;
  if (value >= 70) return `${Colors.cyan}${display}${Colors.reset}`;
  if (value >= 50) return `${Colors.yellow}${display}${Colors.reset}`;
  return `${Colors.red}${display}${Colors.reset}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Dashboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a complete visual dashboard
 */
export function generateDashboard(
  result: ComparisonResult,
  options: VisualizationOptions = {}
): string {
  const lines: string[] = [];
  const width = options.width ?? 60;
  
  // Title
  lines.push('');
  lines.push(`${Colors.bold}╔${'═'.repeat(width - 2)}╗${Colors.reset}`);
  lines.push(`${Colors.bold}║${centerText('IMPLEMENTATION COMPARISON DASHBOARD', width - 2)}║${Colors.reset}`);
  lines.push(`${Colors.bold}╚${'═'.repeat(width - 2)}╝${Colors.reset}`);
  lines.push('');

  // Quick summary
  lines.push(`${Colors.bold}📊 Quick Summary${Colors.reset}`);
  lines.push('─'.repeat(width));
  lines.push(`Implementations: ${result.implementations.map(i => i.name).join(', ')}`);
  lines.push(`Equivalent: ${result.equivalence.equivalent ? '✅ Yes' : '❌ No'}`);
  lines.push(`Performance Winner: 🏆 ${result.performance.winner}`);
  lines.push(`Best Coverage: 📈 ${result.coverage.comparison.bestCoverage.name}`);
  lines.push('');

  // Recommendation box
  lines.push(`${Colors.bold}💡 Recommendation${Colors.reset}`);
  lines.push('─'.repeat(width));
  lines.push(wrapText(result.recommendation, width));
  lines.push('');

  // Performance section
  lines.push(visualizePerformance(result.performance, options));
  lines.push('');

  // Coverage section
  lines.push(visualizeCoverage(result.coverage, options));
  lines.push('');

  // Differences if any
  if (!result.equivalence.equivalent) {
    lines.push(visualizeDifferences(result.equivalence.differences.slice(0, 5), options));
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text + ' '.repeat(width - padding - text.length);
}

function wrapText(text: string, width: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export { Colors };
