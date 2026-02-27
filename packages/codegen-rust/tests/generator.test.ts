// ============================================================================
// Rust Code Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  generate,
  mapPrimitiveType,
  mapType,
  toSnakeCase,
  toScreamingSnakeCase,
  generateEntityStruct,
  generateTypeDeclaration,
  generateBehaviorTrait,
  generateEnum,
} from '../src';
import type { Domain, Entity, Behavior, TypeDeclaration, EnumType } from '../src/ast-types';

// Helper to create source location
const loc = () => ({
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 10,
});

// Helper to create identifier
const id = (name: string) => ({ kind: 'Identifier' as const, name, location: loc() });

// Helper to create string literal
const str = (value: string) => ({ kind: 'StringLiteral' as const, value, location: loc() });

describe('Type Mapping', () => {
  describe('mapPrimitiveType', () => {
    it('should map String to Rust String', () => {
      const result = mapPrimitiveType('String');
      expect(result.type).toBe('String');
      expect(result.imports).toHaveLength(0);
    });

    it('should map Int to i64', () => {
      const result = mapPrimitiveType('Int');
      expect(result.type).toBe('i64');
    });

    it('should map Decimal to rust_decimal::Decimal', () => {
      const result = mapPrimitiveType('Decimal');
      expect(result.type).toBe('rust_decimal::Decimal');
      expect(result.imports).toContainEqual({ crate: 'rust_decimal', items: ['Decimal'] });
    });

    it('should map Boolean to bool', () => {
      const result = mapPrimitiveType('Boolean');
      expect(result.type).toBe('bool');
    });

    it('should map Timestamp to DateTime<Utc>', () => {
      const result = mapPrimitiveType('Timestamp');
      expect(result.type).toBe('DateTime<Utc>');
      expect(result.imports).toContainEqual({ crate: 'chrono', items: ['DateTime', 'Utc'] });
    });

    it('should map UUID to Uuid', () => {
      const result = mapPrimitiveType('UUID');
      expect(result.type).toBe('Uuid');
      expect(result.imports).toContainEqual({ crate: 'uuid', items: ['Uuid'] });
    });

    it('should map Duration to chrono::Duration', () => {
      const result = mapPrimitiveType('Duration');
      expect(result.type).toBe('chrono::Duration');
    });
  });

  describe('mapType', () => {
    it('should map List<T> to Vec<T>', () => {
      const result = mapType({
        kind: 'ListType',
        element: { kind: 'PrimitiveType', name: 'String', location: loc() },
        location: loc(),
      });
      expect(result.type).toBe('Vec<String>');
    });

    it('should map Map<K,V> to HashMap<K,V>', () => {
      const result = mapType({
        kind: 'MapType',
        key: { kind: 'PrimitiveType', name: 'String', location: loc() },
        value: { kind: 'PrimitiveType', name: 'Int', location: loc() },
        location: loc(),
      });
      expect(result.type).toBe('HashMap<String, i64>');
    });

    it('should map Optional<T> to Option<T>', () => {
      const result = mapType({
        kind: 'OptionalType',
        inner: { kind: 'PrimitiveType', name: 'String', location: loc() },
        location: loc(),
      });
      expect(result.type).toBe('Option<String>');
    });

    it('should map reference types', () => {
      const result = mapType({
        kind: 'ReferenceType',
        name: { kind: 'QualifiedName', parts: [id('Email')], location: loc() },
        location: loc(),
      });
      expect(result.type).toBe('Email');
      expect(result.isCustom).toBe(true);
    });
  });
});

describe('Name Conversion', () => {
  it('should convert PascalCase to snake_case', () => {
    expect(toSnakeCase('UserProfile')).toBe('user_profile');
    expect(toSnakeCase('createUser')).toBe('create_user');
    expect(toSnakeCase('HTTPRequest')).toBe('h_t_t_p_request');
  });

  it('should convert to SCREAMING_SNAKE_CASE', () => {
    expect(toScreamingSnakeCase('UserStatus')).toBe('USER_STATUS');
    expect(toScreamingSnakeCase('pending')).toBe('PENDING');
  });
});

