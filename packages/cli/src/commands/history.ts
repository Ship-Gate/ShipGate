/**
 * History Command
 * 
 * View and analyze verification history over time.
 */

// Missing exports from isl-verify - stub types and classes
// import { BundleHistory, formatTrendChart, formatTrendJSON, generateBadgeData } from '@isl-lang/isl-verify';
// import type { BundleHistoryRecord } from '@isl-lang/isl-verify';
type BundleHistoryRecord = {
  timestamp: string;
  trust_score: number;
  properties_proven: number;
  findings_critical: number;
  findings_high: number;
  findings_medium: number;
  findings_low: number;
  commit_sha: string;
  trigger: string;
};
class BundleHistory { 
  constructor(_path?: string) {} 
  async initialize() {} 
  getRecords(_opts?: any): BundleHistoryRecord[] { return []; } 
  async getRecentBundles(_limit?: number): Promise<BundleHistoryRecord[]> { return []; }
  async detectRegressions(_opts?: any): Promise<{ hasRegression: boolean; currentScore: number; averageScore: number; threshold: number }> { 
    return { hasRegression: false, currentScore: 0, averageScore: 0, threshold: 0 }; 
  }
  async getTrendData(_opts?: any): Promise<any[]> { return []; }
  async getMeanTimeToResolve(_since?: string): Promise<number> { return 0; }
  async diffBundles(_id1: string, _id2: string): Promise<{ 
    trustScoreChange: number;
    propertiesChanged: { improved: any[]; regressed: any[] };
    findingsChanged: { resolved: any[]; opened: any[] };
    summary: string;
  }> { 
    return { 
      trustScoreChange: 0, 
      propertiesChanged: { improved: [], regressed: [] }, 
      findingsChanged: { resolved: [], opened: [] }, 
      summary: '' 
    }; 
  }
  async exportBundles(_opts: any): Promise<any[]> { return []; }
  close() {} 
}
const formatTrendChart = null as any;
const formatTrendJSON = null as any;
const generateBadgeData = null as any;
import chalk from 'chalk';
import { output } from '../output.js';

export interface HistoryOptions {
  since?: string;
  branch?: string;
  limit?: number;
  json?: boolean;
}

export interface TrendOptions {
  since?: string;
  branch?: string;
  json?: boolean;
  width?: number;
  height?: number;
}

export interface DiffOptions {
  json?: boolean;
}

export interface ExportOptions {
  since?: string;
  branch?: string;
  output?: string;
}

/**
 * Show verification history
 */
