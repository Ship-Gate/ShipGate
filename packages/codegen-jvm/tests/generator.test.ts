// ============================================================================
// ISL JVM Code Generator - Test Suite
// ============================================================================

import { describe, test, expect, beforeAll } from 'vitest';
import { generate, GeneratorOptions, GeneratedFile } from '../src/generator';
import type { Domain, Entity, Behavior, TypeDeclaration } from '../../master_contracts/ast';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const mockLocation = {
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
};

function createMockDomain(): Domain {
  return {
    kind: 'Domain',
    location: mockLocation,
    name: { kind: 'Identifier', name: 'Auth', location: mockLocation },
    version: { kind: 'StringLiteral', value: '1.0.0', location: mockLocation },
    imports: [],
    types: [
      {
        kind: 'TypeDeclaration',
        location: mockLocation,
        name: { kind: 'Identifier', name: 'Email', location: mockLocation },
        definition: {
          kind: 'ConstrainedType',
          location: mockLocation,
          base: { kind: 'PrimitiveType', name: 'String', location: mockLocation },
          constraints: [
            {
              kind: 'Constraint',
              location: mockLocation,
              name: 'format',
              value: {
                kind: 'RegexLiteral',
                pattern: '^[^\\s@]+@[^\\s@]+$',
                flags: '',
                location: mockLocation,
              },
            },
          ],
        },
        annotations: [],
      },
      {
        kind: 'TypeDeclaration',
        location: mockLocation,
        name: { kind: 'Identifier', name: 'UserStatus', location: mockLocation },
        definition: {
          kind: 'EnumType',
          location: mockLocation,
          variants: [
            { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'PENDING', location: mockLocation }, location: mockLocation },
            { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'ACTIVE', location: mockLocation }, location: mockLocation },
            { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'SUSPENDED', location: mockLocation }, location: mockLocation },
          ],
        },
        annotations: [],
      },
    ],
    entities: [
      {
        kind: 'Entity',
        location: mockLocation,
        name: { kind: 'Identifier', name: 'User', location: mockLocation },
        fields: [
          {
            kind: 'Field',
            location: mockLocation,
            name: { kind: 'Identifier', name: 'id', location: mockLocation },
            type: { kind: 'PrimitiveType', name: 'UUID', location: mockLocation },
            optional: false,
            annotations: [
              { kind: 'Annotation', name: { kind: 'Identifier', name: 'immutable', location: mockLocation }, location: mockLocation },
              { kind: 'Annotation', name: { kind: 'Identifier', name: 'unique', location: mockLocation }, location: mockLocation },
            ],
          },
          {
            kind: 'Field',
            location: mockLocation,
            name: { kind: 'Identifier', name: 'email', location: mockLocation },
            type: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [{ kind: 'Identifier', name: 'Email', location: mockLocation }], location: mockLocation }, location: mockLocation },
            optional: false,
            annotations: [
              { kind: 'Annotation', name: { kind: 'Identifier', name: 'unique', location: mockLocation }, location: mockLocation },
            ],
          },
          {
            kind: 'Field',
            location: mockLocation,
            name: { kind: 'Identifier', name: 'status', location: mockLocation },
            type: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [{ kind: 'Identifier', name: 'UserStatus', location: mockLocation }], location: mockLocation }, location: mockLocation },
            optional: false,
            annotations: [],
          },
          {
            kind: 'Field',
            location: mockLocation,
            name: { kind: 'Identifier', name: 'createdAt', location: mockLocation },
            type: { kind: 'PrimitiveType', name: 'Timestamp', location: mockLocation },
            optional: false,
            annotations: [
              { kind: 'Annotation', name: { kind: 'Identifier', name: 'immutable', location: mockLocation }, location: mockLocation },
            ],
          },
        ],
        invariants: [],
      },
    ],
    behaviors: [
      {
        kind: 'Behavior',
        location: mockLocation,
        name: { kind: 'Identifier', name: 'CreateUser', location: mockLocation },
        description: { kind: 'StringLiteral', value: 'Create a new user', location: mockLocation },
        input: {
          kind: 'InputSpec',
          location: mockLocation,
          fields: [
            {
              kind: 'Field',
              location: mockLocation,
              name: { kind: 'Identifier', name: 'email', location: mockLocation },
              type: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [{ kind: 'Identifier', name: 'Email', location: mockLocation }], location: mockLocation }, location: mockLocation },
              optional: false,
              annotations: [],
            },
          ],
        },
        output: {
          kind: 'OutputSpec',
          location: mockLocation,
          success: { kind: 'ReferenceType', name: { kind: 'QualifiedName', parts: [{ kind: 'Identifier', name: 'User', location: mockLocation }], location: mockLocation }, location: mockLocation },
          errors: [
            {
              kind: 'ErrorSpec',
              location: mockLocation,
              name: { kind: 'Identifier', name: 'DUPLICATE_EMAIL', location: mockLocation },
              when: { kind: 'StringLiteral', value: 'Email already exists', location: mockLocation },
              retriable: false,
            },
          ],
        },
        preconditions: [],
        postconditions: [],
        invariants: [],
        temporal: [],
        security: [],
        compliance: [],
      },
    ],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
  };
}

