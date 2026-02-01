// ============================================================================
// Validator Generator Tests
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
        { name: 'name', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [{ name: 'minLength', args: [1] }, { name: 'maxLength', args: [100] }] },
        { name: 'age', type: { kind: 'primitive', name: 'Int' }, optional: true, annotations: [{ name: 'min', args: [0] }, { name: 'max', args: [150] }] },
        { name: 'status', type: { kind: 'reference', name: 'UserStatus' }, optional: false, annotations: [] },
      ],
      invariants: [],
      annotations: [],
    },
  ],
  types: [
    {
      name: 'UserStatus',
      definition: {
        kind: 'enum',
        values: [{ name: 'PENDING' }, { name: 'ACTIVE' }, { name: 'SUSPENDED' }],
      },
      constraints: [],
      annotations: [],
    },
  ],
  behaviors: [
    {
      name: 'CreateUser',
      input: {
        fields: [
          { name: 'email', type: { kind: 'primitive', name: 'Email' }, optional: false, annotations: [] },
          { name: 'name', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [] },
        ],
      },
      output: {
        success: { kind: 'reference', name: 'User' },
        errors: [],
      },
      preconditions: [],
      postconditions: [],
      annotations: [],
    },
  ],
  scenarios: [],
  policies: [],
  annotations: [],
};

describe('Zod Validator Generation', () => {
  it('should generate validators file', () => {
    const files = generate(mockDomain, { library: 'zod' });

    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.path === 'validators.ts')).toBe(true);
  });

  it('should import zod', () => {
    const files = generate(mockDomain, { library: 'zod' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain("import { z } from 'zod'");
  });

  it('should generate entity schema', () => {
    const files = generate(mockDomain, { library: 'zod' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain('UserSchema = z.object');
    expect(validators?.content).toContain('id:');
    expect(validators?.content).toContain('email:');
    expect(validators?.content).toContain('name:');
  });

  it('should generate enum schema', () => {
    const files = generate(mockDomain, { library: 'zod' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain('UserStatusSchema = z.enum');
    expect(validators?.content).toContain("'PENDING'");
    expect(validators?.content).toContain("'ACTIVE'");
    expect(validators?.content).toContain("'SUSPENDED'");
  });

  it('should apply min/max constraints', () => {
    const files = generate(mockDomain, { library: 'zod' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain('.min(1)');
    expect(validators?.content).toContain('.max(100)');
    expect(validators?.content).toContain('.min(0)');
    expect(validators?.content).toContain('.max(150)');
  });

  it('should handle optional fields', () => {
    const files = generate(mockDomain, { library: 'zod' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain('.optional()');
  });

  it('should generate behavior input schemas', () => {
    const files = generate(mockDomain, { library: 'zod' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain('CreateUserInputSchema');
  });

  it('should use correct primitive types', () => {
    const files = generate(mockDomain, { library: 'zod' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain('z.string().uuid()');
    expect(validators?.content).toContain('z.string().email()');
    expect(validators?.content).toContain('z.number().int()');
  });

  it('should generate type definitions', () => {
    const files = generate(mockDomain, { library: 'zod' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain('type User = z.infer<typeof UserSchema>');
    expect(validators?.content).toContain('type UserStatus = z.infer<typeof UserStatusSchema>');
  });

  it('should generate index file', () => {
    const files = generate(mockDomain, { library: 'zod' });
    const index = files.find((f) => f.path === 'index.ts');

    expect(index).toBeDefined();
    expect(index?.content).toContain('export');
    expect(index?.content).toContain('UserSchema');
  });
});

describe('Yup Validator Generation', () => {
  it('should generate validators file', () => {
    const files = generate(mockDomain, { library: 'yup' });

    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.path === 'validators.ts')).toBe(true);
  });

  it('should import yup', () => {
    const files = generate(mockDomain, { library: 'yup' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain("import * as yup from 'yup'");
  });

  it('should generate entity schema', () => {
    const files = generate(mockDomain, { library: 'yup' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain('UserSchema = yup.object');
    expect(validators?.content).toContain('id:');
    expect(validators?.content).toContain('email:');
  });

  it('should generate enum schema', () => {
    const files = generate(mockDomain, { library: 'yup' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain('UserStatusSchema = yup.string().oneOf');
  });

  it('should use required() for non-optional fields', () => {
    const files = generate(mockDomain, { library: 'yup' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain('.required()');
  });

  it('should use correct Yup primitive types', () => {
    const files = generate(mockDomain, { library: 'yup' });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain('yup.string().uuid()');
    expect(validators?.content).toContain('yup.string().email()');
    expect(validators?.content).toContain('yup.number().integer()');
  });
});

describe('Custom Error Messages', () => {
  it('should include custom messages when enabled (zod)', () => {
    const files = generate(mockDomain, {
      library: 'zod',
      includeMessages: true,
    });
    const validators = files.find((f) => f.path === 'validators.ts');

    expect(validators?.content).toContain('required_error');
    expect(validators?.content).toContain('invalid_type_error');
  });

  it('should include custom messages when enabled (yup)', () => {
    const files = generate(mockDomain, {
      library: 'yup',
      includeMessages: true,
    });
    const validators = files.find((f) => f.path === 'validators.ts');

    // Yup messages are in min/max calls
    expect(validators?.content).toContain('must be at least');
  });
});

describe('Split Files Mode', () => {
  it('should generate separate files when splitFiles is true', () => {
    const files = generate(mockDomain, {
      library: 'zod',
      splitFiles: true,
    });

    expect(files.length).toBeGreaterThan(2);
    expect(files.some((f) => f.path.includes('user'))).toBe(true);
    expect(files.some((f) => f.path === 'index.ts')).toBe(true);
  });

  it('should generate barrel export in index', () => {
    const files = generate(mockDomain, {
      library: 'zod',
      splitFiles: true,
    });
    const index = files.find((f) => f.path === 'index.ts');

    expect(index?.content).toContain('export {');
    expect(index?.content).toContain('export type {');
  });
});
