// ============================================================================
// Mock Server Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator';
import type * as AST from '@isl-lang/isl-core';

const mockDomain: AST.Domain = {
  name: 'Users',
  version: '1.0.0',
  entities: [
    {
      name: 'User',
      fields: [
        { name: 'id', type: { kind: 'primitive', name: 'UUID' }, optional: false, annotations: [] },
        { name: 'email', type: { kind: 'primitive', name: 'Email' }, optional: false, annotations: [] },
        { name: 'name', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [] },
      ],
      invariants: [],
      annotations: [],
    },
  ],
  types: [],
  behaviors: [
    {
      name: 'CreateUser',
      input: { fields: [] },
      output: { success: { kind: 'reference', name: 'User' }, errors: [] },
      preconditions: [],
      postconditions: [],
      annotations: [],
    },
    {
      name: 'GetUserById',
      input: { fields: [] },
      output: { success: { kind: 'reference', name: 'User' }, errors: [] },
      preconditions: [],
      postconditions: [],
      annotations: [],
    },
    {
      name: 'ListUsers',
      input: { fields: [] },
      output: { success: { kind: 'list', elementType: { kind: 'reference', name: 'User' } }, errors: [] },
      preconditions: [],
      postconditions: [],
      annotations: [],
    },
  ],
  scenarios: [],
  policies: [],
  annotations: [],
};

describe('MSW Mock Generation', () => {
  it('should generate handlers file', () => {
    const files = generate(mockDomain, { framework: 'msw' });
    expect(files.some((f) => f.path === 'handlers.ts')).toBe(true);
  });

  it('should generate factories file', () => {
    const files = generate(mockDomain, { framework: 'msw' });
    const factoriesFile = files.find((f) => f.path === 'factories.ts');
    expect(factoriesFile).toBeDefined();
  });

  it('should import msw', () => {
    const files = generate(mockDomain, { framework: 'msw' });
    const handlers = files.find((f) => f.path === 'handlers.ts');
    expect(handlers?.content).toContain("from 'msw'");
  });
});

describe('Express Mock Generation', () => {
  it('should generate server file', () => {
    const files = generate(mockDomain, { framework: 'express' });
    expect(files.some((f) => f.path === 'server.ts')).toBe(true);
  });

  it('should import express', () => {
    const files = generate(mockDomain, { framework: 'express' });
    const server = files.find((f) => f.path === 'server.ts');
    expect(server?.content).toContain("import express from 'express'");
  });
});
