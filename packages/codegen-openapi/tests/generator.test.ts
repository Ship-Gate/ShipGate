// ============================================================================
// OpenAPI Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import * as YAML from 'yaml';
import { generate } from '../src/generator';
import type * as AST from '@intentos/isl-core';

const mockDomain: AST.Domain = {
  name: 'Users',
  version: '1.0.0',
  entities: [
    {
      name: 'User',
      fields: [
        { name: 'id', type: { kind: 'primitive', name: 'UUID' }, optional: false, annotations: [{ name: 'immutable' }] },
        { name: 'email', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [] },
        { name: 'name', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [] },
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
      description: 'Create a new user',
      input: {
        fields: [
          { name: 'email', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [] },
          { name: 'name', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [] },
        ],
      },
      output: {
        success: { kind: 'reference', name: 'User' },
        errors: [
          { name: 'EMAIL_ALREADY_EXISTS', fields: [] },
        ],
      },
      preconditions: [],
      postconditions: [],
      annotations: [],
    },
    {
      name: 'GetUserById',
      input: {
        fields: [
          { name: 'id', type: { kind: 'primitive', name: 'UUID' }, optional: false, annotations: [] },
        ],
      },
      output: {
        success: { kind: 'reference', name: 'User' },
        errors: [{ name: 'USER_NOT_FOUND', fields: [] }],
      },
      preconditions: [],
      postconditions: [],
      annotations: [],
    },
    {
      name: 'ListUsers',
      input: {
        fields: [
          { name: 'page', type: { kind: 'primitive', name: 'Int' }, optional: true, annotations: [] },
          { name: 'limit', type: { kind: 'primitive', name: 'Int' }, optional: true, annotations: [] },
        ],
      },
      output: {
        success: { kind: 'list', elementType: { kind: 'reference', name: 'User' } },
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

describe('OpenAPI Generation', () => {
  it('should generate valid YAML by default', () => {
    const files = generate(mockDomain, {});
    
    expect(files.length).toBe(1);
    expect(files[0].path).toBe('openapi.yaml');
    expect(files[0].format).toBe('yaml');
    
    // Should parse as valid YAML
    const spec = YAML.parse(files[0].content);
    expect(spec).toBeDefined();
  });

  it('should generate JSON when requested', () => {
    const files = generate(mockDomain, { format: 'json' });
    
    expect(files[0].path).toBe('openapi.json');
    expect(files[0].format).toBe('json');
    
    // Should parse as valid JSON
    const spec = JSON.parse(files[0].content);
    expect(spec).toBeDefined();
  });

  it('should generate OpenAPI 3.1 by default', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    expect(spec.openapi).toBe('3.1.0');
  });

  it('should generate OpenAPI 3.0 when requested', () => {
    const files = generate(mockDomain, { version: '3.0' });
    const spec = YAML.parse(files[0].content);
    
    expect(spec.openapi).toBe('3.0.3');
  });

  it('should include info section', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    expect(spec.info.title).toBe('Users API');
    expect(spec.info.version).toBe('1.0.0');
  });

  it('should include servers when provided', () => {
    const files = generate(mockDomain, {
      servers: [
        { url: 'https://api.example.com', description: 'Production' },
        { url: 'https://staging-api.example.com', description: 'Staging' },
      ],
    });
    const spec = YAML.parse(files[0].content);
    
    expect(spec.servers.length).toBe(2);
    expect(spec.servers[0].url).toBe('https://api.example.com');
  });
});

describe('Schema Generation', () => {
  it('should generate schemas for entities', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    expect(spec.components.schemas.User).toBeDefined();
    expect(spec.components.schemas.User.type).toBe('object');
    expect(spec.components.schemas.User.properties.id).toBeDefined();
    expect(spec.components.schemas.User.properties.email).toBeDefined();
  });

  it('should generate schemas for enums', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    expect(spec.components.schemas.UserStatus).toBeDefined();
    expect(spec.components.schemas.UserStatus.type).toBe('string');
    expect(spec.components.schemas.UserStatus.enum).toContain('ACTIVE');
    expect(spec.components.schemas.UserStatus.enum).toContain('PENDING');
    expect(spec.components.schemas.UserStatus.enum).toContain('SUSPENDED');
  });

  it('should generate input schemas for behaviors', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    expect(spec.components.schemas.CreateUserInput).toBeDefined();
    expect(spec.components.schemas.CreateUserInput.properties.email).toBeDefined();
    expect(spec.components.schemas.CreateUserInput.properties.name).toBeDefined();
  });

  it('should mark immutable fields as readOnly', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    expect(spec.components.schemas.User.properties.id.readOnly).toBe(true);
  });

  it('should handle optional fields', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    // page and limit are optional in ListUsersInput
    expect(spec.components.schemas.ListUsersInput).toBeDefined();
    expect(spec.components.schemas.ListUsersInput.required).not.toContain('page');
    expect(spec.components.schemas.ListUsersInput.required).not.toContain('limit');
  });
});

