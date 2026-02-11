#!/usr/bin/env npx tsx
/**
 * Shipgate Evidence Export
 *
 * Exports anonymized metrics from gate runs for dashboards and case studies.
 *
 * Usage:
 *   pnpm shipgate:evidence:export
 *   pnpm shipgate:evidence:export --output metrics.json
 *   pnpm shipgate:evidence:export --format summary --anonymize
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const DEFAULT_RUNS_DIR = '.shipgate/runs';

interface GateRunRecord {
  runId: string;
  timestamp: string;
  verdict: string;
  violations: Array<{ policyId: string; file?: string }>;
}

async function loadRuns(runsDir: string): Promise<GateRunRecord[]> {
  const runs: GateRunRecord[] = [];
  let entries: import('fs').Dirent[];

  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const ent of entries) {
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

async function main() {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf('--output');
  const formatIdx = args.indexOf('--format');
  const anonymize = args.includes('--anonymize');

  const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;
  const format = formatIdx >= 0 ? (args[formatIdx + 1] as 'json' | 'summary') : 'summary';

  const root = process.cwd();
  const runsDir = path.join(root, DEFAULT_RUNS_DIR);

  const runs = await loadRuns(runsDir);

  const blockedRuns = runs.filter((r) => r.verdict === 'NO_SHIP').length;
  const violationsByRule: Record<string, { count: number; files: string[] }> = {};

  for (const run of runs) {
    const violations = Array.isArray(run.violations) ? run.violations : [];
    for (const v of violations) {
      const key = v.policyId;
      if (!violationsByRule[key]) {
        violationsByRule[key] = { count: 0, files: [] };
      }
      violationsByRule[key].count++;
      const file = v.file ?? 'unknown';
      if (file !== 'unknown' && !violationsByRule[key].files.includes(file)) {
        violationsByRule[key].files.push(anonymize ? path.basename(file) : file);
      }
    }
  }

  const metrics = {
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

  const output =
    format === 'json'
      ? JSON.stringify(metrics, null, 2)
      : formatSummary(metrics);

  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, output, 'utf-8');
    console.log(`Exported to ${outputPath}`);
  } else {
    console.log(output);
  }
}

function formatSummary(m: {
  totalRuns: number;
  blockedRuns: number;
  passRate: number;
  violationsByRule: Record<string, { count: number; files: string[] }>;
}): string {
  const lines: string[] = [];
  lines.push('Shipgate Evidence Summary');
  lines.push('─'.repeat(40));
  lines.push(`Total runs: ${m.totalRuns}`);
  lines.push(`Blocked (NO_SHIP): ${m.blockedRuns}`);
  lines.push(`Pass rate: ${(m.passRate * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('Violations by rule:');
  for (const [rule, data] of Object.entries(m.violationsByRule).sort(
    (a, b) => b[1].count - a[1].count
  )) {
    lines.push(`  ${rule}: ${data.count}`);
  }
  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
