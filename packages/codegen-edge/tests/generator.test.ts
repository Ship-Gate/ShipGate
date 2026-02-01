// ============================================================================
// Edge Code Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator';
import { generateCloudflare } from '../src/targets/cloudflare';
import { generateDeno } from '../src/targets/deno';
import { generateVercel } from '../src/targets/vercel';
import { generateNetlify } from '../src/targets/netlify';
import type * as AST from '../../../master_contracts/ast';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createSourceLocation = (): AST.SourceLocation => ({
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
});

const createTestDomain = (): AST.Domain => ({
  kind: 'Domain',
  name: { kind: 'Identifier', name: 'TestApp', location: createSourceLocation() },
  version: { kind: 'StringLiteral', value: '1.0.0', location: createSourceLocation() },
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      name: { kind: 'Identifier', name: 'User', location: createSourceLocation() },
      fields: [
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'id', location: createSourceLocation() },
          type: { kind: 'PrimitiveType', name: 'UUID', location: createSourceLocation() },
          optional: false,
          annotations: [],
          location: createSourceLocation(),
        },
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'email', location: createSourceLocation() },
          type: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
          optional: false,
          annotations: [],
          location: createSourceLocation(),
        },
      ],
      invariants: [],
      location: createSourceLocation(),
    },
  ],
  behaviors: [
    {
      kind: 'Behavior',
      name: { kind: 'Identifier', name: 'CreateUser', location: createSourceLocation() },
      description: { kind: 'StringLiteral', value: 'Create a new user', location: createSourceLocation() },
      input: {
        kind: 'InputSpec',
        fields: [
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'email', location: createSourceLocation() },
            type: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
            optional: false,
            annotations: [],
            location: createSourceLocation(),
          },
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'name', location: createSourceLocation() },
            type: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
            optional: true,
            annotations: [],
            location: createSourceLocation(),
          },
        ],
        location: createSourceLocation(),
      },
      output: {
        kind: 'OutputSpec',
        success: {
          kind: 'ReferenceType',
          name: {
            kind: 'QualifiedName',
            parts: [{ kind: 'Identifier', name: 'User', location: createSourceLocation() }],
            location: createSourceLocation(),
          },
          location: createSourceLocation(),
        },
        errors: [],
        location: createSourceLocation(),
      },
      preconditions: [],
      postconditions: [],
      invariants: [],
      temporal: [],
      security: [],
      compliance: [],
      location: createSourceLocation(),
    },
    {
      kind: 'Behavior',
      name: { kind: 'Identifier', name: 'GetUser', location: createSourceLocation() },
      input: {
        kind: 'InputSpec',
        fields: [
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'id', location: createSourceLocation() },
            type: { kind: 'PrimitiveType', name: 'UUID', location: createSourceLocation() },
            optional: false,
            annotations: [],
            location: createSourceLocation(),
          },
        ],
        location: createSourceLocation(),
      },
      output: {
        kind: 'OutputSpec',
        success: {
          kind: 'ReferenceType',
          name: {
            kind: 'QualifiedName',
            parts: [{ kind: 'Identifier', name: 'User', location: createSourceLocation() }],
            location: createSourceLocation(),
          },
          location: createSourceLocation(),
        },
        errors: [],
        location: createSourceLocation(),
      },
      preconditions: [],
      postconditions: [],
      invariants: [],
      temporal: [],
      security: [],
      compliance: [],
      location: createSourceLocation(),
    },
  ],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
  location: createSourceLocation(),
});

// ============================================================================
// GENERATOR TESTS
// ============================================================================

describe('generate', () => {
  it('should generate Cloudflare Workers code', () => {
    const domain = createTestDomain();
    const result = generate(domain, { target: 'cloudflare-workers' });

    expect(result.success).toBe(true);
    expect(result.code.files.length).toBeGreaterThan(0);
    expect(result.code.config.target).toBe('cloudflare-workers');
  });

  it('should generate Deno Deploy code', () => {
    const domain = createTestDomain();
    const result = generate(domain, { target: 'deno-deploy' });

    expect(result.success).toBe(true);
    expect(result.code.files.some(f => f.path === 'main.ts')).toBe(true);
    expect(result.code.files.some(f => f.path === 'deno.json')).toBe(true);
  });

  it('should generate Vercel Edge code', () => {
    const domain = createTestDomain();
    const result = generate(domain, { target: 'vercel-edge' });

    expect(result.success).toBe(true);
    expect(result.code.files.some(f => f.path.includes('route.ts'))).toBe(true);
    expect(result.code.files.some(f => f.path === 'middleware.ts')).toBe(true);
  });

  it('should generate Netlify Edge code', () => {
    const domain = createTestDomain();
    const result = generate(domain, { target: 'netlify-edge' });

    expect(result.success).toBe(true);
    expect(result.code.files.some(f => f.path.includes('netlify/edge-functions'))).toBe(true);
    expect(result.code.files.some(f => f.path === 'netlify.toml')).toBe(true);
  });

  it('should include CORS middleware when enabled', () => {
    const domain = createTestDomain();
    const result = generate(domain, { target: 'cloudflare-workers', cors: true });

    expect(result.success).toBe(true);
    expect(result.code.files.some(f => f.path === 'cors.ts')).toBe(true);
  });

  it('should include rate limiting when enabled', () => {
    const domain = createTestDomain();
    const result = generate(domain, {
      target: 'cloudflare-workers',
      rateLimit: { requests: 100, window: 60 },
    });

    expect(result.success).toBe(true);
    expect(result.code.files.some(f => f.path === 'rate-limit.ts')).toBe(true);
  });

  it('should include tests when requested', () => {
    const domain = createTestDomain();
    const result = generate(domain, {
      target: 'cloudflare-workers',
      includeTests: true,
    });

    expect(result.success).toBe(true);
    expect(result.code.files.some(f => f.type === 'test')).toBe(true);
  });
});

