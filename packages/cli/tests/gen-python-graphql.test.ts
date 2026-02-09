/**
 * Tests for Python and GraphQL code generation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { gen } from '../src/commands/gen.js';
import { domainToPython, domainToGraphQL } from '../src/commands/gen-adapters.js';
import { parse } from '@isl-lang/parser';

const TEST_ISL = `
domain Auth v1.0.0 {
  entity User {
    id: UUID
    email: String
    name: String?
    createdAt: Timestamp
  }

  behavior Login {
    input {
      email: String
      password: String
    }
    output {
      success: User
      errors {
        InvalidCredentials
        AccountLocked
      }
    }
  }

  behavior Register {
    input {
      email: String
      password: String
      name: String?
    }
    output {
      success: User
      errors {
        EmailExists
      }
    }
  }
}
`;

describe('Python and GraphQL code generation', () => {
  const testDir = join(__dirname, '..', 'test-output');
  
  beforeAll(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    await mkdir(testDir, { recursive: true });
  });

  describe('Python generator', () => {
    it('should generate Python code from ISL', async () => {
      const testFile = join(testDir, 'test-auth.isl');
      await writeFile(testFile, TEST_ISL);

      const result = await gen('python', testFile, {
        output: testDir,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      
      // Check that Python files were generated
      const pythonFiles = result.files.filter(f => f.path.endsWith('.py'));
      expect(pythonFiles.length).toBeGreaterThan(0);
      
      // Check for models.py
      const modelsFile = result.files.find(f => f.path.includes('models.py'));
      expect(modelsFile).toBeDefined();
      expect(modelsFile?.content).toContain('class User');
      expect(modelsFile?.content).toContain('pydantic');
    });

    it('should convert Domain to Python IslDomain correctly', () => {
      const parsed = parse(TEST_ISL, 'test.isl');
      expect(parsed.errors).toHaveLength(0);
      expect(parsed.domain).toBeDefined();
      
      if (parsed.domain) {
        const pythonDomain = domainToPython(parsed.domain);
        expect(pythonDomain.name).toBe('Auth');
        expect(pythonDomain.version).toBe('1.0.0');
        expect(pythonDomain.entities).toHaveLength(1);
        expect(pythonDomain.behaviors).toHaveLength(2);
        expect(pythonDomain.entities[0]?.name).toBe('User');
        expect(pythonDomain.behaviors[0]?.name).toBe('Login');
      }
    });
  });

  describe('GraphQL generator', () => {
    it('should generate GraphQL schema from ISL', async () => {
      const testFile = join(testDir, 'test-auth-graphql.isl');
      await writeFile(testFile, TEST_ISL);

      const result = await gen('graphql', testFile, {
        output: testDir,
        verbose: false,
      });

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      
      // Check that GraphQL files were generated
      const graphqlFiles = result.files.filter(f => f.path.endsWith('.graphql') || f.path.endsWith('.ts'));
      expect(graphqlFiles.length).toBeGreaterThan(0);
      
      // Check for schema.graphql
      const schemaFile = result.files.find(f => f.path.includes('schema.graphql'));
      expect(schemaFile).toBeDefined();
      expect(schemaFile?.content).toContain('type User');
      expect(schemaFile?.content).toContain('type Query');
    });

    it('should convert Domain to GraphQL Domain correctly', () => {
      const parsed = parse(TEST_ISL, 'test.isl');
      expect(parsed.errors).toHaveLength(0);
      expect(parsed.domain).toBeDefined();
      
      if (parsed.domain) {
        const graphqlDomain = domainToGraphQL(parsed.domain);
        expect(graphqlDomain.name).toBe('Auth');
        expect(graphqlDomain.version).toBe('1.0.0');
        expect(graphqlDomain.entities).toHaveLength(1);
        expect(graphqlDomain.behaviors).toHaveLength(2);
        expect(graphqlDomain.entities[0]?.name).toBe('User');
        expect(graphqlDomain.behaviors[0]?.name).toBe('Login');
      }
    });
  });
});
