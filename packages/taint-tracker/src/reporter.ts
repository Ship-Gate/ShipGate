import type { TaintFinding, TaintSinkCategory } from './model.js';

export function formatFinding(finding: TaintFinding): string {
  const lines = [
    `[${finding.severity.toUpperCase()}] ${finding.title}`,
    `  ID: ${finding.id}`,
    `  ${finding.description}`,
    '',
    `  Source: ${finding.flow.source.expression}`,
    `    at ${finding.flow.source.location.file}:${finding.flow.source.location.line}:${finding.flow.source.location.column}`,
    '',
    `  Sink: ${finding.flow.sink.expression}`,
    `    at ${finding.flow.sink.location.file}:${finding.flow.sink.location.line}:${finding.flow.sink.location.column}`,
  ];

  if (finding.flow.path.length > 0) {
    lines.push('', '  Flow path:');
    for (const step of finding.flow.path) {
      const loc = `${step.location.file}:${step.location.line}`;
      lines.push(`    → [${step.kind}] ${step.expression} (${loc})`);
    }
  }

  if (finding.flow.sanitizers.length > 0) {
    lines.push('', '  Applied sanitizers:');
    for (const san of finding.flow.sanitizers) {
      lines.push(`    ✓ ${san.method}: ${san.expression}`);
    }
  }

  lines.push('', `  Remediation: ${finding.remediation}`);

  if (finding.cwe) {
    lines.push(`  CWE: ${finding.cwe}`);
  }

  return lines.join('\n');
}

export interface TaintReport {
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    filesAffected: number;
  };
  findings: TaintFinding[];
  recommendations: string[];
}

export function formatReport(findings: TaintFinding[]): TaintReport {
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const filesAffected = new Set<string>();

  for (const finding of findings) {
    bySeverity[finding.severity] =
      (bySeverity[finding.severity] ?? 0) + 1;
    byCategory[finding.flow.sink.category] =
      (byCategory[finding.flow.sink.category] ?? 0) + 1;
    filesAffected.add(finding.flow.source.location.file);
    filesAffected.add(finding.flow.sink.location.file);
  }

  return {
    summary: {
      total: findings.length,
      bySeverity,
      byCategory,
      filesAffected: filesAffected.size,
    },
    findings,
    recommendations: buildRecommendations(findings),
  };
}

function buildRecommendations(findings: TaintFinding[]): string[] {
  const categories = new Set<TaintSinkCategory>(
    findings.map((f) => f.flow.sink.category),
  );
  const recs: string[] = [];

  if (categories.has('sql-query')) {
    recs.push(
      'Use parameterized queries ($1, ?) or an ORM to prevent SQL injection.',
    );
  }
  if (categories.has('shell-exec')) {
    recs.push(
      'Avoid exec/execSync with user input. Use execFile with explicit argument arrays or an allowlist.',
    );
  }
  if (categories.has('html-render')) {
    recs.push(
      'Sanitize HTML output with DOMPurify or use a template engine with auto-escaping enabled.',
    );
  }
  if (categories.has('eval')) {
    recs.push(
      'Eliminate eval() and Function() usage entirely. Use JSON.parse for data or a sandboxed evaluator.',
    );
  }
  if (categories.has('file-write')) {
    recs.push(
      'Validate file paths against an allowlist. Use path.resolve with a locked base directory.',
    );
  }
  if (categories.has('http-response')) {
    recs.push(
      'Validate all response data with zod or joi schemas before sending to clients.',
    );
  }
  if (categories.has('log-output')) {
    recs.push(
      'Implement structured logging and redact PII fields before writing to log sinks.',
    );
  }

  if (findings.length > 0) {
    recs.push(
      'Add input validation at every API boundary using schema validators (zod, joi, yup).',
    );
    recs.push(
      'Implement Content-Security-Policy headers to provide defense-in-depth against XSS.',
    );
  }

  return recs;
}
