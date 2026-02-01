/**
 * Safe Path Tests
 *
 * Tests for the secure path manipulation functions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { join, sep, resolve } from 'path';
import {
  safeJoin,
  safeJoinMultiple,
  validateRelativePath,
  isPathWithin,
  normalizePath,
  extractRelativePath,
  sanitizeFilename,
} from '../safePath.js';

describe('safeJoin', () => {
  const root = process.platform === 'win32' ? 'C:\\app\\workspace' : '/app/workspace';

  describe('valid paths', () => {
    it('should accept simple relative paths', () => {
      const result = safeJoin(root, 'src/index.ts');
      expect(result.valid).toBe(true);
      expect(result.resolvedPath).toBeDefined();
      expect(result.resolvedPath).toContain('index.ts');
    });

    it('should accept nested paths', () => {
      const result = safeJoin(root, 'src/components/Button/index.tsx');
      expect(result.valid).toBe(true);
      expect(result.resolvedPath).toContain('Button');
    });

    it('should accept paths with dots in filenames', () => {
      const result = safeJoin(root, 'src/file.test.ts');
      expect(result.valid).toBe(true);
    });

    it('should accept paths starting with dot', () => {
      const result = safeJoin(root, '.vibecheck/evidence.json');
      expect(result.valid).toBe(true);
    });
  });

  describe('directory traversal rejection', () => {
    it('should reject paths with ../', () => {
      const result = safeJoin(root, '../secret.txt');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('PATH_TRAVERSAL');
    });

    it('should reject paths with multiple ../../../', () => {
      const result = safeJoin(root, '../../../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('PATH_TRAVERSAL');
    });

    it('should reject hidden traversal in middle of path', () => {
      const result = safeJoin(root, 'src/../../../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('PATH_TRAVERSAL');
    });

    it('should reject backslash traversal on all platforms', () => {
      const result = safeJoin(root, '..\\..\\secret.txt');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('PATH_TRAVERSAL');
    });

    it('should reject encoded traversal', () => {
      const result = safeJoin(root, '%2e%2e/secret.txt');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('PATH_TRAVERSAL');
    });
  });

  describe('absolute path rejection', () => {
    it('should reject Unix absolute paths', () => {
      const result = safeJoin(root, '/etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ABSOLUTE_PATH');
    });

    it('should reject Windows absolute paths with drive letter', () => {
      const result = safeJoin(root, 'C:\\Windows\\System32\\cmd.exe');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ABSOLUTE_PATH');
    });

    it('should reject lowercase Windows drive letters', () => {
      const result = safeJoin(root, 'd:\\data\\file.txt');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ABSOLUTE_PATH');
    });
  });

  describe('UNC path rejection', () => {
    it('should reject UNC paths with forward slashes', () => {
      const result = safeJoin(root, '//server/share/file.txt');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('UNC_PATH');
    });

    it('should reject UNC paths with backslashes', () => {
      const result = safeJoin(root, '\\\\server\\share\\file.txt');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('UNC_PATH');
    });

    it('should reject mixed separator UNC paths', () => {
      const result = safeJoin(root, '\\/server/share\\file.txt');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('UNC_PATH');
    });
  });

  describe('null byte rejection', () => {
    it('should reject paths with null bytes', () => {
      const result = safeJoin(root, 'file.txt\0.exe');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('NULL_BYTE');
    });

    it('should reject paths with embedded null bytes', () => {
      const result = safeJoin(root, 'src\0/index.ts');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('NULL_BYTE');
    });
  });

  describe('empty path rejection', () => {
    it('should reject empty paths', () => {
      const result = safeJoin(root, '');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EMPTY_PATH');
    });

    it('should reject whitespace-only paths', () => {
      const result = safeJoin(root, '   ');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('EMPTY_PATH');
    });
  });

  describe('invalid character rejection', () => {
    it('should reject paths with < character', () => {
      const result = safeJoin(root, 'file<name>.txt');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CHARS');
    });

    it('should reject paths with | character', () => {
      const result = safeJoin(root, 'file|name.txt');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CHARS');
    });

    it('should reject paths with ? character', () => {
      const result = safeJoin(root, 'file?.txt');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CHARS');
    });

    it('should reject paths with * character', () => {
      const result = safeJoin(root, '*.txt');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CHARS');
    });
  });

  describe('configuration options', () => {
    it('should reject paths matching custom reject patterns', () => {
      const result = safeJoin(root, 'src/secrets.ts', {
        root,
        rejectPatterns: [/secrets/i],
      });
      expect(result.valid).toBe(false);
    });

    it('should enforce max path length', () => {
      const longPath = 'a'.repeat(300) + '.ts';
      const result = safeJoin(root, longPath, {
        root,
        maxPathLength: 260,
      });
      expect(result.valid).toBe(false);
    });
  });
});

describe('validateRelativePath', () => {
  it('should accept valid relative paths', () => {
    expect(validateRelativePath('src/index.ts').valid).toBe(true);
    expect(validateRelativePath('file.txt').valid).toBe(true);
    expect(validateRelativePath('a/b/c/d.ts').valid).toBe(true);
  });

  it('should reject traversal', () => {
    expect(validateRelativePath('../file.txt').valid).toBe(false);
    expect(validateRelativePath('a/../../b').valid).toBe(false);
  });

  it('should reject absolute paths', () => {
    expect(validateRelativePath('/etc/passwd').valid).toBe(false);
    expect(validateRelativePath('C:\\file.txt').valid).toBe(false);
  });
});

describe('safeJoinMultiple', () => {
  const root = process.platform === 'win32' ? 'C:\\app' : '/app';

  it('should join multiple segments safely', () => {
    const result = safeJoinMultiple(root, ['src', 'components', 'Button.tsx']);
    expect(result.valid).toBe(true);
    expect(result.resolvedPath).toContain('Button.tsx');
  });

  it('should reject if any segment is dangerous', () => {
    const result = safeJoinMultiple(root, ['src', '..', 'secret.txt']);
    expect(result.valid).toBe(false);
  });
});

describe('isPathWithin', () => {
  const parent = process.platform === 'win32' ? 'C:\\app' : '/app';

  it('should return true for paths within parent', () => {
    const child = join(parent, 'src', 'index.ts');
    expect(isPathWithin(parent, child)).toBe(true);
  });

  it('should return true for equal paths', () => {
    expect(isPathWithin(parent, parent)).toBe(true);
  });

  it('should return false for paths outside parent', () => {
    const outside = process.platform === 'win32' ? 'C:\\other' : '/other';
    expect(isPathWithin(parent, outside)).toBe(false);
  });

  it('should handle normalized traversal attempts', () => {
    const escaped = join(parent, '..', 'etc', 'passwd');
    expect(isPathWithin(parent, escaped)).toBe(false);
  });
});

describe('normalizePath', () => {
  it('should normalize path separators', () => {
    const result = normalizePath('a/b\\c/d');
    expect(result).not.toContain('/\\');
  });

  it('should remove trailing separators', () => {
    const result = normalizePath('path/to/dir/');
    expect(result.endsWith(sep)).toBe(false);
  });

  it('should handle case sensitivity option', () => {
    const caseSensitive = normalizePath('PATH/File.TXT', true);
    const caseInsensitive = normalizePath('PATH/File.TXT', false);
    
    expect(caseSensitive).toBe(normalizePath('PATH/File.TXT', true));
    expect(caseInsensitive).toBe(caseInsensitive.toLowerCase());
  });
});

describe('extractRelativePath', () => {
  const root = process.platform === 'win32' ? 'C:\\app' : '/app';

  it('should extract relative path correctly', () => {
    const fullPath = join(root, 'src', 'index.ts');
    const rel = extractRelativePath(root, fullPath);
    expect(rel).toBe(join('src', 'index.ts'));
  });

  it('should return null for paths outside root', () => {
    const outside = process.platform === 'win32' ? 'C:\\other\\file.txt' : '/other/file.txt';
    expect(extractRelativePath(root, outside)).toBeNull();
  });
});

describe('sanitizeFilename', () => {
  it('should remove null bytes', () => {
    expect(sanitizeFilename('file\0.txt')).toBe('file.txt');
  });

  it('should replace path separators', () => {
    expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
    expect(sanitizeFilename('path\\to\\file.txt')).toBe('path_to_file.txt');
  });

  it('should replace invalid characters', () => {
    // Invalid chars are replaced with _ and multiple _ are collapsed
    expect(sanitizeFilename('file<>:name.txt')).toBe('file_name.txt');
  });

  it('should handle leading/trailing dots and spaces', () => {
    expect(sanitizeFilename('...file...')).toBe('file');
    expect(sanitizeFilename('  file  ')).toBe('file');
  });

  it('should return unnamed for empty result', () => {
    expect(sanitizeFilename('...')).toBe('unnamed');
    expect(sanitizeFilename('')).toBe('unnamed');
  });

  it('should collapse multiple underscores', () => {
    expect(sanitizeFilename('a___b___c')).toBe('a_b_c');
  });
});