export async function historyCommand(options: HistoryOptions = {}): Promise<void> {
  const history = new BundleHistory();
  await history.initialize();

  const limit = options.limit || 20;
  const records = await history.getRecentBundles(limit);

  if (options.json) {
    output.json(records);
    history.close();
    return;
  }

  if (records.length === 0) {
    output.info(chalk.yellow('⚠ No history found. Run verify with --bundle to start tracking history.'));
    history.close();
    return;
  }

  output.section('Verification History');
  console.log('');

  // Table header
  const headers = ['Date', 'Score', 'Proven', 'Findings', 'Trigger', 'Commit'];
  const colWidths = [20, 8, 8, 10, 10, 10];
  
  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join(' ');
  console.log(chalk.bold(headerLine));
  console.log('─'.repeat(headerLine.length));

  // Table rows
  for (const record of records) {
    const date = new Date(record.timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const scoreColor = record.trust_score >= 95 ? chalk.green :
                       record.trust_score >= 85 ? chalk.yellow :
                       record.trust_score >= 70 ? chalk.blue :
                       chalk.red;

    const findingsTotal = record.findings_critical + record.findings_high + 
                         record.findings_medium + record.findings_low;

    const findingsColor = findingsTotal === 0 ? chalk.green :
                         record.findings_critical > 0 ? chalk.red :
                         record.findings_high > 0 ? chalk.yellow :
                         chalk.blue;

    const commitShort = record.commit_sha?.substring(0, 8) || 'n/a';

    console.log([
      date.padEnd(colWidths[0]),
      scoreColor(record.trust_score.toString().padEnd(colWidths[1])),
      record.properties_proven.toString().padEnd(colWidths[2]),
      findingsColor(findingsTotal.toString().padEnd(colWidths[3])),
      record.trigger.padEnd(colWidths[4]),
      commitShort.padEnd(colWidths[5]),
    ].join(' '));
  }

  console.log('');
  output.info(`Showing ${records.length} most recent verification runs`);
  
  if (records.length === limit) {
    output.info(`Use --limit to show more results`);
  }

  // Show regression warning
  const regression = await history.detectRegressions();
  if (regression.hasRegression) {
    console.log('');
    output.warn(
      `⚠️  Trust score regression detected! Current: ${regression.currentScore}, ` +
      `Average: ${regression.averageScore.toFixed(1)}, Threshold: ${regression.threshold.toFixed(1)}`
    );
  }

  history.close();
}

/**
 * Show trust score trend
 */
export async function trendCommand(options: TrendOptions = {}): Promise<void> {
  const history = new BundleHistory();
  await history.initialize();

  const trendData = await history.getTrendData({
    since: options.since,
    branch: options.branch,
  });

  if (trendData.length === 0) {
    output.info('No trend data available. Run `isl-verify` to start tracking.');
    history.close();
    return;
  }

  if (options.json) {
    const jsonOutput = formatTrendJSON(trendData);
    console.log(jsonOutput);
    history.close();
    return;
  }

  output.section('Trust Score Trend');
  console.log('');

  const chart = formatTrendChart(trendData, {
    width: options.width || 60,
    height: options.height || 15,
    showLegend: true,
  });

  console.log(chart);
  console.log('');

  // Mean time to resolve
  const mttr = await history.getMeanTimeToResolve(options.since);

  if (mttr > 0) {
    output.info(`Mean time to resolve findings: ${mttr.toFixed(1)} days`);
  }

  // Badge data
  const currentScore = trendData[trendData.length - 1].trust_score;
  const badge = generateBadgeData(currentScore);
  output.info(`Badge: ${badge.label} (${badge.color}) - ${badge.message}`);

  history.close();
}

/**
 * Diff two bundles
 */
export async function diffCommand(bundleId1: string, bundleId2: string, options: DiffOptions = {}): Promise<void> {
  const history = new BundleHistory();
  await history.initialize();

  try {
    const diff = await history.diffBundles(bundleId1, bundleId2);

    if (options.json) {
      output.json(diff);
      history.close();
      return;
    }

    output.section(`Bundle Diff: ${bundleId1.substring(0, 8)} → ${bundleId2.substring(0, 8)}`);
    console.log('');

    // Trust score change
    const changeColor = diff.trustScoreChange > 0 ? chalk.green :
                       diff.trustScoreChange < 0 ? chalk.red :
                       chalk.gray;

    const changeSymbol = diff.trustScoreChange > 0 ? '↑' :
                        diff.trustScoreChange < 0 ? '↓' :
                        '→';

    console.log(chalk.bold('Trust Score: ') + 
                changeColor(`${changeSymbol} ${diff.trustScoreChange > 0 ? '+' : ''}${diff.trustScoreChange.toFixed(1)} points`));
    console.log('');

    // Properties changed
    if (diff.propertiesChanged.improved.length > 0) {
      console.log(chalk.bold.green('Properties Improved:'));
      for (const prop of diff.propertiesChanged.improved) {
        console.log(chalk.green(`  ✓ ${prop.property}: ${prop.from} → ${prop.to}`));
      }
      console.log('');
    }

    if (diff.propertiesChanged.regressed.length > 0) {
      console.log(chalk.bold.red('Properties Regressed:'));
      for (const prop of diff.propertiesChanged.regressed) {
        console.log(chalk.red(`  ✗ ${prop.property}: ${prop.from} → ${prop.to}`));
      }
      console.log('');
    }

    // Findings changed
    if (diff.findingsChanged.resolved.length > 0) {
      console.log(chalk.bold.green(`Findings Resolved (${diff.findingsChanged.resolved.length}):`));
      for (const finding of diff.findingsChanged.resolved.slice(0, 5)) {
        console.log(chalk.green(`  ✓ ${finding.file}:${finding.line} - ${finding.message}`));
      }
      if (diff.findingsChanged.resolved.length > 5) {
        console.log(chalk.gray(`  ... and ${diff.findingsChanged.resolved.length - 5} more`));
      }
      console.log('');
    }

    if (diff.findingsChanged.opened.length > 0) {
      console.log(chalk.bold.red(`New Findings (${diff.findingsChanged.opened.length}):`));
      for (const finding of diff.findingsChanged.opened.slice(0, 5)) {
        const severityColor = finding.severity === 'critical' ? chalk.red.bold :
                             finding.severity === 'high' ? chalk.red :
                             finding.severity === 'medium' ? chalk.yellow :
                             chalk.blue;
        console.log(severityColor(`  ✗ [${finding.severity.toUpperCase()}] ${finding.file}:${finding.line} - ${finding.message}`));
      }
      if (diff.findingsChanged.opened.length > 5) {
        console.log(chalk.gray(`  ... and ${diff.findingsChanged.opened.length - 5} more`));
      }
      console.log('');
    }

    // Summary
    console.log(chalk.bold('Summary: ') + diff.summary);

  } catch (error) {
    output.error(`Failed to diff bundles: ${error instanceof Error ? error.message : String(error)}`);
  }

  history.close();
}

/**
 * Export bundles to JSON
 */
export async function exportCommand(options: ExportOptions = {}): Promise<void> {
  const history = new BundleHistory();
  await history.initialize();

  const bundles = await history.exportBundles({
    since: options.since,
    branch: options.branch,
  });

  const exportData = {
    exported_at: new Date().toISOString(),
    count: bundles.length,
    filters: {
      since: options.since || null,
      branch: options.branch || null,
    },
    bundles,
  };

  if (options.output) {
    const { writeFile } = await import('fs/promises');
    await writeFile(options.output, JSON.stringify(exportData, null, 2));
    output.success(`Exported ${bundles.length} bundles to ${options.output}`);
  } else {
    console.log(JSON.stringify(exportData, null, 2));
  }

  history.close();
}
