import { describe, it, expect, beforeEach } from 'vitest';
import { CoherenceEngine } from '../src/coherence-engine.js';

describe('CoherenceEngine', () => {
  let engine: CoherenceEngine;

  beforeEach(() => {
    engine = new CoherenceEngine({ rootDir: 'src' });
  });

  it('maintains empty manifest initially', () => {
    const manifest = engine.getManifest();
    expect(manifest.size).toBe(0);
  });

  it('registers file and updates manifest with exports and dependencies', () => {
    const content = `
import { prisma } from '@/lib/db';
import type { Todo } from '@/types';

export function getTodos() {
  return prisma.todo.findMany();
}

export type TodoInput = { title: string };
    `.trim();

    engine.registerFile('src/services/todo.ts', content);

    const manifest = engine.getManifest();
    expect(manifest.size).toBe(1);

    const entry = manifest.get('src/services/todo.ts');
    expect(entry).toBeDefined();
    expect(entry!.exports).toContain('getTodos');
    expect(entry!.types).toContain('TodoInput');
    expect(entry!.dependencies).toContain('@/lib/db');
    expect(entry!.dependencies).toContain('@/types');
  });

  it('provides codegen context with manifest', () => {
    engine.registerFile('src/lib/db.ts', 'export const prisma = new PrismaClient();');
    const ctx = engine.getCodegenContext();

    expect(ctx.manifest['src/lib/db.ts']).toBeDefined();
    expect(ctx.manifest['src/lib/db.ts']!.exports).toContain('prisma');
    expect(ctx.suggestedImports.length).toBeGreaterThan(0);
  });

  it('formats manifest for prompt injection', () => {
    engine.registerFile('src/lib/db.ts', 'export const prisma = new PrismaClient();');
    const formatted = engine.formatManifestForPrompt();

    expect(formatted).toContain('src/lib/db.ts');
    expect(formatted).toContain('prisma');
  });

  it('runs coherence check - coherent when all imports resolve', () => {
    const files = new Map<string, string>([
      ['src/lib/db.ts', 'export const prisma = {};'],
      [
        'src/services/todo.ts',
        `import { prisma } from '@/lib/db';
export function getTodos() { return []; }`,
      ],
    ]);

    for (const [path, content] of files) {
      engine.registerFile(path, content);
    }

    const result = engine.runCoherenceCheck(files);
    expect(result.coherent).toBe(true);
    expect(result.unresolved).toHaveLength(0);
  });

  it('runs coherence check - reports unresolved imports', () => {
    const files = new Map<string, string>([
      [
        'src/services/todo.ts',
        `import { prisma } from '@/lib/missing';
import { x } from './nonexistent';
export function getTodos() { return []; }`,
      ],
    ]);

    for (const [path, content] of files) {
      engine.registerFile(path, content);
    }

    const result = engine.runCoherenceCheck(files);
    expect(result.coherent).toBe(false);
    expect(result.unresolved.length).toBeGreaterThan(0);
  });

  it('resets manifest', () => {
    engine.registerFile('src/lib/db.ts', 'export const x = 1;');
    expect(engine.getManifest().size).toBe(1);

    engine.reset();
    expect(engine.getManifest().size).toBe(0);
  });
});
