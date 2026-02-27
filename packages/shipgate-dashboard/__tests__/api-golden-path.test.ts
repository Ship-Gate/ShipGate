import { describe, it, expect, beforeAll } from 'vitest';
import { testPrisma } from './setup';
import { createHash, randomBytes } from 'crypto';

/**
 * End-to-end golden path test:
 *   create user + org + PAT -> create project -> create run -> upload findings -> complete run -> list runs
 */

let userId: string;
let orgId: string;
let rawToken: string;
let tokenHash: string;

beforeAll(async () => {
  // Seed test user
  const user = await testPrisma.user.create({
    data: {
      email: 'test@shipgate.dev',
      name: 'Test User',
      provider: 'github',
      providerAccountId: 'test-123',
    },
  });
  userId = user.id;

  // Seed test org + membership
  const org = await testPrisma.org.create({ data: { name: 'Test Org' } });
  orgId = org.id;

  await testPrisma.membership.create({
    data: { userId: user.id, orgId: org.id, role: 'admin' },
  });

  // Create PAT
  rawToken = `sg_${randomBytes(32).toString('hex')}`;
  tokenHash = createHash('sha256').update(rawToken).digest('hex');

  await testPrisma.personalAccessToken.create({
    data: {
      userId: user.id,
      name: 'Test Token',
      tokenHash,
      prefix: rawToken.slice(0, 11),
    },
  });
});

describe('Golden Path: CLI scan → Dashboard display', () => {
  let projectId: string;
  let runId: string;

  it('should create a project', async () => {
    const project = await testPrisma.project.create({
      data: { orgId, name: 'my-app' },
    });
    projectId = project.id;
    expect(project.name).toBe('my-app');
    expect(project.orgId).toBe(orgId);
  });

  it('should create a run', async () => {
    const run = await testPrisma.run.create({
      data: {
        orgId,
        projectId,
        userId,
        agentType: 'cli',
        agentVersion: '1.0.0',
        commitSha: 'abc123',
        branch: 'main',
        status: 'running',
      },
    });
    runId = run.id;
    expect(run.status).toBe('running');
  });

  it('should upload findings in bulk', async () => {
    const result = await testPrisma.finding.createMany({
      data: [
        {
          runId,
          severity: 'high',
          category: 'ghost-route',
          title: 'Unused API route',
          filePath: 'src/api/old.ts',
          lineStart: 10,
          message: 'Route /api/old is defined but not used',
          fingerprint: 'src/api/old.ts:ghost-route:10',
        },
        {
          runId,
          severity: 'medium',
          category: 'auth-bypass',
          title: 'Missing auth check',
          filePath: 'src/api/data.ts',
          lineStart: 25,
          message: 'No auth middleware on GET /api/data',
          fingerprint: 'src/api/data.ts:auth-bypass:25',
        },
        {
          runId,
          severity: 'low',
          category: 'ghost-env',
          title: 'Unused env var',
          message: 'OLD_API_KEY is set but never referenced',
          fingerprint: 'env:ghost-env:OLD_API_KEY',
        },
      ],
    });
    expect(result.count).toBe(3);
  });

  it('should complete the run with verdict', async () => {
    const updated = await testPrisma.run.update({
      where: { id: runId },
      data: {
        status: 'completed',
        verdict: 'WARN',
        score: 75,
        durationMs: 3200,
        finishedAt: new Date(),
      },
    });
    expect(updated.status).toBe('completed');
    expect(updated.verdict).toBe('WARN');
    expect(updated.score).toBe(75);
  });

  it('should list runs and include the new run', async () => {
    const runs = await testPrisma.run.findMany({
      where: { orgId },
      include: { _count: { select: { findings: true } } },
      orderBy: { startedAt: 'desc' },
    });
    expect(runs.length).toBeGreaterThanOrEqual(1);
    const found = runs.find((r) => r.id === runId);
    expect(found).toBeDefined();
    expect(found!._count.findings).toBe(3);
  });

  it('should retrieve run detail with findings', async () => {
    const run = await testPrisma.run.findUnique({
      where: { id: runId },
      include: { findings: true },
    });
    expect(run).toBeDefined();
    expect(run!.findings).toHaveLength(3);
    expect(run!.findings.map((f) => f.severity).sort()).toEqual(['high', 'low', 'medium']);
  });
});

describe('Auth: token verification', () => {
  it('should find PAT by hash', async () => {
    const pat = await testPrisma.personalAccessToken.findUnique({
      where: { tokenHash },
    });
    expect(pat).toBeDefined();
    expect(pat!.userId).toBe(userId);
  });

  it('should reject invalid token hash', async () => {
    const badHash = createHash('sha256').update('sg_bad_token').digest('hex');
    const pat = await testPrisma.personalAccessToken.findUnique({
      where: { tokenHash: badHash },
    });
    expect(pat).toBeNull();
  });
});

describe('Tenant isolation', () => {
  it('should not allow user to access another org data', async () => {
    // Create another org that user is NOT a member of
    const otherOrg = await testPrisma.org.create({ data: { name: 'Other Org' } });
    const otherProject = await testPrisma.project.create({
      data: { orgId: otherOrg.id, name: 'other-project' },
    });

    // User's membership list should not include other org
    const memberships = await testPrisma.membership.findMany({
      where: { userId },
    });
    const userOrgIds = memberships.map((m) => m.orgId);
    expect(userOrgIds).not.toContain(otherOrg.id);

    // Querying runs scoped to user's orgs should not include other org's data
    const otherRun = await testPrisma.run.create({
      data: {
        orgId: otherOrg.id,
        projectId: otherProject.id,
        userId: userId, // even if userId matches, orgId check should filter
        agentType: 'cli',
        status: 'completed',
      },
    });

    const runs = await testPrisma.run.findMany({
      where: { orgId: { in: userOrgIds } },
    });
    const foundOtherRun = runs.find((r) => r.id === otherRun.id);
    expect(foundOtherRun).toBeUndefined();
  });
});
