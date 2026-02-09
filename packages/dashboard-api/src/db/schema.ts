import initSqlJs, { type Database } from 'sql.js';
import path from 'node:path';
import fs from 'node:fs';
import { AUTH_SCHEMA_SQL } from '../auth/schema.js';

export type { Database } from 'sql.js';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS reports (
    id            TEXT PRIMARY KEY,
    timestamp     TEXT NOT NULL,
    repo          TEXT NOT NULL,
    branch        TEXT NOT NULL,
    commit_sha    TEXT NOT NULL,
    pr_number     INTEGER,
    verdict       TEXT NOT NULL CHECK(verdict IN ('SHIP', 'WARN', 'NO_SHIP')),
    score         REAL NOT NULL CHECK(score >= 0 AND score <= 100),
    coverage_specced  INTEGER NOT NULL CHECK(coverage_specced >= 0),
    coverage_total    INTEGER NOT NULL CHECK(coverage_total >= 0),
    coverage_pct      REAL NOT NULL CHECK(coverage_pct >= 0 AND coverage_pct <= 100),
    duration_ms   INTEGER NOT NULL CHECK(duration_ms >= 0),
    triggered_by  TEXT NOT NULL CHECK(triggered_by IN ('ci', 'cli', 'vscode')),
    raw_json      TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_reports_repo       ON reports(repo);
  CREATE INDEX IF NOT EXISTS idx_reports_timestamp   ON reports(timestamp);
  CREATE INDEX IF NOT EXISTS idx_reports_branch      ON reports(repo, branch);
  CREATE INDEX IF NOT EXISTS idx_reports_verdict     ON reports(verdict);
  CREATE INDEX IF NOT EXISTS idx_reports_commit      ON reports(commit_sha);
`;

let _sqlJs: Awaited<ReturnType<typeof initSqlJs>> | undefined;

async function getSqlJs() {
  if (!_sqlJs) {
    _sqlJs = await initSqlJs();
  }
  return _sqlJs;
}

/**
 * Opens (or creates) the SQLite database and ensures the schema exists.
 *
 * @param dbPath  Absolute path to the `.db` file.
 *                Defaults to `shipgate.db` in cwd.
 */
export async function openDatabase(dbPath?: string): Promise<Database> {
  const SQL = await getSqlJs();
  const resolved = dbPath ?? path.join(process.cwd(), 'shipgate.db');

  // Ensure parent directory exists
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let db: Database;
  if (fs.existsSync(resolved)) {
    const buffer = fs.readFileSync(resolved);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(SCHEMA_SQL);
  db.run(AUTH_SCHEMA_SQL);

  return db;
}

/**
 * Opens an in-memory database — useful for tests.
 */
export async function openMemoryDatabase(): Promise<Database> {
  const SQL = await getSqlJs();
  const db = new SQL.Database();
  db.run(SCHEMA_SQL);
  db.run(AUTH_SCHEMA_SQL);
  return db;
}

/**
 * Persists the database to disk.
 */
export function saveDatabase(db: Database, dbPath?: string): void {
  const resolved = dbPath ?? path.join(process.cwd(), 'shipgate.db');
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = db.export();
  fs.writeFileSync(resolved, Buffer.from(data));
}
