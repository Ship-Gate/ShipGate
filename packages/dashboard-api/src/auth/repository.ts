/**
 * Auth repository — user & API-key CRUD backed by sql.js (SQLite).
 */

import type { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import type { User, Role, ApiKeyInfo } from './types.js';
import { hashPassword, verifyPassword } from './passwords.js';

// ── SQL helpers (mirrors db/queries.ts) ─────────────────────────────

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
  const rows = queryAll(db, sql, params);
  return rows[0];
}

// ── Input types ─────────────────────────────────────────────────────

export interface CreateUserInput {
  email: string;
  name: string;
  role?: Role;
  password?: string;
  teams?: string[];
}

// ── Repository factory ──────────────────────────────────────────────

export function createAuthRepository(db: Database) {
  // ── Internal helpers ────────────────────────────────────────────

  function getUserTeams(userId: string): string[] {
    const rows = queryAll(
      db,
      'SELECT team FROM team_members WHERE user_id = $user_id',
      { user_id: userId },
    );
    return rows.map((r) => r['team'] as string);
  }

  function rowToUser(row: Record<string, unknown>): User {
    const id = row['id'] as string;
    const teams = getUserTeams(id);
    return {
      id,
      email: row['email'] as string,
      name: row['name'] as string,
      role: row['role'] as Role,
      teams,
    };
  }

  // ── User CRUD ─────────────────────────────────────────────────

  async function createUser(input: CreateUserInput): Promise<User> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const passwordHash = input.password
      ? await hashPassword(input.password)
      : null;
    const role: Role = input.role ?? 'developer';

    db.run(
      `INSERT INTO users (id, email, name, role, password_hash, created_at)
       VALUES ($id, $email, $name, $role, $password_hash, $created_at)`,
      prefixParams({
        id,
        email: input.email,
        name: input.name,
        role,
        password_hash: passwordHash,
        created_at: now,
      }),
    );

    const teams = input.teams ?? [];
    for (const team of teams) {
      db.run(
        'INSERT INTO team_members (user_id, team) VALUES ($user_id, $team)',
        prefixParams({ user_id: id, team }),
      );
    }

    return { id, email: input.email, name: input.name, role, teams };
  }

  function getUserById(id: string): User | undefined {
    const row = queryOne(db, 'SELECT * FROM users WHERE id = $id', { id });
    if (!row) return undefined;
    return rowToUser(row);
  }

  function getUserByEmail(email: string): User | undefined {
    const row = queryOne(db, 'SELECT * FROM users WHERE email = $email', {
      email,
    });
    if (!row) return undefined;
    return rowToUser(row);
  }

  function getPasswordHash(userId: string): string | undefined {
    const row = queryOne(
      db,
      'SELECT password_hash FROM users WHERE id = $id',
      { id: userId },
    );
    return (row?.['password_hash'] as string) ?? undefined;
  }

  async function validatePassword(
    userId: string,
    password: string,
  ): Promise<boolean> {
    const hash = getPasswordHash(userId);
    if (!hash) return false;
    return verifyPassword(password, hash);
  }

  function listUsers(): User[] {
    const rows = queryAll(db, 'SELECT * FROM users ORDER BY created_at DESC');
    return rows.map(rowToUser);
  }

  function deleteUser(userId: string): boolean {
    const existing = queryOne(db, 'SELECT id FROM users WHERE id = $id', {
      id: userId,
    });
    if (!existing) return false;
    db.run('DELETE FROM users WHERE id = $id', prefixParams({ id: userId }));
    return true;
  }

  // ── API Key management ────────────────────────────────────────

  function createApiKey(
    userId: string,
    name?: string,
    expiresInDays?: number,
  ): { key: string; keyHash: string } {
    const key = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const now = new Date().toISOString();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
      : null;

    db.run(
      `INSERT INTO api_keys (key_hash, user_id, name, created_at, expires_at)
       VALUES ($key_hash, $user_id, $name, $created_at, $expires_at)`,
      prefixParams({
        key_hash: keyHash,
        user_id: userId,
        name: name ?? null,
        created_at: now,
        expires_at: expiresAt,
      }),
    );

    return { key, keyHash };
  }

  function validateApiKey(key: string): User | undefined {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const now = new Date().toISOString();

    const row = queryOne(
      db,
      `SELECT u.*
       FROM users u
       INNER JOIN api_keys ak ON u.id = ak.user_id
       WHERE ak.key_hash = $key_hash
         AND (ak.expires_at IS NULL OR ak.expires_at > $now)`,
      { key_hash: keyHash, now },
    );

    if (!row) return undefined;

    // Track last usage
    db.run(
      'UPDATE api_keys SET last_used = $now WHERE key_hash = $key_hash',
      prefixParams({ now: new Date().toISOString(), key_hash: keyHash }),
    );

    return rowToUser(row);
  }

  function revokeApiKey(keyHash: string): boolean {
    const existing = queryOne(
      db,
      'SELECT key_hash FROM api_keys WHERE key_hash = $key_hash',
      { key_hash: keyHash },
    );
    if (!existing) return false;

    db.run(
      'DELETE FROM api_keys WHERE key_hash = $key_hash',
      prefixParams({ key_hash: keyHash }),
    );
    return true;
  }

  function listApiKeys(userId: string): ApiKeyInfo[] {
    const rows = queryAll(
      db,
      'SELECT * FROM api_keys WHERE user_id = $user_id ORDER BY created_at DESC',
      { user_id: userId },
    );
    return rows.map((r) => ({
      keyHash: r['key_hash'] as string,
      name: r['name'] as string | null,
      lastUsed: r['last_used'] as string | null,
      createdAt: r['created_at'] as string,
      expiresAt: r['expires_at'] as string | null,
    }));
  }

  // ── Team management ───────────────────────────────────────────

  function addUserToTeam(userId: string, team: string): void {
    db.run(
      'INSERT OR IGNORE INTO team_members (user_id, team) VALUES ($user_id, $team)',
      prefixParams({ user_id: userId, team }),
    );
  }

  function removeUserFromTeam(userId: string, team: string): void {
    db.run(
      'DELETE FROM team_members WHERE user_id = $user_id AND team = $team',
      prefixParams({ user_id: userId, team }),
    );
  }

  return {
    // Users
    createUser,
    getUserById,
    getUserByEmail,
    getPasswordHash,
    validatePassword,
    listUsers,
    deleteUser,
    // API Keys
    createApiKey,
    validateApiKey,
    revokeApiKey,
    listApiKeys,
    // Teams
    addUserToTeam,
    removeUserFromTeam,
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
