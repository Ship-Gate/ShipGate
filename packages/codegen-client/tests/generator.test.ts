// ============================================================================
// API Client Generator Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator';
import type * as AST from '@intentos/isl-core';

// Mock ISL Domain for testing
const mockDomain: AST.Domain = {
  name: 'Users',
  version: '1.0.0',
  entities: [
    {
      name: 'User',
      fields: [
        { name: 'id', type: { kind: 'primitive', name: 'UUID' }, optional: false, annotations: [] },
        { name: 'email', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [] },
        { name: 'name', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [] },
        { name: 'status', type: { kind: 'reference', name: 'UserStatus' }, optional: false, annotations: [] },
        { name: 'createdAt', type: { kind: 'primitive', name: 'Timestamp' }, optional: false, annotations: [] },
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
          { name: 'INVALID_EMAIL', fields: [] },
        ],
      },
      preconditions: [],
      postconditions: [],
      annotations: [],
    },
    {
      name: 'GetUserById',
      description: 'Get a user by ID',
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
      description: 'List all users',
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
    {
      name: 'DeleteUser',
      description: 'Delete a user',
      input: {
        fields: [
          { name: 'id', type: { kind: 'primitive', name: 'UUID' }, optional: false, annotations: [] },
        ],
      },
      output: {
        success: { kind: 'primitive', name: 'Boolean' },
        errors: [{ name: 'USER_NOT_FOUND', fields: [] }],
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

describe('TypeScript Client Generation', () => {
  it('should generate TypeScript client', () => {
    const files = generate(mockDomain, {
      language: 'typescript',
      baseUrl: 'https://api.example.com',
    });

    expect(files.length).toBeGreaterThan(0);
    
    const clientFile = files.find((f) => f.path === 'client.ts');
    expect(clientFile).toBeDefined();
    expect(clientFile?.content).toContain('class UsersClient');
  });

  it('should generate type definitions', () => {
    const files = generate(mockDomain, {
      language: 'typescript',
      baseUrl: 'https://api.example.com',
    });

    const clientFile = files.find((f) => f.path === 'client.ts');
    expect(clientFile?.content).toContain('interface User');
    expect(clientFile?.content).toContain('enum UserStatus');
    expect(clientFile?.content).toContain('CreateUserInput');
  });

  it('should generate client methods', () => {
    const files = generate(mockDomain, {
      language: 'typescript',
      baseUrl: 'https://api.example.com',
    });

    const clientFile = files.find((f) => f.path === 'client.ts');
    expect(clientFile?.content).toContain('async createUser');
    expect(clientFile?.content).toContain('async getUserById');
    expect(clientFile?.content).toContain('async listUsers');
    expect(clientFile?.content).toContain('async deleteUser');
  });

  it('should infer correct HTTP methods', () => {
    const files = generate(mockDomain, {
      language: 'typescript',
      baseUrl: 'https://api.example.com',
    });

    const clientFile = files.find((f) => f.path === 'client.ts');
    // CreateUser -> POST
    expect(clientFile?.content).toContain("'POST'");
    // GetUserById -> GET
    expect(clientFile?.content).toContain("'GET'");
    // DeleteUser -> DELETE
    expect(clientFile?.content).toContain("'DELETE'");
  });

  it('should include retry logic when enabled', () => {
    const files = generate(mockDomain, {
      language: 'typescript',
      baseUrl: 'https://api.example.com',
      includeRetry: true,
    });

    const clientFile = files.find((f) => f.path === 'client.ts');
    expect(clientFile?.content).toContain('maxRetries');
    expect(clientFile?.content).toContain('isRetryable');
  });

  it('should include logging when enabled', () => {
    const files = generate(mockDomain, {
      language: 'typescript',
      baseUrl: 'https://api.example.com',
      includeLogging: true,
    });

    const clientFile = files.find((f) => f.path === 'client.ts');
    expect(clientFile?.content).toContain('logger');
    expect(clientFile?.content).toContain('debug');
  });

  it('should split files when requested', () => {
    const files = generate(mockDomain, {
      language: 'typescript',
      baseUrl: 'https://api.example.com',
      splitFiles: true,
    });

    expect(files.find((f) => f.path === 'types.ts')).toBeDefined();
    expect(files.find((f) => f.path === 'client.ts')).toBeDefined();
    expect(files.find((f) => f.path === 'index.ts')).toBeDefined();
  });
});

describe('Python Client Generation', () => {
  it('should generate Python client', () => {
    const files = generate(mockDomain, {
      language: 'python',
      baseUrl: 'https://api.example.com',
    });

    expect(files.length).toBeGreaterThan(0);
    
    const clientFile = files.find((f) => f.path === 'client.py');
    expect(clientFile).toBeDefined();
    expect(clientFile?.content).toContain('class UsersClient');
  });

  it('should use Python naming conventions', () => {
    const files = generate(mockDomain, {
      language: 'python',
      baseUrl: 'https://api.example.com',
    });

    const clientFile = files.find((f) => f.path === 'client.py');
    // Methods should be snake_case
    expect(clientFile?.content).toContain('async def create_user');
    expect(clientFile?.content).toContain('async def get_user_by_id');
    expect(clientFile?.content).toContain('async def list_users');
  });

  it('should use httpx for async requests', () => {
    const files = generate(mockDomain, {
      language: 'python',
      baseUrl: 'https://api.example.com',
    });

    const clientFile = files.find((f) => f.path === 'client.py');
    expect(clientFile?.content).toContain('import httpx');
    expect(clientFile?.content).toContain('AsyncClient');
  });

  it('should include __init__.py', () => {
    const files = generate(mockDomain, {
      language: 'python',
      baseUrl: 'https://api.example.com',
    });

    const initFile = files.find((f) => f.path === '__init__.py');
    expect(initFile).toBeDefined();
    expect(initFile?.content).toContain('UsersClient');
    expect(initFile?.content).toContain('__all__');
  });
});

describe('Go Client Generation', () => {
  it('should generate Go client', () => {
    const files = generate(mockDomain, {
      language: 'go',
      baseUrl: 'https://api.example.com',
      packageName: 'users',
    });

    expect(files.length).toBeGreaterThan(0);
    
    const clientFile = files.find((f) => f.path === 'client.go');
    expect(clientFile).toBeDefined();
    expect(clientFile?.content).toContain('package users');
    expect(clientFile?.content).toContain('type UsersClient struct');
  });

  it('should use Go naming conventions', () => {
    const files = generate(mockDomain, {
      language: 'go',
      baseUrl: 'https://api.example.com',
    });

    const clientFile = files.find((f) => f.path === 'client.go');
    // Methods should be PascalCase
    expect(clientFile?.content).toContain('func (c *UsersClient) CreateUser');
    expect(clientFile?.content).toContain('func (c *UsersClient) GetUserById');
  });

  it('should include context parameter', () => {
    const files = generate(mockDomain, {
      language: 'go',
      baseUrl: 'https://api.example.com',
    });

    const clientFile = files.find((f) => f.path === 'client.go');
    expect(clientFile?.content).toContain('ctx context.Context');
    expect(clientFile?.content).toContain('"context"');
  });

  it('should use Result type with generics', () => {
    const files = generate(mockDomain, {
      language: 'go',
      baseUrl: 'https://api.example.com',
    });

    const clientFile = files.find((f) => f.path === 'client.go');
    expect(clientFile?.content).toContain('Result[T any]');
    expect(clientFile?.content).toContain('Success bool');
  });
});

describe('HTTP Method Inference', () => {
  it('should infer GET for retrieval operations', () => {
    const domain: AST.Domain = {
      name: 'Test',
      version: '1.0.0',
      entities: [],
      types: [],
      behaviors: [
        {
          name: 'GetItem',
          input: { fields: [] },
          output: { success: { kind: 'primitive', name: 'String' } },
          preconditions: [],
          postconditions: [],
          annotations: [],
        },
        {
          name: 'FindItems',
          input: { fields: [] },
          output: { success: { kind: 'primitive', name: 'String' } },
          preconditions: [],
          postconditions: [],
          annotations: [],
        },
        {
          name: 'ListItems',
          input: { fields: [] },
          output: { success: { kind: 'primitive', name: 'String' } },
          preconditions: [],
          postconditions: [],
          annotations: [],
        },
      ],
      scenarios: [],
      policies: [],
      annotations: [],
    };

    const files = generate(domain, { language: 'typescript' });
    const content = files.find((f) => f.path === 'client.ts')?.content || '';

    // All should use GET
    expect(content.match(/'GET'/g)?.length).toBe(3);
  });

  it('should infer POST for creation operations', () => {
    const domain: AST.Domain = {
      name: 'Test',
      version: '1.0.0',
      entities: [],
      types: [],
      behaviors: [
        {
          name: 'CreateItem',
          input: { fields: [] },
          output: { success: { kind: 'primitive', name: 'String' } },
          preconditions: [],
          postconditions: [],
          annotations: [],
        },
        {
          name: 'AddItem',
          input: { fields: [] },
          output: { success: { kind: 'primitive', name: 'String' } },
          preconditions: [],
          postconditions: [],
          annotations: [],
        },
      ],
      scenarios: [],
      policies: [],
      annotations: [],
    };

    const files = generate(domain, { language: 'typescript' });
    const content = files.find((f) => f.path === 'client.ts')?.content || '';

    expect(content.match(/'POST'/g)?.length).toBe(2);
  });

  it('should infer DELETE for deletion operations', () => {
    const domain: AST.Domain = {
      name: 'Test',
      version: '1.0.0',
      entities: [],
      types: [],
      behaviors: [
        {
          name: 'DeleteItem',
          input: { fields: [] },
          output: { success: { kind: 'primitive', name: 'Boolean' } },
          preconditions: [],
          postconditions: [],
          annotations: [],
        },
        {
          name: 'RemoveItem',
          input: { fields: [] },
          output: { success: { kind: 'primitive', name: 'Boolean' } },
          preconditions: [],
          postconditions: [],
          annotations: [],
        },
      ],
      scenarios: [],
      policies: [],
      annotations: [],
    };

    const files = generate(domain, { language: 'typescript' });
    const content = files.find((f) => f.path === 'client.ts')?.content || '';

    expect(content.match(/'DELETE'/g)?.length).toBe(2);
  });
});
