import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  SpecInferenceEngine,
  detectFramework,
  inferEntities,
  inferEndpoints,
  inferBehaviors,
  inferActors,
  writeInferredSpec,
} from '../src/index.js';

const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('detect-framework', () => {
  it('detects Next.js + Prisma in nextjs-prisma fixture', async () => {
    const result = await detectFramework(path.join(FIXTURES, 'nextjs-prisma'));
    expect(result.web).toBe('nextjs');
    expect(result.orm).toBe('prisma');
    expect(result.details.hasAppRouter).toBe(true);
  });

  it('detects Express + Mongoose in express-mongoose fixture', async () => {
    const result = await detectFramework(path.join(FIXTURES, 'express-mongoose'));
    expect(result.web).toBe('express');
    expect(result.orm).toBe('mongoose');
  });

  it('detects Fastify in fastify-zod fixture', async () => {
    const result = await detectFramework(path.join(FIXTURES, 'fastify-zod'));
    expect(result.web).toBe('fastify');
    expect(result.orm).toBe('unknown');
  });
});

describe('entity inference', () => {
  it('infers entities from Prisma schema (nextjs-prisma)', async () => {
    const projectRoot = path.join(FIXTURES, 'nextjs-prisma');
    const sourceFiles: string[] = [];
    const { entities, enums } = await inferEntities(projectRoot, sourceFiles, 'prisma');

    expect(entities.length).toBeGreaterThanOrEqual(1);
    const userEntity = entities.find((e) => e.name === 'User');
    expect(userEntity).toBeDefined();
    expect(userEntity!.fields.some((f) => f.name === 'id' || f.name === 'email')).toBe(true);
    expect(userEntity!.confidence).toBe('high');

    if (enums.length > 0) {
      const taskStatus = enums.find((e) => e.name === 'TaskStatus');
      expect(taskStatus?.members).toContain('PENDING');
    }
  });

  it('infers entities from Zod schemas (fastify-zod)', async () => {
    const projectRoot = path.join(FIXTURES, 'fastify-zod');
    const schemaPath = path.join(projectRoot, 'src', 'schemas.ts');
    const { entities } = await inferEntities(projectRoot, [schemaPath], 'unknown');

    expect(entities.length).toBeGreaterThanOrEqual(1);
    const createTodo = entities.find((e) => e.name === 'CreateTodoSchema' || e.name?.includes('CreateTodo'));
    if (createTodo) {
      expect(createTodo.fields.some((f) => f.name === 'title')).toBe(true);
    }
  });

  it('infers entities from TypeScript interfaces (express-mongoose)', async () => {
    const projectRoot = path.join(FIXTURES, 'express-mongoose');
    const modelPath = path.join(projectRoot, 'src', 'models', 'User.ts');
    const { entities } = await inferEntities(projectRoot, [modelPath], 'mongoose');

    const userDoc = entities.find((e) => e.name === 'UserDoc' || e.name === 'User');
    expect(userDoc).toBeDefined();
  });
});

describe('endpoint inference', () => {
  it('infers Next.js App Router endpoints (nextjs-prisma)', async () => {
    const projectRoot = path.join(FIXTURES, 'nextjs-prisma');
    const endpoints = await inferEndpoints(projectRoot, 'nextjs');

    expect(endpoints.length).toBeGreaterThanOrEqual(4);
    const getTasks = endpoints.find((e) => e.method === 'GET' && e.path.includes('tasks'));
    expect(getTasks).toBeDefined();
    const postTasks = endpoints.find((e) => e.method === 'POST' && e.path.includes('tasks'));
    expect(postTasks).toBeDefined();
  });

  it('infers Express routes (express-mongoose)', async () => {
    const projectRoot = path.join(FIXTURES, 'express-mongoose');
    const endpoints = await inferEndpoints(projectRoot, 'express');

    expect(endpoints.length).toBeGreaterThanOrEqual(5);
    expect(endpoints.some((e) => e.path.includes('users'))).toBe(true);
    expect(endpoints.some((e) => e.path.includes('auth'))).toBe(true);
  });

  it('infers Fastify routes (fastify-zod)', async () => {
    const projectRoot = path.join(FIXTURES, 'fastify-zod');
    const endpoints = await inferEndpoints(projectRoot, 'fastify');

    expect(endpoints.length).toBeGreaterThanOrEqual(5);
    expect(endpoints.some((e) => e.path.includes('todos'))).toBe(true);
  });
});

