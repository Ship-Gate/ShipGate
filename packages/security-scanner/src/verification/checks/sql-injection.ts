/**
 * SQL Injection Check
 *
 * Verify all DB access goes through Prisma (no raw SQL unless parameterized).
 * Scans for: $queryRaw, $executeRaw without tagged template literals,
 * string concatenation in queries.
 */

import type { SecurityCheckResult, SecurityFinding } from '../types.js';

export const CHECK_ID = 'sql-injection';

interface ScanInput {
  files: Array<{ path: string; content: string }>;
}

/**
 * Detect unsafe Prisma raw query usage:
 * - $queryRaw`...` (tagged template) = SAFE
 * - $queryRaw("SELECT ... " + var) = UNSAFE
 * - $executeRaw`...` (tagged template) = SAFE
 * - $executeRaw("SELECT ... " + var) = UNSAFE
 * - $queryRawUnsafe / $executeRawUnsafe = UNSAFE by design
 */
function scanFile(path: string, content: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    // $queryRaw or $executeRaw with string concatenation (not tagged template)
    // Pattern: $queryRaw("SELECT ... " + var) or $queryRaw('...' + var)
    const rawConcatPattern =
      /\$(?:queryRaw|executeRaw)\s*\(\s*["'`][^"'`]*["'`]\s*[\+\-]\s*\w+/;
    if (rawConcatPattern.test(line)) {
      findings.push({
        id: 'SQL001',
        title: 'Unsafe raw SQL with string concatenation',
        severity: 'critical',
        file: path,
        line: lineNum,
        description:
          'Prisma $queryRaw/$executeRaw used with string concatenation. Use tagged template literals for parameterization.',
        recommendation:
          'Use tagged template: prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`',
        snippet: line.trim(),
      });
    }

    // $queryRawUnsafe / $executeRawUnsafe - explicitly unsafe
    if (/\$queryRawUnsafe|\$executeRawUnsafe/.test(line)) {
      findings.push({
        id: 'SQL002',
        title: 'Unsafe raw SQL API used',
        severity: 'high',
        file: path,
        line: lineNum,
        description:
          '$queryRawUnsafe/$executeRawUnsafe bypasses parameterization. Only use with fully sanitized input.',
        recommendation:
          'Prefer $queryRaw/$executeRaw with tagged template literals.',
        snippet: line.trim(),
      });
    }

    // Non-Prisma raw SQL (direct db.query, knex.raw with concat, etc.)
    const directSqlPattern =
      /(?:db\.query|knex\.raw|connection\.query|mysql\.query|pg\.query)\s*\(\s*["'`][^"'`]*["'`]\s*[\+\-]\s*\w+/;
    if (directSqlPattern.test(line)) {
      findings.push({
        id: 'SQL003',
        title: 'Raw SQL with string concatenation (non-Prisma)',
        severity: 'critical',
        file: path,
        line: lineNum,
        description:
          'Database query built with string concatenation. Use parameterized queries.',
        recommendation:
          'Use parameterized queries: ? placeholders or $1, $2 for PostgreSQL.',
        snippet: line.trim(),
      });
    }

    // Template literal SQL with ${} interpolation (risky if user input)
    const templateSqlPattern = /`\s*SELECT\s+.+\s+FROM\s+.+\$\{/i;
    if (templateSqlPattern.test(line) && !/\$queryRaw`/.test(line)) {
      findings.push({
        id: 'SQL004',
        title: 'SQL query with template literal interpolation',
        severity: 'high',
        file: path,
        line: lineNum,
        description:
          'SQL built with template literal interpolation. Ensure values are validated/sanitized.',
        recommendation: 'Use Prisma client or parameterized queries.',
        snippet: line.trim(),
      });
    }
  }

  return findings;
}

export function runSqlInjectionCheck(input: ScanInput): SecurityCheckResult {
  const findings: SecurityFinding[] = [];

  for (const file of input.files) {
    if (
      /\.(ts|js|tsx|jsx)$/.test(file.path) &&
      !file.path.includes('node_modules')
    ) {
      findings.push(...scanFile(file.path, file.content));
    }
  }

  const criticalOrHigh = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );

  return {
    check: CHECK_ID,
    severity: criticalOrHigh.length > 0 ? 'critical' : 'low',
    passed: criticalOrHigh.length === 0,
    findings,
  };
}
