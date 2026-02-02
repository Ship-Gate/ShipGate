/**
 * Pretty Renderer
 *
 * Renders verification results with a beautiful CLI UX:
 * - Summary banner with score and SHIP/NO_SHIP decision
 * - Top failures with file/line locations
 * - "How to fix" next steps
 * - Repro commands for copy-paste
 */

import chalk, { type ChalkInstance } from 'chalk';
import type {
  VerificationResult,
  ClauseResult,
  RenderOptions,
  GroupedFailures,
  ReproCommand,
  CategoryScore,
  ImpactLevel,
  Recommendation,
} from './types.js';
import { DEFAULT_RENDER_OPTIONS } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Color Configuration
// ─────────────────────────────────────────────────────────────────────────────

interface ColorScheme {
  success: ChalkInstance;
  error: ChalkInstance;
  warning: ChalkInstance;
  info: ChalkInstance;
  dim: ChalkInstance;
  bold: ChalkInstance;
  ship: ChalkInstance;
  noShip: ChalkInstance;
  critical: ChalkInstance;
  high: ChalkInstance;
  medium: ChalkInstance;
  low: ChalkInstance;
  boldError: ChalkInstance;
  boldInfo: ChalkInstance;
  boldSuccess: ChalkInstance;
}

function getColors(enabled: boolean): ColorScheme {
  if (!enabled) {
    const identity = chalk.reset;
    return {
      success: identity,
      error: identity,
      warning: identity,
      info: identity,
      dim: identity,
      bold: identity,
      ship: identity,
      noShip: identity,
      critical: identity,
      high: identity,
      medium: identity,
      low: identity,
      boldError: identity,
      boldInfo: identity,
      boldSuccess: identity,
    };
  }
  return {
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.cyan,
    dim: chalk.gray,
    bold: chalk.bold,
    ship: chalk.bgGreen.black.bold,
    noShip: chalk.bgRed.white.bold,
    critical: chalk.red.bold,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.gray,
    boldError: chalk.bold.red,
    boldInfo: chalk.bold.cyan,
    boldSuccess: chalk.bold.green,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Banner Renderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the summary banner with score and SHIP/NO_SHIP decision
 */
export function renderBanner(result: VerificationResult, options: RenderOptions = {}): string {
  const opts = { ...DEFAULT_RENDER_OPTIONS, ...options };
  const c = getColors(opts.colors);
  const lines: string[] = [];
  const width = Math.min(opts.terminalWidth, 60);

  const isShip = result.success && result.score >= 95;
  const decision = isShip ? 'SHIP' : 'NO_SHIP';
  const decisionBadge = isShip ? c.ship(` ${decision} `) : c.noShip(` ${decision} `);

  // Score color based on value
  const scoreColor =
    result.score >= 95
      ? c.success
      : result.score >= 85
        ? c.info
        : result.score >= 70
          ? c.warning
          : c.error;

  // Top border
  lines.push(c.dim('╭' + '─'.repeat(width - 2) + '╮'));

  // Title line
  const title = ' ISL Verification Result ';
  const padding = Math.floor((width - title.length - 2) / 2);
  lines.push(c.dim('│') + ' '.repeat(padding) + c.bold(title) + ' '.repeat(width - padding - title.length - 2) + c.dim('│'));

  // Separator
  lines.push(c.dim('├' + '─'.repeat(width - 2) + '┤'));

  // Score and decision
  const scoreStr = `Score: ${scoreColor(result.score.toString())}/${c.dim('100')}`;
  const scoreRaw = `Score: ${result.score}/100`;
  const decisionPadding = width - scoreRaw.length - decision.length - 6;
  lines.push(
    c.dim('│') +
      ` ${scoreStr}` +
      ' '.repeat(Math.max(1, decisionPadding)) +
      decisionBadge +
      ' ' +
      c.dim('│')
  );

  // Confidence
  const confStr = `Confidence: ${result.confidence}%`;
  lines.push(c.dim('│') + ` ${c.dim(confStr)}` + ' '.repeat(width - confStr.length - 3) + c.dim('│'));

  // Recommendation
  const recStr = `Recommendation: ${formatRecommendation(result.recommendation, c)}`;
  const recRaw = `Recommendation: ${result.recommendation.replace(/_/g, ' ')}`;
  lines.push(c.dim('│') + ` ${recStr}` + ' '.repeat(width - recRaw.length - 3) + c.dim('│'));

  // Bottom border
  lines.push(c.dim('╰' + '─'.repeat(width - 2) + '╯'));

  return lines.join('\n');
}

function formatRecommendation(rec: Recommendation, c: ColorScheme): string {
  const labels: Record<Recommendation, { text: string; color: ChalkInstance }> = {
    production_ready: { text: 'Production Ready', color: c.success },
    staging_recommended: { text: 'Staging Recommended', color: c.info },
    shadow_mode: { text: 'Shadow Mode', color: c.warning },
    not_ready: { text: 'Not Ready', color: c.error },
    critical_issues: { text: 'Critical Issues', color: c.critical },
  };
  const { text, color } = labels[rec];
  return color(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// Failures Renderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Group failures by impact level
 */
export function groupFailures(clauses: ClauseResult[]): GroupedFailures {
  const failures = clauses.filter((c) => c.status === 'failed');
  return {
    critical: failures.filter((f) => f.impact === 'critical'),
    high: failures.filter((f) => f.impact === 'high'),
    medium: failures.filter((f) => f.impact === 'medium'),
    low: failures.filter((f) => f.impact === 'low' || !f.impact),
  };
}

/**
 * Render top failures with file/line locations
 */
export function renderFailures(result: VerificationResult, options: RenderOptions = {}): string {
  const opts = { ...DEFAULT_RENDER_OPTIONS, ...options };
  const c = getColors(opts.colors);
  const lines: string[] = [];

  const failures = result.clauses.filter((clause) => clause.status === 'failed');
  if (failures.length === 0) {
    return '';
  }

  // Sort by impact
  const impactOrder: Record<ImpactLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  failures.sort((a, b) => {
    const aOrder = impactOrder[a.impact || 'low'];
    const bOrder = impactOrder[b.impact || 'low'];
    return aOrder - bOrder;
  });

  const toShow = failures.slice(0, opts.maxFailures);

  lines.push('');
  lines.push(c.boldError(`✗ Failed Clauses (${failures.length})`));
  lines.push(c.dim('─'.repeat(40)));

  for (const failure of toShow) {
    lines.push('');
    lines.push(renderFailure(failure, c));
  }

  if (failures.length > opts.maxFailures) {
    lines.push('');
    lines.push(c.dim(`... and ${failures.length - opts.maxFailures} more failure(s)`));
  }

  return lines.join('\n');
}

function renderFailure(failure: ClauseResult, c: ColorScheme): string {
  const lines: string[] = [];

  // Impact badge
  const impactBadge = getImpactBadge(failure.impact || 'low', c);

  // Location
  let location = '';
  if (failure.file) {
    location = c.info(failure.file);
    if (failure.line) {
      location += c.dim(`:${failure.line}`);
      if (failure.column) {
        location += c.dim(`:${failure.column}`);
      }
    }
  }

  // Name and category
  lines.push(`${impactBadge} ${c.bold(failure.name)} ${c.dim(`[${failure.category}]`)}`);

  if (location) {
    lines.push(`  ${c.dim('at')} ${location}`);
  }

  // Error message
  if (failure.error) {
    lines.push(`  ${c.error(failure.error)}`);
  }

  // Expression
  if (failure.expression) {
    lines.push(`  ${c.dim('Expression:')} ${failure.expression}`);
  }

  // Actual vs Expected
  if (failure.actual !== undefined && failure.expected !== undefined) {
    lines.push(`  ${c.dim('Expected:')} ${JSON.stringify(failure.expected)}`);
    lines.push(`  ${c.dim('Actual:')}   ${JSON.stringify(failure.actual)}`);
  }

  return lines.join('\n');
}

function getImpactBadge(impact: ImpactLevel, c: ColorScheme): string {
  const badges: Record<ImpactLevel, string> = {
    critical: c.critical('[CRITICAL]'),
    high: c.high('[HIGH]'),
    medium: c.medium('[MEDIUM]'),
    low: c.low('[LOW]'),
  };
  return badges[impact];
}

// ─────────────────────────────────────────────────────────────────────────────
// How to Fix Renderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render "How to fix" next steps
 */
export function renderHowToFix(result: VerificationResult, options: RenderOptions = {}): string {
  const opts = { ...DEFAULT_RENDER_OPTIONS, ...options };
  if (!opts.showFixes) return '';

  const c = getColors(opts.colors);
  const lines: string[] = [];

  const failures = result.clauses.filter((clause) => clause.status === 'failed');
  if (failures.length === 0) return '';

  const fixes = generateFixes(result, failures);
  if (fixes.length === 0) return '';

  lines.push('');
  lines.push(c.boldInfo('💡 How to Fix'));
  lines.push(c.dim('─'.repeat(40)));

  for (let i = 0; i < fixes.length; i++) {
    lines.push(`${c.info((i + 1).toString() + '.')} ${fixes[i]}`);
  }

  return lines.join('\n');
}

function generateFixes(result: VerificationResult, failures: ClauseResult[]): string[] {
  const fixes: string[] = [];
  const grouped = groupFailures(failures);

  // Critical fixes first
  if (grouped.critical.length > 0) {
    fixes.push(
      `Fix ${grouped.critical.length} critical issue(s) immediately - these block deployment`
    );
    for (const f of grouped.critical.slice(0, 2)) {
      if (f.suggestedFix) {
        fixes.push(`  → ${f.name}: ${f.suggestedFix}`);
      }
    }
  }

  // Category-specific advice
  const failedCategories = [...new Set(failures.map((f) => f.category))];

  if (failedCategories.includes('postcondition')) {
    fixes.push('Review postcondition logic - ensure return values match spec');
  }

  if (failedCategories.includes('invariant')) {
    fixes.push('Check invariant violations - state may be inconsistent');
  }

  if (failedCategories.includes('precondition')) {
    fixes.push('Validate input handling - preconditions are not being met');
  }

  // Suggested fixes from clauses
  const withFixes = failures.filter((f) => f.suggestedFix && f.impact !== 'critical');
  for (const f of withFixes.slice(0, 3)) {
    fixes.push(`${f.name}: ${f.suggestedFix}`);
  }

  // General advice based on score
  if (result.score < 50) {
    fixes.push('Consider reviewing the implementation against the spec');
  } else if (result.score < 70) {
    fixes.push('Focus on high-impact failures first');
  } else if (result.score < 95) {
    fixes.push('Close to passing - fix remaining issues for production readiness');
  }

  return fixes.slice(0, 5); // Max 5 fixes
}

// ─────────────────────────────────────────────────────────────────────────────
// Repro Commands Renderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate repro commands for failed clauses
 */
export function generateReproCommands(
  result: VerificationResult,
  options: RenderOptions = {}
): ReproCommand[] {
  const opts = { ...DEFAULT_RENDER_OPTIONS, ...options };
  const commands: ReproCommand[] = [];

  const specFile = opts.specFile || result.specFile;
  const implFile = opts.implFile || result.implFile;

  // Re-run verification
  commands.push({
    description: 'Re-run verification',
    command: `isl verify ${specFile} ${implFile}`,
  });

  // Run with verbose output
  commands.push({
    description: 'Run with detailed output',
    command: `isl verify ${specFile} ${implFile} --detailed`,
  });

  // Run specific failed tests
  const failures = result.clauses.filter((c) => c.status === 'failed');
  const firstFail = failures[0];
  if (firstFail) {
    commands.push({
      description: `Run specific clause: ${firstFail.name}`,
      command: `isl verify ${specFile} ${implFile} --filter "${firstFail.name}"`,
    });
  }

  // JSON output for CI
  commands.push({
    description: 'Get JSON output for CI',
    command: `isl verify ${specFile} ${implFile} --format json`,
  });

  return commands;
}

/**
 * Render repro commands section
 */
export function renderReproCommands(result: VerificationResult, options: RenderOptions = {}): string {
  const opts = { ...DEFAULT_RENDER_OPTIONS, ...options };
  if (!opts.showRepro) return '';

  const c = getColors(opts.colors);
  const lines: string[] = [];

  const commands = generateReproCommands(result, opts);

  lines.push('');
  lines.push(c.boldInfo('🔄 Repro Commands'));
  lines.push(c.dim('─'.repeat(40)));

  for (const cmd of commands) {
    lines.push(`${c.dim('#')} ${cmd.description}`);
    lines.push(`${c.success('$')} ${cmd.command}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Breakdown Renderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render category breakdown
 */
export function renderBreakdown(result: VerificationResult, options: RenderOptions = {}): string {
  const opts = { ...DEFAULT_RENDER_OPTIONS, ...options };
  if (!opts.showBreakdown) return '';

  const c = getColors(opts.colors);
  const lines: string[] = [];

  lines.push('');
  lines.push(c.bold('📊 Category Breakdown'));
  lines.push(c.dim('─'.repeat(40)));

  const categories: Array<[string, CategoryScore]> = [
    ['Postconditions', result.breakdown.postconditions],
    ['Invariants', result.breakdown.invariants],
    ['Scenarios', result.breakdown.scenarios],
    ['Temporal', result.breakdown.temporal],
  ];

  if (result.breakdown.preconditions) {
    categories.push(['Preconditions', result.breakdown.preconditions]);
  }
  if (result.breakdown.chaos) {
    categories.push(['Chaos', result.breakdown.chaos]);
  }

  for (const [name, score] of categories) {
    if (score.total > 0) {
      lines.push(renderCategoryBar(name, score, c, opts.terminalWidth - 4));
    }
  }

  return lines.join('\n');
}

function renderCategoryBar(
  name: string,
  score: CategoryScore,
  c: ColorScheme,
  width: number
): string {
  const labelWidth = 15;
  const barWidth = Math.max(10, width - labelWidth - 15);

  const filledWidth = Math.round((score.score / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  const barColor = score.score >= 95 ? c.success : score.score >= 70 ? c.warning : c.error;

  const bar = barColor('█'.repeat(filledWidth)) + c.dim('░'.repeat(emptyWidth));
  const stats = c.dim(`${score.passed}/${score.total}`);
  const pct = `${score.score}%`;

  return `${name.padEnd(labelWidth)} ${bar} ${pct.padStart(4)} ${stats}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Render
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render complete verification output
 */
export function render(result: VerificationResult, options: RenderOptions = {}): string {
  const parts: string[] = [];

  parts.push(renderBanner(result, options));
  parts.push(renderBreakdown(result, options));
  parts.push(renderFailures(result, options));
  parts.push(renderHowToFix(result, options));
  parts.push(renderReproCommands(result, options));

  return parts.filter(Boolean).join('\n');
}

/**
 * Print rendered output to console
 */
export function print(result: VerificationResult, options: RenderOptions = {}): void {
  const output = render(result, options);
  process.stdout.write(output + '\n');
}