describe('behavior inference', () => {
  it('infers behaviors from service functions (fastify-zod)', async () => {
    const projectRoot = path.join(FIXTURES, 'fastify-zod');
    const servicePath = path.join(projectRoot, 'src', 'services', 'todo-service.ts');
    const behaviors = await inferBehaviors(projectRoot, [servicePath]);

    expect(behaviors.length).toBeGreaterThanOrEqual(2);
    const createTodo = behaviors.find((b) => b.name === 'createTodo');
    expect(createTodo).toBeDefined();
    expect(Object.keys(createTodo!.input).length).toBeGreaterThanOrEqual(1);
  });
});

describe('actor inference', () => {
  it('infers actors from auth patterns (nextjs-prisma)', async () => {
    const projectRoot = path.join(FIXTURES, 'nextjs-prisma');
    const actors = await inferActors(projectRoot);

    expect(actors.length).toBeGreaterThanOrEqual(1);
    expect(actors.some((a) => a.name === 'Anonymous' || a.name === 'User')).toBe(true);
  });
});

describe('SpecInferenceEngine', () => {
  it('runs full inference on nextjs-prisma fixture', async () => {
    const projectRoot = path.join(FIXTURES, 'nextjs-prisma');
    const engine = new SpecInferenceEngine({
      projectRoot,
      domainName: 'NextjsPrismaFixture',
      writeFile: false,
    });

    const result = await engine.infer({ writeFile: false });

    expect(result.spec.domainName).toBe('NextjsPrismaFixture');
    expect(result.spec.entities.length).toBeGreaterThanOrEqual(1);
    expect(result.spec.endpoints.length).toBeGreaterThanOrEqual(4);
    expect(result.spec.framework.web).toBe('nextjs');
    expect(result.spec.framework.orm).toBe('prisma');
    expect(result.confidenceScore).toBeGreaterThan(0);
  });

  it('runs full inference on express-mongoose fixture', async () => {
    const projectRoot = path.join(FIXTURES, 'express-mongoose');
    const engine = new SpecInferenceEngine({
      projectRoot,
      domainName: 'ExpressMongooseFixture',
      writeFile: false,
    });

    const result = await engine.infer({ writeFile: false });

    expect(result.spec.domainName).toBe('ExpressMongooseFixture');
    expect(result.spec.endpoints.length).toBeGreaterThanOrEqual(5);
    expect(result.spec.framework.web).toBe('express');
  });

  it('runs full inference on fastify-zod fixture', async () => {
    const projectRoot = path.join(FIXTURES, 'fastify-zod');
    const engine = new SpecInferenceEngine({
      projectRoot,
      domainName: 'FastifyZodFixture',
      writeFile: false,
    });

    const result = await engine.infer({ writeFile: false });

    expect(result.spec.domainName).toBe('FastifyZodFixture');
    expect(result.spec.endpoints.length).toBeGreaterThanOrEqual(5);
    expect(result.spec.behaviors.length).toBeGreaterThanOrEqual(2);
    expect(result.spec.framework.web).toBe('fastify');
  });

  it('writes inferred spec to .isl-verify/inferred-spec.isl', async () => {
    const projectRoot = path.join(FIXTURES, 'nextjs-prisma');
    const outputDir = path.join(projectRoot, '.isl-verify');
    const outputPath = path.join(outputDir, 'inferred-spec.isl');

    const engine = new SpecInferenceEngine({
      projectRoot,
      domainName: 'TestDomain',
      writeFile: true,
    });

    const result = await engine.infer({
      writeFile: true,
      outputPath,
    });

    expect(result.outputPath).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('domain TestDomain');
    expect(content).toContain('entity User');
    expect(content).toContain('api {');
    expect(content).toMatch(/\[high\]|\[medium\]|\[low\]/);

    // Cleanup
    fs.rmSync(outputDir, { recursive: true, force: true });
  });
});

describe('spec-writer', () => {
  it('writes valid ISL with confidence comments', async () => {
    const outputPath = path.join(FIXTURES, 'nextjs-prisma', '.test-output.isl');
    const spec = {
      domainName: 'TestDomain',
      entities: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', annotations: ['immutable', 'unique'] },
            { name: 'email', type: 'String', annotations: ['unique'] },
          ],
          confidence: 'high' as const,
          source: 'prisma',
        },
      ],
      enums: [],
      endpoints: [
        {
          method: 'GET' as const,
          path: '/users',
          auth: 'authenticated',
          confidence: 'high' as const,
          source: 'nextjs',
        },
      ],
      behaviors: [],
      actors: [],
      framework: {
        web: 'nextjs' as const,
        orm: 'prisma' as const,
        details: {},
      },
    };

    await writeInferredSpec(spec, outputPath);

    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('domain TestDomain');
    expect(content).toContain('entity User');
    expect(content).toContain('id: UUID [immutable, unique]');
    expect(content).toContain('GET "/users"');
    expect(content).toContain('[high]');

    fs.unlinkSync(outputPath);
  });
});
