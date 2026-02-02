// ============================================================================
// Golden Snapshot Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  resolveAndBundle,
  parseSingleFile,
  createVirtualFS,
} from '../src/index.js';

describe('Golden Snapshots', () => {
  describe('Simple Multi-File Bundle', () => {
    it('should produce expected bundled AST', async () => {
      const files = {
        'main.isl': `
domain Main {
  version: "1.0.0"

  imports {
    User, Email from "./types.isl"
    CreateUser from "./behaviors.isl"
  }

  behavior GetUser {
    description: "Get a user by ID"
    input { id: UUID }
    output {
      success: User
      errors { NOT_FOUND { when: "User not found" } }
    }
  }
}
        `,
        'types.isl': `
domain Types {
  version: "1.0.0"

  type Email = String { format: "email" }
  type UserId = UUID

  entity User {
    id: UserId [immutable, unique]
    email: Email [unique]
    name: String
  }
}
        `,
        'behaviors.isl': `
domain Behaviors {
  version: "1.0.0"

  imports {
    User from "./types.isl"
  }

  behavior CreateUser {
    description: "Create a new user"
    input {
      email: String
      name: String
    }
    output {
      success: User
    }
  }
}
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const result = await resolveAndBundle('main.isl', {
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      expect(result.success).toBe(true);
      expect(result.bundle).toBeDefined();

      // Snapshot structure (not exact locations)
      const bundle = result.bundle!;
      
      expect(bundle.name.name).toBe('Main');
      expect(bundle.version.value).toBe('1.0.0');
      expect(bundle.imports).toHaveLength(0); // Stripped by default
      
      // Types should be merged and sorted
      expect(bundle.types.map(t => t.name.name)).toEqual(['Email', 'UserId']);
      
      // Entities should be merged
      expect(bundle.entities.map(e => e.name.name)).toEqual(['User']);
      
      // Behaviors should be merged and sorted
      expect(bundle.behaviors.map(b => b.name.name)).toEqual(['CreateUser', 'GetUser']);
    });
  });

  describe('Single File Mode', () => {
    it('should parse single file without imports', () => {
      const source = `
domain SingleFile {
  version: "1.0.0"

  type Email = String { format: "email" }

  entity User {
    id: UUID [immutable]
    email: Email
  }

  behavior CreateUser {
    input { email: String }
    output { success: User }
  }
}
      `;

      const result = parseSingleFile(source, 'single.isl');

      expect(result.success).toBe(true);
      expect(result.bundle).toBeDefined();
      expect(result.bundle!.name.name).toBe('SingleFile');
      expect(result.bundle!.types).toHaveLength(1);
      expect(result.bundle!.entities).toHaveLength(1);
      expect(result.bundle!.behaviors).toHaveLength(1);
    });

    it('should reject imports in single file mode', () => {
      const source = `
domain WithImports {
  version: "1.0.0"

  imports {
    User from "./types.isl"
  }
}
      `;

      const result = parseSingleFile(source, 'with-imports.isl');

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes('single-file mode'))).toBe(true);
    });
  });

  describe('Deep Import Chain Bundle', () => {
    it('should correctly bundle deep import chain', async () => {
      const files = {
        'main.isl': `
domain DeepMain {
  version: "1.0.0"
  imports { L1 from "./l1.isl" }
  type MainType = String
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
      const result = await resolveAndBundle('main.isl', {
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      expect(result.success).toBe(true);
      
      // All types from all levels should be merged
      const typeNames = result.bundle!.types.map(t => t.name.name);
      expect(typeNames).toContain('L1');
      expect(typeNames).toContain('L2');
      expect(typeNames).toContain('L3');
      expect(typeNames).toContain('MainType');
      
      // Should be sorted alphabetically
      expect(typeNames).toEqual(['L1', 'L2', 'L3', 'MainType']);
    });
  });

  describe('Diamond Dependency Bundle', () => {
    it('should correctly bundle diamond dependencies', async () => {
      const files = {
        'main.isl': `
domain Main {
  version: "1.0.0"
  imports {
    A from "./a.isl"
    B from "./b.isl"
  }
  type Main = String
}
        `,
        'a.isl': `
domain A {
  version: "1.0.0"
  imports { Shared from "./shared.isl" }
  type A = String
}
        `,
        'b.isl': `
domain B {
  version: "1.0.0"
  imports { Shared from "./shared.isl" }
  type B = String
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
      const result = await resolveAndBundle('main.isl', {
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      expect(result.success).toBe(true);
      
      // Shared type should only appear once
      const typeNames = result.bundle!.types.map(t => t.name.name);
      expect(typeNames.filter(n => n === 'Shared')).toHaveLength(1);
      
      // All types should be present
      expect(typeNames).toEqual(['A', 'B', 'Main', 'Shared']);
    });
  });
});
