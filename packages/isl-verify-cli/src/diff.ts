/**
 * Diff command — Compare current findings vs last saved report
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import chalk from 'chalk';
import { getReportPath } from './config.js';
import type { ScanReport, Finding } from './types.js';

export interface DiffResult {
  hasPrevious: boolean;
  newFindings: Finding[];
  resolvedFindings: Finding[];
  changedScores: { previous: number; current: number; delta: number };
  summary: string;
}

export async function runDiff(
  currentReport: ScanReport,
  projectRoot: string
): Promise<DiffResult> {
  const reportPath = getReportPath(projectRoot);

  if (!existsSync(reportPath)) {
    return {
      hasPrevious: false,
      newFindings: currentReport.findings,
      resolvedFindings: [],
      changedScores: {
        previous: 0,
        current: currentReport.trustScore,
        delta: currentReport.trustScore,
      },
      summary: 'No previous report found. Run isl-verify to create a baseline.',
    };
  }

  const content = await readFile(reportPath, 'utf-8');
  const previous = JSON.parse(content) as ScanReport;

  const prevIds = new Set(previous.findings.map((f) => f.id));
  const currIds = new Set(currentReport.findings.map((f) => f.id));

  const newFindings = currentReport.findings.filter((f) => !prevIds.has(f.id));
  const resolvedFindings = previous.findings.filter((f) => !currIds.has(f.id));

  const delta = currentReport.trustScore - previous.trustScore;

  return {
    hasPrevious: true,
    newFindings,
    resolvedFindings,
    changedScores: {
      previous: previous.trustScore,
      current: currentReport.trustScore,
      delta,
    },
    summary: '',
  };
}

export function formatDiffOutput(result: DiffResult): string {
  const lines: string[] = [];
  lines.push('');

  if (!result.hasPrevious) {
    lines.push(chalk.gray(result.summary));
    lines.push('');
    return lines.join('\n');
  }

  lines.push(chalk.bold('ISL Verify Diff'));
  lines.push('');

  const { changedScores, newFindings, resolvedFindings } = result;
  const scoreColor = changedScores.delta >= 0 ? chalk.green : chalk.red;
  const sign = changedScores.delta >= 0 ? '+' : '';

  lines.push(
    chalk.gray('Trust Score: ') +
      chalk.cyan(`${changedScores.previous}`) +
      chalk.gray(' → ') +
      chalk.cyan(`${changedScores.current}`) +
      ' ' +
      scoreColor(`(${sign}${changedScores.delta})`)
  );
  lines.push('');

  if (newFindings.length > 0) {
    lines.push(chalk.red.bold(`New (${newFindings.length})`));
    for (const f of newFindings.slice(0, 10)) {
      lines.push(`  ✗ ${f.file ?? '?'}${f.line ? `:${f.line}` : ''} — ${f.message}`);
    }
    if (newFindings.length > 10) {
      lines.push(chalk.gray(`  ... and ${newFindings.length - 10} more`));
    }
    lines.push('');
  }

  if (resolvedFindings.length > 0) {
    lines.push(chalk.green.bold(`Resolved (${resolvedFindings.length})`));
    for (const f of resolvedFindings.slice(0, 10)) {
      lines.push(`  ✓ ${f.file ?? '?'}${f.line ? `:${f.line}` : ''} — ${f.message}`);
    }
    if (resolvedFindings.length > 10) {
      lines.push(chalk.gray(`  ... and ${resolvedFindings.length - 10} more`));
    }
    lines.push('');
  }

  if (newFindings.length === 0 && resolvedFindings.length === 0 && changedScores.delta === 0) {
    lines.push(chalk.gray('No changes since last scan.'));
    lines.push('');
  }

  return lines.join('\n');
}
