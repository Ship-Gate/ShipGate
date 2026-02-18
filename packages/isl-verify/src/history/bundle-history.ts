/**
 * Bundle History Storage
 * 
 * SQLite-based storage for proof bundle history tracking verification over time.
 */

import type { ProofBundle } from '../proof/types.js';

export interface BundleHistoryRecord {
  id: string;
  timestamp: string;
  commit_sha: string | null;
  branch: string | null;
  trust_score: number;
  properties_proven: number;
  properties_partial: number;
  properties_failed: number;
  findings_critical: number;
  findings_high: number;
  findings_medium: number;
  findings_low: number;
  trigger: 'manual' | 'ci' | 'pre-commit';
  bundle_json: string;
  duration_ms: number;
}

export interface FindingHistoryRecord {
  id: string;
  bundle_id: string;
  rule_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line: number;
  message: string;
  first_seen_bundle: string;
  resolved_bundle: string | null;
}

export interface TrendData {
  date: string;
  trust_score: number;
  properties_proven: number;
  findings_count: number;
  bundle_id: string;
}

export interface BundleDiff {
  trustScoreChange: number;
  propertiesChanged: {
    improved: Array<{ property: string; from: string; to: string }>;
    regressed: Array<{ property: string; from: string; to: string }>;
  };
  findingsChanged: {
    opened: FindingHistoryRecord[];
    resolved: FindingHistoryRecord[];
  };
  summary: string;
}

export interface BundleHistoryOptions {
  dbPath?: string;
}

/**
 * Bundle history storage using SQLite
 */
export class BundleHistory {
  private db: any;
  private dbPath: string;

  constructor(options: BundleHistoryOptions = {}) {
    this.dbPath = options.dbPath || '.isl-verify/history.db';
  }

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    const { default: Database } = await import('better-sqlite3');
    const { mkdirSync, existsSync } = await import('fs');
    const { dirname } = await import('path');

    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bundles (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        commit_sha TEXT,
        branch TEXT,
        trust_score INTEGER NOT NULL,
        properties_proven INTEGER NOT NULL,
        properties_partial INTEGER NOT NULL,
        properties_failed INTEGER NOT NULL,
        findings_critical INTEGER NOT NULL,
        findings_high INTEGER NOT NULL,
        findings_medium INTEGER NOT NULL,
        findings_low INTEGER NOT NULL,
        trigger TEXT NOT NULL,
        bundle_json TEXT NOT NULL,
        duration_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bundles_timestamp ON bundles(timestamp);
      CREATE INDEX IF NOT EXISTS idx_bundles_branch ON bundles(branch);
      CREATE INDEX IF NOT EXISTS idx_bundles_commit ON bundles(commit_sha);

      CREATE TABLE IF NOT EXISTS finding_history (
        id TEXT NOT NULL,
        bundle_id TEXT NOT NULL REFERENCES bundles(id),
        rule_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        file TEXT NOT NULL,
        line INTEGER NOT NULL,
        message TEXT NOT NULL,
        first_seen_bundle TEXT NOT NULL,
        resolved_bundle TEXT,
        PRIMARY KEY (id, bundle_id)
      );

      CREATE INDEX IF NOT EXISTS idx_findings_bundle ON finding_history(bundle_id);
      CREATE INDEX IF NOT EXISTS idx_findings_rule ON finding_history(rule_id);
      CREATE INDEX IF NOT EXISTS idx_findings_resolved ON finding_history(resolved_bundle);
    `);
  }

  /**
   * Store a proof bundle in history
   */
  async storeBundle(
    bundle: ProofBundle,
    options: {
      trigger?: 'manual' | 'ci' | 'pre-commit';
      commit?: string | null;
      branch?: string | null;
    } = {}
  ): Promise<void> {
    if (!this.db) await this.initialize();

    const trigger = options.trigger || 'manual';
    const commit_sha = options.commit || bundle.project.commit;
    const branch = options.branch || bundle.project.branch;

    const findingCounts = this.categorizeFindings(bundle);

    const stmt = this.db.prepare(`
      INSERT INTO bundles (
        id, timestamp, commit_sha, branch, trust_score,
        properties_proven, properties_partial, properties_failed,
        findings_critical, findings_high, findings_medium, findings_low,
        trigger, bundle_json, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      bundle.id,
      bundle.timestamp,
      commit_sha,
      branch,
      bundle.summary.trustScore,
      bundle.summary.proven,
      bundle.summary.partial,
      bundle.summary.failed,
      findingCounts.critical,
      findingCounts.high,
      findingCounts.medium,
      findingCounts.low,
      trigger,
      JSON.stringify(bundle),
      bundle.metadata.duration_ms
    );

    await this.updateFindingHistory(bundle);
  }

