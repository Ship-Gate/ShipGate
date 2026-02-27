import { describe, it, expect, beforeAll } from 'vitest';
import { createHash, randomBytes } from 'crypto';
import { testPrisma } from './setup';
import {
  assertOrgAccess,
  requireOrgRole,
  requireAdminOrMember,
  type AuthContext,
  type MembershipRole,
} from '@/lib/api-auth';

function authContext(
  userId: string,
  orgIds: string[],
  roles: [string, MembershipRole][]
): AuthContext {
  const orgRoles = new Map<string, MembershipRole>(roles);
  return {
    userId,
    email: 'test@test.com',
    orgIds,
    orgRoles,
  };
}

describe('RBAC: requireOrgRole', () => {
  it('returns null when user has allowed role', () => {
    const auth = authContext('u1', ['o1'], [['o1', 'admin']]);
    expect(requireOrgRole(auth, 'o1', ['admin', 'member'])).toBeNull();
    expect(requireOrgRole(auth, 'o1', ['admin'])).toBeNull();
  });

  it('returns 403 when user has insufficient role', () => {
    const auth = authContext('u1', ['o1'], [['o1', 'viewer']]);
    const res = requireOrgRole(auth, 'o1', ['admin', 'member']);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it('returns 403 when user not in org', () => {
    const auth = authContext('u1', ['o1'], [['o1', 'admin']]);
    const res = requireOrgRole(auth, 'o2', ['admin']);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it('allows viewer for read-only allowed roles', () => {
    const auth = authContext('u1', ['o1'], [['o1', 'viewer']]);
    expect(requireOrgRole(auth, 'o1', ['admin', 'member', 'viewer'])).toBeNull();
  });
});

describe('RBAC: requireAdminOrMember', () => {
  it('returns null when user has admin in any org', () => {
    const auth = authContext('u1', ['o1'], [['o1', 'admin']]);
    expect(requireAdminOrMember(auth)).toBeNull();
  });

  it('returns null when user has member in any org', () => {
    const auth = authContext('u1', ['o1'], [['o1', 'member']]);
    expect(requireAdminOrMember(auth)).toBeNull();
  });

  it('returns 403 when user is viewer only', () => {
    const auth = authContext('u1', ['o1', 'o2'], [['o1', 'viewer'], ['o2', 'viewer']]);
    const res = requireAdminOrMember(auth);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it('returns 403 when user has no orgs', () => {
    const auth = authContext('u1', [], []);
    const res = requireAdminOrMember(auth);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });
});

describe('RBAC: assertOrgAccess', () => {
  it('returns null when user is in org', () => {
    const auth = authContext('u1', ['o1'], [['o1', 'viewer']]);
    expect(assertOrgAccess(auth, 'o1')).toBeNull();
  });

  it('returns 403 when user not in org', () => {
    const auth = authContext('u1', ['o1'], [['o1', 'admin']]);
    const res = assertOrgAccess(auth, 'o2');
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });
});

describe('RBAC: API route permission boundaries (integration)', () => {
  let adminUserId: string;
  let viewerUserId: string;
  let orgId: string;
  let projectId: string;
  let adminToken: string;
  let viewerToken: string;
  let setupOk = false;

  beforeAll(async () => {
    try {
      const org = await testPrisma.org.create({ data: { name: 'RBAC Test Org' } });
      orgId = org.id;

      const adminUser = await testPrisma.user.create({
        data: {
          email: 'admin@rbac.test',
          name: 'Admin',
          provider: 'github',
          providerAccountId: 'rbac-admin',
        },
      });
      adminUserId = adminUser.id;

      const viewerUser = await testPrisma.user.create({
        data: {
          email: 'viewer@rbac.test',
          name: 'Viewer',
          provider: 'github',
          providerAccountId: 'rbac-viewer',
        },
      });
      viewerUserId = viewerUser.id;

      await testPrisma.membership.create({
        data: { userId: adminUserId, orgId, role: 'admin' },
      });
      await testPrisma.membership.create({
        data: { userId: viewerUserId, orgId, role: 'viewer' },
      });

      const project = await testPrisma.project.create({
        data: { orgId, name: 'rbac-project' },
      });
      projectId = project.id;

      adminToken = `sg_${randomBytes(32).toString('hex')}`;
      viewerToken = `sg_${randomBytes(32).toString('hex')}`;

      const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');

      await testPrisma.personalAccessToken.create({
        data: {
          userId: adminUserId,
          name: 'Admin PAT',
          tokenHash: hash(adminToken),
          prefix: adminToken.slice(0, 11),
        },
      });
      await testPrisma.personalAccessToken.create({
        data: {
          userId: viewerUserId,
          name: 'Viewer PAT',
          tokenHash: hash(viewerToken),
          prefix: viewerToken.slice(0, 11),
        },
      });
      setupOk = true;
    } catch (e) {
    console.warn('RBAC integration tests skipped (run db:push or db:migrate):', e);
  }
  });

  const skip = () => !setupOk;

  async function callHandler(
    method: string,
    path: string,
    token: string,
    body?: object
  ): Promise<Response> {
    const { NextRequest } = await import('next/server');
    const url = `http://localhost${path}`;
    const init: Record<string, unknown> = {
      method,
      headers: { Authorization: `Bearer ${token}` },
    };
    if (body) init.body = JSON.stringify(body);
    const req = new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);

    if (path === '/api/v1/projects' && method === 'POST') {
      const { POST } = await import('@/app/api/v1/projects/route');
      return POST(req) as Promise<Response>;
    }
    if (path === '/api/v1/projects' && method === 'GET') {
      const { GET } = await import('@/app/api/v1/projects/route');
      return GET(req) as Promise<Response>;
    }
    if (path === '/api/v1/runs' && method === 'POST') {
      const { POST } = await import('@/app/api/v1/runs/route');
      return POST(req) as Promise<Response>;
    }
    if (path === '/api/v1/tokens' && method === 'GET') {
      const { GET } = await import('@/app/api/v1/tokens/route');
      return GET(req) as Promise<Response>;
    }
    if (path === '/api/v1/tokens' && method === 'POST') {
      const { POST } = await import('@/app/api/v1/tokens/route');
      return POST(req) as Promise<Response>;
    }

    throw new Error(`Unknown route: ${method} ${path}`);
  }

  it.skipIf(skip)('viewer receives 403 on POST /api/v1/projects', async () => {
    const res = await callHandler('POST', '/api/v1/projects', viewerToken, {
      orgId,
      name: 'viewer-created',
    });
    expect(res.status).toBe(403);
  });

  it.skipIf(skip)('admin succeeds on POST /api/v1/projects', async () => {
    const res = await callHandler('POST', '/api/v1/projects', adminToken, {
      orgId,
      name: 'admin-created-project',
    });
    expect(res.status).toBe(201);
  });

  it.skipIf(skip)('viewer succeeds on GET /api/v1/projects', async () => {
    const res = await callHandler('GET', '/api/v1/projects', viewerToken);
    expect(res.status).toBe(200);
  });

  it.skipIf(skip)('viewer receives 403 on GET /api/v1/tokens', async () => {
    const res = await callHandler('GET', '/api/v1/tokens', viewerToken);
    expect(res.status).toBe(403);
  });

  it.skipIf(skip)('viewer receives 403 on POST /api/v1/tokens', async () => {
    const res = await callHandler('POST', '/api/v1/tokens', viewerToken, {
      name: 'viewer-token',
    });
    expect(res.status).toBe(403);
  });

  it.skipIf(skip)('admin succeeds on GET /api/v1/tokens', async () => {
    const res = await callHandler('GET', '/api/v1/tokens', adminToken);
    expect(res.status).toBe(200);
  });

  it.skipIf(skip)('viewer receives 403 on POST /api/v1/runs', async () => {
    const res = await callHandler('POST', '/api/v1/runs', viewerToken, {
      orgId,
      projectId,
      agentType: 'cli',
    });
    expect(res.status).toBe(403);
  });

  it.skipIf(skip)('admin succeeds on POST /api/v1/runs', async () => {
    const res = await callHandler('POST', '/api/v1/runs', adminToken, {
      orgId,
      projectId,
      agentType: 'cli',
    });
    expect([201, 402]).toContain(res.status);
  });
});