// ============================================================================
// JAVA GENERATION TESTS
// ============================================================================

describe('Java Code Generation', () => {
  let domain: Domain;
  let files: GeneratedFile[];

  beforeAll(() => {
    domain = createMockDomain();
    files = generate(domain, {
      language: 'java',
      javaVersion: 17,
      framework: 'spring',
      package: 'com.example.auth',
    });
  });

  test('generates expected number of files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test('generates type files for custom types', () => {
    const emailType = files.find(f => f.path.includes('Email.java'));
    expect(emailType).toBeDefined();
    expect(emailType?.content).toContain('public record Email');
    expect(emailType?.content).toContain('value.matches');
  });

  test('generates enum types', () => {
    const enumType = files.find(f => f.path.includes('UserStatus.java'));
    expect(enumType).toBeDefined();
    expect(enumType?.content).toContain('public enum UserStatus');
    expect(enumType?.content).toContain('PENDING');
    expect(enumType?.content).toContain('ACTIVE');
    expect(enumType?.content).toContain('SUSPENDED');
  });

  test('generates entity records', () => {
    const entity = files.find(f => f.path.includes('User.java'));
    expect(entity).toBeDefined();
    expect(entity?.content).toContain('public record User');
    expect(entity?.content).toContain('UUID id');
    expect(entity?.content).toContain('Email email');
    expect(entity?.content).toContain('UserStatus status');
  });

  test('generates behavior types', () => {
    const behaviorTypes = files.find(f => f.path.includes('CreateUserTypes.java'));
    expect(behaviorTypes).toBeDefined();
    expect(behaviorTypes?.content).toContain('public record CreateUserInput');
    expect(behaviorTypes?.content).toContain('public sealed interface CreateUserResult');
    expect(behaviorTypes?.content).toContain('record Success');
    expect(behaviorTypes?.content).toContain('record DuplicateEmail');
  });

  test('generates service interface', () => {
    const service = files.find(f => f.path.includes('AuthService.java'));
    expect(service).toBeDefined();
    expect(service?.content).toContain('public interface AuthService');
    expect(service?.content).toContain('CreateUserResult createUser');
  });

  test('generates Spring controller', () => {
    const controller = files.find(f => f.path.includes('AuthController.java'));
    expect(controller).toBeDefined();
    expect(controller?.content).toContain('@RestController');
    expect(controller?.content).toContain('@RequestMapping');
    expect(controller?.content).toContain('@PostMapping');
    expect(controller?.content).toContain('ResponseEntity');
  });

  test('uses Java 17 features (sealed interface)', () => {
    const behaviorTypes = files.find(f => f.path.includes('CreateUserTypes.java'));
    expect(behaviorTypes?.content).toContain('sealed interface');
    expect(behaviorTypes?.content).toContain('implements CreateUserResult');
  });

  test('generates proper package structure', () => {
    const typePaths = files.filter(f => f.type === 'type').map(f => f.path);
    const entityPaths = files.filter(f => f.type === 'entity').map(f => f.path);
    const servicePaths = files.filter(f => f.type === 'service').map(f => f.path);

    typePaths.forEach(p => expect(p).toContain('types/'));
    entityPaths.forEach(p => expect(p).toContain('entities/'));
    servicePaths.forEach(p => expect(p).toContain('services/'));
  });
});

// ============================================================================
// KOTLIN GENERATION TESTS
// ============================================================================

describe('Kotlin Code Generation', () => {
  let domain: Domain;
  let files: GeneratedFile[];

  beforeAll(() => {
    domain = createMockDomain();
    files = generate(domain, {
      language: 'kotlin',
      package: 'com.example.auth',
      useSuspend: true,
    });
  });

  test('generates expected number of files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test('generates types file with value classes', () => {
    const types = files.find(f => f.path.includes('Types.kt'));
    expect(types).toBeDefined();
    expect(types?.content).toContain('@JvmInline');
    expect(types?.content).toContain('value class Email');
    expect(types?.content).toContain('require(');
  });

  test('generates enum classes', () => {
    const types = files.find(f => f.path.includes('Types.kt'));
    expect(types?.content).toContain('enum class UserStatus');
    expect(types?.content).toContain('PENDING');
    expect(types?.content).toContain('ACTIVE');
    expect(types?.content).toContain('SUSPENDED');
  });

  test('generates entity data classes', () => {
    const entities = files.find(f => f.path.includes('Entities.kt'));
    expect(entities).toBeDefined();
    expect(entities?.content).toContain('data class User');
    expect(entities?.content).toContain('val id: UUID');
    expect(entities?.content).toContain('val email: Email');
    expect(entities?.content).toContain('val status: UserStatus');
  });

  test('generates behavior sealed classes', () => {
    const behavior = files.find(f => f.path.includes('CreateUser.kt'));
    expect(behavior).toBeDefined();
    expect(behavior?.content).toContain('sealed class CreateUserResult');
    expect(behavior?.content).toContain('data class Success');
    expect(behavior?.content).toContain('data object DuplicateEmail');
  });

  test('generates service interface with suspend functions', () => {
    const service = files.find(f => f.path.includes('AuthService.kt'));
    expect(service).toBeDefined();
    expect(service?.content).toContain('interface AuthService');
    expect(service?.content).toContain('suspend fun createUser');
  });

  test('generates input data class', () => {
    const behavior = files.find(f => f.path.includes('CreateUser.kt'));
    expect(behavior?.content).toContain('data class CreateUserInput');
    expect(behavior?.content).toContain('val email: Email');
  });

  test('generates result extension functions', () => {
    const behavior = files.find(f => f.path.includes('CreateUser.kt'));
    expect(behavior?.content).toContain('fun isSuccess()');
    expect(behavior?.content).toContain('fun isError()');
    expect(behavior?.content).toContain('fun getOrNull()');
    expect(behavior?.content).toContain('fold(');
  });
});