// ============================================================================
// CLOUDFLARE TESTS
// ============================================================================

describe('generateCloudflare', () => {
  it('should generate wrangler.toml', () => {
    const domain = createTestDomain();
    const code = generateCloudflare(domain, { target: 'cloudflare-workers' });

    const wranglerFile = code.files.find(f => f.path === 'wrangler.toml');
    expect(wranglerFile).toBeDefined();
    expect(wranglerFile?.content).toContain('name = "test-app"');
    expect(wranglerFile?.content).toContain('compatibility_date');
  });

  it('should generate handler for each behavior', () => {
    const domain = createTestDomain();
    const code = generateCloudflare(domain, { target: 'cloudflare-workers' });

    expect(code.files.some(f => f.path.includes('create-user'))).toBe(true);
    expect(code.files.some(f => f.path.includes('get-user'))).toBe(true);
  });

  it('should include KV binding', () => {
    const domain = createTestDomain();
    const code = generateCloudflare(domain, { target: 'cloudflare-workers' });

    expect(code.config.bindings.some(b => b.type === 'kv')).toBe(true);
  });
});

// ============================================================================
// DENO TESTS
// ============================================================================

describe('generateDeno', () => {
  it('should generate deno.json with tasks', () => {
    const domain = createTestDomain();
    const code = generateDeno(domain, { target: 'deno-deploy' });

    const configFile = code.files.find(f => f.path === 'deno.json');
    expect(configFile).toBeDefined();

    const config = JSON.parse(configFile!.content);
    expect(config.tasks).toHaveProperty('dev');
    expect(config.tasks).toHaveProperty('start');
    expect(config.tasks).toHaveProperty('test');
  });

  it('should generate KV client', () => {
    const domain = createTestDomain();
    const code = generateDeno(domain, { target: 'deno-deploy' });

    const kvFile = code.files.find(f => f.path === 'lib/kv.ts');
    expect(kvFile).toBeDefined();
    expect(kvFile?.content).toContain('Deno.openKv');
  });

  it('should use Deno-style imports', () => {
    const domain = createTestDomain();
    const code = generateDeno(domain, { target: 'deno-deploy' });

    const mainFile = code.files.find(f => f.path === 'main.ts');
    expect(mainFile?.content).toContain('.ts"');
  });
});

// ============================================================================
// VERCEL TESTS
// ============================================================================

describe('generateVercel', () => {
  it('should generate App Router structure', () => {
    const domain = createTestDomain();
    const code = generateVercel(domain, { target: 'vercel-edge' });

    expect(code.files.some(f => f.path.includes('api/'))).toBe(true);
    expect(code.files.some(f => f.path.includes('/route.ts'))).toBe(true);
  });

  it('should mark functions as edge runtime', () => {
    const domain = createTestDomain();
    const code = generateVercel(domain, { target: 'vercel-edge' });

    const routeFile = code.files.find(f => f.path.includes('route.ts'));
    expect(routeFile?.content).toContain("runtime = 'edge'");
  });

  it('should generate KV and Edge Config clients', () => {
    const domain = createTestDomain();
    const code = generateVercel(domain, { target: 'vercel-edge' });

    expect(code.files.some(f => f.path === 'lib/kv.ts')).toBe(true);
    expect(code.files.some(f => f.path === 'lib/edge-config.ts')).toBe(true);
  });
});

// ============================================================================
// NETLIFY TESTS
// ============================================================================

describe('generateNetlify', () => {
  it('should generate edge functions in correct directory', () => {
    const domain = createTestDomain();
    const code = generateNetlify(domain, { target: 'netlify-edge' });

    expect(code.files.every(f => 
      f.path.startsWith('netlify/') || f.path === 'netlify.toml'
    )).toBe(true);
  });

  it('should generate netlify.toml with edge function config', () => {
    const domain = createTestDomain();
    const code = generateNetlify(domain, { target: 'netlify-edge' });

    const configFile = code.files.find(f => f.path === 'netlify.toml');
    expect(configFile).toBeDefined();
    expect(configFile?.content).toContain('[[edge_functions]]');
  });

  it('should use Netlify Context type', () => {
    const domain = createTestDomain();
    const code = generateNetlify(domain, { target: 'netlify-edge' });

    const handlerFile = code.files.find(f => f.path.includes('create-user'));
    expect(handlerFile?.content).toContain("import type { Context }");
    expect(handlerFile?.content).toContain('context.geo');
  });
});

// ============================================================================
// MANIFEST TESTS
// ============================================================================

describe('manifest', () => {
  it('should include all behaviors', () => {
    const domain = createTestDomain();
    const result = generate(domain, { target: 'cloudflare-workers' });

    expect(result.code.manifest.behaviors).toHaveLength(2);
    expect(result.code.manifest.behaviors.map(b => b.name)).toContain('CreateUser');
    expect(result.code.manifest.behaviors.map(b => b.name)).toContain('GetUser');
  });

  it('should include platform limits', () => {
    const domain = createTestDomain();
    const result = generate(domain, { target: 'cloudflare-workers' });

    expect(result.code.manifest.limits.cpuTime).toBeDefined();
    expect(result.code.manifest.limits.memory).toBeDefined();
  });
});
