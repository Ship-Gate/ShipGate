/**
 * Explain command — Deep dive on a specific finding
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import chalk from 'chalk';
import { getReportPath } from './config.js';
import type { ScanReport, Finding } from './types.js';

export interface ExplainResult {
  found: boolean;
  finding?: Finding;
  codeSnippet?: string;
  projectRoot?: string;
}

export async function runExplain(
  findingId: string,
  projectRoot: string
): Promise<ExplainResult> {
  const reportPath = getReportPath(projectRoot);

  if (!existsSync(reportPath)) {
    return {
      found: false,
      projectRoot,
    };
  }

  const content = await readFile(reportPath, 'utf-8');
  const report = JSON.parse(content) as ScanReport;

  const finding = report.findings.find(
    (f) => f.id === findingId || f.id.includes(findingId)
  );

  if (!finding) {
    return {
      found: false,
      projectRoot,
    };
  }

  let codeSnippet: string | undefined;
  if (finding.file && finding.line) {
    const filePath = join(projectRoot, finding.file);
    if (existsSync(filePath)) {
      const lines = (await readFile(filePath, 'utf-8')).split('\n');
      const start = Math.max(0, finding.line - 3);
      const end = Math.min(lines.length, finding.line + 2);
      codeSnippet = lines
        .slice(start, end)
        .map((l, i) => {
          const num = start + i + 1;
          const marker = num === finding.line ? '>' : ' ';
          return `${marker} ${String(num).padStart(4)} | ${l}`;
        })
        .join('\n');
    }
  }

  return {
    found: true,
    finding,
    codeSnippet: codeSnippet ?? finding.snippet,
    projectRoot,
  };
}

export function formatExplainOutput(result: ExplainResult): string {
  const lines: string[] = [];
  lines.push('');

  if (!result.found || !result.finding) {
    lines.push(chalk.red('Finding not found. Run isl-verify first to generate a report.'));
    lines.push('');
    return lines.join('\n');
  }

  const f = result.finding;

  lines.push(chalk.bold(`Finding: ${f.id}`));
  lines.push('');
  lines.push(chalk.gray('Rule: ') + f.ruleId);
  lines.push(chalk.gray('Severity: ') + chalk.yellow(f.severity));
  lines.push(chalk.gray('Checker: ') + f.checker);
  lines.push('');

  lines.push(chalk.bold('Message'));
  lines.push('  ' + f.message);
  lines.push('');

  if (f.file) {
    lines.push(chalk.bold('Location'));
    lines.push(`  ${f.file}${f.line ? `:${f.line}` : ''}`);
    lines.push('');
  }

  if (result.codeSnippet) {
    lines.push(chalk.bold('Code'));
    lines.push(chalk.gray('---'));
    lines.push(result.codeSnippet);
    lines.push(chalk.gray('---'));
    lines.push('');
  }

  if (f.recommendation) {
    lines.push(chalk.bold('Suggested Fix'));
    lines.push('  ' + chalk.green(f.recommendation));
    lines.push('');
  }

  return lines.join('\n');
}
