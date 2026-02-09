/**
 * Backbone queries — CRUD for orgs / projects / runs / artifacts / verdicts.
 */

import type { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  Org,
  Project,
  Run,
  Artifact,
  Verdict,
  RunWithDetails,
  CreateOrgInput,
  CreateProjectInput,
  SubmitRunInput,
  ListRunsQuery,
} from './types.js';

// ── SQL helpers (same pattern as db/queries.ts) ────────────────────────

function prefixParams(params: Record<string, unknown>): Record<string, unknown> {
  const prefixed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const k = key.startsWith('$') ? key : `$${key}`;
    prefixed[k] = value ?? null;
  }
  return prefixed;
}

function queryAll(
  db: Database,
  sql: string,
  params: Record<string, unknown> = {},
): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  stmt.bind(prefixParams(params));
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return rows;
}

function queryOne(
  db: Database,
  sql: string,
  params: Record<string, unknown> = {},
): Record<string, unknown> | undefined {
  return queryAll(db, sql, params)[0];
}

// ── Row → entity mappers ───────────────────────────────────────────────

function rowToOrg(r: Record<string, unknown>): Org {
  return {
    id: r['id'] as string,
    name: r['name'] as string,
    createdAt: r['created_at'] as string,
  };
}

function rowToProject(r: Record<string, unknown>): Project {
  return {
    id: r['id'] as string,
    orgId: r['org_id'] as string,
    name: r['name'] as string,
    repoUrl: (r['repo_url'] as string) || null,
    createdAt: r['created_at'] as string,
  };
}

function rowToRun(r: Record<string, unknown>): Run {
  const metaRaw = r['meta_json'] as string | null;
  return {
    id: r['id'] as string,
    projectId: r['project_id'] as string,
    commitSha: (r['commit_sha'] as string) || null,
    branch: (r['branch'] as string) || null,
    trigger: r['trigger'] as Run['trigger'],
    status: r['status'] as Run['status'],
    startedAt: r['started_at'] as string,
    finishedAt: (r['finished_at'] as string) || null,
    meta: metaRaw ? (JSON.parse(metaRaw) as Record<string, unknown>) : null,
  };
}

function rowToArtifact(r: Record<string, unknown>): Artifact {
  const metaRaw = r['meta_json'] as string | null;
  return {
    id: r['id'] as string,
    runId: r['run_id'] as string,
    kind: r['kind'] as Artifact['kind'],
    path: r['path'] as string,
    sha256: (r['sha256'] as string) || null,
    sizeBytes: (r['size_bytes'] as number) ?? null,
    meta: metaRaw ? (JSON.parse(metaRaw) as Record<string, unknown>) : null,
    createdAt: r['created_at'] as string,
  };
}

function rowToVerdict(r: Record<string, unknown>): Verdict {
  const ruleIdsRaw = r['rule_ids'] as string | null;
  return {
    id: r['id'] as string,
    runId: r['run_id'] as string,
    verdict: r['verdict'] as Verdict['verdict'],
    score: r['score'] as number,
    reason: (r['reason'] as string) || null,
    ruleIds: ruleIdsRaw ? (JSON.parse(ruleIdsRaw) as string[]) : [],
    createdAt: r['created_at'] as string,
  };
}

// ── Query factory ──────────────────────────────────────────────────────