// ============================================================================
// OPTIONS TESTS
// ============================================================================

describe('Generator Options', () => {
  const domain = createMockDomain();

  test('respects language option', () => {
    const javaFiles = generate(domain, { language: 'java', package: 'com.test' });
    const kotlinFiles = generate(domain, { language: 'kotlin', package: 'com.test' });

    expect(javaFiles.every(f => f.path.endsWith('.java'))).toBe(true);
    expect(kotlinFiles.every(f => f.path.endsWith('.kt'))).toBe(true);
  });

  test('respects package option', () => {
    const files = generate(domain, { language: 'java', package: 'com.custom.pkg' });
    const typeFile = files.find(f => f.type === 'type');

    expect(typeFile?.content).toContain('package com.custom.pkg');
    expect(typeFile?.path).toContain('com/custom/pkg');
  });

  test('includes Spring code when framework is spring', () => {
    const files = generate(domain, { 
      language: 'java', 
      package: 'com.test',
      framework: 'spring',
    });

    const hasController = files.some(f => f.path.includes('Controller'));
    const hasConfig = files.some(f => f.path.includes('Config'));

    expect(hasController).toBe(true);
    expect(hasConfig).toBe(true);
  });

  test('excludes Spring code when framework is none', () => {
    const files = generate(domain, { 
      language: 'java', 
      package: 'com.test',
      framework: 'none',
    });

    const hasController = files.some(f => f.path.includes('Controller'));
    expect(hasController).toBe(false);
  });

  test('Kotlin respects useSuspend option', () => {
    const withSuspend = generate(domain, { 
      language: 'kotlin', 
      package: 'com.test',
      useSuspend: true,
    });
    const withoutSuspend = generate(domain, { 
      language: 'kotlin', 
      package: 'com.test',
      useSuspend: false,
    });

    const serviceWithSuspend = withSuspend.find(f => f.type === 'service');
    const serviceWithoutSuspend = withoutSuspend.find(f => f.type === 'service');

    expect(serviceWithSuspend?.content).toContain('suspend fun');
    expect(serviceWithoutSuspend?.content).not.toContain('suspend fun');
  });
});

// ============================================================================
// TYPE MAPPING TESTS
// ============================================================================

describe('Type Mapping', () => {
  test('maps ISL primitives to Java types', () => {
    const domain = createMockDomain();
    const files = generate(domain, { language: 'java', package: 'com.test' });
    const entityFile = files.find(f => f.type === 'entity');

    expect(entityFile?.content).toContain('UUID');
    expect(entityFile?.content).toContain('Instant');
  });

  test('maps ISL primitives to Kotlin types', () => {
    const domain = createMockDomain();
    const files = generate(domain, { language: 'kotlin', package: 'com.test' });
    const entityFile = files.find(f => f.type === 'entity');

    expect(entityFile?.content).toContain('UUID');
    expect(entityFile?.content).toContain('Instant');
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('Validation Generation', () => {
  const domain = createMockDomain();

  test('generates validation for constrained types in Java', () => {
    const files = generate(domain, { language: 'java', package: 'com.test' });
    const emailType = files.find(f => f.path.includes('Email.java'));

    expect(emailType?.content).toContain('matches');
    expect(emailType?.content).toContain('IllegalArgumentException');
  });

  test('generates require validation in Kotlin', () => {
    const files = generate(domain, { language: 'kotlin', package: 'com.test' });
    const types = files.find(f => f.path.includes('Types.kt'));

    expect(types?.content).toContain('require(');
    expect(types?.content).toContain('Regex(');
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Code Generation', () => {
  const domain = createMockDomain();

  test('generates error cases in Java sealed interface', () => {
    const files = generate(domain, { language: 'java', package: 'com.test' });
    const behaviorTypes = files.find(f => f.path.includes('CreateUserTypes.java'));

    expect(behaviorTypes?.content).toContain('DuplicateEmail');
    expect(behaviorTypes?.content).toContain('implements CreateUserResult');
  });

  test('generates error cases as data objects in Kotlin', () => {
    const files = generate(domain, { language: 'kotlin', package: 'com.test' });
    const behavior = files.find(f => f.path.includes('CreateUser.kt'));

    expect(behavior?.content).toContain('data object DuplicateEmail');
    expect(behavior?.content).toContain(': CreateUserResult()');
  });
});