describe('Path Generation', () => {
  it('should generate paths for behaviors', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    expect(spec.paths).toBeDefined();
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });

  it('should infer POST for create operations', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    // CreateUser should be POST /users
    const createPath = Object.keys(spec.paths).find(p => !p.includes(':id'));
    expect(spec.paths[createPath].post).toBeDefined();
    expect(spec.paths[createPath].post.operationId).toBe('createUser');
  });

  it('should infer GET for get operations', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    // GetUserById should be GET /users/:id
    const getPath = Object.keys(spec.paths).find(p => p.includes(':id'));
    expect(spec.paths[getPath].get).toBeDefined();
    expect(spec.paths[getPath].get.operationId).toBe('getUserById');
  });

  it('should generate request body for POST operations', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    const createPath = Object.keys(spec.paths).find(p => !p.includes(':id') && spec.paths[p].post);
    const operation = spec.paths[createPath].post;
    
    expect(operation.requestBody).toBeDefined();
    expect(operation.requestBody.content['application/json']).toBeDefined();
  });

  it('should generate path parameters for GET operations', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    const getPath = Object.keys(spec.paths).find(p => p.includes(':id'));
    const operation = spec.paths[getPath].get;
    
    expect(operation.parameters).toBeDefined();
    expect(operation.parameters.some((p: unknown) => (p as {name: string}).name === 'id')).toBe(true);
  });
});

describe('Response Generation', () => {
  it('should generate success responses', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    const createPath = Object.keys(spec.paths).find(p => spec.paths[p].post);
    const operation = spec.paths[createPath].post;
    
    expect(operation.responses['200']).toBeDefined();
    expect(operation.responses['200'].content['application/json']).toBeDefined();
  });

  it('should generate error responses', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    // CreateUser has EMAIL_ALREADY_EXISTS error -> 409 Conflict
    const createPath = Object.keys(spec.paths).find(p => spec.paths[p].post);
    const operation = spec.paths[createPath].post;
    
    expect(operation.responses['409']).toBeDefined();
  });

  it('should include standard error responses', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    const createPath = Object.keys(spec.paths).find(p => spec.paths[p].post);
    const operation = spec.paths[createPath].post;
    
    expect(operation.responses['400']).toBeDefined();
    expect(operation.responses['401']).toBeDefined();
    expect(operation.responses['500']).toBeDefined();
  });

  it('should include ErrorResponse schema', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    expect(spec.components.schemas.ErrorResponse).toBeDefined();
    expect(spec.components.schemas.ErrorResponse.properties.code).toBeDefined();
    expect(spec.components.schemas.ErrorResponse.properties.message).toBeDefined();
  });
});

describe('Security Generation', () => {
  it('should include security schemes when provided', () => {
    const files = generate(mockDomain, {
      auth: [
        { type: 'http', name: 'bearerAuth', scheme: 'bearer' },
      ],
    });
    const spec = YAML.parse(files[0].content);
    
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth.type).toBe('http');
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });

  it('should apply security globally', () => {
    const files = generate(mockDomain, {
      auth: [
        { type: 'apiKey', name: 'ApiKeyAuth', in: 'header' },
      ],
    });
    const spec = YAML.parse(files[0].content);
    
    expect(spec.security).toBeDefined();
    expect(spec.security[0].ApiKeyAuth).toBeDefined();
  });
});

describe('Tags Generation', () => {
  it('should generate tags from entities', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    expect(spec.tags).toBeDefined();
    expect(spec.tags.some((t: {name: string}) => t.name === 'User')).toBe(true);
  });

  it('should assign operations to tags', () => {
    const files = generate(mockDomain, {});
    const spec = YAML.parse(files[0].content);
    
    const createPath = Object.keys(spec.paths).find(p => spec.paths[p].post);
    const operation = spec.paths[createPath].post;
    
    expect(operation.tags).toBeDefined();
    expect(operation.tags.length).toBeGreaterThan(0);
  });
});
