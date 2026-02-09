/**
 * Backbone schema — orgs / projects / runs / artifacts / verdicts.
 * Applied as a migration alongside the existing reports + auth schemas.
 */

export const BACKBONE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS orgs (
    id         TEXT PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id         TEXT PRIMARY KEY,
    org_id     TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    repo_url   TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(org_id, name)
  );

  CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);

  CREATE TABLE IF NOT EXISTS runs (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    commit_sha   TEXT,
    branch       TEXT,
    trigger      TEXT NOT NULL CHECK("trigger" IN ('ci', 'cli', 'manual')),
    status       TEXT NOT NULL DEFAULT 'pending'
                   CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    started_at   TEXT NOT NULL,
    finished_at  TEXT,
    meta_json    TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_runs_project    ON runs(project_id);
  CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);
  CREATE INDEX IF NOT EXISTS idx_runs_status     ON runs(status);

  CREATE TABLE IF NOT EXISTS artifacts (
    id         TEXT PRIMARY KEY,
    run_id     TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL
                 CHECK(kind IN ('proof_bundle', 'isl_spec', 'coverage_report', 'log', 'other')),
    path       TEXT NOT NULL,
    sha256     TEXT,
    size_bytes INTEGER,
    meta_json  TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_artifacts_run  ON artifacts(run_id);
  CREATE INDEX IF NOT EXISTS idx_artifacts_kind ON artifacts(kind);

  CREATE TABLE IF NOT EXISTS verdicts (
    id         TEXT PRIMARY KEY,
    run_id     TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    verdict    TEXT NOT NULL CHECK(verdict IN ('SHIP', 'WARN', 'NO_SHIP')),
    score      REAL NOT NULL CHECK(score >= 0 AND score <= 100),
    reason     TEXT,
    rule_ids   TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_verdicts_run     ON verdicts(run_id);
  CREATE INDEX IF NOT EXISTS idx_verdicts_verdict  ON verdicts(verdict);
`;

/** Migration version identifier — bump when schema changes. */
export const BACKBONE_SCHEMA_VERSION = 1;
