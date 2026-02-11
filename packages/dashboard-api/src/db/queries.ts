import type { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  CreateReportInput,
  VerificationReport,
  ListReportsQuery,
  TrendPoint,
  DriftAlert,
  CoverageSummary,
  ReportDiff,
  FileResult,
} from '../types.js';

// ── Helpers ────────────────────────────────────────────────────────────

/** Execute a SELECT and return rows as plain objects. */
function queryAll(db: Database, sql: string, params: Record<string, unknown> = {}): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  stmt.bind(prefixParams(params));
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return rows;
}

/** Execute a SELECT and return the first row (or undefined). */
function queryOne(db: Database, sql: string, params: Record<string, unknown> = {}): Record<string, unknown> | undefined {
  const rows = queryAll(db, sql, params);
  return rows[0];
}

/** sql.js requires param keys prefixed with `$` / `:` / `@`. We use `$`. */
function prefixParams(params: Record<string, unknown>): Record<string, unknown> {
  const prefixed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const k = key.startsWith('$') ? key : `$${key}`;
    prefixed[k] = value ?? null;
  }
  return prefixed;
}

function rowToReport(row: Record<string, unknown>): VerificationReport {
  return JSON.parse(row['raw_json'] as string) as VerificationReport;
}

// ── Query factory ──────────────────────────────────────────────────────