describe('Entity Generation', () => {
  it('should generate Rust struct from entity', () => {
    const entity: Entity = {
      kind: 'Entity',
      name: id('User'),
      fields: [
        {
          kind: 'Field',
          name: id('id'),
          type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
          optional: false,
          annotations: [],
          location: loc(),
        },
        {
          kind: 'Field',
          name: id('email'),
          type: { kind: 'PrimitiveType', name: 'String', location: loc() },
          optional: false,
          annotations: [],
          location: loc(),
        },
        {
          kind: 'Field',
          name: id('createdAt'),
          type: { kind: 'PrimitiveType', name: 'Timestamp', location: loc() },
          optional: false,
          annotations: [],
          location: loc(),
        },
      ],
      invariants: [],
      location: loc(),
    };

    const result = generateEntityStruct(entity);

    expect(result.name).toBe('User');
    expect(result.code).toContain('pub struct User');
    expect(result.code).toContain('#[derive(Debug, Clone, Serialize, Deserialize, Validate)]');
    expect(result.code).toContain('pub id: Uuid');
    expect(result.code).toContain('pub email: String');
    expect(result.code).toContain('pub created_at: DateTime<Utc>');
  });

  it('should handle optional fields', () => {
    const entity: Entity = {
      kind: 'Entity',
      name: id('Profile'),
      fields: [
        {
          kind: 'Field',
          name: id('bio'),
          type: { kind: 'PrimitiveType', name: 'String', location: loc() },
          optional: true,
          annotations: [],
          location: loc(),
        },
      ],
      invariants: [],
      location: loc(),
    };

    const result = generateEntityStruct(entity);

    expect(result.code).toContain('pub bio: Option<String>');
    expect(result.code).toContain('#[serde(skip_serializing_if = "Option::is_none")]');
  });
});

describe('Enum Generation', () => {
  it('should generate Rust enum', () => {
    const enumType: EnumType = {
      kind: 'EnumType',
      variants: [
        { kind: 'EnumVariant', name: id('Pending'), location: loc() },
        { kind: 'EnumVariant', name: id('Active'), location: loc() },
        { kind: 'EnumVariant', name: id('Suspended'), location: loc() },
      ],
      location: loc(),
    };

    const result = generateEnum('UserStatus', enumType);

    expect(result.name).toBe('UserStatus');
    expect(result.code).toContain('pub enum UserStatus');
    expect(result.code).toContain('#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]');
    expect(result.code).toContain('#[serde(rename_all = "SCREAMING_SNAKE_CASE")]');
    expect(result.code).toContain('Pending,');
    expect(result.code).toContain('Active,');
    expect(result.code).toContain('Suspended,');
    expect(result.code).toContain('impl std::fmt::Display for UserStatus');
    expect(result.code).toContain('impl Default for UserStatus');
  });
});

describe('Type Declaration Generation', () => {
  it('should generate newtype with validation for constrained types', () => {
    const typeDecl: TypeDeclaration = {
      kind: 'TypeDeclaration',
      name: id('Email'),
      definition: {
        kind: 'ConstrainedType',
        base: { kind: 'PrimitiveType', name: 'String', location: loc() },
        constraints: [
          {
            kind: 'Constraint',
            name: 'format',
            value: { kind: 'StringLiteral', value: 'email', location: loc() },
            location: loc(),
          },
        ],
        location: loc(),
      },
      annotations: [],
      location: loc(),
    };

    const result = generateTypeDeclaration(typeDecl);

    expect(result.name).toBe('Email');
    expect(result.code).toContain('pub struct Email');
    expect(result.code).toContain('#[validate(email)]');
    expect(result.code).toContain('pub fn new(value: impl Into<String>)');
    expect(result.code).toContain('instance.validate()?');
  });
});

describe('Behavior Generation', () => {
  it('should generate trait and associated types', () => {
    const behavior: Behavior = {
      kind: 'Behavior',
      name: id('CreateUser'),
      description: str('Create a new user account'),
      input: {
        kind: 'InputSpec',
        fields: [
          {
            kind: 'Field',
            name: id('email'),
            type: { kind: 'PrimitiveType', name: 'String', location: loc() },
            optional: false,
            annotations: [],
            location: loc(),
          },
          {
            kind: 'Field',
            name: id('username'),
            type: { kind: 'PrimitiveType', name: 'String', location: loc() },
            optional: false,
            annotations: [],
            location: loc(),
          },
        ],
        location: loc(),
      },
      output: {
        kind: 'OutputSpec',
        success: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
        errors: [
          { kind: 'ErrorSpec', name: id('DuplicateEmail'), when: str('Email already exists'), retriable: false, location: loc() },
          { kind: 'ErrorSpec', name: id('InvalidInput'), retriable: false, location: loc() },
        ],
        location: loc(),
      },
      preconditions: [],
      postconditions: [],
      location: loc(),
    };

    const result = generateBehaviorTrait(behavior);

    // Check input struct
    expect(result.inputStructCode).toContain('pub struct CreateUserInput');
    expect(result.inputStructCode).toContain('pub email: String');
    expect(result.inputStructCode).toContain('pub username: String');
    expect(result.inputStructCode).toContain('CreateUserInputBuilder');

    // Check error enum
    expect(result.errorEnumCode).toContain('pub enum CreateUserError');
    expect(result.errorEnumCode).toContain('DuplicateEmail');
    expect(result.errorEnumCode).toContain('InvalidInput');
    expect(result.errorEnumCode).toContain('#[error("Email already exists")]');
    expect(result.errorEnumCode).toContain('thiserror::Error');

    // Check output type
    expect(result.outputTypeCode).toContain('pub type CreateUserResult = Result<Uuid, CreateUserError>');

    // Check trait
    expect(result.traitCode).toContain('#[async_trait]');
    expect(result.traitCode).toContain('pub trait CreateUserService');
    expect(result.traitCode).toContain('async fn create_user(&self, input: CreateUserInput) -> CreateUserResult');
  });
});

