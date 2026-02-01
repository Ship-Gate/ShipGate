import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/client';

const app = createApp();

describe('Dashboard API', () => {
  beforeAll(async () => {
    // Ensure clean database state
    await prisma.testResult.deleteMany();
    await prisma.verification.deleteMany();
    await prisma.domain.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Health Check', () => {
    it('GET /health should return status ok', async () => {
      const res = await request(app).get('/health');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('Domains API', () => {
    let domainId: string;

    beforeEach(async () => {
      // Clean up before each test
      await prisma.testResult.deleteMany();
      await prisma.verification.deleteMany();
      await prisma.domain.deleteMany();
    });

    it('POST /api/domains should create a domain', async () => {
      const res = await request(app)
        .post('/api/domains')
        .send({
          name: 'Test Domain',
          description: 'A test domain for API testing',
          contractPath: '/contracts/test.isl',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Test Domain');
      expect(res.body.status).toBe('PENDING');
      
      domainId = res.body.id;
    });

    it('GET /api/domains should list domains', async () => {
      // Create a domain first
      await prisma.domain.create({
        data: {
          name: 'List Test Domain',
          contractPath: '/contracts/list-test.isl',
        },
      });

      const res = await request(app).get('/api/domains');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/domains/:id should return a domain', async () => {
      const domain = await prisma.domain.create({
        data: {
          name: 'Get Test Domain',
          contractPath: '/contracts/get-test.isl',
        },
      });

      const res = await request(app).get(`/api/domains/${domain.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(domain.id);
      expect(res.body.name).toBe('Get Test Domain');
    });

    it('GET /api/domains/:id should return 404 for non-existent domain', async () => {
      const res = await request(app).get('/api/domains/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not Found');
    });

    it('PATCH /api/domains/:id should update a domain', async () => {
      const domain = await prisma.domain.create({
        data: {
          name: 'Update Test Domain',
          contractPath: '/contracts/update-test.isl',
        },
      });

      const res = await request(app)
        .patch(`/api/domains/${domain.id}`)
        .send({ name: 'Updated Domain Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Domain Name');
    });

    it('DELETE /api/domains/:id should delete a domain', async () => {
      const domain = await prisma.domain.create({
        data: {
          name: 'Delete Test Domain',
          contractPath: '/contracts/delete-test.isl',
        },
      });

      const res = await request(app).delete(`/api/domains/${domain.id}`);

      expect(res.status).toBe(204);

      // Verify deletion
      const deleted = await prisma.domain.findUnique({
        where: { id: domain.id },
      });
      expect(deleted).toBeNull();
    });

    it('POST /api/domains should validate input', async () => {
      const res = await request(app)
        .post('/api/domains')
        .send({ description: 'Missing required fields' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Validation Error');
    });
  });

  describe('Verifications API', () => {
    let testDomainId: string;

    beforeEach(async () => {
      await prisma.testResult.deleteMany();
      await prisma.verification.deleteMany();
      await prisma.domain.deleteMany();

      const domain = await prisma.domain.create({
        data: {
          name: 'Verification Test Domain',
          contractPath: '/contracts/verification-test.isl',
        },
      });
      testDomainId = domain.id;
    });

    it('POST /api/verifications should create a verification', async () => {
      const res = await request(app)
        .post('/api/verifications')
        .send({ domainId: testDomainId });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.domainId).toBe(testDomainId);
      expect(res.body.status).toBe('PENDING');
    });

    it('POST /api/verifications should return 404 for non-existent domain', async () => {
      const res = await request(app)
        .post('/api/verifications')
        .send({ domainId: 'non-existent-domain' });

      expect(res.status).toBe(404);
    });

    it('GET /api/verifications should list verifications', async () => {
      await prisma.verification.create({
        data: { domainId: testDomainId },
      });

      const res = await request(app).get('/api/verifications');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/verifications/:id should return a verification', async () => {
      const verification = await prisma.verification.create({
        data: { domainId: testDomainId },
      });

      const res = await request(app).get(`/api/verifications/${verification.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(verification.id);
    });

    it('POST /api/verifications/:id/start should start a verification', async () => {
      const verification = await prisma.verification.create({
        data: { domainId: testDomainId },
      });

      const res = await request(app).post(`/api/verifications/${verification.id}/start`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('RUNNING');
      expect(res.body.startedAt).toBeTruthy();
    });

    it('POST /api/verifications/:id/complete should complete a verification', async () => {
      const verification = await prisma.verification.create({
        data: { 
          domainId: testDomainId,
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      const res = await request(app)
        .post(`/api/verifications/${verification.id}/complete`)
        .send({ passed: 10, failed: 0, coverage: 95 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PASSED');
      expect(res.body.passedTests).toBe(10);
      expect(res.body.failedTests).toBe(0);
    });

    it('POST /api/verifications/:id/results should add test results', async () => {
      const verification = await prisma.verification.create({
        data: { domainId: testDomainId, status: 'RUNNING' },
      });

      const res = await request(app)
        .post(`/api/verifications/${verification.id}/results`)
        .send({
          testName: 'Test Case 1',
          category: 'unit',
          status: 'PASSED',
          duration: 150,
        });

      expect(res.status).toBe(201);
      expect(res.body.testName).toBe('Test Case 1');
      expect(res.body.status).toBe('PASSED');
    });
  });

  describe('Analytics API', () => {
    beforeEach(async () => {
      await prisma.testResult.deleteMany();
      await prisma.verification.deleteMany();
      await prisma.domain.deleteMany();
    });

    it('GET /api/analytics/overview should return dashboard stats', async () => {
      // Create some test data
      const domain = await prisma.domain.create({
        data: {
          name: 'Analytics Test Domain',
          contractPath: '/contracts/analytics-test.isl',
          status: 'VERIFIED',
          trustScore: 95,
        },
      });

      await prisma.verification.create({
        data: {
          domainId: domain.id,
          status: 'PASSED',
          passedTests: 10,
          failedTests: 0,
        },
      });

      const res = await request(app).get('/api/analytics/overview');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('domains');
      expect(res.body).toHaveProperty('verifications');
      expect(res.body).toHaveProperty('tests');
      expect(res.body).toHaveProperty('recentActivity');
      expect(res.body).toHaveProperty('trustScoreDistribution');
    });

    it('GET /api/analytics/trends should return verification trends', async () => {
      const res = await request(app).get('/api/analytics/trends?days=7');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('days');
      expect(res.body).toHaveProperty('trends');
      expect(Array.isArray(res.body.trends)).toBe(true);
    });

    it('GET /api/analytics/domains/:id should return domain analytics', async () => {
      const domain = await prisma.domain.create({
        data: {
          name: 'Domain Analytics Test',
          contractPath: '/contracts/domain-analytics.isl',
        },
      });

      const res = await request(app).get(`/api/analytics/domains/${domain.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('domain');
      expect(res.body.domain.id).toBe(domain.id);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown-route');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not Found');
    });
  });
});
