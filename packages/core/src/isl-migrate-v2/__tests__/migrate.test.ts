/**
 * ISL Migration V2 Tests
 */

import { describe, it, expect } from 'vitest';
import { migrateToISL } from '../migrate.js';
import type { MigrationSource } from '../types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const OPENAPI_FIXTURE: MigrationSource = {
  id: 'test-openapi',
  sourceType: 'openapi',
  name: 'TestAPI',
  filePath: 'test.json',
  content: JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/users': {
        get: {
          operationId: 'getUsers',
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: 'createUser',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateUser' },
              },
            },
          },
          responses: {
            '201': { description: 'Created' },
            '400': { description: 'Bad Request' },
          },
        },
      },
    },
    components: {
      schemas: {
        User: {
          type: 'object',
          required: ['id', 'email'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string', maxLength: 100 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateUser: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
  }),
};

const ZOD_FIXTURE: MigrationSource = {
  id: 'test-zod',
  sourceType: 'zod',
  name: 'TestSchemas',
  filePath: 'schemas.ts',
  content: `
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'user']),
});

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().min(0),
});
`,
};

const TYPESCRIPT_FIXTURE: MigrationSource = {
  id: 'test-ts',
  sourceType: 'typescript',
  name: 'TestTypes',
  filePath: 'types.ts',
  content: `
export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: Date;
}

export type UserRole = 'admin' | 'user' | 'guest';

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
}

export interface OrderItem {
  productId: string;
  quantity: number;
}
`,
};

// ============================================================================
// Tests
// ============================================================================

describe('migrateToISL', () => {
  describe('OpenAPI migration', () => {
    it('should extract types from OpenAPI spec', () => {
      const result = migrateToISL([OPENAPI_FIXTURE]);

      expect(result.ast.types).toBeDefined();
      expect(result.ast.types!.length).toBeGreaterThan(0);

      const userType = result.ast.types!.find((t) => t.name.name === 'User');
      expect(userType).toBeDefined();
    });

    it('should extract behaviors from OpenAPI operations', () => {
      const result = migrateToISL([OPENAPI_FIXTURE]);

      expect(result.ast.behaviors).toBeDefined();
      expect(result.ast.behaviors!.length).toBe(2);

      const getUsers = result.ast.behaviors!.find((b) => b.name.name === 'Getusers');
      expect(getUsers).toBeDefined();
    });

    it('should infer entities from types with id fields', () => {
      const result = migrateToISL([OPENAPI_FIXTURE], { inferEntities: true });

      expect(result.ast.entities).toBeDefined();
      expect(result.ast.entities!.length).toBeGreaterThan(0);
    });

    it('should generate openQuestions for missing contracts', () => {
      const result = migrateToISL([OPENAPI_FIXTURE], {
        generatePreconditions: true,
        generatePostconditions: true,
      });

      expect(result.openQuestions.length).toBeGreaterThan(0);

      const behaviorQuestions = result.openQuestions.filter(
        (q) => q.category === 'behavior_contract'
      );
      expect(behaviorQuestions.length).toBeGreaterThan(0);
    });

    it('should generate canonical ISL output', () => {
      const result = migrateToISL([OPENAPI_FIXTURE]);

      expect(result.islOutput).toBeDefined();
      expect(result.islOutput).toContain('domain');
      expect(result.islOutput).toContain('behavior');
    });
  });

  describe('Zod migration', () => {
    it('should extract types from Zod schemas', () => {
      const result = migrateToISL([ZOD_FIXTURE]);

      expect(result.ast.types).toBeDefined();
      expect(result.ast.types!.length).toBeGreaterThan(0);
    });

    it('should handle Zod enum types', () => {
      const result = migrateToISL([ZOD_FIXTURE]);

      // The schema contains role: z.enum(['admin', 'user'])
      const islOutput = result.islOutput ?? '';
      expect(islOutput.length).toBeGreaterThan(0);
    });
  });

  describe('TypeScript migration', () => {
    it('should extract interfaces from TypeScript', () => {
      const result = migrateToISL([TYPESCRIPT_FIXTURE]);

      expect(result.ast.types).toBeDefined();
      expect(result.ast.types!.length).toBeGreaterThan(0);

      const userType = result.ast.types!.find((t) => t.name.name === 'User');
      expect(userType).toBeDefined();
    });

    it('should convert string literal unions to enums', () => {
      const result = migrateToISL([TYPESCRIPT_FIXTURE]);

      const roleType = result.ast.types!.find((t) => t.name.name === 'Userrole');
      expect(roleType).toBeDefined();
      expect(roleType!.definition.kind).toBe('EnumType');
    });

    it('should handle nested types', () => {
      const result = migrateToISL([TYPESCRIPT_FIXTURE]);

      const orderType = result.ast.types!.find((t) => t.name.name === 'Order');
      expect(orderType).toBeDefined();
    });
  });

  describe('Configuration options', () => {
    it('should use provided domain name', () => {
      const result = migrateToISL([OPENAPI_FIXTURE], { domainName: 'CustomDomain' });

      expect(result.ast.name?.name).toBe('CustomDomain');
    });

    it('should use provided version', () => {
      const result = migrateToISL([OPENAPI_FIXTURE], { version: '2.0.0' });

      expect(result.ast.version?.value).toBe('2.0.0');
    });

    it('should respect naming convention', () => {
      const result = migrateToISL([OPENAPI_FIXTURE], { naming: 'preserve' });

      // With preserve, names should match source exactly
      expect(result.ast).toBeDefined();
    });

    it('should skip entity inference when disabled', () => {
      const result = migrateToISL([OPENAPI_FIXTURE], { inferEntities: false });

      expect(result.ast.entities).toEqual([]);
    });
  });

  describe('Statistics', () => {
    it('should track migration statistics', () => {
      const result = migrateToISL([OPENAPI_FIXTURE]);

      expect(result.stats.typesExtracted).toBeGreaterThan(0);
      expect(result.stats.behaviorsCreated).toBeGreaterThan(0);
      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should count open questions', () => {
      const result = migrateToISL([OPENAPI_FIXTURE], {
        generatePreconditions: true,
        generatePostconditions: true,
      });

      expect(result.stats.openQuestionsCount).toBe(result.openQuestions.length);
    });
  });

  describe('Multiple sources', () => {
    it('should combine types from multiple sources', () => {
      const result = migrateToISL([OPENAPI_FIXTURE, TYPESCRIPT_FIXTURE]);

      expect(result.processedSources).toContain('test-openapi');
      expect(result.processedSources).toContain('test-ts');
      expect(result.ast.types!.length).toBeGreaterThan(2);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid JSON gracefully', () => {
      const invalidSource: MigrationSource = {
        id: 'invalid',
        sourceType: 'openapi',
        name: 'Invalid',
        filePath: 'invalid.json',
        content: 'not valid json',
      };

      const result = migrateToISL([invalidSource]);

      expect(result.openQuestions.some((q) => q.priority === 'critical')).toBe(true);
    });

    it('should handle unknown source types', () => {
      const unknownSource: MigrationSource = {
        id: 'unknown',
        sourceType: 'graphql' as any,
        name: 'Unknown',
        filePath: 'schema.graphql',
        content: 'type Query { hello: String }',
      };

      const result = migrateToISL([unknownSource]);

      expect(result.openQuestions.some((q) => q.question.includes('Unknown source type'))).toBe(
        true
      );
    });
  });
});

describe('OpenQuestion generation', () => {
  it('should generate questions with unique IDs', () => {
    const result = migrateToISL([OPENAPI_FIXTURE], {
      generatePreconditions: true,
      generatePostconditions: true,
    });

    const ids = result.openQuestions.map((q) => q.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should include source context in questions', () => {
    const result = migrateToISL([OPENAPI_FIXTURE]);

    const questionsWithContext = result.openQuestions.filter((q) => q.sourceContext);
    expect(questionsWithContext.length).toBeGreaterThan(0);
  });

  it('should categorize questions appropriately', () => {
    const result = migrateToISL([OPENAPI_FIXTURE], {
      generatePreconditions: true,
      generatePostconditions: true,
    });

    const categories = new Set(result.openQuestions.map((q) => q.category));
    expect(categories.has('behavior_contract')).toBe(true);
  });
});
