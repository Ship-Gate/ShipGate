/**
 * Shipgate Metrics - Evidence & run persistence
 *
 * Records gate runs for blocked PR metrics and rule calibration.
 * Exports anonymized metrics for dashboards and case studies.
 *
 * @module @isl-lang/shipgate-metrics
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface GateRunViolation {
  policyId: string;
  message: string;
  severity: string;
  tier: string;
  file?: string;
}

export interface GateRunRecord {
  runId: string;
  timestamp: string;
  verdict: 'SHIP' | 'NO_SHIP' | 'WARN';
  score: number;
  filesChecked: number;
  violations: GateRunViolation[];
  source: 'firewall' | 'pre-commit' | 'pre-push' | 'ci' | 'mcp';
  durationMs?: number;
}

export interface ExportOptions {
  runsDir?: string;
  outputPath?: string;
  format?: 'json' | 'summary';
  anonymize?: boolean;
}

export interface ExportedMetrics {
  totalRuns: number;
  blockedRuns: number;
  passRate: number;
  violationsByRule: Record<string, { count: number; files: string[] }>;
  recentRuns: Array<{
    runId: string;
    timestamp: string;
    verdict: string;
  }>;
}

const DEFAULT_RUNS_DIR = '.shipgate/runs';

/**
 * Generate a unique run ID
 */
function generateRunId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[:-]/g, '').slice(0, 15);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}`;
}

/**
 * Record a gate run to the evidence store
 */
export async function recordGateRun(
  record: Omit<GateRunRecord, 'runId' | 'timestamp'>,
  options: { runsDir?: string; projectRoot?: string } = {}
): Promise<string> {
  const root = options.projectRoot ?? process.cwd();
  const runsDir = path.join(root, options.runsDir ?? DEFAULT_RUNS_DIR);

  const runId = generateRunId();
  const fullRecord: GateRunRecord = {
    ...record,
    runId,
    timestamp: new Date().toISOString(),
  };

  const runDir = path.join(runsDir, runId);
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(
    path.join(runDir, 'manifest.json'),
    JSON.stringify(fullRecord, null, 2),
    'utf-8'
  );

  // Update latest symlink/file for easy access
  const latestPath = path.join(runsDir, 'latest.json');
  await fs.writeFile(latestPath, JSON.stringify(fullRecord, null, 2), 'utf-8');

  return runId;
}

/**
 * Load all run manifests from the runs directory
 */
async function loadRuns(runsDir: string): Promise<GateRunRecord[]> {
  const runs: GateRunRecord[] = [];

  let dirEntries;
  try {
    dirEntries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const ent of dirEntries) {
    if (!ent.isDirectory() || ent.name === 'latest') continue;
    const manifestPath = path.join(runsDir, ent.name, 'manifest.json');
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const record = JSON.parse(content) as GateRunRecord;
      runs.push(record);
    } catch {
      // Skip invalid manifests
    }
  }

  return runs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Export evidence metrics for dashboards and case studies
 */
export async function exportEvidence(options: ExportOptions = {}): Promise<ExportedMetrics> {
  const root = process.cwd();
  const runsDir = path.join(root, options.runsDir ?? DEFAULT_RUNS_DIR);

  const runs = await loadRuns(runsDir);

  const blockedRuns = runs.filter((r) => r.verdict === 'NO_SHIP').length;
  const violationsByRule: Record<string, { count: number; files: string[] }> = {};

  for (const run of runs) {
    for (const v of run.violations) {
      const key = v.policyId;
      if (!violationsByRule[key]) {
        violationsByRule[key] = { count: 0, files: [] };
      }
      violationsByRule[key].count++;
      const file = v.file ?? 'unknown';
      if (file !== 'unknown' && !violationsByRule[key].files.includes(file)) {
        violationsByRule[key].files.push(file);
      }
    }
  }

  // Anonymize file paths if requested
  if (options.anonymize) {
    for (const rule of Object.values(violationsByRule)) {
      rule.files = rule.files.map((f) => path.basename(f) || 'anon');
    }
  }

  const metrics: ExportedMetrics = {
    totalRuns: runs.length,
    blockedRuns,
    passRate: runs.length > 0 ? 1 - blockedRuns / runs.length : 1,
    violationsByRule,
    recentRuns: runs.slice(0, 20).map((r) => ({
      runId: r.runId,
      timestamp: r.timestamp,
      verdict: r.verdict,
    })),
  };

  if (options.outputPath) {
    await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
    await fs.writeFile(
      options.outputPath,
      options.format === 'json'
        ? JSON.stringify(metrics, null, 2)
        : formatSummary(metrics),
      'utf-8'
    );
  }

  return metrics;
}

function formatSummary(m: ExportedMetrics): string {
  const lines: string[] = [];
  lines.push('# Shipgate Evidence Summary');
  lines.push('');
  lines.push(`Total runs: ${m.totalRuns}`);
  lines.push(`Blocked (NO_SHIP): ${m.blockedRuns}`);
  lines.push(`Pass rate: ${(m.passRate * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('## Violations by Rule');
  for (const [rule, data] of Object.entries(m.violationsByRule).sort(
    (a, b) => b[1].count - a[1].count
  )) {
    lines.push(`- ${rule}: ${data.count} (files: ${data.files.length})`);
  }
  lines.push('');
  lines.push('## Recent Runs');
  for (const r of m.recentRuns) {
    lines.push(`- ${r.timestamp} ${r.verdict} ${r.runId}`);
  }
  return lines.join('\n');
}
