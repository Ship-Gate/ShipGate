// ============================================================================
// Golden Output Generation Test
//
// Generates proto + stubs from a mock domain and writes golden files.
// Run with UPDATE_GOLDEN=1 to regenerate golden files.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import type { DomainDeclaration } from '@isl-lang/isl-core';

// ==========================================================================
// FIXTURES
// ==========================================================================

const S = { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } };
const id = (name: string) => ({ kind: 'Identifier' as const, name, span: S });
const str = (value: string) => ({ kind: 'StringLiteral' as const, value, span: S });

const authDomain: DomainDeclaration = {
  kind: 'DomainDeclaration',
  name: id('Auth'),
  version: str('1.0.0'),
  uses: [],
  imports: [],
  types: [
    {
      kind: 'TypeDeclaration',
      name: id('Email'),
      baseType: { kind: 'SimpleType', name: id('String'), span: S },
      constraints: [
        { kind: 'TypeConstraint', name: id('pattern'), value: str('^[^\\s@]+@[^\\s@]+$'), span: S },
      ],
      span: S,
    },
    {
      kind: 'TypeDeclaration',
      name: id('HashedPassword'),
      baseType: { kind: 'SimpleType', name: id('String'), span: S },
      constraints: [
        { kind: 'TypeConstraint', name: id('min_length'), value: { kind: 'NumberLiteral', value: 60, span: S }, span: S },
      ],
      span: S,
    },
  ],
  enums: [
    {
      kind: 'EnumDeclaration',
      name: id('Role'),
      variants: [id('ADMIN'), id('USER'), id('GUEST')],
      span: S,
    },
    {
      kind: 'EnumDeclaration',
      name: id('SessionStatus'),
      variants: [id('ACTIVE'), id('EXPIRED'), id('REVOKED')],
      span: S,
    },
  ],
  entities: [
    {
      kind: 'EntityDeclaration',
      name: id('User'),
      fields: [
        { kind: 'FieldDeclaration', name: id('id'), type: { kind: 'SimpleType', name: id('UUID'), span: S }, optional: false, annotations: [{ kind: 'Annotation', name: id('immutable'), span: S }], constraints: [], span: S },
        { kind: 'FieldDeclaration', name: id('email'), type: { kind: 'SimpleType', name: id('Email'), span: S }, optional: false, annotations: [], constraints: [], span: S },
        { kind: 'FieldDeclaration', name: id('password_hash'), type: { kind: 'SimpleType', name: id('HashedPassword'), span: S }, optional: false, annotations: [{ kind: 'Annotation', name: id('sensitive'), span: S }], constraints: [], span: S },
        { kind: 'FieldDeclaration', name: id('role'), type: { kind: 'SimpleType', name: id('Role'), span: S }, optional: false, annotations: [], constraints: [], span: S },
        { kind: 'FieldDeclaration', name: id('created_at'), type: { kind: 'SimpleType', name: id('Timestamp'), span: S }, optional: false, annotations: [{ kind: 'Annotation', name: id('immutable'), span: S }], constraints: [], span: S },
      ],
      span: S,
    },
    {
      kind: 'EntityDeclaration',
      name: id('Session'),
      fields: [
        { kind: 'FieldDeclaration', name: id('id'), type: { kind: 'SimpleType', name: id('UUID'), span: S }, optional: false, annotations: [], constraints: [], span: S },
        { kind: 'FieldDeclaration', name: id('user_id'), type: { kind: 'SimpleType', name: id('UUID'), span: S }, optional: false, annotations: [], constraints: [], span: S },
        { kind: 'FieldDeclaration', name: id('token'), type: { kind: 'SimpleType', name: id('String'), span: S }, optional: false, annotations: [{ kind: 'Annotation', name: id('sensitive'), span: S }], constraints: [], span: S },
        { kind: 'FieldDeclaration', name: id('status'), type: { kind: 'SimpleType', name: id('SessionStatus'), span: S }, optional: false, annotations: [], constraints: [], span: S },
        { kind: 'FieldDeclaration', name: id('expires_at'), type: { kind: 'SimpleType', name: id('Timestamp'), span: S }, optional: false, annotations: [], constraints: [], span: S },
      ],
      span: S,
    },
  ],
  behaviors: [
    {
      kind: 'BehaviorDeclaration',
      name: id('RegisterUser'),
      description: str('Register a new user account'),
      input: {
        kind: 'InputBlock',
        fields: [
          { kind: 'FieldDeclaration', name: id('email'), type: { kind: 'SimpleType', name: id('Email'), span: S }, optional: false, annotations: [], constraints: [], span: S },
          { kind: 'FieldDeclaration', name: id('password'), type: { kind: 'SimpleType', name: id('String'), span: S }, optional: false, annotations: [{ kind: 'Annotation', name: id('sensitive'), span: S }], constraints: [], span: S },
          { kind: 'FieldDeclaration', name: id('role'), type: { kind: 'SimpleType', name: id('Role'), span: S }, optional: true, annotations: [], constraints: [], span: S },
        ],
        span: S,
      },
      output: {
        kind: 'OutputBlock',
        success: { kind: 'SimpleType', name: id('User'), span: S },
        errors: [
          { kind: 'ErrorDeclaration', name: id('DUPLICATE_EMAIL'), when: str('Email already registered'), retriable: false, span: S },
          { kind: 'ErrorDeclaration', name: id('INVALID_EMAIL'), when: str('Email format is invalid'), retriable: false, span: S },
          { kind: 'ErrorDeclaration', name: id('WEAK_PASSWORD'), when: str('Password does not meet requirements'), retriable: false, span: S },
        ],
        span: S,
      },
      span: S,
    },
    {
      kind: 'BehaviorDeclaration',
      name: id('Login'),
      description: str('Authenticate user and create session'),
      input: {
        kind: 'InputBlock',
        fields: [
          { kind: 'FieldDeclaration', name: id('email'), type: { kind: 'SimpleType', name: id('Email'), span: S }, optional: false, annotations: [], constraints: [], span: S },
          { kind: 'FieldDeclaration', name: id('password'), type: { kind: 'SimpleType', name: id('String'), span: S }, optional: false, annotations: [{ kind: 'Annotation', name: id('sensitive'), span: S }], constraints: [], span: S },
        ],
        span: S,
      },
      output: {
        kind: 'OutputBlock',
        success: { kind: 'SimpleType', name: id('Session'), span: S },
        errors: [
          { kind: 'ErrorDeclaration', name: id('INVALID_CREDENTIALS'), when: str('Email or password is incorrect'), retriable: false, span: S },
          { kind: 'ErrorDeclaration', name: id('ACCOUNT_LOCKED'), when: str('Too many failed attempts'), retriable: true, span: S },
        ],
        span: S,
      },
      span: S,
    },
    {
      kind: 'BehaviorDeclaration',
      name: id('Logout'),
      description: str('Revoke the current session'),
      input: {
        kind: 'InputBlock',
        fields: [
          { kind: 'FieldDeclaration', name: id('session_id'), type: { kind: 'SimpleType', name: id('UUID'), span: S }, optional: false, annotations: [], constraints: [], span: S },
        ],
        span: S,
      },
      output: {
        kind: 'OutputBlock',
        success: { kind: 'SimpleType', name: id('Boolean'), span: S },
        errors: [
          { kind: 'ErrorDeclaration', name: id('SESSION_NOT_FOUND'), when: str('Session does not exist'), retriable: false, span: S },
          { kind: 'ErrorDeclaration', name: id('SESSION_EXPIRED'), when: str('Session has already expired'), retriable: false, span: S },
        ],
        span: S,
      },
      span: S,
    },
  ],
  invariants: [],
  span: S,
};

