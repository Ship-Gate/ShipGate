import { PrismaClient } from '@prisma/client';

// Use a test-specific DATABASE_URL if provided, otherwise fall back to the default
const testDbUrl = process.env.DATABASE_URL ?? 'postgresql://liquidgroove@localhost:5432/shipgate_test?schema=public';
process.env.DATABASE_URL = testDbUrl;

export const testPrisma = new PrismaClient({
  datasources: { db: { url: testDbUrl } },
});

beforeAll(async () => {
  // Clean test data before suite
  await cleanTestData();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

async function cleanTestData() {
  // Delete in order respecting FK constraints
  await testPrisma.auditLog.deleteMany({});
  await testPrisma.finding.deleteMany({});
  await testPrisma.proofBundle.deleteMany({});
  await testPrisma.artifact.deleteMany({});
  await testPrisma.run.deleteMany({});
  await testPrisma.project.deleteMany({});
  await testPrisma.personalAccessToken.deleteMany({});
  await testPrisma.membership.deleteMany({});
  await testPrisma.org.deleteMany({});
  await testPrisma.user.deleteMany({});
}
