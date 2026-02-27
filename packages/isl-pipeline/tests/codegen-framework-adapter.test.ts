/**
 * Tests for Codegen Framework Adapters (NextJSAdapter, ExpressAdapter)
 */

import { describe, it, expect } from 'vitest';
import {
  NextJSAdapter,
  ExpressAdapter,
  type ISLSpec,
  type CodegenContext,
} from '../src/adapters/index.js';
import { getFrameworkInstructions } from '../src/code-templates.js';

// ============================================================================
// Fixtures
// ============================================================================

function createLoginSpec(): ISLSpec {
  return {
    kind: 'Domain',
    name: 'Auth',
    version: '1.0.0',
    entities: [],
    behaviors: [
      {
        kind: 'Behavior',
        name: 'UserLogin',
        description: 'User login',
        input: [
          { kind: 'Field', name: 'email', type: { kind: 'Type', name: 'Email' }, optional: false, constraints: [] },
          { kind: 'Field', name: 'password', type: { kind: 'Type', name: 'String' }, optional: false, constraints: [] },
        ],
        output: {
          kind: 'Output',
          success: { kind: 'Type', name: 'AuthToken' },
          errors: [
            { kind: 'Error', name: 'InvalidCredentials', when: 'Invalid email or password' },
          ],
        },
        preconditions: [],
        postconditions: [],
        invariants: [],
        intents: [
          { kind: 'Intent', tag: 'rate-limit-required', description: '' },
          { kind: 'Intent', tag: 'audit-required', description: '' },
        ],
      },
    ],
    invariants: [],
    metadata: {
      generatedFrom: 'nl-translator',
      prompt: 'login',
      timestamp: new Date().toISOString(),
      confidence: 0.9,
    },
  };
}

function createSimpleSpec(): ISLSpec {
  return {
    kind: 'Domain',
    name: 'Todo',
    version: '1.0.0',
    entities: [],
    behaviors: [
      {
        kind: 'Behavior',
        name: 'CreateTodo',
        description: 'Create a todo',
        input: [
          { kind: 'Field', name: 'title', type: { kind: 'Type', name: 'String' }, optional: false, constraints: [] },
        ],
        output: {
          kind: 'Output',
          success: { kind: 'Type', name: 'Todo' },
          errors: [],
        },
        preconditions: [],
        postconditions: [],
        invariants: [],
        intents: [],
      },
    ],
    invariants: [],
    metadata: {
      generatedFrom: 'nl-translator',
      prompt: 'todo',
      timestamp: new Date().toISOString(),
      confidence: 0.9,
    },
  };
}

const baseContext: CodegenContext = {
  spec: createLoginSpec(),
  repoContext: {
    framework: 'express',
    validationLib: 'zod',
    routingStyle: 'explicit',
    conventions: { apiPrefix: '/api' },
  },
};

// ============================================================================
// NextJSAdapter Tests
// ============================================================================

