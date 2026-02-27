import { describe, it, expect } from 'vitest';
import {
  getSemantics,
  getSemanticsForVersion,
  getLatestSemantics,
  getAvailableVersions,
  isVersionSupported,
  getDefaultSemantics,
  DEFAULT_VERSION,
  V1_VERSION,
  parseVersion,
  formatVersion,
  compareVersions,
  isCompatible,
} from '../src/index.js';

describe('Version Registry', () => {
  describe('getSemantics', () => {
    it('should return v1 semantics for version 1.0.0', () => {
      const semantics = getSemantics('1.0.0');
      expect(semantics).toBeDefined();
      expect(semantics!.versionString).toBe('1.0.0');
    });

    it('should return undefined for unsupported version', () => {
      const semantics = getSemantics('99.0.0');
      expect(semantics).toBeUndefined();
    });

    it('should handle patch versions within same major', () => {
      const semantics = getSemantics('1.0.5');
      expect(semantics).toBeDefined();
      expect(semantics!.version.major).toBe(1);
    });

    it('should handle minor versions within same major', () => {
      const semantics = getSemantics('1.5.0');
      expect(semantics).toBeDefined();
      expect(semantics!.version.major).toBe(1);
    });
  });

  describe('getSemanticsForVersion', () => {
    it('should return semantics for parsed version', () => {
      const semantics = getSemanticsForVersion({ major: 1, minor: 0, patch: 0 });
      expect(semantics).toBeDefined();
    });
  });

  describe('getLatestSemantics', () => {
    it('should return latest v1 semantics', () => {
      const semantics = getLatestSemantics(1);
      expect(semantics).toBeDefined();
      expect(semantics!.version.major).toBe(1);
    });

    it('should return undefined for unsupported major version', () => {
      const semantics = getLatestSemantics(99);
      expect(semantics).toBeUndefined();
    });
  });

  describe('getAvailableVersions', () => {
    it('should return available versions', () => {
      const versions = getAvailableVersions();
      expect(versions).toContain('1.0.0');
    });
  });

  describe('isVersionSupported', () => {
    it('should return true for v1', () => {
      expect(isVersionSupported('1.0.0')).toBe(true);
      expect(isVersionSupported('1.5.0')).toBe(true);
    });

    it('should return false for unsupported versions', () => {
      expect(isVersionSupported('99.0.0')).toBe(false);
    });

    it('should return false for invalid version strings', () => {
      expect(isVersionSupported('invalid')).toBe(false);
      expect(isVersionSupported('1.0')).toBe(false);
    });
  });

  describe('getDefaultSemantics', () => {
    it('should return default semantics', () => {
      const semantics = getDefaultSemantics();
      expect(semantics).toBeDefined();
      expect(semantics.versionString).toBe(DEFAULT_VERSION);
    });
  });

  describe('Version utilities', () => {
    describe('parseVersion', () => {
      it('should parse valid version strings', () => {
        const version = parseVersion('1.2.3');
        expect(version).toEqual({ major: 1, minor: 2, patch: 3 });
      });

      it('should throw for invalid version strings', () => {
        expect(() => parseVersion('invalid')).toThrow();
        expect(() => parseVersion('1.0')).toThrow();
        expect(() => parseVersion('1.0.0.0')).toThrow();
      });
    });

    describe('formatVersion', () => {
      it('should format version object as string', () => {
        const version = { major: 1, minor: 2, patch: 3 };
        expect(formatVersion(version)).toBe('1.2.3');
      });
    });

    describe('compareVersions', () => {
      it('should compare major versions', () => {
        expect(compareVersions(
          { major: 1, minor: 0, patch: 0 },
          { major: 2, minor: 0, patch: 0 }
        )).toBe(-1);
        expect(compareVersions(
          { major: 2, minor: 0, patch: 0 },
          { major: 1, minor: 0, patch: 0 }
        )).toBe(1);
      });

      it('should compare minor versions', () => {
        expect(compareVersions(
          { major: 1, minor: 1, patch: 0 },
          { major: 1, minor: 2, patch: 0 }
        )).toBe(-1);
      });

      it('should compare patch versions', () => {
        expect(compareVersions(
          { major: 1, minor: 0, patch: 1 },
          { major: 1, minor: 0, patch: 2 }
        )).toBe(-1);
      });

      it('should return 0 for equal versions', () => {
        expect(compareVersions(
          { major: 1, minor: 0, patch: 0 },
          { major: 1, minor: 0, patch: 0 }
        )).toBe(0);
      });
    });

    describe('isCompatible', () => {
      it('should return true for same major version and higher', () => {
        expect(isCompatible(
          { major: 1, minor: 1, patch: 0 },
          { major: 1, minor: 0, patch: 0 }
        )).toBe(true);
      });

      it('should return false for different major versions', () => {
        expect(isCompatible(
          { major: 2, minor: 0, patch: 0 },
          { major: 1, minor: 0, patch: 0 }
        )).toBe(false);
      });

      it('should return false for lower versions in same major', () => {
        expect(isCompatible(
          { major: 1, minor: 0, patch: 0 },
          { major: 1, minor: 1, patch: 0 }
        )).toBe(false);
      });
    });
  });
});
