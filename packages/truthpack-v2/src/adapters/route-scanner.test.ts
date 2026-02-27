/**
 * Route Scanner Tests
 * 
 * Tests for Fastify and file-based route discovery with fixtures
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FastifyAdapter, NextAppRouterAdapter, NextPagesApiAdapter } from './index.js';
import type { AdapterContext } from './index.js';

describe('FastifyAdapter', () => {
  describe('Plugin Registration Graph', () => {
    it('should detect routes in plugin with prefix', async () => {
      const adapter = new FastifyAdapter();
      
      const content = `
import Fastify from 'fastify';

async function routesPlugin(fastify: any) {
  fastify.get('/users', async () => ({ users: [] }));
  fastify.post('/users', async () => ({ created: true }));
}

export default routesPlugin;
`;

      const context: AdapterContext = {
        repoRoot: '/test',
        filePath: '/test/src/routes.ts',
        content,
      };

      const result = await adapter.extract(context);
      
      expect(result.routes.length).toBeGreaterThanOrEqual(2);
      expect(result.routes.some(r => r.method === 'GET' && r.path === '/users')).toBe(true);
      expect(result.routes.some(r => r.method === 'POST' && r.path === '/users')).toBe(true);
    });

    it('should extract route schemas from route config', async () => {
      const adapter = new FastifyAdapter();
      
      const content = `
fastify.route({
  method: 'POST',
  url: '/api/users',
  schema: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' }
      }
    }
  },
  handler: async (req, res) => ({ id: 1 })
});
`;

      const context: AdapterContext = {
        repoRoot: '/test',
        filePath: '/test/src/server.ts',
        content,
      };

      const result = await adapter.extract(context);
      
      expect(result.routes.length).toBe(1);
      expect(result.routes[0].method).toBe('POST');
      expect(result.routes[0].path).toBe('/api/users');
      expect(result.routes[0].metadata?.schema).toBeDefined();
      expect(result.routes[0].confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('should detect register() calls with prefixes', async () => {
      const adapter = new FastifyAdapter();
      
      const content = `
import Fastify from 'fastify';
import routes from './routes.js';

const fastify = Fastify();

await fastify.register(routes, { prefix: '/api' });
await fastify.register(authPlugin, { prefix: '/auth' });
`;

      const context: AdapterContext = {
        repoRoot: '/test',
        filePath: '/test/src/server.ts',
        content,
      };

      const result = await adapter.extract(context);
      
      // Should detect register calls (though routes won't be extracted from this file)
      expect(adapter.canHandle(context)).toBe(true);
    });

    it('should calculate meaningful confidence scores', async () => {
      const adapter = new FastifyAdapter();
      
      const content = `
fastify.get('/health', async () => ({ status: 'ok' }));
fastify.route({
  method: 'GET',
  url: '/api/users',
  schema: { querystring: { type: 'object' } },
  handler: async () => ({ users: [] })
});
`;

      const context: AdapterContext = {
        repoRoot: '/test',
        filePath: '/test/src/server.ts',
        content,
      };

      const result = await adapter.extract(context);
      
      expect(result.routes.length).toBe(2);
      
      // Route with schema should have higher confidence
      const routeWithSchema = result.routes.find(r => r.path === '/api/users');
      const routeWithoutSchema = result.routes.find(r => r.path === '/health');
      
      expect(routeWithSchema).toBeDefined();
      expect(routeWithoutSchema).toBeDefined();
      
      if (routeWithSchema && routeWithoutSchema) {
        expect(routeWithSchema.confidence).toBeGreaterThanOrEqual(routeWithoutSchema.confidence);
      }
    });
  });
});

describe('NextAppRouterAdapter', () => {
  describe('Dynamic Segment Normalization', () => {
    it('should normalize [id] to :id', async () => {
      const adapter = new NextAppRouterAdapter();
      
      const context: AdapterContext = {
        repoRoot: '/test',
        filePath: '/test/app/api/users/[id]/route.ts',
        content: `
export async function GET(request: Request) {
  return Response.json({ id: '123' });
}
`,
      };

      const result = await adapter.extract(context);
      
      expect(result.routes.length).toBe(1);
      expect(result.routes[0].path).toBe('/api/users/:id');
      expect(result.routes[0].parameters).toContain('id');
    });

    it('should normalize [...slug] to *slug', async () => {
      const adapter = new NextAppRouterAdapter();
      
      const context: AdapterContext = {
        repoRoot: '/test',
        filePath: '/test/app/api/posts/[...slug]/route.ts',
        content: `
export async function GET(request: Request) {
  return Response.json({ slug: 'test' });
}
`,
      };

      const result = await adapter.extract(context);
      
      expect(result.routes.length).toBe(1);
      expect(result.routes[0].path).toBe('/api/posts/*slug');
      expect(result.routes[0].parameters).toContain('slug');
    });

    it('should normalize [[...slug]] to *slug?', async () => {
      const adapter = new NextAppRouterAdapter();
      
      const context: AdapterContext = {
        repoRoot: '/test',
        filePath: '/test/app/api/docs/[[...slug]]/route.ts',
        content: `
export async function GET(request: Request) {
  return Response.json({ docs: [] });
}
`,
      };

      const result = await adapter.extract(context);
      
      expect(result.routes.length).toBe(1);
      expect(result.routes[0].path).toMatch(/\/api\/docs\/\*slug/);
      expect(result.routes[0].parameters).toContain('slug');
    });

    it('should handle nested dynamic segments', async () => {
      const adapter = new NextAppRouterAdapter();
      
      const context: AdapterContext = {
        repoRoot: '/test',
        filePath: '/test/app/api/users/[userId]/posts/[postId]/route.ts',
        content: `
export async function GET(request: Request) {
  return Response.json({ post: {} });
}
`,
      };

      const result = await adapter.extract(context);
      
      expect(result.routes.length).toBe(1);
      expect(result.routes[0].path).toBe('/api/users/:userId/posts/:postId');
      expect(result.routes[0].parameters).toContain('userId');
      expect(result.routes[0].parameters).toContain('postId');
    });
  });

  describe('Handler Detection', () => {
    it('should detect multiple HTTP methods', async () => {
      const adapter = new NextAppRouterAdapter();
      
      const context: AdapterContext = {
        repoRoot: '/test',
        filePath: '/test/app/api/users/route.ts',
        content: `
export async function GET(request: Request) {
  return Response.json({ users: [] });
}

export async function POST(request: Request) {
  return Response.json({ created: true });
}

export async function PUT(request: Request) {
  return Response.json({ updated: true });
}
`,
      };

      const result = await adapter.extract(context);
      
      expect(result.routes.length).toBe(3);
      expect(result.routes.some(r => r.method === 'GET')).toBe(true);
      expect(result.routes.some(r => r.method === 'POST')).toBe(true);
      expect(result.routes.some(r => r.method === 'PUT')).toBe(true);
    });

    it('should calculate confidence based on handler reliability', async () => {
      const adapter = new NextAppRouterAdapter();
      
      const context: AdapterContext = {
        repoRoot: '/test',
        filePath: '/test/app/api/users/route.ts',
        content: `
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ users: [] });
}
`,
      };

      const result = await adapter.extract(context);
      
      expect(result.routes.length).toBe(1);
      expect(result.routes[0].confidence).toBeGreaterThan(0.85);
      // Should have higher confidence due to type annotations
    });
  });
});

describe('NextPagesApiAdapter', () => {
  it('should normalize dynamic segments in Pages API', async () => {
    const adapter = new NextPagesApiAdapter();
    
    const context: AdapterContext = {
      repoRoot: '/test',
      filePath: '/test/pages/api/users/[id].ts',
      content: `
export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    res.json({ id: req.query.id });
  }
}
`,
    };

    const result = await adapter.extract(context);
    
    expect(result.routes.length).toBeGreaterThan(0);
    expect(result.routes[0].path).toBe('/api/users/:id');
    expect(result.routes[0].parameters).toContain('id');
  });

  it('should detect handled methods from req.method checks', async () => {
    const adapter = new NextPagesApiAdapter();
    
    const context: AdapterContext = {
      repoRoot: '/test',
      filePath: '/test/pages/api/users.ts',
      content: `
export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    res.json({ users: [] });
  } else if (req.method === 'POST') {
    res.json({ created: true });
  }
}
`,
    };

    const result = await adapter.extract(context);
    
    expect(result.routes.length).toBeGreaterThanOrEqual(2);
    expect(result.routes.some(r => r.method === 'GET')).toBe(true);
    expect(result.routes.some(r => r.method === 'POST')).toBe(true);
  });
});

describe('Route Discovery Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'route-scanner-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should discover routes matching runtime behavior - Fastify fixture', async () => {
    // Create mini Fastify app
    const serverFile = path.join(tempDir, 'server.ts');
    await fs.writeFile(
      serverFile,
      `
import Fastify from 'fastify';

const fastify = Fastify();

fastify.get('/health', async () => ({ status: 'ok' }));

fastify.post('/api/users', {
  schema: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    }
  }
}, async (req) => ({ id: 1, name: req.body.name }));

fastify.route({
  method: 'GET',
  url: '/api/users/:id',
  handler: async (req) => ({ id: req.params.id })
});

export default fastify;
`,
      'utf-8'
    );

    const adapter = new FastifyAdapter();
    const content = await fs.readFile(serverFile, 'utf-8');
    const result = await adapter.extract({
      repoRoot: tempDir,
      filePath: serverFile,
      content,
    });

    // Should discover all routes
    expect(result.routes.length).toBe(3);
    
    // Verify routes match expected runtime behavior
    expect(result.routes.some(r => r.method === 'GET' && r.path === '/health')).toBe(true);
    expect(result.routes.some(r => r.method === 'POST' && r.path === '/api/users')).toBe(true);
    expect(result.routes.some(r => r.method === 'GET' && r.path === '/api/users/:id')).toBe(true);
    
    // Verify parameters extracted
    const userByIdRoute = result.routes.find(r => r.path === '/api/users/:id');
    expect(userByIdRoute?.parameters).toContain('id');
    
    // Verify confidence scores are meaningful
    result.routes.forEach(route => {
      expect(route.confidence).toBeGreaterThanOrEqual(0.7);
      expect(route.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  it('should discover routes matching runtime behavior - Next.js App Router fixture', async () => {
    // Create mini Next.js App Router app
    const appDir = path.join(tempDir, 'app', 'api', 'users', '[id]');
    await fs.mkdir(appDir, { recursive: true });

    const routeFile = path.join(appDir, 'route.ts');
    await fs.writeFile(
      routeFile,
      `
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return NextResponse.json({ id: params.id });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const body = await request.json();
  return NextResponse.json({ id: params.id, ...body });
}
`,
      'utf-8'
    );

    const adapter = new NextAppRouterAdapter();
    const content = await fs.readFile(routeFile, 'utf-8');
    const result = await adapter.extract({
      repoRoot: tempDir,
      filePath: routeFile,
      content,
    });

    // Should discover both methods
    expect(result.routes.length).toBe(2);
    
    // Verify routes match expected runtime behavior
    expect(result.routes.some(r => r.method === 'GET' && r.path === '/api/users/:id')).toBe(true);
    expect(result.routes.some(r => r.method === 'PUT' && r.path === '/api/users/:id')).toBe(true);
    
    // Verify parameters extracted
    result.routes.forEach(route => {
      expect(route.parameters).toContain('id');
    });
    
    // Verify confidence scores
    result.routes.forEach(route => {
      expect(route.confidence).toBeGreaterThan(0.85);
    });
  });
});
