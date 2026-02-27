/**
 * DEV-ONLY seed script. Populates the local database with realistic test data.
 *
 * Usage: DATABASE_URL=... node scripts/seed-dev.mjs
 *
 * WARNING: This is for development only. Never run in production.
 */

import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('⚠  DEV SEED: Populating database with sample data...\n');

  // 1. Create a dev user
  const user = await prisma.user.upsert({
    where: { email: 'dev@shipgate.dev' },
    update: {},
    create: {
      email: 'dev@shipgate.dev',
      name: 'Dev User',
      provider: 'github',
      providerAccountId: 'dev-seed-001',
    },
  });
  console.log(`  User: ${user.email} (${user.id})`);

  // 2. Create a dev org
  const org = await prisma.org.upsert({
    where: { name: 'Dev Workspace' },
    update: {},
    create: { name: 'Dev Workspace' },
  });
  console.log(`  Org:  ${org.name} (${org.id})`);

  // 3. Membership
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    update: {},
    create: { userId: user.id, orgId: org.id, role: 'admin' },
  });

  // 4. Create a PAT for CLI testing
  const rawToken = `sg_${randomBytes(32).toString('hex')}`;
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await prisma.personalAccessToken.upsert({
    where: { tokenHash },
    update: {},
    create: {
      userId: user.id,
      name: 'Dev CLI Token',
      tokenHash,
      prefix: rawToken.slice(0, 11),
    },
  });
  console.log(`  PAT:  ${rawToken}`);

  // 5. Create sample projects
  const projects = ['frontend-app', 'api-server', 'mobile-app'];
  const projectRecords = [];
  for (const name of projects) {
    const proj = await prisma.project.upsert({
      where: { orgId_name: { orgId: org.id, name } },
      update: {},
      create: { orgId: org.id, name, repoUrl: `https://github.com/shipgate/${name}` },
    });
    projectRecords.push(proj);
    console.log(`  Project: ${name} (${proj.id})`);
  }

  // 6. Create sample runs with findings
  const verdicts = ['SHIP', 'WARN', 'NO_SHIP'];
  const severities = ['critical', 'high', 'medium', 'low', 'info'];
  const categories = ['ghost-route', 'ghost-env', 'auth-bypass', 'pii-leak', 'rate-limit'];

  for (const proj of projectRecords) {
    for (let i = 0; i < 3; i++) {
      const verdict = verdicts[i % verdicts.length];
      const run = await prisma.run.create({
        data: {
          orgId: org.id,
          projectId: proj.id,
          userId: user.id,
          agentType: i % 2 === 0 ? 'cli' : 'vscode',
          agentVersion: '1.0.0',
          commitSha: randomBytes(20).toString('hex'),
          branch: 'main',
          status: 'completed',
          verdict,
          score: verdict === 'SHIP' ? 95 : verdict === 'WARN' ? 72 : 45,
          startedAt: new Date(Date.now() - i * 3600000),
          finishedAt: new Date(Date.now() - i * 3600000 + 5000),
          durationMs: 5000,
        },
      });

      const findingCount = verdict === 'SHIP' ? 1 : verdict === 'WARN' ? 3 : 5;
      const findings = Array.from({ length: findingCount }, (_, j) => ({
        runId: run.id,
        severity: severities[j % severities.length],
        category: categories[j % categories.length],
        title: `Finding ${j + 1}`,
        filePath: `src/module-${j}.ts`,
        lineStart: 10 + j * 5,
        message: `Sample finding #${j + 1} in ${proj.name}`,
        fingerprint: `${proj.name}:${categories[j % categories.length]}:${10 + j * 5}`,
      }));

      await prisma.finding.createMany({ data: findings });
      console.log(`  Run: ${run.id} (${verdict}, ${findingCount} findings)`);
    }
  }

  console.log('\n✓ Dev seed complete. Use the PAT above for CLI testing.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
