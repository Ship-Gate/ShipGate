// ============================================================================
// gRPC Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate, generateProtoOnly, generateBufProject } from '../src/generator';
import { generateProtoTypes } from '../src/proto/types';
import { generateProtoMessages } from '../src/proto/messages';
import { generateProtoServices, generateCrudService } from '../src/proto/services';
import { generateBufYaml, generateBufGenYaml } from '../src/proto/options';
import {
  toSnakeCase,
  toPascalCase,
  toScreamingSnakeCase,
  toProtoPackage,
} from '../src/utils';
import type { Domain, Entity, Behavior, TypeDeclaration } from '@isl-lang/isl-core';

// ==========================================================================
// TEST FIXTURES
// ==========================================================================

const mockDomain: Domain = {
  kind: 'Domain',
  name: { kind: 'Identifier', name: 'Users', location: null as any },
  version: { kind: 'StringLiteral', value: '1.0.0', location: null as any },
  imports: [],
  types: [
    {
      kind: 'TypeDeclaration',
      name: { kind: 'Identifier', name: 'Email', location: null as any },
      definition: {
        kind: 'ConstrainedType',
        base: { kind: 'PrimitiveType', name: 'String', location: null as any },
        constraints: [
          {
            kind: 'Constraint',
            name: 'pattern',
            value: {
              kind: 'RegexLiteral',
              pattern: '^[^\\s@]+@[^\\s@]+$',
              flags: '',
              location: null as any,
            },
            location: null as any,
          },
        ],
        location: null as any,
      },
      annotations: [],
      location: null as any,
    },
    {
      kind: 'TypeDeclaration',
      name: { kind: 'Identifier', name: 'UserStatus', location: null as any },
      definition: {
        kind: 'EnumType',
        variants: [
          { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'PENDING', location: null as any }, location: null as any },
          { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'ACTIVE', location: null as any }, location: null as any },
          { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'SUSPENDED', location: null as any }, location: null as any },
        ],
        location: null as any,
      },
      annotations: [],
      location: null as any,
    },
  ],
  entities: [
    {
      kind: 'Entity',
      name: { kind: 'Identifier', name: 'User', location: null as any },
      fields: [
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'id', location: null as any },
          type: { kind: 'PrimitiveType', name: 'UUID', location: null as any },
          optional: false,
          annotations: [
            { kind: 'Annotation', name: { kind: 'Identifier', name: 'immutable', location: null as any }, location: null as any },
            { kind: 'Annotation', name: { kind: 'Identifier', name: 'unique', location: null as any }, location: null as any },
          ],
          location: null as any,
        },
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'email', location: null as any },
          type: {
            kind: 'ReferenceType',
            name: {
              kind: 'QualifiedName',
              parts: [{ kind: 'Identifier', name: 'Email', location: null as any }],
              location: null as any,
            },
            location: null as any,
          },
          optional: false,
          annotations: [],
          location: null as any,
        },
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'status', location: null as any },
          type: {
            kind: 'ReferenceType',
            name: {
              kind: 'QualifiedName',
              parts: [{ kind: 'Identifier', name: 'UserStatus', location: null as any }],
              location: null as any,
            },
            location: null as any,
          },
          optional: false,
          annotations: [],
          location: null as any,
        },
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'created_at', location: null as any },
          type: { kind: 'PrimitiveType', name: 'Timestamp', location: null as any },
          optional: false,
          annotations: [
            { kind: 'Annotation', name: { kind: 'Identifier', name: 'immutable', location: null as any }, location: null as any },
          ],
          location: null as any,
        },
      ],
      invariants: [],
      location: null as any,
    },
  ],
  behaviors: [
    {
      kind: 'Behavior',
      name: { kind: 'Identifier', name: 'CreateUser', location: null as any },
      description: { kind: 'StringLiteral', value: 'Create a new user', location: null as any },
      input: {
        kind: 'InputSpec',
        fields: [
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'email', location: null as any },
            type: {
              kind: 'ReferenceType',
              name: {
                kind: 'QualifiedName',
                parts: [{ kind: 'Identifier', name: 'Email', location: null as any }],
                location: null as any,
              },
              location: null as any,
            },
            optional: false,
            annotations: [],
            location: null as any,
          },
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'idempotency_key', location: null as any },
            type: { kind: 'PrimitiveType', name: 'String', location: null as any },
            optional: false,
            annotations: [],
            location: null as any,
          },
        ],
        location: null as any,
      },
      output: {
        kind: 'OutputSpec',
        success: {
          kind: 'ReferenceType',
          name: {
            kind: 'QualifiedName',
            parts: [{ kind: 'Identifier', name: 'User', location: null as any }],
            location: null as any,
          },
          location: null as any,
        },
        errors: [
          {
            kind: 'ErrorSpec',
            name: { kind: 'Identifier', name: 'DUPLICATE_EMAIL', location: null as any },
            when: { kind: 'StringLiteral', value: 'Email already exists', location: null as any },
            retriable: false,
            location: null as any,
          },
          {
            kind: 'ErrorSpec',
            name: { kind: 'Identifier', name: 'INVALID_INPUT', location: null as any },
            when: { kind: 'StringLiteral', value: 'Invalid input data', location: null as any },
            retriable: false,
            location: null as any,
          },
        ],
        location: null as any,
      },
      preconditions: [],
      postconditions: [],
      invariants: [],
      temporal: [],
      security: [],
      compliance: [],
      location: null as any,
    },
  ],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
  location: null as any,
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
  it('should generate enum types', () => {
    const types = generateProtoTypes(mockDomain.types as TypeDeclaration[]);
    
    const userStatus = types.find(t => t.name === 'UserStatus');
    expect(userStatus).toBeDefined();
    expect(userStatus?.definition).toContain('enum UserStatus');
    expect(userStatus?.definition).toContain('USER_STATUS_UNSPECIFIED = 0');
    expect(userStatus?.definition).toContain('USER_STATUS_PENDING = 1');
    expect(userStatus?.definition).toContain('USER_STATUS_ACTIVE = 2');
    expect(userStatus?.definition).toContain('USER_STATUS_SUSPENDED = 3');
  });
  
  it('should generate constrained type wrappers', () => {
    const types = generateProtoTypes(mockDomain.types as TypeDeclaration[], {
      includeValidation: true,
    });
    
    const email = types.find(t => t.name === 'Email');
    expect(email).toBeDefined();
    expect(email?.definition).toContain('message Email');
    expect(email?.definition).toContain('string value = 1');
    expect(email?.isWrapper).toBe(true);
  });
  
  it('should include validation imports when requested', () => {
    const types = generateProtoTypes(mockDomain.types as TypeDeclaration[], {
      includeValidation: true,
    });
    
    const hasValidationImport = types.some(t => 
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
    const messages = generateProtoMessages(mockDomain.entities as Entity[], {
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
    const messages = generateProtoMessages(mockDomain.entities as Entity[]);
    
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
      mockDomain.behaviors as Behavior[],
      mockDomain.entities as Entity[],
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
      mockDomain.behaviors as Behavior[],
      mockDomain.entities as Entity[],
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
    const crudService = generateCrudService(mockDomain.entities[0] as Entity, {
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
