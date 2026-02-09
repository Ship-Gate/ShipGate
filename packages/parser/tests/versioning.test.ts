// ============================================================================
// ISL Versioning Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '../src/index.js';
import {
  CURRENT_ISL_VERSION,
  SUPPORTED_VERSIONS,
  isSupportedVersion,
  areVersionsCompatible,
  getMigrationWarnings,
  migrateISL,
  VERSION_COMPATIBILITY,
} from '../src/versioning.js';

describe('ISL Versioning', () => {
  describe('Version Detection', () => {
    it('should detect islVersion directive with hash comment', () => {
      const content = `#islVersion "0.1"
domain Test {
  version: "1.0.0"
}`;
      const result = parse(content);
      expect(result.islVersion).toBe('0.1');
      expect(result.success).toBe(true);
    });

    it('should detect islVersion directive without hash', () => {
      const content = `islVersion "0.2"
domain Test {
  version: "1.0.0"
}`;
      const result = parse(content);
      expect(result.islVersion).toBe('0.2');
      expect(result.success).toBe(true);
    });

    it('should return undefined when islVersion is not specified', () => {
      const content = `domain Test {
  version: "1.0.0"
}`;
      const result = parse(content);
      expect(result.islVersion).toBeUndefined();
      expect(result.success).toBe(true);
    });

    it('should parse islVersion before domain declaration', () => {
      const content = `# Some comment
#islVersion "0.1"
# Another comment
domain Test {
  version: "1.0.0"
}`;
      const result = parse(content);
      expect(result.islVersion).toBe('0.1');
    });

    it('should stop searching for islVersion at domain declaration', () => {
      const content = `domain Test {
  version: "1.0.0"
  #islVersion "0.1"  # This should be ignored
}`;
      const result = parse(content);
      expect(result.islVersion).toBeUndefined();
    });
  });

  describe('Version Compatibility', () => {
    it('should recognize supported versions', () => {
      expect(isSupportedVersion('0.1')).toBe(true);
      expect(isSupportedVersion('0.2')).toBe(true);
      expect(isSupportedVersion('1.0')).toBe(false);
      expect(isSupportedVersion('')).toBe(false);
    });

    it('should check version compatibility', () => {
      expect(areVersionsCompatible('0.1', '0.2')).toBe(true);
      expect(areVersionsCompatible('0.2', '0.2')).toBe(true);
      expect(areVersionsCompatible(undefined, '0.2')).toBe(true);
      expect(areVersionsCompatible('0.1', '0.1')).toBe(true);
    });

    it('should provide migration warnings', () => {
      const warnings = getMigrationWarnings('0.1', '0.2');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain('migration');
    });

    it('should warn when version is missing', () => {
      const warnings = getMigrationWarnings(undefined);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain('No islVersion directive');
    });
  });

  describe('Migration', () => {
    it('should migrate v0.1 to v0.2 by adding islVersion directive', () => {
      const content = `domain Test {
  version: "1.0.0"
}`;
      const migration = migrateISL(content, '0.1', '0.2');
      expect(migration.appliedRules.length).toBeGreaterThan(0);
      expect(migration.migrated).toContain('#islVersion "0.2"');
      expect(migration.migrated).toContain('domain Test');
    });

    it('should not migrate if version already matches', () => {
      const content = `#islVersion "0.2"
domain Test {
  version: "1.0.0"
}`;
      const migration = migrateISL(content, '0.2', '0.2');
      expect(migration.appliedRules.length).toBe(0);
      expect(migration.migrated).toBe(content);
    });

    it('should preserve existing islVersion directive', () => {
      const content = `#islVersion "0.1"
domain Test {
  version: "1.0.0"
}`;
      const migration = migrateISL(content, '0.1', '0.2');
      // Should update the version, not add a new one
      expect(migration.migrated.match(/#islVersion/g)?.length).toBeLessThanOrEqual(1);
    });

    it('should handle files with shebang', () => {
      const content = `#!/usr/bin/env isl
domain Test {
  version: "1.0.0"
}`;
      const migration = migrateISL(content, '0.1', '0.2');
      expect(migration.migrated).toContain('#islVersion "0.2"');
      expect(migration.migrated).toContain('#!/usr/bin/env isl');
    });
  });

  describe('Version Constants', () => {
    it('should have current version defined', () => {
      expect(CURRENT_ISL_VERSION).toBe('0.2');
    });

    it('should have supported versions list', () => {
      expect(SUPPORTED_VERSIONS).toContain('0.1');
      expect(SUPPORTED_VERSIONS).toContain('0.2');
    });

    it('should have compatibility matrix', () => {
      expect(VERSION_COMPATIBILITY['0.1']).toBeDefined();
      expect(VERSION_COMPATIBILITY['0.2']).toBeDefined();
    });
  });

  describe('Parsing Multiple Versions', () => {
    it('should parse v0.1 spec correctly', () => {
      const content = `#islVersion "0.1"
domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
    name: String
  }
}`;
      const result = parse(content);
      expect(result.success).toBe(true);
      expect(result.islVersion).toBe('0.1');
      expect(result.domain?.name.name).toBe('Test');
    });

    it('should parse v0.2 spec correctly', () => {
      const content = `#islVersion "0.2"
domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
    name: String
  }
}`;
      const result = parse(content);
      expect(result.success).toBe(true);
      expect(result.islVersion).toBe('0.2');
      expect(result.domain?.name.name).toBe('Test');
    });

    it('should parse spec without version (assumes current)', () => {
      const content = `domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
    name: String
  }
}`;
      const result = parse(content);
      expect(result.success).toBe(true);
      expect(result.islVersion).toBeUndefined();
      expect(result.domain?.name.name).toBe('Test');
    });
  });
});