describe('NextJSAdapter', () => {
  it('has correct name', () => {
    expect(NextJSAdapter.name).toBe('nextjs');
  });

  it('generateProjectStructure produces FileMap with route files', () => {
    const spec = createLoginSpec();
    const map = NextJSAdapter.generateProjectStructure(spec);

    expect(map.has('app/api/user-login/route.ts')).toBe(true);
    expect(map.has('app/api/user-login/route.test.ts')).toBe(true);
    expect(map.get('app/api/user-login/route.ts')).toContain('NextRequest');
    expect(map.get('app/api/user-login/route.ts')).toContain('UserLogin');
  });

  it('generateRouteFile returns GeneratedFile for endpoint', () => {
    const spec = createLoginSpec();
    const endpoint = spec.behaviors[0]!;
    const ctx: CodegenContext = { ...baseContext, spec };
    const file = NextJSAdapter.generateRouteFile(endpoint, ctx);

    expect(file.path).toBe('app/api/user-login/route.ts');
    expect(file.content).toContain('POST');
    expect(file.content).toContain('UserLoginSchema');
  });

  it('generateMiddleware includes rate-limit and audit when intents present', () => {
    const spec = createLoginSpec();
    const middleware = NextJSAdapter.generateMiddleware(spec);

    expect(middleware.some((m) => m.path.includes('rate-limit'))).toBe(true);
    expect(middleware.some((m) => m.path.includes('audit'))).toBe(true);
  });

  it('generateMiddleware is minimal when no intents', () => {
    const spec = createSimpleSpec();
    const middleware = NextJSAdapter.generateMiddleware(spec);

    expect(middleware.length).toBe(0);
  });

  it('getPackageDeps returns next, react, zod', () => {
    const deps = NextJSAdapter.getPackageDeps();
    expect(deps['next']).toBeDefined();
    expect(deps['zod']).toBeDefined();
  });

  it('getScripts returns dev, build, start', () => {
    const scripts = NextJSAdapter.getScripts();
    expect(scripts.dev).toContain('next');
    expect(scripts.build).toContain('next');
  });

  it('getTsConfig returns valid tsconfig', () => {
    const config = NextJSAdapter.getTsConfig() as { compilerOptions?: { paths?: Record<string, string[]> } };
    expect(config.compilerOptions?.paths?.['@/*']).toBeDefined();
  });
});

// ============================================================================
// ExpressAdapter Tests
// ============================================================================