export function createQueries(db: Database) {
  // ── INSERT ─────────────────────────────────────────────────────────

  function insertReport(input: CreateReportInput, extendedRaw?: Record<string, unknown>): VerificationReport {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const report: VerificationReport & Record<string, unknown> = { id, timestamp, ...input };
    if (extendedRaw) Object.assign(report, extendedRaw);

    db.run(
      `INSERT INTO reports
        (id, timestamp, repo, branch, commit_sha, pr_number, verdict,
         score, coverage_specced, coverage_total, coverage_pct,
         duration_ms, triggered_by, raw_json)
       VALUES
        ($id, $timestamp, $repo, $branch, $commit_sha, $pr_number, $verdict,
         $score, $coverage_specced, $coverage_total, $coverage_pct,
         $duration_ms, $triggered_by, $raw_json)`,
      prefixParams({
        id,
        timestamp,
        repo: input.repo,
        branch: input.branch,
        commit_sha: input.commit,
        pr_number: input.pr ?? null,
        verdict: input.verdict,
        score: input.score,
        coverage_specced: input.coverage.specced,
        coverage_total: input.coverage.total,
        coverage_pct: input.coverage.percentage,
        duration_ms: input.duration,
        triggered_by: input.triggeredBy,
        raw_json: JSON.stringify(report),
      }),
    );

    return report as VerificationReport;
  }

  function insertReportWithProofBundle(
    input: CreateReportInput,
    proofBundle: Record<string, unknown>,
  ): VerificationReport {
    return insertReport(input, { proofBundle });
  }

  // ── SELECT ONE ─────────────────────────────────────────────────────

  function getReport(id: string): VerificationReport | undefined {
    const row = queryOne(db, 'SELECT raw_json FROM reports WHERE id = $id', { id });
    return row ? rowToReport(row) : undefined;
  }

  // ── LIST (paginated + filtered) ────────────────────────────────────

  function listReports(query: ListReportsQuery): {
    reports: VerificationReport[];
    total: number;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (query.repo) {
      conditions.push('repo = $repo');
      params['repo'] = query.repo;
    }
    if (query.branch) {
      conditions.push('branch = $branch');
      params['branch'] = query.branch;
    }
    if (query.verdict) {
      conditions.push('verdict = $verdict');
      params['verdict'] = query.verdict;
    }
    if (query.triggeredBy) {
      conditions.push('triggered_by = $triggeredBy');
      params['triggeredBy'] = query.triggeredBy;
    }
    if (query.from) {
      conditions.push('timestamp >= $from');
      params['from'] = query.from;
    }
    if (query.to) {
      conditions.push('timestamp <= $to');
      params['to'] = query.to;
    }
    if (query.q) {
      conditions.push('(repo LIKE $q OR branch LIKE $q OR commit_sha LIKE $q)');
      params['q'] = `%${query.q}%`;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (query.page - 1) * query.limit;

    const countRow = queryOne(
      db,
      `SELECT COUNT(*) as cnt FROM reports ${where}`,
      params,
    );
    const total = (countRow?.['cnt'] as number) ?? 0;

    const rows = queryAll(
      db,
      `SELECT raw_json FROM reports ${where}
       ORDER BY timestamp DESC
       LIMIT $limit OFFSET $offset`,
      { ...params, limit: query.limit, offset },
    );

    return {
      reports: rows.map(rowToReport),
      total,
    };
  }

  // ── COVERAGE SUMMARY ───────────────────────────────────────────────

  function getCoverageSummary(repo?: string): CoverageSummary[] {
    const repoClause = repo ? 'WHERE repo = $repo' : '';
    const innerClause = repo ? 'WHERE repo = $repo' : '';
    const params: Record<string, unknown> = repo ? { repo } : {};

    const sql = `
      SELECT raw_json
      FROM reports r
      INNER JOIN (
        SELECT repo, MAX(timestamp) AS max_ts
        FROM reports
        ${innerClause}
        GROUP BY repo
      ) latest ON r.repo = latest.repo AND r.timestamp = latest.max_ts
    `;

    const rows = queryAll(db, sql, params);

    return rows.map((row) => {
      const report = rowToReport(row);
      const islCount = report.files.filter((f) => f.method === 'isl').length;
      const speclessCount = report.files.filter((f) => f.method === 'specless').length;

      return {
        repo: report.repo,
        totalFiles: report.coverage.total,
        speccedFiles: report.coverage.specced,
        coveragePercentage: report.coverage.percentage,
        byMethod: { isl: islCount, specless: speclessCount },
        lastUpdated: report.timestamp,
      };
    });
  }

  // ── TRENDS ─────────────────────────────────────────────────────────

  function getTrends(repo: string, days: number, branch?: string): TrendPoint[] {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const branchClause = branch ? 'AND branch = $branch' : '';
    const params: Record<string, unknown> = { repo, since };
    if (branch) params['branch'] = branch;

    const sql = `
      SELECT
        DATE(timestamp) AS date,
        AVG(score)       AS avgScore,
        COUNT(*)         AS reportCount,
        AVG(coverage_pct) AS coveragePercentage
      FROM reports
      WHERE repo = $repo AND timestamp >= $since ${branchClause}
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `;

    const rows = queryAll(db, sql, params);

    return rows.map((r) => ({
      date: r['date'] as string,
      avgScore: Math.round((r['avgScore'] as number) * 100) / 100,
      reportCount: r['reportCount'] as number,
      coveragePercentage: Math.round((r['coveragePercentage'] as number) * 100) / 100,
    }));
  }

  // ── DRIFT ALERTS ───────────────────────────────────────────────────

  function getDriftAlerts(repo: string, threshold: number): DriftAlert[] {
    // Step 1: Get all distinct branches for this repo
    const branches = queryAll(
      db,
      'SELECT DISTINCT branch FROM reports WHERE repo = $repo',
      { repo },
    );

    const alerts: DriftAlert[] = [];

    // Step 2: For each branch, get the two most recent reports and compare
    for (const branchRow of branches) {
      const branch = branchRow['branch'] as string;
      const recent = queryAll(
        db,
        `SELECT score, commit_sha, timestamp
         FROM reports
         WHERE repo = $repo AND branch = $branch
         ORDER BY timestamp DESC
         LIMIT 2`,
        { repo, branch },
      );

      if (recent.length < 2) continue;

      const current = recent[0]!;
      const previous = recent[1]!;
      const currentScore = current['score'] as number;
      const previousScore = previous['score'] as number;

      if (Math.abs(currentScore - previousScore) < threshold) continue;

      const delta = Math.round((currentScore - previousScore) * 100) / 100;

      alerts.push({
        repo,
        branch,
        currentScore,
        previousScore,
        delta,
        direction: delta >= 0 ? 'improving' : 'degrading',
        commit: current['commit_sha'] as string,
        timestamp: current['timestamp'] as string,
      });
    }

    return alerts;
  }

  // ── DIFF (compare to previous run on same repo+branch) ───────────────

  function getReportDiff(id: string): ReportDiff | undefined {
    const current = getReport(id);
    if (!current) return undefined;

    const previousRows = queryAll(
      db,
      `SELECT raw_json FROM reports
       WHERE repo = $repo AND branch = $branch AND timestamp < $timestamp
       ORDER BY timestamp DESC LIMIT 1`,
      { repo: current.repo, branch: current.branch, timestamp: current.timestamp },
    );
    const previous = previousRows[0] ? rowToReport(previousRows[0]) : null;

    const prevByPath = new Map<string, FileResult>();
    if (previous) {
      for (const f of previous.files) prevByPath.set(f.path, f);
    }

    const newFailures: FileResult[] = [];
    const resolved: FileResult[] = [];

    for (const f of current.files) {
      const prev = prevByPath.get(f.path);
      if (f.verdict === 'fail' || f.verdict === 'warn') {
        if (!prev || prev.verdict === 'pass') newFailures.push(f);
      } else {
        if (prev && (prev.verdict === 'fail' || prev.verdict === 'warn')) resolved.push(f);
      }
    }

    return { current, previous, newFailures, resolved };
  }

  return {
    insertReport,
    insertReportWithProofBundle,
    getReport,
    getReportDiff,
    listReports,
    getCoverageSummary,
    getTrends,
    getDriftAlerts,
  };
}

export type Queries = ReturnType<typeof createQueries>;
