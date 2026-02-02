// ============================================================================
// Import Resolver Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import {
  ImportResolver,
  resolveImports,
  createVirtualFS,
  ResolverErrorCode,
} from '../src/index.js';

describe('ImportResolver', () => {
  describe('Local Module Resolution', () => {
    it('should resolve a single file without imports', async () => {
      const files = {
        'main.isl': `
          domain Test {
            version: "1.0.0"
            
            entity User {
              id: UUID [immutable]
            }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.graph).toBeDefined();
      expect(result.graph!.modules.size).toBe(1);
    });

    it('should resolve relative imports with ./', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              User from "./types.isl"
            }
          }
        `,
        'types.isl': `
          domain Types {
            version: "1.0.0"
            entity User {
              id: UUID [immutable]
            }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      
      expect(result.success).toBe(true);
      expect(result.graph!.modules.size).toBe(2);
    });

    it('should resolve relative imports with ../', async () => {
      const files = {
        'app/main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              User from "../shared/types.isl"
            }
          }
        `,
        'shared/types.isl': `
          domain Types {
            version: "1.0.0"
            entity User {
              id: UUID [immutable]
            }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test/app',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      
      expect(result.success).toBe(true);
      expect(result.graph!.modules.size).toBe(2);
    });

    it('should add .isl extension if not provided', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              User from "./types"
            }
          }
        `,
        'types.isl': `
          domain Types {
            version: "1.0.0"
            entity User {
              id: UUID [immutable]
            }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      
      expect(result.success).toBe(true);
      expect(result.graph!.modules.size).toBe(2);
    });
  });

  describe('Cycle Detection', () => {
    it('should detect simple cycles (A -> B -> A)', async () => {
      const files = {
        'a.isl': `
          domain A {
            version: "1.0.0"
            imports {
              EntityB from "./b.isl"
            }
            entity EntityA { id: UUID }
          }
        `,
        'b.isl': `
          domain B {
            version: "1.0.0"
            imports {
              EntityA from "./a.isl"
            }
            entity EntityB { id: UUID }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('a.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === ResolverErrorCode.CIRCULAR_DEPENDENCY)).toBe(true);
    });

    it('should detect complex cycles (A -> B -> C -> A)', async () => {
      const files = {
        'a.isl': `
          domain A {
            version: "1.0.0"
            imports {
              EntityB from "./b.isl"
            }
            entity EntityA { id: UUID }
          }
        `,
        'b.isl': `
          domain B {
            version: "1.0.0"
            imports {
              EntityC from "./c.isl"
            }
            entity EntityB { id: UUID }
          }
        `,
        'c.isl': `
          domain C {
            version: "1.0.0"
            imports {
              EntityA from "./a.isl"
            }
            entity EntityC { id: UUID }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('a.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === ResolverErrorCode.CIRCULAR_DEPENDENCY)).toBe(true);
      
      // Verify error message contains cycle path
      const cycleError = result.errors.find(e => e.code === ResolverErrorCode.CIRCULAR_DEPENDENCY);
      expect(cycleError?.message).toContain('Circular dependency detected');
    });

    it('should allow diamond dependencies (not cycles)', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              EntityA from "./a.isl"
              EntityB from "./b.isl"
            }
          }
        `,
        'a.isl': `
          domain A {
            version: "1.0.0"
            imports {
              Shared from "./shared.isl"
            }
            entity EntityA { id: UUID }
          }
        `,
        'b.isl': `
          domain B {
            version: "1.0.0"
            imports {
              Shared from "./shared.isl"
            }
            entity EntityB { id: UUID }
          }
        `,
        'shared.isl': `
          domain Shared {
            version: "1.0.0"
            type Shared = String
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      
      expect(result.success).toBe(true);
      expect(result.graph!.modules.size).toBe(4);
    });
  });

  describe('MVP Mode (Imports Disabled)', () => {
    it('should error when imports are disabled and file has imports', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              User from "./types.isl"
            }
          }
        `,
        'types.isl': `
          domain Types {
            version: "1.0.0"
            entity User { id: UUID }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: false,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === ResolverErrorCode.IMPORTS_DISABLED)).toBe(true);
      
      const error = result.errors.find(e => e.code === ResolverErrorCode.IMPORTS_DISABLED);
      expect(error?.message).toContain('single-file mode');
    });

    it('should succeed when imports are disabled and file has no imports', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            entity User { id: UUID }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: false,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      
      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should error when module not found', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              User from "./missing.isl"
            }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === ResolverErrorCode.MODULE_NOT_FOUND)).toBe(true);
    });

    it('should error on invalid import path (not relative)', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              User from "types.isl"
            }
          }
        `,
        'types.isl': `
          domain Types {
            version: "1.0.0"
            entity User { id: UUID }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === ResolverErrorCode.INVALID_IMPORT_PATH)).toBe(true);
    });

    it('should error on parse failure', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              User from "./bad.isl"
            }
          }
        `,
        'bad.isl': `
          this is not valid ISL syntax
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === ResolverErrorCode.PARSE_ERROR)).toBe(true);
    });
  });

  describe('Deep Import Chains', () => {
    it('should resolve deep import chains', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports { L1 from "./l1.isl" }
          }
        `,
        'l1.isl': `
          domain L1 {
            version: "1.0.0"
            imports { L2 from "./l2.isl" }
            type L1 = String
          }
        `,
        'l2.isl': `
          domain L2 {
            version: "1.0.0"
            imports { L3 from "./l3.isl" }
            type L2 = String
          }
        `,
        'l3.isl': `
          domain L3 {
            version: "1.0.0"
            type L3 = String
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      
      expect(result.success).toBe(true);
      expect(result.graph!.modules.size).toBe(4);
      
      // Verify topological order (leaves first)
      const order = result.graph!.sortedOrder;
      const l3Index = order.findIndex(p => p.includes('l3.isl'));
      const l2Index = order.findIndex(p => p.includes('l2.isl'));
      const l1Index = order.findIndex(p => p.includes('l1.isl'));
      const mainIndex = order.findIndex(p => p.includes('main.isl'));
      
      expect(l3Index).toBeLessThan(l2Index);
      expect(l2Index).toBeLessThan(l1Index);
      expect(l1Index).toBeLessThan(mainIndex);
    });
  });
});
