import { describe, it, expect } from 'vitest';
import { parseImports, parseExports, isProjectImport } from '../src/parser.js';

describe('parseImports', () => {
  it('parses named imports', () => {
    const source = `import { foo, bar } from './utils';`;
    const imports = parseImports(source);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.specifier).toBe('./utils');
    expect(imports[0]!.names).toContain('foo');
    expect(imports[0]!.names).toContain('bar');
  });

  it('parses default import', () => {
    const source = `import React from 'react';`;
    const imports = parseImports(source);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.specifier).toBe('react');
    expect(imports[0]!.names).toContain('React');
  });

  it('parses type-only imports', () => {
    const source = `import type { Todo } from '@/types';`;
    const imports = parseImports(source);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.typeOnly).toBe(true);
    expect(imports[0]!.specifier).toBe('@/types');
  });

  it('parses @/ alias imports', () => {
    const source = `import { prisma } from '@/lib/db';`;
    const imports = parseImports(source);
    expect(imports).toHaveLength(1);
    expect(imports[0]!.specifier).toBe('@/lib/db');
  });
});

describe('parseExports', () => {
  it('parses export function', () => {
    const source = `export function getTodos() { return []; }`;
    const exports = parseExports(source);
    expect(exports).toHaveLength(1);
    expect(exports[0]!.name).toBe('getTodos');
    expect(exports[0]!.isType).toBe(false);
  });

  it('parses export const', () => {
    const source = `export const prisma = new PrismaClient();`;
    const exports = parseExports(source);
    expect(exports).toHaveLength(1);
    expect(exports[0]!.name).toBe('prisma');
  });

  it('parses export type', () => {
    const source = `export type Todo = { id: string; title: string };`;
    const exports = parseExports(source);
    expect(exports).toHaveLength(1);
    expect(exports[0]!.name).toBe('Todo');
    expect(exports[0]!.isType).toBe(true);
  });

  it('parses export interface', () => {
    const source = `export interface Todo { id: string; }`;
    const exports = parseExports(source);
    expect(exports).toHaveLength(1);
    expect(exports[0]!.name).toBe('Todo');
    expect(exports[0]!.isType).toBe(true);
  });

  it('parses export { a, b }', () => {
    const source = `export { foo, bar as baz };`;
    const exports = parseExports(source);
    expect(exports).toHaveLength(2);
    expect(exports.map((e) => e.name)).toContain('foo');
    expect(exports.map((e) => e.name)).toContain('baz');
  });
});

describe('isProjectImport', () => {
  it('returns true for relative paths', () => {
    expect(isProjectImport('./utils')).toBe(true);
    expect(isProjectImport('../lib/db')).toBe(true);
  });

  it('returns true for @/ alias', () => {
    expect(isProjectImport('@/lib/db')).toBe(true);
  });

  it('returns false for node_modules', () => {
    expect(isProjectImport('react')).toBe(false);
    expect(isProjectImport('zod')).toBe(false);
  });
});
