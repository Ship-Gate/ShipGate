import type {
  TrafficStats,
  SpecViolation,
  Anomaly,
  TrafficReport,
  ViolationSeverity,
} from './types.js';

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

export function generateReport(
  stats: TrafficStats,
  violations: SpecViolation[],
  anomalies: Anomaly[],
): TrafficReport {
  return {
    summary: buildSummary(stats, violations, anomalies),
    violations,
    anomalies,
    recommendations: buildRecommendations(stats, violations, anomalies),
    generatedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Markdown formatting
// ---------------------------------------------------------------------------

export function formatMarkdown(report: TrafficReport): string {
  const lines: string[] = [];

  lines.push('# Traffic Verification Report');
  lines.push('');
  lines.push(`> Generated at: ${new Date(report.generatedAt).toISOString()}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(report.summary);
  lines.push('');

  // Violations
  if (report.violations.length > 0) {
    lines.push('## Spec Violations');
    lines.push('');
    lines.push(`Total: **${report.violations.length}**`);
    lines.push('');

    const bySeverity = groupBy(report.violations, (v) => v.severity);
    for (const severity of SEVERITY_ORDER) {
      const group = bySeverity.get(severity);
      if (!group || group.length === 0) continue;

      lines.push(`### ${severityLabel(severity)} (${group.length})`);
      lines.push('');
      lines.push('| Route | Type | Expected | Actual |');
      lines.push('|-------|------|----------|--------|');
      for (const v of group) {
        lines.push(
          `| \`${v.route}\` | ${v.type} | ${escapeCell(v.expected)} | ${escapeCell(v.actual)} |`,
        );
      }
      lines.push('');
    }
  } else {
    lines.push('## Spec Violations');
    lines.push('');
    lines.push('No violations detected.');
    lines.push('');
  }

  // Anomalies
  if (report.anomalies.length > 0) {
    lines.push('## Anomalies');
    lines.push('');

    for (const a of report.anomalies) {
      lines.push(
        `- ${severityBadge(a.severity)} **${a.type}**: ${a.details} ` +
          `_(${new Date(a.detectedAt).toISOString()})_`,
      );
    }
    lines.push('');
  } else {
    lines.push('## Anomalies');
    lines.push('');
    lines.push('No anomalies detected.');
    lines.push('');
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(
  stats: TrafficStats,
  violations: SpecViolation[],
  anomalies: Anomaly[],
): string {
  const parts: string[] = [];

  parts.push(
    `Sampled **${stats.totalSampled}** requests. ` +
      `**${stats.violations}** violations detected ` +
      `(${(stats.violationRate * 100).toFixed(1)}% violation rate).`,
  );

  parts.push(
    `Latency: p50=${Math.round(stats.latencyP50)}ms, ` +
      `p95=${Math.round(stats.latencyP95)}ms, ` +
      `p99=${Math.round(stats.latencyP99)}ms. ` +
      `Error rate: ${(stats.errorRate * 100).toFixed(2)}%.`,
  );

  const criticalViolations = violations.filter((v) => v.severity === 'critical');
  const criticalAnomalies = anomalies.filter((a) => a.severity === 'critical');

  if (criticalViolations.length > 0 || criticalAnomalies.length > 0) {
    parts.push(
      `**Action required**: ${criticalViolations.length} critical violation(s), ` +
        `${criticalAnomalies.length} critical anomaly/anomalies.`,
    );
  }

  if (stats.topViolations.length > 0) {
    const topRoute = stats.topViolations[0];
    parts.push(
      `Top offender: \`${topRoute.route}\` with ${topRoute.count} ${topRoute.type} violations.`,
    );
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Recommendation engine
// ---------------------------------------------------------------------------

function buildRecommendations(
  stats: TrafficStats,
  violations: SpecViolation[],
  anomalies: Anomaly[],
): string[] {
  const recs: string[] = [];

  const authViolations = violations.filter((v) => v.type === 'auth');
  if (authViolations.length > 0) {
    const routes = uniqueValues(authViolations.map((v) => v.route));
    recs.push(
      `Review auth middleware for ${routes.length} route(s) responding successfully ` +
        `without authorization headers: ${routes.map((r) => `\`${r}\``).join(', ')}`,
    );
  }

  const shapeViolations = violations.filter((v) => v.type === 'response-shape');
  if (shapeViolations.length > 0) {
    recs.push(
      `${shapeViolations.length} response shape violation(s) — verify that API ` +
        `implementations match entity definitions in the ISL specs.`,
    );
  }

  if (stats.latencyP99 > 1_000) {
    recs.push(
      `p99 latency is ${Math.round(stats.latencyP99)}ms. Consider profiling slow ` +
        `endpoints and evaluating caching or database query optimization.`,
    );
  }

  if (stats.errorRate > 0.05) {
    recs.push(
      `Error rate is ${(stats.errorRate * 100).toFixed(1)}% — investigate 5xx responses ` +
        `and consider adding circuit breakers for downstream dependencies.`,
    );
  }

  const schemaDrift = anomalies.filter((a) => a.type === 'schema-drift');
  if (schemaDrift.length > 0) {
    recs.push(
      `Schema drift detected on ${schemaDrift.length} route(s). Ensure response shapes ` +
        `are consistent and spec files are up-to-date.`,
    );
  }

  const latencySpikes = anomalies.filter((a) => a.type === 'latency-spike');
  if (latencySpikes.length > 0) {
    recs.push(
      `${latencySpikes.length} latency spike(s) detected. Check for resource contention, ` +
        `GC pauses, or sudden traffic increases.`,
    );
  }

  if (recs.length === 0) {
    recs.push('No action items — traffic is conformant with specifications.');
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: ViolationSeverity[] = ['critical', 'high', 'medium', 'low'];

function severityLabel(s: ViolationSeverity): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function severityBadge(s: ViolationSeverity): string {
  switch (s) {
    case 'critical':
      return '[CRIT]';
    case 'high':
      return '[HIGH]';
    case 'medium':
      return '[MED]';
    case 'low':
      return '[LOW]';
  }
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}

function uniqueValues(arr: string[]): string[] {
  return [...new Set(arr)];
}