describe('ExpressAdapter', () => {
  it('has correct name', () => {
    expect(ExpressAdapter.name).toBe('express');
  });

  it('generateProjectStructure produces Express structure', () => {
    const spec = createLoginSpec();
    const map = ExpressAdapter.generateProjectStructure(spec);

    expect(map.has('src/routes/user-login.ts')).toBe(true);
    expect(map.has('src/controllers/user-login.ts')).toBe(true);
    expect(map.has('src/services/user-login.ts')).toBe(true);
    expect(map.has('src/validators/user-login.ts')).toBe(true);
    expect(map.has('src/index.ts')).toBe(true);
    expect(map.has('src/lib/db.ts')).toBe(true);
  });

  it('generateProjectStructure includes middleware files', () => {
    const spec = createLoginSpec();
    const map = ExpressAdapter.generateProjectStructure(spec);

    expect(map.has('src/middleware/error-handler.ts')).toBe(true);
    expect(map.has('src/middleware/request-logger.ts')).toBe(true);
    expect(map.has('src/middleware/cors.ts')).toBe(true);
    expect(map.has('src/middleware/rate-limit.ts')).toBe(true);
    expect(map.has('src/middleware/audit.ts')).toBe(true);
    expect(map.has('src/middleware/auth.ts')).toBe(true);
  });

  it('generateRouteFile returns Express Router file', () => {
    const spec = createLoginSpec();
    const endpoint = spec.behaviors[0]!;
    const ctx: CodegenContext = { ...baseContext, spec };
    const file = ExpressAdapter.generateRouteFile(endpoint, ctx);

    expect(file.path).toBe('src/routes/user-login.ts');
    expect(file.content).toContain('Router');
    expect(file.content).toContain('express');
  });

  it('generateEntryPoint produces src/index.ts with app and routes', () => {
    const spec = createLoginSpec();
    const entry = ExpressAdapter.generateEntryPoint(spec);

    expect(entry.path).toBe('src/index.ts');
    expect(entry.content).toContain('express');
    expect(entry.content).toContain('app.use');
    expect(entry.content).toContain('/api/user-login');
    expect(entry.content).toContain('errorHandler');
  });

  it('getPackageDeps returns express, zod, prisma', () => {
    const deps = ExpressAdapter.getPackageDeps();
    expect(deps['express']).toBeDefined();
    expect(deps['zod']).toBeDefined();
    expect(deps['@prisma/client']).toBeDefined();
  });

  it('getScripts returns dev, build, start, db commands', () => {
    const scripts = ExpressAdapter.getScripts();
    expect(scripts.dev).toContain('tsx');
    expect(scripts['db:generate']).toContain('prisma');
  });

  it('getTsConfig returns NodeNext module resolution', () => {
    const config = ExpressAdapter.getTsConfig() as { compilerOptions?: { module?: string } };
    expect(config.compilerOptions?.module).toBe('NodeNext');
  });

  it('controller content includes error classes for output errors', () => {
    const spec = createLoginSpec();
    const map = ExpressAdapter.generateProjectStructure(spec);
    const controllerContent = map.get('src/controllers/user-login.ts') ?? '';

    expect(controllerContent).toContain('InvalidCredentialsError');
    expect(controllerContent).toContain('res.status(401)');
  });

  it('controller imports schema from validators (no duplication)', () => {
    const spec = createLoginSpec();
    const map = ExpressAdapter.generateProjectStructure(spec);
    const controllerContent = map.get('src/controllers/user-login.ts') ?? '';

    expect(controllerContent).toContain("from '../validators/user-login.js'");
    expect(controllerContent).toContain('UserLoginSchema');
    expect(controllerContent).not.toContain('z.object({');
  });

  it('generateProjectStructure with no intents produces minimal middleware (no rate-limit, no audit)', () => {
    const spec = createSimpleSpec();
    const map = ExpressAdapter.generateProjectStructure(spec);

    expect(map.has('src/middleware/rate-limit.ts')).toBe(false);
    expect(map.has('src/middleware/audit.ts')).toBe(false);
    expect(map.has('src/middleware/error-handler.ts')).toBe(true);
    expect(map.has('src/middleware/auth.ts')).toBe(true);
  });

  it('generateProjectStructure with multiple behaviors produces separate route/controller/service per behavior', () => {
    const spec: ISLSpec = {
      ...createLoginSpec(),
      behaviors: [
        createLoginSpec().behaviors[0]!,
        {
          kind: 'Behavior',
          name: 'CreateTodo',
          description: 'Create todo',
          input: [
            { kind: 'Field', name: 'title', type: { kind: 'Type', name: 'String' }, optional: false, constraints: [] },
          ],
          output: { kind: 'Output', success: { kind: 'Type', name: 'Todo' }, errors: [] },
          preconditions: [],
          postconditions: [],
          invariants: [],
          intents: [],
        },
      ],
    };
    const map = ExpressAdapter.generateProjectStructure(spec);

    expect(map.has('src/routes/user-login.ts')).toBe(true);
    expect(map.has('src/routes/create-todo.ts')).toBe(true);
    expect(map.has('src/controllers/user-login.ts')).toBe(true);
    expect(map.has('src/controllers/create-todo.ts')).toBe(true);
    expect(map.has('src/services/user-login.ts')).toBe(true);
    expect(map.has('src/services/create-todo.ts')).toBe(true);
  });

  it('entry point registers all behavior routes under /api/', () => {
    const spec = createLoginSpec();
    const entry = ExpressAdapter.generateEntryPoint(spec);

    expect(entry.content).toContain("app.use('/api/user-login'");
    expect(entry.content).toContain('user-loginRoutes');
    expect(entry.content).toContain('errorHandler');
  });
});

// ============================================================================
// Framework-Aware Prompt Instructions
// ============================================================================

describe('getFrameworkInstructions', () => {
  it('returns Express instructions for express framework', () => {
    const instructions = getFrameworkInstructions('express');
    expect(instructions).toContain('Express');
    expect(instructions).toContain('src/routes/');
    expect(instructions).toContain('src/controllers/');
    expect(instructions).toContain('src/services/');
    expect(instructions).toContain('src/validators/');
    expect(instructions).toContain('src/middleware/');
    expect(instructions).toContain('Router');
    expect(instructions).toContain('Prisma');
  });

  it('returns Next.js instructions for nextjs framework', () => {
    const instructions = getFrameworkInstructions('nextjs');
    expect(instructions).toContain('Next.js');
    expect(instructions).toContain('NextResponse');
    expect(instructions).toContain('app/api/');
  });

  it('defaults to Next.js for unknown framework', () => {
    const instructions = getFrameworkInstructions('unknown');
    expect(instructions).toContain('Next.js');
  });
});
