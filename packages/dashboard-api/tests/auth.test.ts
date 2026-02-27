import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Database } from 'sql.js';
import type { Express } from 'express';
import express from 'express';

import { openMemoryDatabase } from '../src/db/schema.js';
import {
  createAuthRepository,
  createAuthMiddleware,
  authorize,
  requirePermission,
  scopeQuery,
  createToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  PERMISSIONS,
} from '../src/auth/index.js';
import type { AuthRepository, User, Role } from '../src/auth/index.js';

// ── Helpers ─────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret-do-not-use-in-production';

/** Build a minimal Express app wired with auth middleware for testing. */
function buildTestApp(authRepo: AuthRepository) {
  const app = express();
  app.use(express.json());

  const { authenticate } = createAuthMiddleware(authRepo);

  // Public route
  app.get('/public', (_req, res) => {
    res.json({ ok: true, data: 'public' });
  });

  // Authenticated route — any role
  app.get('/protected', authenticate, (_req, res) => {
    res.json({ ok: true, data: { user: _req.user } });
  });

  // Admin-only
  app.get(
    '/admin',
    authenticate,
    authorize('admin'),
    (_req, res) => {
      res.json({ ok: true, data: 'admin-only' });
    },
  );

  // Developer + admin
  app.post(
    '/submit',
    authenticate,
    authorize('admin', 'developer'),
    (_req, res) => {
      res.json({ ok: true, data: 'submitted' });
    },
  );

  // Permission-based
  app.get(
    '/manage-users',
    authenticate,
    requirePermission('manage:users'),
    (_req, res) => {
      res.json({ ok: true, data: 'manage-users' });
    },
  );

  return app;
}

// ── Test suite ──────────────────────────────────────────────────────

