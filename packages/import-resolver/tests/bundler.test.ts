// ============================================================================
// AST Bundler Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  ImportResolver,
  Bundler,
  bundleModules,
  createVirtualFS,
  ResolverErrorCode,
} from '../src/index.js';

describe('Bundler', () => {
  describe('Fragment Merging', () => {
    it('should merge types from multiple modules', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              Email from "./types.isl"
            }
            type UserId = UUID
          }
        `,
        'types.isl': `
          domain Types {
            version: "1.0.0"
            type Email = String { format: "email" }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const resolveResult = await resolver.resolve('main.isl');
      expect(resolveResult.success).toBe(true);

      const bundler = new Bundler();
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(true);
      expect(bundleResult.bundle).toBeDefined();
      expect(bundleResult.bundle!.types).toHaveLength(2);
      
      // Check canonical ordering (alphabetical)
      expect(bundleResult.bundle!.types[0].name.name).toBe('Email');
      expect(bundleResult.bundle!.types[1].name.name).toBe('UserId');
    });

    it('should merge entities from multiple modules', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              Account from "./account.isl"
            }
            entity User {
              id: UUID [immutable]
              name: String
            }
          }
        `,
        'account.isl': `
          domain Account {
            version: "1.0.0"
            entity Account {
              id: UUID [immutable]
              balance: Decimal
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

      const resolveResult = await resolver.resolve('main.isl');
      const bundler = new Bundler();
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(true);
      expect(bundleResult.bundle!.entities).toHaveLength(2);
      
      // Check canonical ordering
      expect(bundleResult.bundle!.entities[0].name.name).toBe('Account');
      expect(bundleResult.bundle!.entities[1].name.name).toBe('User');
    });

    it('should merge behaviors from multiple modules', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              CreateUser from "./behaviors.isl"
            }
            behavior GetUser {
              input { id: UUID }
              output { success: String }
            }
          }
        `,
        'behaviors.isl': `
          domain Behaviors {
            version: "1.0.0"
            behavior CreateUser {
              input { name: String }
              output { success: String }
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

      const resolveResult = await resolver.resolve('main.isl');
      const bundler = new Bundler();
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(true);
      expect(bundleResult.bundle!.behaviors).toHaveLength(2);
      
      // Check canonical ordering
      expect(bundleResult.bundle!.behaviors[0].name.name).toBe('CreateUser');
      expect(bundleResult.bundle!.behaviors[1].name.name).toBe('GetUser');
    });
  });

  describe('Conflict Detection', () => {
    it('should error on duplicate entity names', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              User from "./types.isl"
            }
            entity User {
              id: UUID [immutable]
            }
          }
        `,
        'types.isl': `
          domain Types {
            version: "1.0.0"
            entity User {
              id: UUID [immutable]
              email: String
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

      const resolveResult = await resolver.resolve('main.isl');
      const bundler = new Bundler({ allowShadowing: false });
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(false);
      expect(bundleResult.errors.some(e => e.code === ResolverErrorCode.DUPLICATE_ENTITY)).toBe(true);
    });

    it('should error on duplicate type names', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              Email from "./types.isl"
            }
            type Email = String
          }
        `,
        'types.isl': `
          domain Types {
            version: "1.0.0"
            type Email = String { format: "email" }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const resolveResult = await resolver.resolve('main.isl');
      const bundler = new Bundler({ allowShadowing: false });
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(false);
      expect(bundleResult.errors.some(e => e.code === ResolverErrorCode.DUPLICATE_TYPE)).toBe(true);
    });

    it('should error on duplicate behavior names', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              CreateUser from "./behaviors.isl"
            }
            behavior CreateUser {
              input { name: String }
              output { success: String }
            }
          }
        `,
        'behaviors.isl': `
          domain Behaviors {
            version: "1.0.0"
            behavior CreateUser {
              input { email: String }
              output { success: String }
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

      const resolveResult = await resolver.resolve('main.isl');
      const bundler = new Bundler({ allowShadowing: false });
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(false);
      expect(bundleResult.errors.some(e => e.code === ResolverErrorCode.DUPLICATE_BEHAVIOR)).toBe(true);
    });
  });

  describe('Shadowing', () => {
    it('should allow shadowing when enabled (last-write-wins)', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              Email from "./types.isl"
            }
            type Email = String { max_length: 100 }
          }
        `,
        'types.isl': `
          domain Types {
            version: "1.0.0"
            type Email = String { max_length: 255 }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const resolveResult = await resolver.resolve('main.isl');
      expect(resolveResult.success).toBe(true);
      expect(resolveResult.graph).toBeDefined();
      
      const bundler = new Bundler({ allowShadowing: true });
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(true);
      expect(bundleResult.bundle!.types).toHaveLength(1);
      expect(bundleResult.warnings.length).toBeGreaterThan(0);
    });

    it('should emit warning when import is shadowed', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              Email from "./types.isl"
            }
            type Email = String
          }
        `,
        'types.isl': `
          domain Types {
            version: "1.0.0"
            type Email = String { format: "email" }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const resolveResult = await resolver.resolve('main.isl');
      const bundler = new Bundler({ allowShadowing: true });
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(true);
      expect(bundleResult.warnings.some(w => w.message.includes('shadowed'))).toBe(true);
    });
  });

  describe('Symbol Validation', () => {
    it('should error when imported symbol does not exist', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              NonExistent from "./types.isl"
            }
          }
        `,
        'types.isl': `
          domain Types {
            version: "1.0.0"
            type Email = String
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const resolveResult = await resolver.resolve('main.isl');
      const bundler = new Bundler();
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(false);
      expect(bundleResult.errors.some(e => e.code === ResolverErrorCode.SYMBOL_NOT_FOUND)).toBe(true);
    });
  });

  describe('Canonical Ordering', () => {
    it('should produce deterministic output regardless of file order', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              Zebra from "./z.isl"
              Apple from "./a.isl"
            }
            entity Mango { id: UUID }
          }
        `,
        'z.isl': `
          domain Z {
            version: "1.0.0"
            entity Zebra { id: UUID }
          }
        `,
        'a.isl': `
          domain A {
            version: "1.0.0"
            entity Apple { id: UUID }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const resolveResult = await resolver.resolve('main.isl');
      const bundler = new Bundler();
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(true);
      
      // Entities should be alphabetically sorted
      const entityNames = bundleResult.bundle!.entities.map(e => e.name.name);
      expect(entityNames).toEqual(['Apple', 'Mango', 'Zebra']);
    });
  });

  describe('Bundler Options', () => {
    it('should strip imports by default', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            imports {
              Email from "./types.isl"
            }
          }
        `,
        'types.isl': `
          domain Types {
            version: "1.0.0"
            type Email = String
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const resolveResult = await resolver.resolve('main.isl');
      const bundler = new Bundler({ stripImports: true });
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(true);
      expect(bundleResult.bundle!.imports).toHaveLength(0);
    });

    it('should use custom bundle domain name', async () => {
      const files = {
        'main.isl': `
          domain Original {
            version: "1.0.0"
            type Email = String
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const resolveResult = await resolver.resolve('main.isl');
      const bundler = new Bundler({ bundleDomainName: 'BundledApp' });
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(true);
      expect(bundleResult.bundle!.name.name).toBe('BundledApp');
    });

    it('should use custom bundle version', async () => {
      const files = {
        'main.isl': `
          domain Main {
            version: "1.0.0"
            type Email = String
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const resolveResult = await resolver.resolve('main.isl');
      const bundler = new Bundler({ bundleVersion: '2.0.0' });
      const bundleResult = bundler.bundle(resolveResult.graph!);

      expect(bundleResult.success).toBe(true);
      expect(bundleResult.bundle!.version.value).toBe('2.0.0');
    });
  });
});
