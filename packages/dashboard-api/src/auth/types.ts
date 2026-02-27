/**
 * Auth types for dashboard API — enterprise-lite RBAC.
 *
 * Roles:
 *   admin     — submit reports, view all, manage team config, manage users
 *   developer — submit reports, view own team's data
 *   viewer    — view own team's data (read-only)
 */

// ── Roles ───────────────────────────────────────────────────────────

export type Role = 'admin' | 'developer' | 'viewer';

export const ROLES: readonly Role[] = ['admin', 'developer', 'viewer'] as const;

// ── User ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  teams: string[];
  apiKey?: string; // populated only when created, never stored in plaintext
}

// ── Permissions ─────────────────────────────────────────────────────

export const PERMISSIONS = {
  admin: ['submit:reports', 'view:all', 'manage:config', 'manage:users'],
  developer: ['submit:reports', 'view:team'],
  viewer: ['view:team'],
} as const satisfies Record<Role, readonly string[]>;

export type Permission = (typeof PERMISSIONS)[Role][number];

// ── DB row shapes (internal) ────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string | null;
  created_at: string;
}

export interface ApiKeyRow {
  key_hash: string;
  user_id: string;
  name: string | null;
  last_used: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface ApiKeyInfo {
  keyHash: string;
  name: string | null;
  lastUsed: string | null;
  createdAt: string;
  expiresAt: string | null;
}

// ── Express Request augmentation ────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
