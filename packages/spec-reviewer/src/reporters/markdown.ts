/**
 * Markdown Reporter
 * 
 * Formats review results as Markdown for documentation.
 */

import type { ReviewResult, Issue, Suggestion } from '../reviewer.js';

export interface MarkdownReporterOptions {
  includeTableOfContents?: boolean;
  includeSuggestions?: boolean;
  includeTimestamp?: boolean;
  maxIssuesPerCategory?: number;
}

/**
 * Format review result as Markdown
 */
export function formatMarkdown(result: ReviewResult, options: MarkdownReporterOptions = {}): string {
  const {
    includeTableOfContents = true,
    includeSuggestions = true,
    includeTimestamp = true,
    maxIssuesPerCategory = 20,
  } = options;

  const lines: string[] = [];

  // Title
  lines.push('# ISL Spec Review Report');
  lines.push('');

  // Timestamp
  if (includeTimestamp) {
    lines.push(`*Generated: ${new Date().toISOString()}*`);
    lines.push('');
  }

  // Table of Contents
  if (includeTableOfContents) {
    lines.push('## Table of Contents');
    lines.push('');
    lines.push('- [Summary](#summary)');
    lines.push('- [Category Scores](#category-scores)');
    if (result.issues.filter(i => i.severity === 'critical').length > 0) {
      lines.push('- [Critical Issues](#critical-issues)');
    }
    if (result.issues.filter(i => i.severity === 'warning').length > 0) {
      lines.push('- [Warnings](#warnings)');
    }
    if (result.issues.filter(i => i.severity === 'info').length > 0) {
      lines.push('- [Information](#information)');
    }
    if (includeSuggestions && result.suggestions.length > 0) {
      lines.push('- [Suggestions](#suggestions)');
    }
    lines.push('');
  }

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(formatSummarySection(result));
  lines.push('');

  // Category Scores
  lines.push('## Category Scores');
  lines.push('');
  lines.push(formatCategoryTable(result.categories));
  lines.push('');

  // Critical Issues
  const criticalIssues = result.issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    lines.push('## Critical Issues');
    lines.push('');
    lines.push(`> ⚠️ **${criticalIssues.length} critical issue(s) found that must be addressed.**`);
    lines.push('');
    lines.push(formatIssuesSection(criticalIssues.slice(0, maxIssuesPerCategory)));
    lines.push('');
  }

  // Warnings
  const warnings = result.issues.filter(i => i.severity === 'warning');
  if (warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    lines.push(formatIssuesSection(warnings.slice(0, maxIssuesPerCategory)));
    lines.push('');
  }

  // Info
  const infoIssues = result.issues.filter(i => i.severity === 'info');
  if (infoIssues.length > 0) {
    lines.push('## Information');
    lines.push('');
    lines.push(formatIssuesSection(infoIssues.slice(0, maxIssuesPerCategory)));
    lines.push('');
  }

  // Suggestions
  if (includeSuggestions && result.suggestions.length > 0) {
    lines.push('## Suggestions');
    lines.push('');
    lines.push(formatSuggestionsSection(result.suggestions.slice(0, 15)));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format summary section
 */
function formatSummarySection(result: ReviewResult): string {
  const { summary } = result;
  const badge = getScoreBadge(summary.score);
  
  const lines: string[] = [];
  
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| **Overall Score** | ${badge} ${summary.score}/100 |`);
  lines.push(`| Critical Issues | ${summary.criticalIssues} |`);
  lines.push(`| Total Issues | ${summary.issues} |`);
  lines.push(`| Suggestions | ${summary.suggestions} |`);
  
  return lines.join('\n');
}

/**
 * Format category scores table
 */
function formatCategoryTable(categories: ReviewResult['categories']): string {
  const lines: string[] = [];
  
  lines.push('| Category | Score | Status |');
  lines.push('|----------|-------|--------|');
  
  const categoryNames: Array<[keyof typeof categories, string]> = [
    ['completeness', 'Completeness'],
    ['consistency', 'Consistency'],
    ['security', 'Security'],
    ['performance', 'Performance'],
    ['naming', 'Naming'],
    ['bestPractices', 'Best Practices'],
  ];

  for (const [key, name] of categoryNames) {
    const cat = categories[key];
    const status = getStatusEmoji(cat.score);
    const bar = getTextProgressBar(cat.score);
    lines.push(`| ${name} | ${bar} ${cat.score}% | ${status} |`);
  }

  return lines.join('\n');
}

/**
 * Format issues section
 */
function formatIssuesSection(issues: Issue[]): string {
  const lines: string[] = [];

  for (const issue of issues) {
    const icon = getSeverityEmoji(issue.severity);
    
    lines.push(`### ${icon} ${issue.title}`);
    lines.push('');
    lines.push(issue.description);
    lines.push('');
    
    if (issue.location) {
      lines.push(`**Location:** Line ${issue.location.line}, Column ${issue.location.column}`);
      lines.push('');
    }
    
    if (issue.fix) {
      lines.push('**Suggested Fix:**');
      lines.push('');
      lines.push(`> ${issue.fix}`);
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format suggestions section
 */
function formatSuggestionsSection(suggestions: Suggestion[]): string {
  const lines: string[] = [];

  for (const suggestion of suggestions) {
    const confidence = Math.round(suggestion.confidence * 100);
    const priority = suggestion.priority ?? 'medium';
    const priorityBadge = getPriorityBadge(priority);
    
    lines.push(`### 💡 ${suggestion.title}`);
    lines.push('');
    lines.push(`${priorityBadge} | Confidence: ${confidence}%`);
    lines.push('');
    lines.push(suggestion.description);
    lines.push('');
    
    if (suggestion.suggestedCode) {
      lines.push('**Suggested Code:**');
      lines.push('');
      lines.push('```isl');
      lines.push(suggestion.suggestedCode.trim());
      lines.push('```');
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get score badge
 */
function getScoreBadge(score: number): string {
  if (score >= 80) return '🟢';
  if (score >= 50) return '🟡';
  return '🔴';
}

/**
 * Get status emoji
 */
function getStatusEmoji(score: number): string {
  if (score >= 80) return '✅ Good';
  if (score >= 50) return '⚠️ Needs Work';
  return '❌ Poor';
}

/**
 * Get severity emoji
 */
function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'critical': return '🔴';
    case 'warning': return '🟡';
    case 'info': return '🔵';
    default: return '⚪';
  }
}

/**
 * Get priority badge
 */
function getPriorityBadge(priority: string): string {
  switch (priority) {
    case 'high': return '🔴 High Priority';
    case 'medium': return '🟡 Medium Priority';
    case 'low': return '🟢 Low Priority';
    default: return '⚪ Unknown';
  }
}

/**
 * Get text progress bar
 */
function getTextProgressBar(value: number): string {
  const filled = Math.round(value / 10);
  const empty = 10 - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
}

/**
 * Generate Markdown badge
 */
export function generateBadge(score: number): string {
  const color = score >= 80 ? 'brightgreen' : score >= 50 ? 'yellow' : 'red';
  return `![ISL Review Score](https://img.shields.io/badge/ISL%20Review-${score}%25-${color})`;
}
