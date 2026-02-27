/**
 * Tests for codegen-types package
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generate,
  CodeGenerator,
  TypeScriptGenerator,
  PythonGenerator,
  ZodGenerator,
  SerdesGenerator,
} from '../src/index.js';

import type {
  DomainDeclaration,
  EntityDeclaration,
  EnumDeclaration,
  TypeDeclaration,
  BehaviorDeclaration,
  FieldDeclaration,
  TypeExpression,
} from '@isl-lang/isl-core';

// ============================================================================
// Test Fixtures
// ============================================================================

function createSpan() {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
  };
}

function createIdentifier(name: string) {
  return { kind: 'Identifier' as const, name, span: createSpan() };
}

function createStringLiteral(value: string) {
  return { kind: 'StringLiteral' as const, value, span: createSpan() };
}

function createSimpleType(name: string): TypeExpression {
  return { kind: 'SimpleType' as const, name: createIdentifier(name), span: createSpan() };
}

function createField(
  name: string,
  type: TypeExpression,
  options: { optional?: boolean; annotations?: string[] } = {}
): FieldDeclaration {
  return {
    kind: 'FieldDeclaration',
    name: createIdentifier(name),
    type,
    optional: options.optional ?? false,
    annotations: (options.annotations ?? []).map(a => ({
      kind: 'Annotation' as const,
      name: createIdentifier(a),
      span: createSpan(),
    })),
    constraints: [],
    span: createSpan(),
  };
}

function createMinimalDomain(): DomainDeclaration {
  return {
    kind: 'DomainDeclaration',
    name: createIdentifier('TestDomain'),
    version: createStringLiteral('1.0.0'),
    imports: [],
    entities: [],
    types: [],
    enums: [],
    behaviors: [],
    invariants: [],
    span: createSpan(),
  };
}

function createUserEntity(): EntityDeclaration {
  return {
    kind: 'EntityDeclaration',
    name: createIdentifier('User'),
    fields: [
      createField('id', createSimpleType('UUID'), { annotations: ['immutable', 'unique'] }),
      createField('email', createSimpleType('String'), { annotations: ['unique'] }),
      createField('name', createSimpleType('String')),
      createField('age', createSimpleType('Int'), { optional: true }),
      createField('created_at', createSimpleType('Timestamp'), { annotations: ['immutable'] }),
    ],
    span: createSpan(),
  };
}

function createStatusEnum(): EnumDeclaration {
  return {
    kind: 'EnumDeclaration',
    name: createIdentifier('Status'),
    variants: [
      createIdentifier('ACTIVE'),
      createIdentifier('INACTIVE'),
      createIdentifier('SUSPENDED'),
    ],
    span: createSpan(),
  };
}

function createEmailType(): TypeDeclaration {
  return {
    kind: 'TypeDeclaration',
    name: createIdentifier('Email'),
    baseType: createSimpleType('String'),
    constraints: [
      {
        kind: 'TypeConstraint',
        name: createIdentifier('max_length'),
        value: { kind: 'NumberLiteral' as const, value: 254, span: createSpan() },
        span: createSpan(),
      },
    ],
    span: createSpan(),
  };
}

function createLoginBehavior(): BehaviorDeclaration {
  return {
    kind: 'BehaviorDeclaration',
    name: createIdentifier('Login'),
    description: createStringLiteral('Authenticate user and create session'),
    input: {
      kind: 'InputBlock',
      fields: [
        createField('email', createSimpleType('String')),
        createField('password', createSimpleType('String'), { annotations: ['sensitive'] }),
      ],
      span: createSpan(),
    },
    output: {
      kind: 'OutputBlock',
      success: createSimpleType('Session'),
      errors: [
        {
          kind: 'ErrorDeclaration',
          name: createIdentifier('INVALID_CREDENTIALS'),
          when: createStringLiteral('Email or password incorrect'),
          retriable: true,
          span: createSpan(),
        },
        {
          kind: 'ErrorDeclaration',
          name: createIdentifier('ACCOUNT_LOCKED'),
          when: createStringLiteral('Too many failed attempts'),
          retriable: true,
          span: createSpan(),
        },
      ],
      span: createSpan(),
    },
    span: createSpan(),
  };
}

// ============================================================================
// Tests: Main Generator
// ============================================================================

describe('CodeGenerator', () => {
  let domain: DomainDeclaration;

  beforeEach(() => {
    domain = createMinimalDomain();
    domain.entities = [createUserEntity()];
    domain.enums = [createStatusEnum()];
    domain.types = [createEmailType()];
    domain.behaviors = [createLoginBehavior()];
  });

  describe('generate()', () => {
    it('should generate TypeScript files', () => {
      const result = generate(domain, { language: 'typescript', validation: true });

      expect(result.files).toHaveLength(4); // types, validation, serdes, index
      expect(result.domain).toBe('TestDomain');
      expect(result.language).toBe('typescript');
      expect(result.generatedAt).toBeInstanceOf(Date);

      const types = result.files.find(f => f.type === 'types');
      expect(types?.path).toBe('testdomain/types.ts');
      expect(types?.content).toContain('export interface User');
      expect(types?.content).toContain('export enum Status');
    });

    it('should generate Python files', () => {
      const result = generate(domain, { language: 'python', validation: true });

      // Python generates 5 files: types.py, validation.py, contracts.py, serdes.py, __init__.py
      expect(result.files).toHaveLength(5);
      expect(result.language).toBe('python');

      const types = result.files.find(f => f.type === 'types');
      expect(types?.path).toBe('test_domain/types.py');
      expect(types?.content).toContain('class User:');
      expect(types?.content).toContain('class Status(str, Enum):');
    });

    it('should skip validation when disabled', () => {
      const result = generate(domain, { language: 'typescript', validation: false });

      expect(result.files).toHaveLength(3); // types, serdes, index (no validation)
      expect(result.files.find(f => f.type === 'validation')).toBeUndefined();
    });

    it('should skip serdes when disabled', () => {
      const result = generate(domain, { 
        language: 'typescript', 
        validation: false, 
        serdes: false 
      });

      expect(result.files).toHaveLength(2); // types, index
      expect(result.files.find(f => f.type === 'serdes')).toBeUndefined();
    });
  });
});

// ============================================================================
// Tests: TypeScript Generator
// ============================================================================

describe('TypeScriptGenerator', () => {
  let generator: TypeScriptGenerator;
  let domain: DomainDeclaration;

  beforeEach(() => {
    generator = new TypeScriptGenerator({
      language: 'typescript',
      validation: false,
      comments: true,
    });
    domain = createMinimalDomain();
  });

  describe('generate()', () => {
    it('should generate utility types', () => {
      const output = generator.generate(domain);

      expect(output).toContain('export type UUID = string;');
      expect(output).toContain('export type Timestamp = string;');
      expect(output).toContain('export interface Money');
    });

    it('should generate enum types', () => {
      domain.enums = [createStatusEnum()];
      const output = generator.generate(domain);

      expect(output).toContain('export enum Status {');
      expect(output).toContain("ACTIVE = 'ACTIVE'");
      expect(output).toContain("INACTIVE = 'INACTIVE'");
      expect(output).toContain('export const StatusValues = ');
    });

    it('should generate entity interfaces', () => {
      domain.entities = [createUserEntity()];
      const output = generator.generate(domain);

      expect(output).toContain('export interface User {');
      expect(output).toContain('readonly id: UUID;');
      expect(output).toContain('email: string;');
      expect(output).toContain('age?: number;');
      expect(output).toContain('export interface UserCreateInput');
      expect(output).toContain('export type UserUpdateInput');
    });

    it('should generate type aliases with branded types', () => {
      domain.types = [createEmailType()];
      const output = generator.generate(domain);

      expect(output).toContain('export type Email = string;');
      expect(output).toContain('export type EmailBranded = string & ');
    });

    it('should generate behavior input/output types', () => {
      domain.behaviors = [createLoginBehavior()];
      const output = generator.generate(domain);

      expect(output).toContain('export interface LoginInput {');
      expect(output).toContain('email: string;');
      expect(output).toContain("export type LoginErrorCode = 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED';");
      expect(output).toContain('export interface LoginError {');
      expect(output).toContain('export type LoginResult =');
      expect(output).toContain('export type LoginFunction =');
    });
  });
});

// ============================================================================
// Tests: Python Generator
// ============================================================================

describe('PythonGenerator', () => {
  let generator: PythonGenerator;
  let domain: DomainDeclaration;

  beforeEach(() => {
    generator = new PythonGenerator({
      language: 'python',
      validation: false,
      comments: true,
    });
    domain = createMinimalDomain();
  });

  describe('generate()', () => {
    it('should generate dataclass imports', () => {
      const output = generator.generate(domain);

      expect(output).toContain('from dataclasses import dataclass');
      expect(output).toContain('from typing import');
      expect(output).toContain('from enum import Enum');
    });

    it('should generate enum classes', () => {
      domain.enums = [createStatusEnum()];
      const output = generator.generate(domain);

      expect(output).toContain('class Status(str, Enum):');
      expect(output).toContain('ACTIVE = "ACTIVE"');
      expect(output).toContain('INACTIVE = "INACTIVE"');
    });

    it('should generate entity dataclasses', () => {
      domain.entities = [createUserEntity()];
      const output = generator.generate(domain);

      expect(output).toContain('@dataclass');
      expect(output).toContain('class User:');
      expect(output).toContain('id: UUID');
      expect(output).toContain('email: str');
      expect(output).toContain('age: Optional[int] = None');
    });
  });

  describe('generatePydantic()', () => {
    it('should generate Pydantic imports', () => {
      const output = generator.generatePydantic(domain);

      expect(output).toContain('from pydantic import');
      expect(output).toContain('BaseModel');
      expect(output).toContain('Field');
    });

    it('should generate Pydantic models', () => {
      domain.entities = [createUserEntity()];
      const output = generator.generatePydantic(domain);

      expect(output).toContain('class User(BaseModel):');
      expect(output).toContain('class UserCreateInput(BaseModel):');
      expect(output).toContain('class UserUpdateInput(BaseModel):');
    });

    it('should generate Pydantic validators for constrained types', () => {
      domain.types = [createEmailType()];
      const output = generator.generatePydantic(domain);

      expect(output).toContain('def validate_email');
      expect(output).toContain('Email = Annotated[str');
    });
  });
});

// ============================================================================
// Tests: Zod Generator
// ============================================================================

describe('ZodGenerator', () => {
  let generator: ZodGenerator;
  let domain: DomainDeclaration;

  beforeEach(() => {
    generator = new ZodGenerator({
      language: 'typescript',
      validation: true,
      comments: true,
    });
    domain = createMinimalDomain();
  });

  describe('generate()', () => {
    it('should generate zod imports', () => {
      const output = generator.generate(domain);

      expect(output).toContain("import { z } from 'zod';");
      expect(output).toContain("import type * as Types from './types.js';");
    });

    it('should generate base schemas', () => {
      const output = generator.generate(domain);

      expect(output).toContain('export const UUIDSchema = z.string().uuid()');
      expect(output).toContain('export const TimestampSchema = z.string().datetime()');
      expect(output).toContain('export const MoneySchema = z.object');
    });

    it('should generate enum schemas', () => {
      domain.enums = [createStatusEnum()];
      const output = generator.generate(domain);

      expect(output).toContain('export const StatusSchema = z.enum([');
      expect(output).toContain("'ACTIVE'");
      expect(output).toContain("'INACTIVE'");
    });

    it('should generate entity schemas', () => {
      domain.entities = [createUserEntity()];
      const output = generator.generate(domain);

      expect(output).toContain('export const UserSchema = z.object({');
      expect(output).toContain('id: UUIDSchema');
      expect(output).toContain('export const UserCreateInputSchema = z.object');
      expect(output).toContain('export const UserUpdateInputSchema = z.object');
    });

    it('should generate type schemas with constraints', () => {
      domain.types = [createEmailType()];
      const output = generator.generate(domain);

      expect(output).toContain('export const EmailSchema = z.string().max(254)');
      expect(output).toContain('export function parseEmail');
      expect(output).toContain('export function isEmail');
    });

    it('should generate behavior schemas', () => {
      domain.behaviors = [createLoginBehavior()];
      const output = generator.generate(domain);

      expect(output).toContain('export const LoginInputSchema = z.object');
      expect(output).toContain('export const LoginErrorCodeSchema = z.enum');
      expect(output).toContain('export const LoginResultSchema = z.discriminatedUnion');
      expect(output).toContain('export function validateLoginInput');
    });

    it('should generate schema registry', () => {
      domain.entities = [createUserEntity()];
      domain.enums = [createStatusEnum()];
      const output = generator.generate(domain);

      expect(output).toContain('export const SchemaRegistry = {');
      expect(output).toContain('User: UserSchema');
      expect(output).toContain('Status: StatusSchema');
      expect(output).toContain('export function validate<K extends keyof typeof SchemaRegistry>');
    });
  });
});

// ============================================================================
// Tests: SerDes Generator
// ============================================================================

describe('SerdesGenerator', () => {
  let generator: SerdesGenerator;
  let domain: DomainDeclaration;

  beforeEach(() => {
    generator = new SerdesGenerator({
      language: 'typescript',
      validation: false,
      comments: true,
    });
    domain = createMinimalDomain();
  });

  describe('generateTypeScript()', () => {
    it('should generate base serializers', () => {
      const output = generator.generateTypeScript(domain);

      expect(output).toContain('export function serializeTimestamp');
      expect(output).toContain('export function deserializeTimestamp');
      expect(output).toContain('export function serializeMoney');
      expect(output).toContain('export function deserializeMoney');
    });

    it('should generate entity serializers', () => {
      domain.entities = [createUserEntity()];
      const output = generator.generateTypeScript(domain);

      expect(output).toContain('export interface UserSerialized {');
      expect(output).toContain('export function serializeUser');
      expect(output).toContain('export function deserializeUser');
      expect(output).toContain('export function safeDeserializeUser');
    });

    it('should generate serializer registry', () => {
      domain.entities = [createUserEntity()];
      const output = generator.generateTypeScript(domain);

      expect(output).toContain('export const Serializers = {');
      expect(output).toContain('User: serializeUser');
      expect(output).toContain('export const Deserializers = {');
      expect(output).toContain('export function toJSON');
      expect(output).toContain('export function fromJSON');
    });
  });

  describe('generatePython()', () => {
    it('should generate Python imports', () => {
      const output = generator.generatePython(domain);

      expect(output).toContain('import json');
      expect(output).toContain('from dataclasses import asdict');
      expect(output).toContain('from datetime import datetime');
    });

    it('should generate Python serializers', () => {
      domain.entities = [createUserEntity()];
      const output = generator.generatePython(domain);

      expect(output).toContain('def serialize_user(');
      expect(output).toContain('def deserialize_user(');
    });

    it('should generate serializer registry', () => {
      domain.entities = [createUserEntity()];
      const output = generator.generatePython(domain);

      expect(output).toContain('SERIALIZERS: Dict[str, Any] = {');
      expect(output).toContain('"User": serialize_user');
      expect(output).toContain('DESERIALIZERS: Dict[str, Any] = {');
      expect(output).toContain('def to_json(');
      expect(output).toContain('def from_json(');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration', () => {
  it('should generate complete domain with all features', () => {
    const domain = createMinimalDomain();
    domain.entities = [createUserEntity()];
    domain.enums = [createStatusEnum()];
    domain.types = [createEmailType()];
    domain.behaviors = [createLoginBehavior()];

    const tsResult = generate(domain, { language: 'typescript', validation: true });
    const pyResult = generate(domain, { language: 'python', validation: true });

    // TypeScript output
    expect(tsResult.files.length).toBe(4);
    
    const tsTypes = tsResult.files.find(f => f.type === 'types')!;
    expect(tsTypes.content).toContain('export interface User');
    expect(tsTypes.content).toContain('export enum Status');
    expect(tsTypes.content).toContain('export type Email');
    expect(tsTypes.content).toContain('export interface LoginInput');

    const tsValidation = tsResult.files.find(f => f.type === 'validation')!;
    expect(tsValidation.content).toContain('export const UserSchema');
    expect(tsValidation.content).toContain('export const StatusSchema');
    expect(tsValidation.content).toContain('export const LoginInputSchema');

    // Python output - generates 5 files: types.py, validation.py, contracts.py, serdes.py, __init__.py
    expect(pyResult.files.length).toBe(5);
    
    const pyTypes = pyResult.files.find(f => f.type === 'types')!;
    expect(pyTypes.content).toContain('class User:');
    expect(pyTypes.content).toContain('class Status(str, Enum):');
    expect(pyTypes.content).toContain('class LoginInput:');

    const pyValidation = pyResult.files.find(f => f.type === 'validation')!;
    expect(pyValidation.content).toContain('class User(BaseModel):');
    expect(pyValidation.content).toContain('class LoginInput(BaseModel):');
  });
});
