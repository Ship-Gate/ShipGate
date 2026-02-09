/**
 * SQLite schema additions for authentication & RBAC.
 * Applied alongside the main reports schema in db/schema.ts.
 */

export const AUTH_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'developer'
                    CHECK(role IN ('admin', 'developer', 'viewer')),
    password_hash TEXT,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    key_hash    TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT,
    last_used   TEXT,
    created_at  TEXT NOT NULL,
    expires_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS team_members (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team    TEXT NOT NULL,
    PRIMARY KEY (user_id, team)
  );

  CREATE INDEX IF NOT EXISTS idx_api_keys_user    ON api_keys(user_id);
  CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team);
`;