  /**
   * Get recent bundles
   */
  async getRecentBundles(limit: number = 20, options: {
    since?: string;
    branch?: string;
  } = {}): Promise<BundleHistoryRecord[]> {
    if (!this.db) await this.initialize();

    let query = 'SELECT * FROM bundles WHERE 1=1';
    const params: any[] = [];

    if (options.since) {
      query += ' AND timestamp >= ?';
      params.push(options.since);
    }

    if (options.branch) {
      query += ' AND branch = ?';
      params.push(options.branch);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * Get trend data over time
   */
  async getTrendData(options: {
    since?: string;
    branch?: string;
  } = {}): Promise<TrendData[]> {
    if (!this.db) await this.initialize();

    let query = `
      SELECT 
        timestamp as date,
        trust_score,
        properties_proven,
        (findings_critical + findings_high + findings_medium + findings_low) as findings_count,
        id as bundle_id
      FROM bundles
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options.since) {
      query += ' AND timestamp >= ?';
      params.push(options.since);
    }

    if (options.branch) {
      query += ' AND branch = ?';
      params.push(options.branch);
    }

    query += ' ORDER BY timestamp ASC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * Compare two bundles
   */
  async diffBundles(bundleId1: string, bundleId2: string): Promise<BundleDiff> {
    if (!this.db) await this.initialize();

    const stmt = this.db.prepare('SELECT bundle_json FROM bundles WHERE id = ?');
    const row1 = stmt.get(bundleId1);
    const row2 = stmt.get(bundleId2);

    if (!row1 || !row2) {
      throw new Error('Bundle not found');
    }

    const bundle1: ProofBundle = JSON.parse(row1.bundle_json);
    const bundle2: ProofBundle = JSON.parse(row2.bundle_json);

    const trustScoreChange = bundle2.summary.trustScore - bundle1.summary.trustScore;

    const propertiesChanged = this.diffProperties(bundle1, bundle2);
    const findingsChanged = await this.diffFindings(bundleId1, bundleId2);

    const summary = this.generateDiffSummary(trustScoreChange, propertiesChanged, findingsChanged);

    return {
      trustScoreChange,
      propertiesChanged,
      findingsChanged,
      summary,
    };
  }

  /**
   * Export all bundles as JSON
   */
  async exportBundles(options: {
    since?: string;
    branch?: string;
  } = {}): Promise<ProofBundle[]> {
    const records = await this.getRecentBundles(10000, options);
    return records.map(r => JSON.parse(r.bundle_json));
  }

  /**
   * Calculate regression metrics
   */
  async detectRegressions(windowSize: number = 10): Promise<{
    hasRegression: boolean;
    currentScore: number;
    averageScore: number;
    threshold: number;
  }> {
    if (!this.db) await this.initialize();

    const recent = await this.getRecentBundles(windowSize + 1);

    if (recent.length < 2) {
      return {
        hasRegression: false,
        currentScore: recent[0]?.trust_score || 0,
        averageScore: recent[0]?.trust_score || 0,
        threshold: 0,
      };
    }

    const current = recent[0];
    const historical = recent.slice(1, windowSize + 1);
    const averageScore = historical.reduce((sum, r) => sum + r.trust_score, 0) / historical.length;
    const threshold = averageScore * 0.9; // 10% drop threshold

    return {
      hasRegression: current.trust_score < threshold,
      currentScore: current.trust_score,
      averageScore,
      threshold,
    };
  }

  /**
   * Get mean time to resolve for findings
   */
  async getMeanTimeToResolve(options: {
    since?: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
  } = {}): Promise<number> {
    if (!this.db) await this.initialize();

    let query = `
      SELECT 
        f.first_seen_bundle,
        f.resolved_bundle,
        b1.timestamp as opened_at,
        b2.timestamp as resolved_at
      FROM finding_history f
      JOIN bundles b1 ON f.first_seen_bundle = b1.id
      LEFT JOIN bundles b2 ON f.resolved_bundle = b2.id
      WHERE f.resolved_bundle IS NOT NULL
    `;
    const params: any[] = [];

    if (options.since) {
      query += ' AND b1.timestamp >= ?';
      params.push(options.since);
    }

    if (options.severity) {
      query += ' AND f.severity = ?';
      params.push(options.severity);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    if (rows.length === 0) return 0;

    const totalTime = rows.reduce((sum: number, row: any) => {
      const opened = new Date(row.opened_at).getTime();
      const resolved = new Date(row.resolved_at).getTime();
      return sum + (resolved - opened);
    }, 0);

    return totalTime / rows.length / (1000 * 60 * 60 * 24); // days
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  // Private helper methods

  private categorizeFindings(bundle: ProofBundle): {
    critical: number;
    high: number;
    medium: number;
    low: number;
  } {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const property of bundle.properties) {
      for (const finding of property.findings) {
        if (finding.severity === 'error') {
          if (property.property.includes('auth') || property.property.includes('secret') || property.property.includes('sql')) {
            counts.critical++;
          } else {
            counts.high++;
          }
        } else {
          counts.medium++;
        }
      }
    }

    return counts;
  }

  private async updateFindingHistory(bundle: ProofBundle): Promise<void> {
    const currentFindings = new Map<string, FindingHistoryRecord>();

    for (const property of bundle.properties) {
      for (const finding of property.findings) {
        const findingId = `${finding.file}:${finding.line}:${finding.message}`;
        const severity = this.mapSeverity(finding.severity, property.property);

        currentFindings.set(findingId, {
          id: findingId,
          bundle_id: bundle.id,
          rule_id: property.property,
          severity,
          file: finding.file,
          line: finding.line,
          message: finding.message,
          first_seen_bundle: bundle.id,
          resolved_bundle: null,
        });
      }
    }

    // Get previous bundle to detect resolved findings
    const prevBundle = this.db.prepare(
      'SELECT id FROM bundles WHERE timestamp < ? ORDER BY timestamp DESC LIMIT 1'
    ).get(bundle.timestamp);

    if (prevBundle) {
      const prevFindings = this.db.prepare(
        'SELECT * FROM finding_history WHERE bundle_id = ? AND resolved_bundle IS NULL'
      ).all(prevBundle.id);

      for (const prevFinding of prevFindings) {
        if (!currentFindings.has(prevFinding.id)) {
          // Finding resolved
          this.db.prepare(
            'UPDATE finding_history SET resolved_bundle = ? WHERE id = ? AND resolved_bundle IS NULL'
          ).run(bundle.id, prevFinding.id);
        }
      }
    }

    // Insert new findings
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO finding_history (
        id, bundle_id, rule_id, severity, file, line, message, first_seen_bundle, resolved_bundle
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const finding of currentFindings.values()) {
      insertStmt.run(
        finding.id,
        finding.bundle_id,
        finding.rule_id,
        finding.severity,
        finding.file,
        finding.line,
        finding.message,
        finding.first_seen_bundle,
        finding.resolved_bundle
      );
    }
  }

  private mapSeverity(
    findingSeverity: 'error' | 'warning',
    propertyName: string
  ): 'critical' | 'high' | 'medium' | 'low' {
    if (findingSeverity === 'error') {
      if (propertyName.includes('auth') || propertyName.includes('secret') || propertyName.includes('sql')) {
        return 'critical';
      }
      return 'high';
    }
    return 'medium';
  }

  private diffProperties(bundle1: ProofBundle, bundle2: ProofBundle) {
    const improved: Array<{ property: string; from: string; to: string }> = [];
    const regressed: Array<{ property: string; from: string; to: string }> = [];

    const props1 = new Map(bundle1.properties.map(p => [p.property, p.status]));
    const props2 = new Map(bundle2.properties.map(p => [p.property, p.status]));

    for (const [prop, status2] of props2) {
      const status1 = props1.get(prop);
      if (status1 && status1 !== status2) {
        const statusOrder = { 'FAILED': 0, 'NOT_VERIFIED': 1, 'PARTIAL': 2, 'PROVEN': 3 };
        if (statusOrder[status2] > statusOrder[status1]) {
          improved.push({ property: prop, from: status1, to: status2 });
        } else {
          regressed.push({ property: prop, from: status1, to: status2 });
        }
      }
    }

    return { improved, regressed };
  }

  private async diffFindings(bundleId1: string, bundleId2: string) {
    const findings1 = this.db.prepare(
      'SELECT * FROM finding_history WHERE bundle_id = ?'
    ).all(bundleId1);

    const findings2 = this.db.prepare(
      'SELECT * FROM finding_history WHERE bundle_id = ?'
    ).all(bundleId2);

    const ids1 = new Set(findings1.map((f: any) => f.id));
    const ids2 = new Set(findings2.map((f: any) => f.id));

    const opened = findings2.filter((f: any) => !ids1.has(f.id));
    const resolved = findings1.filter((f: any) => !ids2.has(f.id));

    return { opened, resolved };
  }

  private generateDiffSummary(
    trustScoreChange: number,
    propertiesChanged: ReturnType<typeof this.diffProperties>,
    findingsChanged: { opened: any[]; resolved: any[] }
  ): string {
    const parts: string[] = [];

    if (trustScoreChange > 0) {
      parts.push(`Trust score improved by ${trustScoreChange.toFixed(1)} points`);
    } else if (trustScoreChange < 0) {
      parts.push(`Trust score decreased by ${Math.abs(trustScoreChange).toFixed(1)} points`);
    } else {
      parts.push('Trust score unchanged');
    }

    if (propertiesChanged.improved.length > 0) {
      parts.push(`${propertiesChanged.improved.length} properties improved`);
    }

    if (propertiesChanged.regressed.length > 0) {
      parts.push(`${propertiesChanged.regressed.length} properties regressed`);
    }

    if (findingsChanged.resolved.length > 0) {
      parts.push(`${findingsChanged.resolved.length} findings resolved`);
    }

    if (findingsChanged.opened.length > 0) {
      parts.push(`${findingsChanged.opened.length} new findings`);
    }

    return parts.join(', ');
  }
}
