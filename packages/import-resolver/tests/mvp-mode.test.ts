// ============================================================================
// MVP Mode Tests - Single-File Mode Toggle
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  resolveAndBundle,
  parseSingleFile,
  hasImports,
  validateImportPaths,
  createVirtualFS,
  ResolverErrorCode,
} from '../src/index.js';

describe('MVP Mode (Single-File Mode)', () => {
  describe('hasImports', () => {
    it('should return true when file has imports', () => {
      const source = `
domain Test {
  version: "1.0.0"
  imports {
    User from "./types.isl"
  }
}
      `;

      expect(hasImports(source)).toBe(true);
    });

    it('should return false when file has no imports', () => {
      const source = `
domain Test {
  version: "1.0.0"
  entity User { id: UUID }
}
      `;

      expect(hasImports(source)).toBe(false);
    });

    it('should return false for invalid source', () => {
      const source = 'this is not valid ISL';
      expect(hasImports(source)).toBe(false);
    });
  });

  describe('parseSingleFile', () => {
    it('should succeed for single file without imports', () => {
      const source = `
domain MyApp {
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

      const result = parseSingleFile(source);

      expect(result.success).toBe(true);
      expect(result.bundle).toBeDefined();
      expect(result.bundle!.types).toHaveLength(1);
      expect(result.bundle!.entities).toHaveLength(1);
      expect(result.bundle!.behaviors).toHaveLength(1);
    });

    it('should fail with clear error for file with imports', () => {
      const source = `
domain MyApp {
  version: "1.0.0"

  imports {
    User from "./types.isl"
  }

  behavior GetUser {
    input { id: UUID }
    output { success: User }
  }
}
      `;

      const result = parseSingleFile(source);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ResolverErrorCode.IMPORTS_DISABLED);
      expect(result.errors[0].message).toContain('Import resolution is disabled');
      expect(result.errors[0].message).toContain('single-file mode');
      expect(result.errors[0].message).toContain('./types.isl');
    });

    it('should fail for multiple imports with multiple errors', () => {
      const source = `
domain MyApp {
  version: "1.0.0"

  imports {
    User from "./types.isl"
    CreateUser from "./behaviors.isl"
  }
}
      `;

      const result = parseSingleFile(source);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.every(e => e.code === ResolverErrorCode.IMPORTS_DISABLED)).toBe(true);
    });

    it('should fail with parse error for invalid syntax', () => {
      const source = 'this is not valid ISL syntax at all';

      const result = parseSingleFile(source);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === ResolverErrorCode.PARSE_ERROR)).toBe(true);
    });
  });

  describe('validateImportPaths', () => {
    it('should pass for valid relative import paths', () => {
      const source = `
domain Test {
  version: "1.0.0"
  imports {
    User from "./types.isl"
    Behavior from "../shared/behaviors.isl"
  }
}
      `;

      const result = validateImportPaths(source);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for non-relative import paths', () => {
      const source = `
domain Test {
  version: "1.0.0"
  imports {
    User from "types.isl"
  }
}
      `;

      const result = validateImportPaths(source);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('relative');
    });

    it('should fail for absolute import paths', () => {
      const source = `
domain Test {
  version: "1.0.0"
  imports {
    User from "/absolute/path/types.isl"
  }
}
      `;

      const result = validateImportPaths(source);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should pass for files without imports', () => {
      const source = `
domain Test {
  version: "1.0.0"
  entity User { id: UUID }
}
      `;

      const result = validateImportPaths(source);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Explicit Error Messages', () => {
    it('should explain how to enable multi-file mode', () => {
      const source = `
domain Test {
  version: "1.0.0"
  imports {
    User from "./types.isl"
  }
}
      `;

      const result = parseSingleFile(source);

      expect(result.success).toBe(false);
      const errorMessage = result.errors[0].message;
      
      // Error should explain how to enable imports
      expect(errorMessage).toContain('enableImports');
      expect(errorMessage).toContain('true');
    });
  });

  describe('Mode Switching', () => {
    it('should work when switching from disabled to enabled imports', async () => {
      // First try with imports disabled
      const sourceWithImports = `
domain Test {
  version: "1.0.0"
  imports {
    User from "./types.isl"
  }
}
      `;

      const singleFileResult = parseSingleFile(sourceWithImports);
      expect(singleFileResult.success).toBe(false);

      // Then try with imports enabled using virtual file system
      const files = {
        'main.isl': sourceWithImports,
        'types.isl': `
domain Types {
  version: "1.0.0"
  entity User { id: UUID }
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
    });
  });
});