describe('Auth Module', () => {
  let db: Database;
  let authRepo: AuthRepository;
  let app: Express;

  beforeEach(async () => {
    process.env['JWT_SECRET'] = JWT_SECRET;
    db = await openMemoryDatabase();
    authRepo = createAuthRepository(db);
    app = buildTestApp(authRepo);
  });

  afterEach(() => {
    db.close();
    delete process.env['JWT_SECRET'];
  });

  // ── Password hashing ───────────────────────────────────────────

  describe('Password hashing', () => {
    it('hashes a password and verifies it', async () => {
      const hash = await hashPassword('my-secure-password');
      expect(hash).not.toBe('my-secure-password');
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt prefix

      const valid = await verifyPassword('my-secure-password', hash);
      expect(valid).toBe(true);
    });

    it('rejects wrong password', async () => {
      const hash = await hashPassword('correct-password');
      const valid = await verifyPassword('wrong-password', hash);
      expect(valid).toBe(false);
    });
  });

  // ── JWT ────────────────────────────────────────────────────────

  describe('JWT tokens', () => {
    it('creates and verifies a token', () => {
      const user: User = {
        id: 'u1',
        email: 'alice@example.com',
        name: 'Alice',
        role: 'admin',
        teams: ['team-a'],
      };

      const token = createToken(user);
      const payload = verifyToken(token);

      expect(payload.sub).toBe('u1');
      expect(payload.email).toBe('alice@example.com');
      expect(payload.role).toBe('admin');
      expect(payload.teams).toEqual(['team-a']);
    });

    it('throws on invalid token', () => {
      expect(() => verifyToken('not-a-valid-token')).toThrow();
    });

    it('throws when JWT_SECRET is missing', () => {
      delete process.env['JWT_SECRET'];
      const user: User = {
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        role: 'viewer',
        teams: [],
      };
      expect(() => createToken(user)).toThrow('JWT_SECRET');
    });
  });

  // ── User repository ────────────────────────────────────────────

  describe('User repository', () => {
    it('creates a user with hashed password', async () => {
      const user = await authRepo.createUser({
        email: 'bob@example.com',
        name: 'Bob',
        role: 'developer',
        password: 'bob-pass-123',
        teams: ['team-a', 'team-b'],
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('bob@example.com');
      expect(user.role).toBe('developer');
      expect(user.teams).toEqual(['team-a', 'team-b']);
    });

    it('defaults role to developer', async () => {
      const user = await authRepo.createUser({
        email: 'carol@example.com',
        name: 'Carol',
      });
      expect(user.role).toBe('developer');
    });

    it('finds user by id', async () => {
      const created = await authRepo.createUser({
        email: 'dave@example.com',
        name: 'Dave',
        teams: ['team-x'],
      });

      const found = authRepo.getUserById(created.id);
      expect(found).toBeDefined();
      expect(found!.email).toBe('dave@example.com');
      expect(found!.teams).toEqual(['team-x']);
    });

    it('finds user by email', async () => {
      await authRepo.createUser({
        email: 'eve@example.com',
        name: 'Eve',
      });

      const found = authRepo.getUserByEmail('eve@example.com');
      expect(found).toBeDefined();
      expect(found!.name).toBe('Eve');
    });

    it('returns undefined for unknown user', () => {
      expect(authRepo.getUserById('nonexistent')).toBeUndefined();
      expect(authRepo.getUserByEmail('nobody@example.com')).toBeUndefined();
    });

    it('validates correct password', async () => {
      const user = await authRepo.createUser({
        email: 'frank@example.com',
        name: 'Frank',
        password: 'frank-pass',
      });

      const valid = await authRepo.validatePassword(user.id, 'frank-pass');
      expect(valid).toBe(true);
    });

    it('rejects wrong password', async () => {
      const user = await authRepo.createUser({
        email: 'grace@example.com',
        name: 'Grace',
        password: 'grace-pass',
      });

      const valid = await authRepo.validatePassword(user.id, 'wrong');
      expect(valid).toBe(false);
    });

    it('lists all users', async () => {
      await authRepo.createUser({ email: 'u1@e.com', name: 'U1' });
      await authRepo.createUser({ email: 'u2@e.com', name: 'U2' });

      const users = authRepo.listUsers();
      expect(users).toHaveLength(2);
    });

    it('deletes a user', async () => {
      const user = await authRepo.createUser({
        email: 'del@e.com',
        name: 'Del',
      });

      expect(authRepo.deleteUser(user.id)).toBe(true);
      expect(authRepo.getUserById(user.id)).toBeUndefined();
    });

    it('returns false when deleting nonexistent user', () => {
      expect(authRepo.deleteUser('nonexistent')).toBe(false);
    });
  });

  // ── API Key management ─────────────────────────────────────────

  describe('API Key management', () => {
    it('creates and validates an API key', async () => {
      const user = await authRepo.createUser({
        email: 'apiuser@example.com',
        name: 'API User',
        role: 'developer',
        teams: ['ci-team'],
      });

      const { key } = authRepo.createApiKey(user.id, 'CI key');
      expect(key).toMatch(/^sk_/);

      const resolved = authRepo.validateApiKey(key);
      expect(resolved).toBeDefined();
      expect(resolved!.id).toBe(user.id);
      expect(resolved!.teams).toEqual(['ci-team']);
    });

    it('rejects an invalid API key', () => {
      const resolved = authRepo.validateApiKey('sk_invalid');
      expect(resolved).toBeUndefined();
    });

    it('rejects an expired API key', async () => {
      const user = await authRepo.createUser({
        email: 'expired@example.com',
        name: 'Expired',
      });

      // Create key that expired yesterday (negative days hack via direct SQL)
      const { key, keyHash } = authRepo.createApiKey(user.id, 'expired-key');
      const pastDate = new Date(Date.now() - 86_400_000).toISOString();
      db.run(
        `UPDATE api_keys SET expires_at = '${pastDate}' WHERE key_hash = '${keyHash}'`,
      );

      const resolved = authRepo.validateApiKey(key);
      expect(resolved).toBeUndefined();
    });

    it('revokes an API key', async () => {
      const user = await authRepo.createUser({
        email: 'revoke@example.com',
        name: 'Revoke',
      });

      const { key, keyHash } = authRepo.createApiKey(user.id);
      expect(authRepo.revokeApiKey(keyHash)).toBe(true);

      const resolved = authRepo.validateApiKey(key);
      expect(resolved).toBeUndefined();
    });

    it('returns false when revoking nonexistent key', () => {
      expect(authRepo.revokeApiKey('nonexistent-hash')).toBe(false);
    });

    it('lists API keys for a user', async () => {
      const user = await authRepo.createUser({
        email: 'listkeys@example.com',
        name: 'ListKeys',
      });

      authRepo.createApiKey(user.id, 'key-1');
      authRepo.createApiKey(user.id, 'key-2');

      const keys = authRepo.listApiKeys(user.id);
      expect(keys).toHaveLength(2);
      const names = keys.map((k) => k.name).sort();
      expect(names).toEqual(['key-1', 'key-2']);
    });
  });

  // ── Team management ────────────────────────────────────────────

  describe('Team management', () => {
    it('adds and removes team membership', async () => {
      const user = await authRepo.createUser({
        email: 'teams@example.com',
        name: 'Teams',
        teams: ['alpha'],
      });

      authRepo.addUserToTeam(user.id, 'beta');
      let found = authRepo.getUserById(user.id);
      expect(found!.teams).toContain('alpha');
      expect(found!.teams).toContain('beta');

      authRepo.removeUserFromTeam(user.id, 'alpha');
      found = authRepo.getUserById(user.id);
      expect(found!.teams).toEqual(['beta']);
    });

    it('ignores duplicate team addition', async () => {
      const user = await authRepo.createUser({
        email: 'dup@example.com',
        name: 'Dup',
        teams: ['alpha'],
      });

      authRepo.addUserToTeam(user.id, 'alpha'); // no-op
      const found = authRepo.getUserById(user.id);
      expect(found!.teams).toEqual(['alpha']);
    });
  });

  // ── Authentication middleware (API Key) ────────────────────────

  describe('API Key authentication', () => {
    it('authenticates with valid API key', async () => {
      const user = await authRepo.createUser({
        email: 'apiauth@example.com',
        name: 'API Auth',
        role: 'admin',
        teams: ['team-a'],
      });
      const { key } = authRepo.createApiKey(user.id);

      const res = await request(app)
        .get('/protected')
        .set('X-Api-Key', key)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.user.email).toBe('apiauth@example.com');
    });

    it('rejects invalid API key', async () => {
      const res = await request(app)
        .get('/protected')
        .set('X-Api-Key', 'sk_bad')
        .expect(401);

      expect(res.body.error).toBe('Invalid API key');
    });
  });

  // ── Authentication middleware (JWT) ────────────────────────────

  describe('JWT authentication', () => {
    it('authenticates with valid JWT', async () => {
      const user = await authRepo.createUser({
        email: 'jwt@example.com',
        name: 'JWT User',
        role: 'developer',
        teams: ['frontend'],
      });

      const token = createToken(user);

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.user.email).toBe('jwt@example.com');
    });

    it('rejects invalid JWT', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('rejects JWT for deleted user', async () => {
      const user = await authRepo.createUser({
        email: 'deleted@example.com',
        name: 'Deleted',
      });
      const token = createToken(user);
      authRepo.deleteUser(user.id);

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(res.body.error).toBe('User not found');
    });
  });

  // ── Authentication middleware (Basic Auth) ─────────────────────

  describe('Basic Auth authentication', () => {
    it('authenticates with valid credentials', async () => {
      await authRepo.createUser({
        email: 'basic@example.com',
        name: 'Basic User',
        password: 'basic-pass',
        role: 'viewer',
        teams: ['team-v'],
      });

      const credentials = Buffer.from('basic@example.com:basic-pass').toString(
        'base64',
      );

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Basic ${credentials}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.user.email).toBe('basic@example.com');
    });

    it('rejects wrong password', async () => {
      await authRepo.createUser({
        email: 'basic2@example.com',
        name: 'Basic2',
        password: 'correct',
      });

      const credentials = Buffer.from('basic2@example.com:wrong').toString(
        'base64',
      );

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Basic ${credentials}`)
        .expect(401);

      expect(res.body.error).toBe('Invalid credentials');
    });

    it('rejects unknown email', async () => {
      const credentials = Buffer.from('nobody@example.com:pass').toString(
        'base64',
      );

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Basic ${credentials}`)
        .expect(401);

      expect(res.body.error).toBe('Invalid credentials');
    });

    it('rejects malformed Basic Auth header', async () => {
      const malformed = Buffer.from('nocolon').toString('base64');

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Basic ${malformed}`)
        .expect(401);

      expect(res.body.error).toBe('Invalid Basic Auth format');
    });
  });

  // ── No credentials ────────────────────────────────────────────

  describe('No credentials', () => {
    it('returns 401 with no auth headers', async () => {
      const res = await request(app).get('/protected').expect(401);

      expect(res.body.error).toBe('Authentication required');
    });

    it('allows public routes without auth', async () => {
      const res = await request(app).get('/public').expect(200);

      expect(res.body.data).toBe('public');
    });
  });

  // ── RBAC (authorize middleware) ────────────────────────────────

  describe('Role-based authorization', () => {
    async function authHeader(
      role: Role,
      email: string,
    ): Promise<{ key: string }> {
      const user = await authRepo.createUser({
        email,
        name: email.split('@')[0]!,
        role,
        teams: ['test-team'],
      });
      const { key } = authRepo.createApiKey(user.id);
      return { key };
    }

    it('admin can access admin-only route', async () => {
      const { key } = await authHeader('admin', 'admin@test.com');

      const res = await request(app)
        .get('/admin')
        .set('X-Api-Key', key)
        .expect(200);

      expect(res.body.data).toBe('admin-only');
    });

    it('developer cannot access admin-only route', async () => {
      const { key } = await authHeader('developer', 'dev@test.com');

      const res = await request(app)
        .get('/admin')
        .set('X-Api-Key', key)
        .expect(403);

      expect(res.body.error).toBe('Insufficient permissions');
    });

    it('viewer cannot access admin-only route', async () => {
      const { key } = await authHeader('viewer', 'viewer@test.com');

      await request(app)
        .get('/admin')
        .set('X-Api-Key', key)
        .expect(403);
    });

    it('admin can submit', async () => {
      const { key } = await authHeader('admin', 'admin-submit@test.com');

      await request(app)
        .post('/submit')
        .set('X-Api-Key', key)
        .expect(200);
    });

    it('developer can submit', async () => {
      const { key } = await authHeader('developer', 'dev-submit@test.com');

      await request(app)
        .post('/submit')
        .set('X-Api-Key', key)
        .expect(200);
    });

    it('viewer cannot submit', async () => {
      const { key } = await authHeader('viewer', 'viewer-submit@test.com');

      await request(app)
        .post('/submit')
        .set('X-Api-Key', key)
        .expect(403);
    });
  });

  // ── Permission-based authorization ─────────────────────────────

  describe('Permission-based authorization', () => {
    it('admin has manage:users permission', async () => {
      const user = await authRepo.createUser({
        email: 'perm-admin@test.com',
        name: 'PermAdmin',
        role: 'admin',
      });
      const { key } = authRepo.createApiKey(user.id);

      await request(app)
        .get('/manage-users')
        .set('X-Api-Key', key)
        .expect(200);
    });

    it('developer lacks manage:users permission', async () => {
      const user = await authRepo.createUser({
        email: 'perm-dev@test.com',
        name: 'PermDev',
        role: 'developer',
      });
      const { key } = authRepo.createApiKey(user.id);

      const res = await request(app)
        .get('/manage-users')
        .set('X-Api-Key', key)
        .expect(403);

      expect(res.body.error).toBe('Missing permission: manage:users');
    });

    it('viewer lacks manage:users permission', async () => {
      const user = await authRepo.createUser({
        email: 'perm-viewer@test.com',
        name: 'PermViewer',
        role: 'viewer',
      });
      const { key } = authRepo.createApiKey(user.id);

      await request(app)
        .get('/manage-users')
        .set('X-Api-Key', key)
        .expect(403);
    });
  });

  // ── Data scoping ──────────────────────────────────────────────

  describe('Data scoping (scopeQuery)', () => {
    it('admin sees everything (no team filter)', () => {
      const admin: User = {
        id: 'a1',
        email: 'a@b.com',
        name: 'Admin',
        role: 'admin',
        teams: ['team-a'],
      };

      const scoped = scopeQuery(admin, { repo: 'my-repo' });
      expect(scoped).toEqual({ repo: 'my-repo' });
      expect(scoped.teams).toBeUndefined();
    });

    it('developer gets team filter attached', () => {
      const dev: User = {
        id: 'd1',
        email: 'd@b.com',
        name: 'Dev',
        role: 'developer',
        teams: ['team-a', 'team-b'],
      };

      const scoped = scopeQuery(dev, { repo: 'my-repo' });
      expect(scoped).toEqual({
        repo: 'my-repo',
        teams: ['team-a', 'team-b'],
      });
    });

    it('viewer gets team filter attached', () => {
      const viewer: User = {
        id: 'v1',
        email: 'v@b.com',
        name: 'Viewer',
        role: 'viewer',
        teams: ['team-c'],
      };

      const scoped = scopeQuery(viewer, {});
      expect(scoped).toEqual({ teams: ['team-c'] });
    });
  });

  // ── Permissions map ───────────────────────────────────────────

  describe('Permissions map', () => {
    it('admin has all 4 permissions', () => {
      expect(PERMISSIONS.admin).toHaveLength(4);
      expect(PERMISSIONS.admin).toContain('submit:reports');
      expect(PERMISSIONS.admin).toContain('view:all');
      expect(PERMISSIONS.admin).toContain('manage:config');
      expect(PERMISSIONS.admin).toContain('manage:users');
    });

    it('developer has submit and view:team', () => {
      expect(PERMISSIONS.developer).toHaveLength(2);
      expect(PERMISSIONS.developer).toContain('submit:reports');
      expect(PERMISSIONS.developer).toContain('view:team');
    });

    it('viewer has view:team only', () => {
      expect(PERMISSIONS.viewer).toHaveLength(1);
      expect(PERMISSIONS.viewer).toContain('view:team');
    });
  });
});
