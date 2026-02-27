// ============================================================================
// gRPC Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate, generateProtoOnly, generateBufProject } from '../src/generator';
import { generateProtoTypes, generateProtoEnums } from '../src/proto/types';
import { generateProtoMessages } from '../src/proto/messages';
import { generateProtoServices, generateCrudService } from '../src/proto/services';
import { generateBufYaml, generateBufGenYaml } from '../src/proto/options';
import {
  mapErrorToGrpcStatus,
  mapBehaviorErrors,
  GrpcStatusCode,
} from '../src/error-mapping';
import {
  toSnakeCase,
  toPascalCase,
  toScreamingSnakeCase,
  toProtoPackage,
} from '../src/utils';
import type {
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
  TypeDeclaration,
  EnumDeclaration,
  FieldDeclaration,
  ErrorDeclaration,
} from '@isl-lang/isl-core';

// ==========================================================================
// TEST FIXTURES
// ==========================================================================

const S = { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } };
const id = (name: string) => ({ kind: 'Identifier' as const, name, span: S });
const str = (value: string) => ({ kind: 'StringLiteral' as const, value, span: S });

const mockDomain: DomainDeclaration = {
  kind: 'DomainDeclaration',
  name: id('Users'),
  version: str('1.0.0'),
  uses: [],
  imports: [],
  types: [
    {
      kind: 'TypeDeclaration',
      name: id('Email'),
      baseType: { kind: 'SimpleType', name: id('String'), span: S },
      constraints: [
        {
          kind: 'TypeConstraint',
          name: id('pattern'),
          value: {
            kind: 'StringLiteral',
            value: '^[^\\s@]+@[^\\s@]+$',
            span: S,
          },
          span: S,
        },
      ],
      span: S,
    },
  ],
  enums: [
    {
      kind: 'EnumDeclaration',
      name: id('UserStatus'),
      variants: [id('PENDING'), id('ACTIVE'), id('SUSPENDED')],
      span: S,
    },
  ],
  entities: [
    {
      kind: 'EntityDeclaration',
      name: id('User'),
      fields: [
        {
          kind: 'FieldDeclaration',
          name: id('id'),
          type: { kind: 'SimpleType', name: id('UUID'), span: S },
          optional: false,
          annotations: [
            { kind: 'Annotation', name: id('immutable'), span: S },
            { kind: 'Annotation', name: id('unique'), span: S },
          ],
          constraints: [],
          span: S,
        },
        {
          kind: 'FieldDeclaration',
          name: id('email'),
          type: { kind: 'SimpleType', name: id('Email'), span: S },
          optional: false,
          annotations: [],
          constraints: [],
          span: S,
        },
        {
          kind: 'FieldDeclaration',
          name: id('status'),
          type: { kind: 'SimpleType', name: id('UserStatus'), span: S },
          optional: false,
          annotations: [],
          constraints: [],
          span: S,
        },
        {
          kind: 'FieldDeclaration',
          name: id('created_at'),
          type: { kind: 'SimpleType', name: id('Timestamp'), span: S },
          optional: false,
          annotations: [
            { kind: 'Annotation', name: id('immutable'), span: S },
          ],
          constraints: [],
          span: S,
        },
      ],
      span: S,
    },
  ],
  behaviors: [
    {
      kind: 'BehaviorDeclaration',
      name: id('CreateUser'),
      description: str('Create a new user'),
      input: {
        kind: 'InputBlock',
        fields: [
          {
            kind: 'FieldDeclaration',
            name: id('email'),
            type: { kind: 'SimpleType', name: id('Email'), span: S },
            optional: false,
            annotations: [],
            constraints: [],
            span: S,
          },
          {
            kind: 'FieldDeclaration',
            name: id('idempotency_key'),
            type: { kind: 'SimpleType', name: id('String'), span: S },
            optional: false,
            annotations: [],
            constraints: [],
            span: S,
          },
        ],
        span: S,
      },
      output: {
        kind: 'OutputBlock',
        success: { kind: 'SimpleType', name: id('User'), span: S },
        errors: [
          {
            kind: 'ErrorDeclaration',
            name: id('DUPLICATE_EMAIL'),
            when: str('Email already exists'),
            retriable: false,
            span: S,
          },
          {
            kind: 'ErrorDeclaration',
            name: id('INVALID_INPUT'),
            when: str('Invalid input data'),
            retriable: false,
            span: S,
          },
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
// UTILITY TESTS
// ==========================================================================

describe('Utils', () => {
  describe('toSnakeCase', () => {
    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('camelCase')).toBe('camel_case');
      expect(toSnakeCase('PascalCase')).toBe('pascal_case');
      expect(toSnakeCase('createdAt')).toBe('created_at');
    });
  });
  
  describe('toPascalCase', () => {
    it('should convert to PascalCase', () => {
      expect(toPascalCase('camel_case')).toBe('CamelCase');
      expect(toPascalCase('snake_case')).toBe('SnakeCase');
      expect(toPascalCase('already')).toBe('Already');
    });
  });
  
  describe('toScreamingSnakeCase', () => {
    it('should convert to SCREAMING_SNAKE_CASE', () => {
      expect(toScreamingSnakeCase('camelCase')).toBe('CAMEL_CASE');
      expect(toScreamingSnakeCase('UserStatus')).toBe('USER_STATUS');
    });
  });
  
  describe('toProtoPackage', () => {
    it('should generate proto package name', () => {
      expect(toProtoPackage('Users', '1.0.0')).toBe('users.v1_0_0');
      expect(toProtoPackage('My Domain')).toBe('my.domain');
    });
  });
});

// ==========================================================================
// TYPE GENERATION TESTS
// ==========================================================================

describe('Proto Type Generation', () => {
  it('should generate enum types from EnumDeclaration', () => {
    const enums = generateProtoEnums(mockDomain.enums);

    const userStatus = enums.find(t => t.name === 'UserStatus');
    expect(userStatus).toBeDefined();
    expect(userStatus?.definition).toContain('enum UserStatus');
    expect(userStatus?.definition).toContain('USER_STATUS_UNSPECIFIED = 0');
    expect(userStatus?.definition).toContain('USER_STATUS_PENDING = 1');
    expect(userStatus?.definition).toContain('USER_STATUS_ACTIVE = 2');
    expect(userStatus?.definition).toContain('USER_STATUS_SUSPENDED = 3');
  });

  it('should generate constrained type wrappers', () => {
    const types = generateProtoTypes(mockDomain.types, {
      includeValidation: true,
    });

    const email = types.find(t => t.name === 'Email');
    expect(email).toBeDefined();
    expect(email?.definition).toContain('message Email');
    expect(email?.definition).toContain('string value = 1');
    expect(email?.isWrapper).toBe(true);
  });

  it('should include validation imports from entity messages', () => {
    const messages = generateProtoMessages(mockDomain.entities, {
      includeValidation: true,
    });

    const hasValidationImport = messages.some(t =>
      t.imports.has('validate/validate.proto')
    );
    expect(hasValidationImport).toBe(true);
  });
});

// ==========================================================================
// MESSAGE GENERATION TESTS
// ==========================================================================

describe('Proto Message Generation', () => {
  it('should generate entity messages', () => {
    const messages = generateProtoMessages(mockDomain.entities, {
      includeValidation: true,
      generateLifecycleEnums: true,
    });

    expect(messages).toHaveLength(1);

    const userMsg = messages[0];
    expect(userMsg.name).toBe('User');
    expect(userMsg.definition).toContain('message User');
    expect(userMsg.definition).toContain('string id = 1');
    expect(userMsg.definition).toContain('Email email = 2');
    expect(userMsg.definition).toContain('UserStatus status = 3');
  });

  it('should include timestamp imports', () => {
    const messages = generateProtoMessages(mockDomain.entities);

    const userMsg = messages[0];
    expect(userMsg.imports.has('google/protobuf/timestamp.proto')).toBe(true);
  });
});

// ==========================================================================
// SERVICE GENERATION TESTS
// ==========================================================================

describe('Proto Service Generation', () => {
  it('should generate services from behaviors', () => {
    const services = generateProtoServices(
      mockDomain.behaviors,
      mockDomain.entities,
      {
        includeValidation: true,
        generateErrorMessages: true,
        addIdempotencyOptions: true,
      }
    );

    expect(services.length).toBeGreaterThan(0);

    const service = services[0];
    expect(service.definition).toContain('service');
    expect(service.definition).toContain('rpc CreateUser');
    expect(service.definition).toContain('CreateUserRequest');
    expect(service.definition).toContain('CreateUserResponse');
  });

  it('should generate error messages', () => {
    const services = generateProtoServices(
      mockDomain.behaviors,
      mockDomain.entities,
      {
        generateErrorMessages: true,
      }
    );

    const service = services[0];
    expect(service.definition).toContain('CreateUserError');
    expect(service.definition).toContain('DUPLICATE_EMAIL');
    expect(service.definition).toContain('INVALID_INPUT');
  });

  it('should generate CRUD service', () => {
    const crudService = generateCrudService(mockDomain.entities[0], {
      includeValidation: true,
      generateStreaming: true,
    });

    expect(crudService.name).toBe('UserService');
    expect(crudService.definition).toContain('rpc CreateUser');
    expect(crudService.definition).toContain('rpc GetUser');
    expect(crudService.definition).toContain('rpc UpdateUser');
    expect(crudService.definition).toContain('rpc DeleteUser');
    expect(crudService.definition).toContain('rpc ListUsers');
    expect(crudService.definition).toContain('rpc WatchUser');
  });
});

// ==========================================================================
// BUF CONFIGURATION TESTS
// ==========================================================================

describe('Buf Configuration', () => {
  it('should generate buf.yaml', () => {
    const yaml = generateBufYaml({
      organization: 'myorg',
      moduleName: 'users',
    });
    
    expect(yaml).toContain('version: v1');
    expect(yaml).toContain('name: buf.build/myorg/users');
    expect(yaml).toContain('buf.build/envoyproxy/protoc-gen-validate');
    expect(yaml).toContain('breaking:');
    expect(yaml).toContain('lint:');
  });
  
  it('should generate buf.gen.yaml', () => {
    const yaml = generateBufGenYaml({
      includeGo: true,
      goModule: 'gen/go',
      includeTypeScript: true,
      includeConnect: true,
      includeValidation: true,
    });
    
    expect(yaml).toContain('version: v1');
    expect(yaml).toContain('plugins:');
    expect(yaml).toContain('buf.build/protocolbuffers/go');
    expect(yaml).toContain('buf.build/connectrpc/es');
  });
});

// ==========================================================================
// MAIN GENERATOR TESTS
// ==========================================================================

describe('Main Generator', () => {
  it('should generate complete proto file', () => {
    const files = generate(mockDomain, {
      package: 'domain.users.v1',
      includeValidation: true,
      goPackage: 'github.com/myorg/users/gen/go',
    });
    
    const protoFile = files.find(f => f.path.endsWith('.proto') && f.type === 'proto');
    expect(protoFile).toBeDefined();
    expect(protoFile?.content).toContain('syntax = "proto3"');
    expect(protoFile?.content).toContain('package domain.users.v1');
    expect(protoFile?.content).toContain('option go_package');
  });
  
  it('should generate buf configuration files', () => {
    const files = generate(mockDomain, {
      package: 'domain.users.v1',
      bufOrganization: 'myorg',
      bufModule: 'users',
    });
    
    const bufYaml = files.find(f => f.path === 'buf.yaml');
    expect(bufYaml).toBeDefined();
    
    const bufGenYaml = files.find(f => f.path === 'buf.gen.yaml');
    expect(bufGenYaml).toBeDefined();
  });
  
  it('should generate TypeScript stubs when requested', () => {
    const files = generate(mockDomain, {
      package: 'domain.users.v1',
      generateTypeScript: true,
    });
    
    const tsFiles = files.filter(f => f.type === 'typescript');
    expect(tsFiles.length).toBeGreaterThan(0);
    
    const clientFile = tsFiles.find(f => f.path.includes('_client'));
    expect(clientFile).toBeDefined();
    
    const serverFile = tsFiles.find(f => f.path.includes('_server'));
    expect(serverFile).toBeDefined();
  });
  
  it('should generate Connect-RPC files when requested', () => {
    const files = generate(mockDomain, {
      package: 'domain.users.v1',
      includeConnect: true,
    });
    
    const connectFiles = files.filter(f => 
      f.type === 'typescript' && f.path.includes('connect')
    );
    expect(connectFiles.length).toBeGreaterThan(0);
  });
  
  it('should generate Go stubs when requested', () => {
    const files = generate(mockDomain, {
      package: 'domain.users.v1',
      generateGo: true,
      goPackage: 'github.com/myorg/users/gen/go',
    });
    
    const goFiles = files.filter(f => f.type === 'go');
    expect(goFiles.length).toBeGreaterThan(0);
  });
});

// ==========================================================================
// CONVENIENCE FUNCTION TESTS
// ==========================================================================

describe('Convenience Functions', () => {
  it('should generate proto only', () => {
    const proto = generateProtoOnly(mockDomain, {
      package: 'test.v1',
      includeValidation: true,
    });
    
    expect(proto).toContain('syntax = "proto3"');
    expect(proto).toContain('package test.v1');
    expect(proto).not.toContain('// TypeScript');
  });
  
  it('should generate buf project', () => {
    const files = generateBufProject(mockDomain, 'testorg', 'testmodule');
    
    expect(files.some(f => f.path === 'buf.yaml')).toBe(true);
    expect(files.some(f => f.path === 'buf.gen.yaml')).toBe(true);
    expect(files.some(f => f.type === 'proto')).toBe(true);
    expect(files.some(f => f.type === 'typescript')).toBe(true);
  });
});

// ==========================================================================
// PROTO OUTPUT FORMAT TESTS
// ==========================================================================

describe('Proto Output Format', () => {
  it('should have proper proto3 syntax', () => {
    const proto = generateProtoOnly(mockDomain, { package: 'test.v1' });
    
    // Check syntax is first
    const lines = proto.split('\n');
    expect(lines[0]).toBe('syntax = "proto3";');
  });
  
  it('should have proper imports', () => {
    const proto = generateProtoOnly(mockDomain, { 
      package: 'test.v1',
      includeValidation: true,
    });
    
    expect(proto).toContain('import "google/protobuf/timestamp.proto"');
    expect(proto).toContain('import "validate/validate.proto"');
  });
  
  it('should use snake_case for field names', () => {
    const proto = generateProtoOnly(mockDomain, { package: 'test.v1' });
    
    expect(proto).toContain('created_at');
    expect(proto).toContain('idempotency_key');
  });
  
  it('should use PascalCase for message names', () => {
    const proto = generateProtoOnly(mockDomain, { package: 'test.v1' });
    
    expect(proto).toContain('message User');
    expect(proto).toContain('message Email');
    expect(proto).toContain('message CreateUserRequest');
    expect(proto).toContain('message CreateUserResponse');
  });
  
  it('should have UNSPECIFIED as first enum value', () => {
    const proto = generateProtoOnly(mockDomain, { package: 'test.v1' });

    expect(proto).toContain('USER_STATUS_UNSPECIFIED = 0');
  });
});

// ==========================================================================
// ERROR MAPPING TESTS
// ==========================================================================

describe('Error Mapping', () => {
  const errors = mockDomain.behaviors[0].output!.errors;

  it('should map DUPLICATE_EMAIL to ALREADY_EXISTS', () => {
    const mapped = mapErrorToGrpcStatus(errors[0] as any);
    expect(mapped.grpcCode).toBe(GrpcStatusCode.ALREADY_EXISTS);
    expect(mapped.grpcCodeName).toBe('ALREADY_EXISTS');
    expect(mapped.islErrorName).toBe('DUPLICATE_EMAIL');
  });

  it('should map INVALID_INPUT to INVALID_ARGUMENT', () => {
    const mapped = mapErrorToGrpcStatus(errors[1] as any);
    expect(mapped.grpcCode).toBe(GrpcStatusCode.INVALID_ARGUMENT);
    expect(mapped.grpcCodeName).toBe('INVALID_ARGUMENT');
  });

  it('should map all behavior errors', () => {
    const mapped = mapBehaviorErrors(errors as any);
    expect(mapped).toHaveLength(2);
    expect(mapped[0].grpcCode).toBe(GrpcStatusCode.ALREADY_EXISTS);
    expect(mapped[1].grpcCode).toBe(GrpcStatusCode.INVALID_ARGUMENT);
  });

  it('should default retriable errors to UNAVAILABLE', () => {
    const retriableError = {
      kind: 'ErrorDeclaration' as const,
      name: id('SOME_UNKNOWN_ERROR'),
      when: str('Something went wrong'),
      retriable: true,
      span: S,
    };
    const mapped = mapErrorToGrpcStatus(retriableError as any);
    expect(mapped.grpcCode).toBe(GrpcStatusCode.UNAVAILABLE);
    expect(mapped.retriable).toBe(true);
  });

  it('should default non-retriable unknown errors to INTERNAL', () => {
    const unknownError = {
      kind: 'ErrorDeclaration' as const,
      name: id('SOME_UNKNOWN_ERROR'),
      when: str('Something went wrong'),
      retriable: false,
      span: S,
    };
    const mapped = mapErrorToGrpcStatus(unknownError as any);
    expect(mapped.grpcCode).toBe(GrpcStatusCode.INTERNAL);
  });
});

// ==========================================================================
// DETERMINISTIC OUTPUT TESTS
// ==========================================================================

describe('Deterministic Output', () => {
  it('should produce identical output on repeated calls', () => {
    const opts = { package: 'test.v1', includeValidation: true };
    const run1 = generateProtoOnly(mockDomain, opts);
    const run2 = generateProtoOnly(mockDomain, opts);
    expect(run1).toBe(run2);
  });

  it('should produce deterministic field numbers', () => {
    const messages = generateProtoMessages(mockDomain.entities);
    const userMsg = messages[0];
    // Fields should always get the same numbers in the same order
    expect(userMsg.definition).toContain('id = 1');
    expect(userMsg.definition).toContain('email = 2');
    expect(userMsg.definition).toContain('status = 3');
    expect(userMsg.definition).toContain('created_at = 4');
  });
});