export function createBackboneQueries(db: Database) {
  // ── Orgs ───────────────────────────────────────────────────────────

  function createOrg(input: CreateOrgInput): Org {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      'INSERT INTO orgs (id, name, created_at) VALUES ($id, $name, $created_at)',
      prefixParams({ id, name: input.name, created_at: now }),
    );
    return { id, name: input.name, createdAt: now };
  }

  function getOrg(id: string): Org | undefined {
    const row = queryOne(db, 'SELECT * FROM orgs WHERE id = $id', { id });
    return row ? rowToOrg(row) : undefined;
  }

  function listOrgs(): Org[] {
    return queryAll(db, 'SELECT * FROM orgs ORDER BY created_at DESC').map(rowToOrg);
  }

  // ── Projects ───────────────────────────────────────────────────────

  function createProject(input: CreateProjectInput): Project {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO projects (id, org_id, name, repo_url, created_at)
       VALUES ($id, $org_id, $name, $repo_url, $created_at)`,
      prefixParams({
        id,
        org_id: input.orgId,
        name: input.name,
        repo_url: input.repoUrl ?? null,
        created_at: now,
      }),
    );
    return { id, orgId: input.orgId, name: input.name, repoUrl: input.repoUrl ?? null, createdAt: now };
  }

  function getProject(id: string): Project | undefined {
    const row = queryOne(db, 'SELECT * FROM projects WHERE id = $id', { id });
    return row ? rowToProject(row) : undefined;
  }

  function listProjects(orgId?: string): Project[] {
    if (orgId) {
      return queryAll(
        db,
        'SELECT * FROM projects WHERE org_id = $org_id ORDER BY created_at DESC',
        { org_id: orgId },
      ).map(rowToProject);
    }
    return queryAll(db, 'SELECT * FROM projects ORDER BY created_at DESC').map(rowToProject);
  }

  // ── Runs ───────────────────────────────────────────────────────────

  function submitRun(input: SubmitRunInput): RunWithDetails {
    const runId = uuidv4();
    const now = new Date().toISOString();

    // Determine status based on whether a verdict is provided
    const status = input.verdict ? 'completed' : 'pending';
    const finishedAt = input.verdict ? now : null;

    db.run(
      `INSERT INTO runs (id, project_id, commit_sha, branch, "trigger", status, started_at, finished_at, meta_json)
       VALUES ($id, $project_id, $commit_sha, $branch, $trigger, $status, $started_at, $finished_at, $meta_json)`,
      prefixParams({
        id: runId,
        project_id: input.projectId,
        commit_sha: input.commitSha ?? null,
        branch: input.branch ?? null,
        trigger: input.trigger,
        status,
        started_at: now,
        finished_at: finishedAt,
        meta_json: input.meta ? JSON.stringify(input.meta) : null,
      }),
    );

    // Insert artifacts
    const artifacts: Artifact[] = (input.artifacts ?? []).map((ref) => {
      const artId = uuidv4();
      db.run(
        `INSERT INTO artifacts (id, run_id, kind, path, sha256, size_bytes, meta_json, created_at)
         VALUES ($id, $run_id, $kind, $path, $sha256, $size_bytes, $meta_json, $created_at)`,
        prefixParams({
          id: artId,
          run_id: runId,
          kind: ref.kind,
          path: ref.path,
          sha256: ref.sha256 ?? null,
          size_bytes: ref.sizeBytes ?? null,
          meta_json: ref.meta ? JSON.stringify(ref.meta) : null,
          created_at: now,
        }),
      );
      return {
        id: artId,
        runId,
        kind: ref.kind,
        path: ref.path,
        sha256: ref.sha256 ?? null,
        sizeBytes: ref.sizeBytes ?? null,
        meta: ref.meta ?? null,
        createdAt: now,
      };
    });

    // Insert verdict if provided
    let verdictEntity: Verdict | null = null;
    if (input.verdict) {
      const verdictId = uuidv4();
      db.run(
        `INSERT INTO verdicts (id, run_id, verdict, score, reason, rule_ids, created_at)
         VALUES ($id, $run_id, $verdict, $score, $reason, $rule_ids, $created_at)`,
        prefixParams({
          id: verdictId,
          run_id: runId,
          verdict: input.verdict.verdict,
          score: input.verdict.score,
          reason: input.verdict.reason ?? null,
          rule_ids: JSON.stringify(input.verdict.ruleIds ?? []),
          created_at: now,
        }),
      );
      verdictEntity = {
        id: verdictId,
        runId,
        verdict: input.verdict.verdict,
        score: input.verdict.score,
        reason: input.verdict.reason ?? null,
        ruleIds: input.verdict.ruleIds ?? [],
        createdAt: now,
      };
    }

    return {
      id: runId,
      projectId: input.projectId,
      commitSha: input.commitSha ?? null,
      branch: input.branch ?? null,
      trigger: input.trigger,
      status: status as Run['status'],
      startedAt: now,
      finishedAt: finishedAt,
      meta: input.meta ?? null,
      artifacts,
      verdict: verdictEntity,
    };
  }

  function getRun(id: string): RunWithDetails | undefined {
    const row = queryOne(db, 'SELECT * FROM runs WHERE id = $id', { id });
    if (!row) return undefined;

    const run = rowToRun(row);
    const artifacts = queryAll(
      db,
      'SELECT * FROM artifacts WHERE run_id = $run_id ORDER BY created_at ASC',
      { run_id: id },
    ).map(rowToArtifact);

    const verdictRow = queryOne(
      db,
      'SELECT * FROM verdicts WHERE run_id = $run_id ORDER BY created_at DESC LIMIT 1',
      { run_id: id },
    );

    return {
      ...run,
      artifacts,
      verdict: verdictRow ? rowToVerdict(verdictRow) : null,
    };
  }

  function listRuns(query: ListRunsQuery): { runs: RunWithDetails[]; total: number } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (query.projectId) {
      conditions.push('r.project_id = $project_id');
      params['project_id'] = query.projectId;
    }
    if (query.status) {
      conditions.push('r.status = $status');
      params['status'] = query.status;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (query.page - 1) * query.limit;

    const countRow = queryOne(db, `SELECT COUNT(*) as cnt FROM runs r ${where}`, params);
    const total = (countRow?.['cnt'] as number) ?? 0;

    const rows = queryAll(
      db,
      `SELECT r.* FROM runs r ${where} ORDER BY r.started_at DESC LIMIT $limit OFFSET $offset`,
      { ...params, limit: query.limit, offset },
    );

    const runs = rows.map((row) => {
      const run = rowToRun(row);
      const artifacts = queryAll(
        db,
        'SELECT * FROM artifacts WHERE run_id = $run_id ORDER BY created_at ASC',
        { run_id: run.id },
      ).map(rowToArtifact);

      const verdictRow = queryOne(
        db,
        'SELECT * FROM verdicts WHERE run_id = $run_id ORDER BY created_at DESC LIMIT 1',
        { run_id: run.id },
      );

      return {
        ...run,
        artifacts,
        verdict: verdictRow ? rowToVerdict(verdictRow) : null,
      };
    });

    return { runs, total };
  }

  // ── Latest verdict for a project ──────────────────────────────────

  function getLatestVerdict(projectId: string): (Verdict & { run: Run }) | undefined {
    const row = queryOne(
      db,
      `SELECT v.*, r.id AS r_id, r.project_id, r.commit_sha, r.branch,
              r."trigger", r.status, r.started_at, r.finished_at, r.meta_json
       FROM verdicts v
       INNER JOIN runs r ON v.run_id = r.id
       WHERE r.project_id = $project_id
       ORDER BY v.created_at DESC
       LIMIT 1`,
      { project_id: projectId },
    );
    if (!row) return undefined;

    const verdict = rowToVerdict(row);
    const run: Run = {
      id: row['r_id'] as string,
      projectId: row['project_id'] as string,
      commitSha: (row['commit_sha'] as string) || null,
      branch: (row['branch'] as string) || null,
      trigger: row['trigger'] as Run['trigger'],
      status: row['status'] as Run['status'],
      startedAt: row['started_at'] as string,
      finishedAt: (row['finished_at'] as string) || null,
      meta: row['meta_json']
        ? (JSON.parse(row['meta_json'] as string) as Record<string, unknown>)
        : null,
    };

    return { ...verdict, run };
  }

  // ── Artifact queries ──────────────────────────────────────────────

  function getArtifactsForRun(runId: string): Artifact[] {
    return queryAll(
      db,
      'SELECT * FROM artifacts WHERE run_id = $run_id ORDER BY created_at ASC',
      { run_id: runId },
    ).map(rowToArtifact);
  }

  function getArtifact(id: string): Artifact | undefined {
    const row = queryOne(db, 'SELECT * FROM artifacts WHERE id = $id', { id });
    return row ? rowToArtifact(row) : undefined;
  }

  return {
    // Orgs
    createOrg,
    getOrg,
    listOrgs,
    // Projects
    createProject,
    getProject,
    listProjects,
    // Runs
    submitRun,
    getRun,
    listRuns,
    // Verdicts
    getLatestVerdict,
    // Artifacts
    getArtifactsForRun,
    getArtifact,
  };
}

export type BackboneQueries = ReturnType<typeof createBackboneQueries>;
