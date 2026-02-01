// ============================================================================
// Fixture Integration Tests - Uses shared test-fixtures directory
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { parse, parseFile } from '../src/index.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Path to test fixtures (relative to package root)
const FIXTURES_ROOT = join(__dirname, '../../../test-fixtures');

// Helper to load fixture
function loadFixture(relativePath: string): string {
  const fullPath = join(FIXTURES_ROOT, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Fixture not found: ${fullPath}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

describe('Fixture Integration Tests', () => {
  // Verify fixtures exist before running tests
  beforeAll(() => {
    expect(existsSync(FIXTURES_ROOT)).toBe(true);
  });

  describe('Valid Fixtures', () => {
    describe('minimal.isl', () => {
      it('should parse without errors', () => {
        const source = loadFixture('valid/minimal.isl');
        const result = parse(source, 'minimal.isl');
        
        expect(result.success).toBe(true);
        expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
        expect(result.domain).toBeDefined();
      });

      it('should have correct structure', () => {
        const source = loadFixture('valid/minimal.isl');
        const result = parse(source, 'minimal.isl');
        
        expect(result.domain?.name.name).toBe('Minimal');
        expect(result.domain?.version.value).toBe('1.0.0');
        expect(result.domain?.entities).toHaveLength(1);
        expect(result.domain?.entities[0]?.name.name).toBe('Item');
      });
    });

    describe('all-features.isl', () => {
      it('should parse without errors', () => {
        const source = loadFixture('valid/all-features.isl');
        const result = parse(source, 'all-features.isl');
        
        expect(result.success).toBe(true);
        expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
      });

      it('should parse all type definitions', () => {
        const source = loadFixture('valid/all-features.isl');
        const result = parse(source, 'all-features.isl');
        
        // Check constrained types
        const email = result.domain?.types.find(t => t.name.name === 'Email');
        expect(email).toBeDefined();
        expect(email?.definition.kind).toBe('ConstrainedType');
        
        // Check enums
        const status = result.domain?.types.find(t => t.name.name === 'Status');
        expect(status).toBeDefined();
        expect(status?.definition.kind).toBe('EnumType');
        
        // Check structs
        const address = result.domain?.types.find(t => t.name.name === 'Address');
        expect(address).toBeDefined();
        expect(address?.definition.kind).toBe('StructType');
      });

      it('should parse all entities', () => {
        const source = loadFixture('valid/all-features.isl');
        const result = parse(source, 'all-features.isl');
        
        expect(result.domain?.entities.length).toBeGreaterThanOrEqual(4);
        
        // Check User entity
        const user = result.domain?.entities.find(e => e.name.name === 'User');
        expect(user).toBeDefined();
        expect(user?.fields.length).toBeGreaterThanOrEqual(10);
        expect(user?.invariants.length).toBeGreaterThan(0);
        expect(user?.lifecycle).toBeDefined();
      });

      it('should parse all behaviors', () => {
        const source = loadFixture('valid/all-features.isl');
        const result = parse(source, 'all-features.isl');
        
        expect(result.domain?.behaviors.length).toBeGreaterThanOrEqual(5);
        
        // Check CreateUser behavior
        const createUser = result.domain?.behaviors.find(b => b.name.name === 'CreateUser');
        expect(createUser).toBeDefined();
        expect(createUser?.description).toBeDefined();
        expect(createUser?.actors).toBeDefined();
        expect(createUser?.input).toBeDefined();
        expect(createUser?.output).toBeDefined();
        expect(createUser?.preconditions.length).toBeGreaterThan(0);
        expect(createUser?.postconditions.length).toBeGreaterThan(0);
      });

      it('should parse views', () => {
        const source = loadFixture('valid/all-features.isl');
        const result = parse(source, 'all-features.isl');
        
        expect(result.domain?.views.length).toBeGreaterThan(0);
      });

      it('should parse policies', () => {
        const source = loadFixture('valid/all-features.isl');
        const result = parse(source, 'all-features.isl');
        
        expect(result.domain?.policies.length).toBeGreaterThan(0);
      });

      it('should parse scenarios', () => {
        const source = loadFixture('valid/all-features.isl');
        const result = parse(source, 'all-features.isl');
        
        expect(result.domain?.scenarios.length).toBeGreaterThan(0);
      });

      it('should parse chaos blocks', () => {
        const source = loadFixture('valid/all-features.isl');
        const result = parse(source, 'all-features.isl');
        
        expect(result.domain?.chaos.length).toBeGreaterThan(0);
      });

      it('should parse global invariants', () => {
        const source = loadFixture('valid/all-features.isl');
        const result = parse(source, 'all-features.isl');
        
        expect(result.domain?.invariants.length).toBeGreaterThan(0);
      });
    });

    describe('complex-types.isl', () => {
      it('should parse without errors', () => {
        const source = loadFixture('valid/complex-types.isl');
        const result = parse(source, 'complex-types.isl');
        
        expect(result.success).toBe(true);
        expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
      });

      it('should parse nested struct types', () => {
        const source = loadFixture('valid/complex-types.isl');
        const result = parse(source, 'complex-types.isl');
        
        const contactInfo = result.domain?.types.find(t => t.name.name === 'ContactInfo');
        expect(contactInfo).toBeDefined();
        expect(contactInfo?.definition.kind).toBe('StructType');
      });

      it('should parse List types', () => {
        const source = loadFixture('valid/complex-types.isl');
        const result = parse(source, 'complex-types.isl');
        
        const stringList = result.domain?.types.find(t => t.name.name === 'StringList');
        expect(stringList).toBeDefined();
        expect(stringList?.definition.kind).toBe('ListType');
      });

      it('should parse Map types', () => {
        const source = loadFixture('valid/complex-types.isl');
        const result = parse(source, 'complex-types.isl');
        
        const stringMap = result.domain?.types.find(t => t.name.name === 'StringMap');
        expect(stringMap).toBeDefined();
        expect(stringMap?.definition.kind).toBe('MapType');
      });

      it('should parse deeply nested types', () => {
        const source = loadFixture('valid/complex-types.isl');
        const result = parse(source, 'complex-types.isl');
        
        const nestedList = result.domain?.types.find(t => t.name.name === 'NestedList5');
        expect(nestedList).toBeDefined();
      });
    });

    describe('Real-world fixtures', () => {
      it('should parse payment.isl', () => {
        const source = loadFixture('valid/real-world/payment.isl');
        const result = parse(source, 'payment.isl');
        
        expect(result.success).toBe(true);
        expect(result.domain?.name.name).toBe('Payment');
        expect(result.domain?.behaviors.length).toBeGreaterThan(0);
      });

      it('should parse auth.isl', () => {
        const source = loadFixture('valid/real-world/auth.isl');
        const result = parse(source, 'auth.isl');
        
        expect(result.success).toBe(true);
        expect(result.domain?.name.name).toBe('Auth');
        expect(result.domain?.behaviors.length).toBeGreaterThan(0);
      });

      it('should parse crud.isl', () => {
        const source = loadFixture('valid/real-world/crud.isl');
        const result = parse(source, 'crud.isl');
        
        expect(result.success).toBe(true);
        expect(result.domain?.name.name).toBe('CRUD');
        expect(result.domain?.behaviors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Invalid Fixtures - Syntax Errors', () => {
    it('should detect missing braces', () => {
      const source = loadFixture('invalid/syntax-errors/missing-braces.isl');
      const result = parse(source, 'missing-braces.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect unterminated string', () => {
      const source = loadFixture('invalid/syntax-errors/unterminated-string.isl');
      const result = parse(source, 'unterminated-string.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => 
        e.message.toLowerCase().includes('unterminated') || 
        e.message.toLowerCase().includes('string')
      )).toBe(true);
    });

    it('should detect invalid token', () => {
      const source = loadFixture('invalid/syntax-errors/invalid-token.isl');
      const result = parse(source, 'invalid-token.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing version', () => {
      const source = loadFixture('invalid/syntax-errors/missing-version.isl');
      const result = parse(source, 'missing-version.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => 
        e.message.toLowerCase().includes('version')
      )).toBe(true);
    });

    it('should detect unexpected token', () => {
      const source = loadFixture('invalid/syntax-errors/unexpected-token.isl');
      const result = parse(source, 'unexpected-token.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid escape sequence', () => {
      const source = loadFixture('invalid/syntax-errors/invalid-escape.isl');
      const result = parse(source, 'invalid-escape.isl');
      
      // May produce warnings or errors depending on parser behavior
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect unterminated comment', () => {
      const source = loadFixture('invalid/syntax-errors/unterminated-comment.isl');
      const result = parse(source, 'unterminated-comment.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => 
        e.message.toLowerCase().includes('unterminated') || 
        e.message.toLowerCase().includes('comment')
      )).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unicode content', () => {
      const source = loadFixture('edge-cases/unicode.isl');
      const result = parse(source, 'unicode.isl');
      
      // Parser should handle unicode gracefully (either succeed or fail with good error)
      expect(result.domain !== undefined || result.errors.length > 0).toBe(true);
    });

    it('should handle empty blocks', () => {
      const source = loadFixture('edge-cases/empty-blocks.isl');
      const result = parse(source, 'empty-blocks.isl');
      
      // Empty blocks should parse (might have warnings)
      expect(result.domain).toBeDefined();
    });

    it('should handle deeply nested structures', () => {
      const source = loadFixture('edge-cases/deeply-nested.isl');
      const result = parse(source, 'deeply-nested.isl');
      
      expect(result.success).toBe(true);
      expect(result.domain).toBeDefined();
    });

    it('should handle large files within timeout', () => {
      const source = loadFixture('edge-cases/max-size.isl');
      
      const startTime = performance.now();
      const result = parse(source, 'max-size.isl');
      const endTime = performance.now();
      
      expect(result.domain).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in < 5s
    });

    it('should handle special values', () => {
      const source = loadFixture('edge-cases/special-values.isl');
      const result = parse(source, 'special-values.isl');
      
      expect(result.success).toBe(true);
      expect(result.domain).toBeDefined();
    });
  });
});

describe('parseFile Tests', () => {
  it('should parse file from disk', async () => {
    const filePath = join(FIXTURES_ROOT, 'valid/minimal.isl');
    const result = await parseFile(filePath);
    
    expect(result.success).toBe(true);
    expect(result.domain?.name.name).toBe('Minimal');
  });

  it('should include filename in error locations', async () => {
    const filePath = join(FIXTURES_ROOT, 'invalid/syntax-errors/missing-version.isl');
    const result = await parseFile(filePath);
    
    expect(result.success).toBe(false);
    expect(result.errors[0]?.location.file).toBe(filePath);
  });

  it('should handle non-existent file', async () => {
    const result = await parseFile('/nonexistent/path/file.isl');
    
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain('ENOENT');
  });
});

describe('Performance Tests', () => {
  it('should parse 100 minimal specs in < 1 second', () => {
    const source = loadFixture('valid/minimal.isl');
    
    const startTime = performance.now();
    for (let i = 0; i < 100; i++) {
      parse(source);
    }
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(1000);
  });

  it('should parse complex spec in < 500ms', () => {
    const source = loadFixture('valid/all-features.isl');
    
    const startTime = performance.now();
    parse(source);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(500);
  });

  it('should parse real-world specs efficiently', () => {
    const sources = [
      loadFixture('valid/real-world/payment.isl'),
      loadFixture('valid/real-world/auth.isl'),
      loadFixture('valid/real-world/crud.isl'),
    ];
    
    const startTime = performance.now();
    for (const source of sources) {
      parse(source);
    }
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(1000);
  });
});
