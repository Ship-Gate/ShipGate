/**
 * Console Reporter
 * 
 * Formats review results for terminal output.
 */

import type { ReviewResult, Issue, Suggestion, CategoryResult } from '../reviewer.js';

export interface ConsoleReporterOptions {
  colors?: boolean;
  verbose?: boolean;
  showSuggestions?: boolean;
  maxIssues?: number;
}

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

/**
 * Format review result for console output
 */
export function formatConsole(result: ReviewResult, options: ConsoleReporterOptions = {}): string {
  const {
    colors: useColors = true,
    verbose = false,
    showSuggestions = true,
    maxIssues = 50,
  } = options;

  const c = useColors ? colors : createNoColors();
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(`${c.bold}═══════════════════════════════════════════════════════════════${c.reset}`);
  lines.push(`${c.bold}                    ISL SPEC REVIEW REPORT                      ${c.reset}`);
  lines.push(`${c.bold}═══════════════════════════════════════════════════════════════${c.reset}`);
  lines.push('');

  // Summary
  lines.push(formatSummary(result, c));
  lines.push('');

  // Category Scores
  lines.push(`${c.bold}Category Scores:${c.reset}`);
  lines.push(formatCategoryScores(result.categories, c));
  lines.push('');

  // Critical Issues
  const criticalIssues = result.issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    lines.push(`${c.bold}${c.red}Critical Issues (${criticalIssues.length}):${c.reset}`);
    lines.push(formatIssues(criticalIssues.slice(0, maxIssues), c, verbose));
    lines.push('');
  }

  // Warnings
  const warnings = result.issues.filter(i => i.severity === 'warning');
  if (warnings.length > 0) {
    lines.push(`${c.bold}${c.yellow}Warnings (${warnings.length}):${c.reset}`);
    lines.push(formatIssues(warnings.slice(0, maxIssues), c, verbose));
    lines.push('');
  }

  // Info Issues (only in verbose mode)
  if (verbose) {
    const infoIssues = result.issues.filter(i => i.severity === 'info');
    if (infoIssues.length > 0) {
      lines.push(`${c.bold}${c.blue}Info (${infoIssues.length}):${c.reset}`);
      lines.push(formatIssues(infoIssues.slice(0, maxIssues), c, verbose));
      lines.push('');
    }
  }

  // Suggestions
  if (showSuggestions && result.suggestions.length > 0) {
    lines.push(`${c.bold}${c.cyan}Suggestions (${result.suggestions.length}):${c.reset}`);
    lines.push(formatSuggestions(result.suggestions.slice(0, 10), c, verbose));
    lines.push('');
  }

  // Footer
  lines.push(`${c.dim}───────────────────────────────────────────────────────────────${c.reset}`);
  lines.push(`${c.dim}Review completed at ${new Date().toISOString()}${c.reset}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format summary section
 */
function formatSummary(result: ReviewResult, c: typeof colors): string {
  const { summary } = result;
  const scoreColor = getScoreColor(summary.score, c);
  const verdictIcon = summary.score >= 80 ? '✓' : summary.score >= 50 ? '!' : '✗';

  const lines: string[] = [];
  
  lines.push(`${c.bold}Overall Score: ${scoreColor}${summary.score}/100${c.reset} ${verdictIcon}`);
  lines.push('');
  lines.push(`  ${c.red}●${c.reset} Critical Issues: ${summary.criticalIssues}`);
  lines.push(`  ${c.yellow}●${c.reset} Warnings: ${summary.issues - summary.criticalIssues}`);
  lines.push(`  ${c.cyan}●${c.reset} Suggestions: ${summary.suggestions}`);

  return lines.join('\n');
}

/**
 * Format category scores
 */
function formatCategoryScores(categories: ReviewResult['categories'], c: typeof colors): string {
  const lines: string[] = [];

  const categoryNames: Array<keyof typeof categories> = [
    'completeness',
    'consistency', 
    'security',
    'performance',
    'naming',
    'bestPractices',
  ];

  for (const name of categoryNames) {
    const cat = categories[name];
    const bar = createProgressBar(cat.score, 20, c);
    const displayName = name.replace(/([A-Z])/g, ' $1').trim();
    lines.push(`  ${displayName.padEnd(15)} ${bar} ${cat.score.toString().padStart(3)}%`);
  }

  return lines.join('\n');
}

/**
 * Format issues list
 */
function formatIssues(issues: Issue[], c: typeof colors, verbose: boolean): string {
  const lines: string[] = [];

  for (const issue of issues) {
    const icon = getSeverityIcon(issue.severity);
    const severityColor = getSeverityColor(issue.severity, c);
    
    lines.push(`  ${severityColor}${icon}${c.reset} ${c.bold}${issue.title}${c.reset}`);
    
    if (verbose || issue.severity === 'critical') {
      lines.push(`    ${c.dim}${issue.description}${c.reset}`);
      
      if (issue.location) {
        lines.push(`    ${c.dim}at line ${issue.location.line}:${issue.location.column}${c.reset}`);
      }
      
      if (issue.fix) {
        lines.push(`    ${c.green}Fix: ${issue.fix}${c.reset}`);
      }
    }
    
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format suggestions list
 */
function formatSuggestions(suggestions: Suggestion[], c: typeof colors, verbose: boolean): string {
  const lines: string[] = [];

  for (const suggestion of suggestions) {
    const confidence = Math.round(suggestion.confidence * 100);
    const confidenceBar = createMiniBar(confidence, c);
    
    lines.push(`  ${c.cyan}💡${c.reset} ${c.bold}${suggestion.title}${c.reset} ${confidenceBar}`);
    
    if (verbose) {
      lines.push(`    ${c.dim}${suggestion.description}${c.reset}`);
      
      if (suggestion.suggestedCode) {
        lines.push(`    ${c.dim}Suggested code:${c.reset}`);
        const codeLines = suggestion.suggestedCode.split('\n').slice(0, 5);
        for (const line of codeLines) {
          lines.push(`    ${c.green}${line}${c.reset}`);
        }
        if (suggestion.suggestedCode.split('\n').length > 5) {
          lines.push(`    ${c.dim}...${c.reset}`);
        }
      }
    }
    
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Create progress bar
 */
function createProgressBar(value: number, width: number, c: typeof colors): string {
  const filled = Math.round((value / 100) * width);
  const empty = width - filled;
  
  const color = value >= 80 ? c.green : value >= 50 ? c.yellow : c.red;
  
  return `${color}${'█'.repeat(filled)}${c.dim}${'░'.repeat(empty)}${c.reset}`;
}

/**
 * Create mini confidence bar
 */
function createMiniBar(value: number, c: typeof colors): string {
  const color = value >= 80 ? c.green : value >= 50 ? c.yellow : c.dim;
  return `${color}[${value}%]${c.reset}`;
}

/**
 * Get color for score
 */
function getScoreColor(score: number, c: typeof colors): string {
  if (score >= 80) return c.green;
  if (score >= 50) return c.yellow;
  return c.red;
}

/**
 * Get icon for severity
 */
function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '✗';
    case 'warning': return '!';
    case 'info': return 'ℹ';
    default: return '•';
  }
}

/**
 * Get color for severity
 */
function getSeverityColor(severity: string, c: typeof colors): string {
  switch (severity) {
    case 'critical': return c.red;
    case 'warning': return c.yellow;
    case 'info': return c.blue;
    default: return c.white;
  }
}

/**
 * Create no-color placeholder
 */
function createNoColors(): typeof colors {
  const noColor: Record<string, string> = {};
  for (const key of Object.keys(colors)) {
    noColor[key] = '';
  }
  return noColor as typeof colors;
}
