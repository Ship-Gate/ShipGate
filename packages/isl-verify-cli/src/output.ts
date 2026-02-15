/**
 * Formatted output for isl-verify scan results
 */

import chalk from 'chalk';
import { relative } from 'path';
import type { ScanReport, Finding } from './types.js';

const LINE = '━'.repeat(4);

export function formatScanOutput(report: ScanReport, options: { verbose?: boolean } = {}): string {
  const lines: string[] = [];
  const cwd = process.cwd();
  const relRoot = relative(cwd, report.projectRoot) || '.';

  lines.push('');
  lines.push(chalk.bold('ISL Verify') + chalk.gray(' — Scanning ') + chalk.cyan(relRoot));
  lines.push(
    chalk.gray(`Framework: ${report.framework}`) +
      chalk.gray('  |  ') +
      chalk.gray(`ORM: ${report.orm}`) +
      chalk.gray('  |  ') +
      chalk.gray(`Files: ${report.fileCount}`)
  );
  lines.push('');

  const scoreColor =
    report.trustScore >= 80 ? chalk.green : report.trustScore >= 50 ? chalk.yellow : chalk.red;
  const verdictLabel =
    report.verdict === 'SHIP' ? 'SHIP' : report.verdict === 'REVIEW' ? 'REVIEW' : 'NO_SHIP';
  lines.push(
    chalk.gray(`${LINE} `) +
      chalk.bold('Trust Score: ') +
      scoreColor(`${report.trustScore}/100`) +
      chalk.gray(` — ${verdictLabel} `) +
      chalk.gray(LINE)
  );
  lines.push('');

  const critical = report.findings.filter((f) => f.severity === 'critical');
  const high = report.findings.filter((f) => f.severity === 'high');
  const medium = report.findings.filter((f) => f.severity === 'medium');
  const low = report.findings.filter((f) => f.severity === 'low');

  if (critical.length > 0) {
    lines.push(chalk.red.bold(`CRITICAL (${critical.length})`));
    for (const f of critical) {
      lines.push(formatFinding(f, '✗', chalk.red));
    }
    lines.push('');
  }

  if (high.length > 0) {
    lines.push(chalk.yellow.bold(`HIGH (${high.length})`));
    for (const f of high) {
      lines.push(formatFinding(f, '⚠', chalk.yellow));
    }
    lines.push('');
  }

  if (medium.length > 0 && options.verbose) {
    lines.push(chalk.blue.bold(`MEDIUM (${medium.length})`));
    for (const f of medium) {
      lines.push(formatFinding(f, '○', chalk.blue));
    }
    lines.push('');
  }

  if (low.length > 0 && options.verbose) {
    lines.push(chalk.gray.bold(`LOW (${low.length})`));
    for (const f of low) {
      lines.push(formatFinding(f, '·', chalk.gray));
    }
    lines.push('');
  }

  if (!options.verbose && (medium.length > 0 || low.length > 0)) {
    lines.push(
      chalk.gray(`  MEDIUM (${medium.length})  LOW (${low.length})  — Run with --verbose for details`)
    );
    lines.push('');
  }

  if (critical.length > 0) {
    lines.push(
      chalk.yellow(
        `Fix the ${critical.length} critical finding${critical.length > 1 ? 's' : ''} to reach SHIP status.`
      )
    );
  }

  lines.push(chalk.gray(`Full report: .isl-verify/report.json`));
  lines.push('');

  return lines.join('\n');
}

function formatFinding(f: Finding, icon: string, color: typeof chalk): string {
  const loc = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : 'unknown';
  return `  ${color(icon)} ${loc} — ${f.message}`;
}
