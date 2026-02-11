/**
 * Module Resolution System Tests
 *
 * Tests for the ISL module resolution system including:
 * - Module specifier parsing
 * - Path resolution
 * - Module graph construction
 * - Cycle detection
 * - AST caching
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import {
  // Types
  createModuleId,
  isRelativePath,
  isStdlibModule,
  isScopedPackage,
  parseModuleSpecifier,
  inferStdlibCategory,
  createEmptyGraph,

  // Resolver
  ModuleResolver,
  createResolver,
  extractExports,

  // Graph
  ModuleGraphBuilder,
  formatCycleError,

  // Cache
  ASTCache,
  createCache,
  cacheKeyFromPath,
} from '../src/modules/index.js';

// ============================================================================
// Type Helpers Tests
// ============================================================================

describe('Module Types', () => {
  describe('createModuleId', () => {
    it('should normalize path separators', () => {
      const id = createModuleId('C:\\Users\\test\\file.isl');
      expect(id).toBe('C:/Users/test/file.isl');
    });

    it('should preserve forward slashes', () => {
      const id = createModuleId('/home/user/file.isl');
      expect(id).toBe('/home/user/file.isl');
    });
  });

  describe('isRelativePath', () => {
    it('should return true for ./ paths', () => {
      expect(isRelativePath('./local')).toBe(true);
      expect(isRelativePath('./nested/path')).toBe(true);
    });

    it('should return true for ../ paths', () => {
      expect(isRelativePath('../parent')).toBe(true);
      expect(isRelativePath('../../grandparent')).toBe(true);
    });

    it('should return false for bare specifiers', () => {
      expect(isRelativePath('stdlib-auth')).toBe(false);
      expect(isRelativePath('my-module')).toBe(false);
    });

    it('should return false for absolute paths', () => {
      expect(isRelativePath('/absolute/path')).toBe(false);
    });
  });

  describe('isStdlibModule', () => {
    it('should return true for stdlib- prefixed modules', () => {
      expect(isStdlibModule('stdlib-auth')).toBe(true);
      expect(isStdlibModule('stdlib-payments')).toBe(true);
      expect(isStdlibModule('stdlib-uploads')).toBe(true);
    });

    it('should return false for non-stdlib modules', () => {
      expect(isStdlibModule('my-module')).toBe(false);
      expect(isStdlibModule('@org/package')).toBe(false);
      expect(isStdlibModule('./local')).toBe(false);
    });
  });

  describe('isScopedPackage', () => {
    it('should return true for @ prefixed packages', () => {
      expect(isScopedPackage('@org/package')).toBe(true);
      expect(isScopedPackage('@isl-lang/stdlib')).toBe(true);
    });

    it('should return false for non-scoped packages', () => {
      expect(isScopedPackage('package')).toBe(false);
      expect(isScopedPackage('stdlib-auth')).toBe(false);
    });
  });

  describe('parseModuleSpecifier', () => {
    it('should parse bare module name', () => {
      const result = parseModuleSpecifier('stdlib-auth');
      expect(result).toEqual({ name: 'stdlib-auth' });
    });

    it('should parse module with version', () => {
      const result = parseModuleSpecifier('stdlib-auth@1.0.0');
      expect(result).toEqual({ name: 'stdlib-auth', version: '1.0.0' });
    });

    it('should parse module with alias', () => {
      const result = parseModuleSpecifier('stdlib-auth as auth');
      expect(result).toEqual({ name: 'stdlib-auth', alias: 'auth' });
    });

    it('should parse module with version and alias', () => {
      const result = parseModuleSpecifier('stdlib-auth@1.0.0 as auth');
      expect(result).toEqual({
        name: 'stdlib-auth',
        version: '1.0.0',
        alias: 'auth',
      });
    });
  });

  describe('inferStdlibCategory', () => {
    it('should infer auth category', () => {
      expect(inferStdlibCategory('stdlib-auth')).toBe('auth');
      expect(inferStdlibCategory('oauth-login')).toBe('auth');
      expect(inferStdlibCategory('session-create')).toBe('auth');
    });

    it('should infer payments category', () => {
      expect(inferStdlibCategory('stdlib-payments')).toBe('payments');
      expect(inferStdlibCategory('process-payment')).toBe('payments');
    });

    it('should infer uploads category', () => {
      expect(inferStdlibCategory('stdlib-uploads')).toBe('uploads');
      expect(inferStdlibCategory('upload-image')).toBe('uploads');
    });

    it('should return null for unknown modules', () => {
      expect(inferStdlibCategory('unknown-module')).toBe(null);
    });
  });
});

// ============================================================================
// Module Resolver Tests
// ============================================================================

describe('ModuleResolver', () => {
  let tempDir: string;
  let resolver: ModuleResolver;

  beforeEach(() => {
    // Create a temp directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isl-test-'));

    // Create test files
    fs.mkdirSync(path.join(tempDir, 'intents'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'main.isl'), 'domain Main {}');
    fs.writeFileSync(path.join(tempDir, 'intents', 'auth.isl'), 'domain Auth {}');
    fs.mkdirSync(path.join(tempDir, 'stdlib', 'auth'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'stdlib', 'auth', 'session-create.isl'),
      'module SessionCreate {}'
    );

    resolver = new ModuleResolver({
      projectRoot: tempDir,
      stdlibPath: path.join(tempDir, 'stdlib'),
    });
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('resolving relative paths', () => {
    it('should resolve ./relative paths', () => {
      const result = resolver.resolve(
        {
          raw: './intents/auth',
          span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 20, offset: 19 } },
        },
        path.join(tempDir, 'main.isl')
      );

      expect(result.success).toBe(true);
      expect(result.module?.path).toContain('intents');
      expect(result.module?.path).toContain('auth.isl');
    });

    it('should return error for non-existent relative path', () => {
      const result = resolver.resolve(
        {
          raw: './nonexistent',
          span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 20, offset: 19 } },
        },
        path.join(tempDir, 'main.isl')
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MODULE_NOT_FOUND');
      expect(result.triedPaths).toBeDefined();
      expect(result.triedPaths!.length).toBeGreaterThan(0);
    });
  });

  describe('resolving project modules', () => {
    it('should resolve bare specifiers from search paths', () => {
      const result = resolver.resolve({
        raw: 'auth',
        span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 5, offset: 4 } },
      });

      expect(result.success).toBe(true);
      expect(result.module?.path).toContain('auth.isl');
    });
  });

  describe('cache behavior', () => {
    it('should cache resolution results', () => {
      const specifier = {
        raw: './intents/auth',
        span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 20, offset: 19 } },
      };
      const fromFile = path.join(tempDir, 'main.isl');

      const result1 = resolver.resolve(specifier, fromFile);
      const result2 = resolver.resolve(specifier, fromFile);

      expect(result1).toEqual(result2);
    });

    it('should clear cache when requested', () => {
      const stats1 = resolver.getStats();
      resolver.clearCache();
      const stats2 = resolver.getStats();

      expect(stats2.cacheSize).toBe(0);
    });
  });
});

// ============================================================================
// AST Cache Tests
// ============================================================================

describe('ASTCache', () => {
  let cache: ASTCache;
  const mockAst = {
    kind: 'DomainDeclaration' as const,
    name: { kind: 'Identifier' as const, name: 'Test', span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 5, offset: 4 } } },
    uses: [],
    imports: [],
    entities: [],
    types: [],
    enums: [],
    behaviors: [],
    invariants: [],
    span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 5, offset: 4 } },
  };

  beforeEach(() => {
    cache = createCache({ maxSize: 100 });
  });

  describe('basic operations', () => {
    it('should store and retrieve AST', () => {
      const id = createModuleId('/test/file.isl');
      cache.set(id, mockAst, 12345);

      const result = cache.get(id, 12345);
      expect(result).toEqual(mockAst);
    });

    it('should return null for missing entry', () => {
      const id = createModuleId('/nonexistent.isl');
      const result = cache.get(id, 12345);
      expect(result).toBeNull();
    });

    it('should invalidate on mtime change', () => {
      const id = createModuleId('/test/file.isl');
      cache.set(id, mockAst, 12345);

      // Different mtime should invalidate
      const result = cache.get(id, 99999);
      expect(result).toBeNull();
    });
  });

  describe('invalidation', () => {
    it('should invalidate specific entry', () => {
      const id = createModuleId('/test/file.isl');
      cache.set(id, mockAst, 12345);
      cache.invalidate(id);

      const result = cache.get(id, 12345);
      expect(result).toBeNull();
    });

    it('should clear all entries', () => {
      const id1 = createModuleId('/test/file1.isl');
      const id2 = createModuleId('/test/file2.isl');
      cache.set(id1, mockAst, 12345);
      cache.set(id2, mockAst, 12345);

      cache.clear();

      expect(cache.size).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used when at capacity', () => {
      const smallCache = createCache({ maxSize: 2 });

      const id1 = createModuleId('/file1.isl');
      const id2 = createModuleId('/file2.isl');
      const id3 = createModuleId('/file3.isl');

      smallCache.set(id1, mockAst, 1);
      smallCache.set(id2, mockAst, 2);

      // Access id1 to make it more recently used
      smallCache.get(id1, 1);

      // Add id3, should evict id2 (least recently used)
      smallCache.set(id3, mockAst, 3);

      expect(smallCache.has(id1)).toBe(true);
      expect(smallCache.has(id2)).toBe(false);
      expect(smallCache.has(id3)).toBe(true);
    });

    it('get() refreshes recency so LRU evicts the non-accessed entry', () => {
      const smallCache = createCache({ maxSize: 2 });
      const id1 = createModuleId('/a.isl');
      const id2 = createModuleId('/b.isl');
      const id3 = createModuleId('/c.isl');

      smallCache.set(id1, mockAst, 1);
      smallCache.set(id2, mockAst, 2);
      smallCache.get(id2, 2); // refresh id2, id1 is now LRU

      smallCache.set(id3, mockAst, 3); // should evict id1

      expect(smallCache.has(id1)).toBe(false);
      expect(smallCache.has(id2)).toBe(true);
      expect(smallCache.has(id3)).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      const id = createModuleId('/test/file.isl');
      cache.set(id, mockAst, 12345);

      cache.get(id, 12345); // hit
      cache.get(id, 12345); // hit
      cache.get(createModuleId('/missing.isl'), 0); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 0);
    });
  });
});

// ============================================================================
// Module Graph Tests
// ============================================================================

describe('ModuleGraph', () => {
  describe('createEmptyGraph', () => {
    it('should create an empty graph structure', () => {
      const graph = createEmptyGraph();

      expect(graph.modules.size).toBe(0);
      expect(graph.edges).toEqual([]);
      expect(graph.entryPoints).toEqual([]);
      expect(graph.order).toEqual([]);
    });
  });

  describe('formatCycleError', () => {
    it('should format cycle error message', () => {
      const graph = createEmptyGraph();
      const id1 = createModuleId('/auth.isl');
      const id2 = createModuleId('/session.isl');
      const id3 = createModuleId('/user.isl');

      graph.modules.set(id1, {
        id: id1,
        path: '/auth.isl',
        exports: [],
      });
      graph.modules.set(id2, {
        id: id2,
        path: '/session.isl',
        exports: [],
      });
      graph.modules.set(id3, {
        id: id3,
        path: '/user.isl',
        exports: [],
      });

      const cycle = [id1, id2, id3];
      const errorMessage = formatCycleError(cycle, graph);

      expect(errorMessage).toContain('Circular import detected');
      expect(errorMessage).toContain('auth.isl');
      expect(errorMessage).toContain('session.isl');
      expect(errorMessage).toContain('user.isl');
      expect(errorMessage).toContain('cycle back');
      expect(errorMessage).toContain('To fix');
    });
  });
});

// ============================================================================
// Export Extraction Tests
// ============================================================================

describe('extractExports', () => {
  it('should extract entity exports', () => {
    const ast = {
      entities: [
        { name: { name: 'User' } },
        { name: { name: 'Session' } },
      ],
    };

    const exports = extractExports(ast);

    expect(exports).toContainEqual({
      name: 'User',
      kind: 'entity',
      isPublic: true,
    });
    expect(exports).toContainEqual({
      name: 'Session',
      kind: 'entity',
      isPublic: true,
    });
  });

  it('should extract behavior exports', () => {
    const ast = {
      behaviors: [
        { name: { name: 'CreateUser' } },
        { name: { name: 'DeleteUser' } },
      ],
    };

    const exports = extractExports(ast);

    expect(exports).toContainEqual({
      name: 'CreateUser',
      kind: 'behavior',
      isPublic: true,
    });
  });

  it('should extract type and enum exports', () => {
    const ast = {
      types: [{ name: { name: 'Email' } }],
      enums: [{ name: { name: 'Status' } }],
    };

    const exports = extractExports(ast);

    expect(exports).toContainEqual({
      name: 'Email',
      kind: 'type',
      isPublic: true,
    });
    expect(exports).toContainEqual({
      name: 'Status',
      kind: 'enum',
      isPublic: true,
    });
  });
});

// ============================================================================
// Cache Key Generation Tests
// ============================================================================

describe('cacheKeyFromPath', () => {
  it('should normalize Windows paths', () => {
    const key = cacheKeyFromPath('C:\\Users\\test\\file.isl');
    expect(key).toBe('C:/Users/test/file.isl');
  });

  it('should preserve Unix paths', () => {
    const key = cacheKeyFromPath('/home/user/file.isl');
    expect(key).toBe('/home/user/file.isl');
  });
});
