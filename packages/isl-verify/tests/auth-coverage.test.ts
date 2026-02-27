/**
 * Auth Coverage Prover Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthCoverageProver, createAuthCoverageProver } from '../src/proof/auth-coverage.js';
import type { AuthEvidence } from '../src/proof/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('AuthCoverageProver', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'auth-coverage-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Next.js App Router', () => {
    it('should detect routes in App Router', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'users'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'users', 'route.ts'),
        `export async function GET(request: Request) {
          return Response.json({ users: [] });
        }

        export async function POST(request: Request) {
          return Response.json({ created: true });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      expect(proof.property).toBe('auth-coverage');
      expect(proof.evidence.length).toBe(2);
      
      const evidence = proof.evidence as AuthEvidence[];
      const getRoute = evidence.find(e => e.route === 'GET /api/users');
      const postRoute = evidence.find(e => e.route === 'POST /api/users');
      
      expect(getRoute).toBeDefined();
      expect(postRoute).toBeDefined();
    });

    it('should detect getServerSession auth', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'protected'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'protected', 'route.ts'),
        `import { getServerSession } from 'next-auth';

        export async function GET(request: Request) {
          const session = await getServerSession();
          if (!session) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
          }
          return Response.json({ data: 'secret' });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const route = evidence.find(e => e.route === 'GET /api/protected');
      expect(route?.isProtected).toBe(true);
      expect(route?.authMethod).toBe('getServerSession() call');
    });

    it('should detect auth() from next-auth', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'dashboard'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'dashboard', 'route.ts'),
        `import { auth } from '@/auth';

        export async function POST(request: Request) {
          const session = await auth();
          if (!session) throw new Error('Unauthorized');
          return Response.json({ ok: true });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const route = evidence.find(e => e.route === 'POST /api/dashboard');
      expect(route?.isProtected).toBe(true);
      expect(route?.authMethod).toBe('auth() from next-auth');
    });

    it('should detect JWT token verification', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'orders'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'orders', 'route.ts'),
        `import { cookies } from 'next/headers';
        import { verify } from 'jsonwebtoken';

        export async function GET() {
          const token = cookies().get('token')?.value;
          const decoded = verify(token, process.env.JWT_SECRET);
          return Response.json({ orders: [] });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const route = evidence.find(e => e.route === 'GET /api/orders');
      expect(route?.isProtected).toBe(true);
      expect(route?.authMethod).toBe('JWT token verification');
    });

    it('should fail routes without auth', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'admin'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'admin', 'route.ts'),
        `export async function DELETE(request: Request) {
          // No auth check - DANGEROUS!
          await db.users.deleteMany();
          return Response.json({ deleted: true });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const route = evidence.find(e => e.route === 'DELETE /api/admin');
      expect(route?.shouldBeProtected).toBe(true);
      expect(route?.isProtected).toBe(false);
      expect(proof.status).toBe('FAILED');
    });
  });

  describe('Next.js Pages Router', () => {
    it('should detect Pages API routes', async () => {
      await fs.mkdir(path.join(testDir, 'pages', 'api'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'pages', 'api', 'users.ts'),
        `export default async function handler(req, res) {
          if (req.method === 'GET') {
            return res.json({ users: [] });
          }
          if (req.method === 'POST') {
            return res.json({ created: true });
          }
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      expect(evidence.some(e => e.route === 'GET /api/users')).toBe(true);
      expect(evidence.some(e => e.route === 'POST /api/users')).toBe(true);
    });

    it('should detect req.user checks', async () => {
      await fs.mkdir(path.join(testDir, 'pages', 'api'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'pages', 'api', 'profile.ts'),
        `export default async function handler(req, res) {
          if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
          }
          return res.json({ user: req.user });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const route = evidence.find(e => e.file.includes('profile.ts'));
      expect(route?.isProtected).toBe(true);
      expect(route?.authMethod).toBe('req.user/req.session check');
    });
  });

  describe('Express', () => {
    it('should detect Express routes', async () => {
      await fs.mkdir(path.join(testDir, 'src', 'routes'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'src', 'routes', 'users.ts'),
        `import express from 'express';
        const router = express.Router();

        router.get('/api/users', (req, res) => {
          res.json({ users: [] });
        });

        router.post('/api/users', (req, res) => {
          res.json({ created: true });
        });

        export default router;`
      );

      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { express: '^4.18.0' } })
      );

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      expect(evidence.some(e => e.route === 'GET /api/users')).toBe(true);
      expect(evidence.some(e => e.route === 'POST /api/users')).toBe(true);
    });

    it('should detect middleware in route chain', async () => {
      await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'src', 'server.ts'),
        `import express from 'express';
        const app = express();

        app.post('/api/orders', authMiddleware, (req, res) => {
          res.json({ order: 'created' });
        });`
      );

      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { express: '^4.18.0' } })
      );

      const prover = new AuthCoverageProver(testDir, {
        authMiddleware: ['authMiddleware'],
      });
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const route = evidence.find(e => e.route === 'POST /api/orders');
      expect(route?.isProtected).toBe(true);
      expect(route?.authMethod).toBe('authMiddleware middleware');
    });

    it('should detect custom middleware names', async () => {
      await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'src', 'app.ts'),
        `router.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
          await User.delete(req.params.id);
          res.json({ deleted: true });
        });`
      );

      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { express: '^4.18.0' } })
      );

      const prover = new AuthCoverageProver(testDir, {
        authMiddleware: ['requireAdmin', 'requireAuth'],
      });
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const route = evidence.find(e => e.route.includes('admin/users'));
      expect(route?.isProtected).toBe(true);
    });
  });

  describe('Fastify', () => {
    it('should detect Fastify routes', async () => {
      await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'src', 'server.ts'),
        `import fastify from 'fastify';
        const app = fastify();

        app.get('/api/users', async (request, reply) => {
          return { users: [] };
        });

        app.post('/api/users', async (request, reply) => {
          return { created: true };
        });`
      );

      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { fastify: '^4.0.0' } })
      );

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      expect(evidence.some(e => e.route === 'GET /api/users')).toBe(true);
      expect(evidence.some(e => e.route === 'POST /api/users')).toBe(true);
    });

    it('should detect onRequest hooks', async () => {
      await fs.mkdir(path.join(testDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'src', 'routes.ts'),
        `fastify.route({
          method: 'POST',
          url: '/api/protected',
          onRequest: async (request, reply) => {
            if (!request.user) {
              reply.code(401).send({ error: 'Unauthorized' });
            }
          },
          handler: async (request, reply) => {
            return { data: 'secret' };
          }
        });`
      );

      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { fastify: '^4.0.0' } })
      );

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const route = evidence.find(e => e.route === 'POST /api/protected');
      expect(route?.isProtected).toBe(true);
      expect(route?.authMethod).toBe('onRequest/preHandler hook');
    });
  });

  describe('Protection Heuristics', () => {
    it('should mark public routes as unprotected', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'health'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'health', 'route.ts'),
        `export async function GET() {
          return Response.json({ status: 'ok' });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const route = evidence.find(e => e.route === 'GET /api/health');
      expect(route?.shouldBeProtected).toBe(false);
      expect(route?.protectionReason).toContain('public route pattern');
    });

    it('should respect config publicRoutes', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'webhook'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'webhook', 'route.ts'),
        `export async function POST() {
          return Response.json({ received: true });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir, {
        publicRoutes: ['/api/webhook'],
      });
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const route = evidence.find(e => e.route === 'POST /api/webhook');
      expect(route?.shouldBeProtected).toBe(false);
      expect(route?.protectionReason).toBe('config: in publicRoutes');
    });

    it('should mark modifying methods as protected by default', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'data'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'data', 'route.ts'),
        `export async function POST() {
          return Response.json({ created: true });
        }

        export async function DELETE() {
          return Response.json({ deleted: true });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const postRoute = evidence.find(e => e.route === 'POST /api/data');
      const deleteRoute = evidence.find(e => e.route === 'DELETE /api/data');
      
      expect(postRoute?.shouldBeProtected).toBe(true);
      expect(postRoute?.protectionReason).toContain('modifies data');
      expect(deleteRoute?.shouldBeProtected).toBe(true);
    });

    it('should use wildcard patterns', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'admin', 'users'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'admin', 'users', 'route.ts'),
        `export async function GET() {
          return Response.json({ users: [] });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const route = evidence.find(e => e.route === 'GET /api/admin/users');
      expect(route?.shouldBeProtected).toBe(true);
      expect(route?.protectionReason).toContain('protected route pattern');
    });
  });

  describe('Status Calculation', () => {
    it('should return PROVEN when all protected routes have auth', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'users'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'users', 'route.ts'),
        `import { getServerSession } from 'next-auth';

        export async function POST(request: Request) {
          const session = await getServerSession();
          if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
          return Response.json({ created: true });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PROVEN');
      expect(proof.summary).toContain('1/1 protected routes verified');
    });

    it('should return FAILED when most protected routes lack auth', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'orders'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'orders', 'route.ts'),
        `export async function POST() {
          return Response.json({ created: true });
        }

        export async function DELETE() {
          return Response.json({ deleted: true });
        }

        export async function PUT() {
          return Response.json({ updated: true });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('FAILED');
    });

    it('should return PARTIAL when some routes are protected', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'mixed'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'mixed', 'route.ts'),
        `import { getServerSession } from 'next-auth';

        export async function POST() {
          const session = await getServerSession();
          if (!session) throw new Error('Unauthorized');
          return Response.json({ created: true });
        }

        export async function DELETE() {
          // Missing auth!
          return Response.json({ deleted: true });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PARTIAL');
    });
  });

  describe('Factory Function', () => {
    it('should create prover with factory', async () => {
      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = createAuthCoverageProver(testDir, {
        publicRoutes: ['/api/health'],
      });

      expect(prover).toBeInstanceOf(AuthCoverageProver);
      const proof = await prover.prove();
      expect(proof.property).toBe('auth-coverage');
    });
  });

  describe('Findings', () => {
    it('should produce findings for critical issues', async () => {
      await fs.mkdir(path.join(testDir, 'app', 'api', 'admin', 'delete-all'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, 'app', 'api', 'admin', 'delete-all', 'route.ts'),
        `export async function DELETE() {
          await db.users.deleteMany({});
          return Response.json({ deleted: 'all' });
        }`
      );

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));

      const prover = new AuthCoverageProver(testDir);
      const proof = await prover.prove();

      const evidence = proof.evidence as AuthEvidence[];
      const route = evidence.find(e => e.route.includes('delete-all'));
      expect(route?.shouldBeProtected).toBe(true);
      expect(route?.isProtected).toBe(false);
      expect(proof.status).toBe('FAILED');
    });
  });
});