// ==========================================================================
// GOLDEN DIRECTORY
// ==========================================================================

const GOLDEN_DIR = join(__dirname, '..', 'samples', 'golden');
const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === '1';

function goldenPath(filename: string): string {
  return join(GOLDEN_DIR, filename);
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function assertGoldenMatch(filename: string, actual: string): void {
  const path = goldenPath(filename);

  if (UPDATE_GOLDEN) {
    ensureDir(path);
    writeFileSync(path, actual, 'utf-8');
    return;
  }

  if (!existsSync(path)) {
    // Auto-create golden file on first run
    ensureDir(path);
    writeFileSync(path, actual, 'utf-8');
    return;
  }

  const expected = readFileSync(path, 'utf-8');
  expect(actual).toBe(expected);
}

// ==========================================================================
// GOLDEN TESTS
// ==========================================================================

describe('Golden Output - Proto', () => {
  const files = generate(authDomain, {
    package: 'isl.auth.v1',
    includeValidation: true,
    goPackage: 'github.com/isl-lang/auth/gen/go',
    generateCrud: true,
    generateStreaming: true,
  });

  it('should match golden .proto file', () => {
    const protoFile = files.find(f => f.path.endsWith('.proto') && f.type === 'proto');
    expect(protoFile).toBeDefined();
    assertGoldenMatch('proto/auth.proto', protoFile!.content);
  });
});

describe('Golden Output - TypeScript Stubs', () => {
  const files = generate(authDomain, {
    package: 'isl.auth.v1',
    generateTypeScript: true,
  });

  it('should match golden TypeScript client stub', () => {
    const clientFile = files.find(f => f.type === 'typescript' && f.path.includes('_client'));
    expect(clientFile).toBeDefined();
    assertGoldenMatch('typescript/auth_client.ts', clientFile!.content);
  });

  it('should match golden TypeScript server stub', () => {
    const serverFile = files.find(f => f.type === 'typescript' && f.path.includes('_server'));
    expect(serverFile).toBeDefined();
    assertGoldenMatch('typescript/auth_server.ts', serverFile!.content);
  });
});

describe('Golden Output - Full Buf Project', () => {
  const files = generate(authDomain, {
    package: 'isl.auth.v1',
    bufOrganization: 'isl-lang',
    bufModule: 'auth',
    includeValidation: true,
    generateTypeScript: true,
    includeConnect: true,
    generateGo: true,
    goPackage: 'github.com/isl-lang/auth/gen/go',
    generateCrud: true,
    generateStreaming: true,
  });

  it('should generate expected number of files', () => {
    // proto, isl_options not present (no customOptions), buf.yaml, buf.gen.yaml, ts client, ts server, ts types,
    // connect files, go files
    expect(files.length).toBeGreaterThan(5);
  });

  it('should include buf.yaml', () => {
    const bufYaml = files.find(f => f.path === 'buf.yaml');
    expect(bufYaml).toBeDefined();
    assertGoldenMatch('buf/buf.yaml', bufYaml!.content);
  });

  it('should include buf.gen.yaml', () => {
    const bufGenYaml = files.find(f => f.path === 'buf.gen.yaml');
    expect(bufGenYaml).toBeDefined();
    assertGoldenMatch('buf/buf.gen.yaml', bufGenYaml!.content);
  });
});