describe('Full Generation', () => {
  it('should generate complete Rust crate', () => {
    const domain: Domain = {
      kind: 'Domain',
      name: id('UserService'),
      version: str('1.0.0'),
      types: [
        {
          kind: 'TypeDeclaration',
          name: id('Email'),
          definition: {
            kind: 'ConstrainedType',
            base: { kind: 'PrimitiveType', name: 'String', location: loc() },
            constraints: [
              { kind: 'Constraint', name: 'format', value: { kind: 'StringLiteral', value: 'email', location: loc() }, location: loc() },
            ],
            location: loc(),
          },
          annotations: [],
          location: loc(),
        },
        {
          kind: 'TypeDeclaration',
          name: id('UserStatus'),
          definition: {
            kind: 'EnumType',
            variants: [
              { kind: 'EnumVariant', name: id('Pending'), location: loc() },
              { kind: 'EnumVariant', name: id('Active'), location: loc() },
            ],
            location: loc(),
          },
          annotations: [],
          location: loc(),
        },
      ],
      entities: [
        {
          kind: 'Entity',
          name: id('User'),
          fields: [
            { kind: 'Field', name: id('id'), type: { kind: 'PrimitiveType', name: 'UUID', location: loc() }, optional: false, annotations: [], location: loc() },
            { kind: 'Field', name: id('email'), type: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [id('Email')], location: loc() }, location: loc() }, optional: false, annotations: [], location: loc() },
            { kind: 'Field', name: id('status'), type: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [id('UserStatus')], location: loc() }, location: loc() }, optional: false, annotations: [], location: loc() },
          ],
          invariants: [],
          location: loc(),
        },
      ],
      behaviors: [
        {
          kind: 'Behavior',
          name: id('CreateUser'),
          input: {
            kind: 'InputSpec',
            fields: [
              { kind: 'Field', name: id('email'), type: { kind: 'PrimitiveType', name: 'String', location: loc() }, optional: false, annotations: [], location: loc() },
            ],
            location: loc(),
          },
          output: {
            kind: 'OutputSpec',
            success: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
            errors: [],
            location: loc(),
          },
          preconditions: [],
          postconditions: [],
          location: loc(),
        },
      ],
      invariants: [],
      policies: [],
      views: [],
      location: loc(),
    };

    const files = generate(domain, {
      outputDir: './generated',
      crateName: 'user_service',
    });

    // Check generated files
    const fileNames = files.map(f => f.path);
    expect(fileNames).toContain('src/types.rs');
    expect(fileNames).toContain('src/models.rs');
    expect(fileNames).toContain('src/traits.rs');
    expect(fileNames).toContain('src/errors.rs');
    expect(fileNames).toContain('src/lib.rs');
    expect(fileNames).toContain('Cargo.toml');

    // Check lib.rs content
    const libFile = files.find(f => f.path === 'src/lib.rs');
    expect(libFile?.content).toContain('pub mod types;');
    expect(libFile?.content).toContain('pub mod models;');
    expect(libFile?.content).toContain('pub mod traits;');
    expect(libFile?.content).toContain('pub mod errors;');
    expect(libFile?.content).toContain('Domain: UserService');

    // Check Cargo.toml
    const cargoFile = files.find(f => f.path === 'Cargo.toml');
    expect(cargoFile?.content).toContain('name = "user_service"');
    expect(cargoFile?.content).toContain('serde = { version = "1.0", features = ["derive"] }');
    expect(cargoFile?.content).toContain('validator = { version = "0.16", features = ["derive"] }');
    expect(cargoFile?.content).toContain('async-trait = "0.1"');
    expect(cargoFile?.content).toContain('uuid = { version = "1.0", features = ["v4", "serde"] }');
    expect(cargoFile?.content).toContain('chrono = { version = "0.4", features = ["serde"] }');

    // Check types.rs has Email
    const typesFile = files.find(f => f.path === 'src/types.rs');
    expect(typesFile?.content).toContain('pub struct Email');
    expect(typesFile?.content).toContain('pub enum UserStatus');

    // Check models.rs has User
    const modelsFile = files.find(f => f.path === 'src/models.rs');
    expect(modelsFile?.content).toContain('pub struct User');
    expect(modelsFile?.content).toContain('pub struct CreateUserInput');

    // Check traits.rs
    const traitsFile = files.find(f => f.path === 'src/traits.rs');
    expect(traitsFile?.content).toContain('pub trait CreateUserService');
    expect(traitsFile?.content).toContain('pub type CreateUserResult');
  });
});
