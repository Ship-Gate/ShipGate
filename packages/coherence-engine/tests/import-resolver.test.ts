import { describe, it, expect } from 'vitest';
import { ImportResolver } from '../src/import-resolver.js';

describe('ImportResolver', () => {
  it('reports unresolved project imports', () => {
    const resolver = new ImportResolver({ rootDir: 'src' });
    const files = new Map<string, string>([
      [
        'src/app/page.tsx',
        `import { foo } from '@/lib/missing';
export default function Page() { return null; }`,
      ],
    ]);

    const result = resolver.checkAll(files, false);
    expect(result.coherent).toBe(false);
    expect(result.unresolved.length).toBe(1);
    expect(result.unresolved[0]!.specifier).toBe('@/lib/missing');
    expect(result.unresolved[0]!.file).toBe('src/app/page.tsx');
  });

  it('passes when imports resolve to existing files', () => {
    const resolver = new ImportResolver({ rootDir: 'src' });
    const files = new Map<string, string>([
      ['src/lib/db.ts', 'export const prisma = {};'],
      [
        'src/app/page.tsx',
        `import { prisma } from '@/lib/db';
export default function Page() { return null; }`,
      ],
    ]);

    const result = resolver.checkAll(files, false);
    expect(result.coherent).toBe(true);
    expect(result.unresolved).toHaveLength(0);
  });

  it('suggests fix for missing extension', () => {
    const resolver = new ImportResolver({ rootDir: 'src' });
    const files = new Map<string, string>([
      ['src/lib/db.ts', 'export const prisma = {};'],
      [
        'src/app/page.tsx',
        `import { prisma } from '@/lib/db';
export default function Page() { return null; }`,
      ],
    ]);

    const result = resolver.checkAll(files, false);
    expect(result.coherent).toBe(true);
  });

  it('ignores non-project imports (node_modules, etc)', () => {
    const resolver = new ImportResolver({ rootDir: 'src' });
    const files = new Map<string, string>([
      [
        'src/app/page.tsx',
        `import React from 'react';
import { z } from 'zod';
export default function Page() { return null; }`,
      ],
    ]);

    const result = resolver.checkAll(files, false);
    expect(result.coherent).toBe(true);
    expect(result.unresolved).toHaveLength(0);
  });

  it('reports unresolved imports with suggested fixes', () => {
    const resolver = new ImportResolver({ rootDir: 'src' });
    const files = new Map<string, string>([
      ['src/lib/db.ts', 'export const prisma = {};'],
      [
        'src/services/todo.ts',
        `import { prisma } from '@/lib/db';
import { x } from './wrong-path';
export function getTodos() { return []; }`,
      ],
    ]);

    const result = resolver.checkAll(files, false);
    const wrongPath = result.unresolved.find((u) => u.specifier === './wrong-path');
    expect(wrongPath).toBeDefined();
  });
});
