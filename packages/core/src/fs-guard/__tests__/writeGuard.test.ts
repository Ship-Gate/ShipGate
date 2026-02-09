/**
 * Write Guard Tests
 *
 * Tests for the allowlist-based write protection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'path';
import {
  WriteGuard,
  createWriteGuard,
  canWriteTo,
} from '../writeGuard.js';
import { DEFAULT_ALLOWED_DIRS } from '../guardTypes.js';

describe('WriteGuard', () => {
  const root = process.platform === 'win32' ? 'C:\\app\\workspace' : '/app/workspace';
  let guard: WriteGuard;

  beforeEach(() => {
    guard = createWriteGuard(root);
  });

  describe('allowed directories', () => {
    it('should allow writes to src/', () => {
      const result = guard.validate('src/index.ts');
      expect(result.allowed).toBe(true);
    });

    it('should allow writes to app/', () => {
      const result = guard.validate('app/page.tsx');
      expect(result.allowed).toBe(true);
    });

    it('should allow writes to packages/', () => {
      const result = guard.validate('packages/core/index.ts');
      expect(result.allowed).toBe(true);
    });

    it('should allow writes to lib/', () => {
      const result = guard.validate('lib/utils.ts');
      expect(result.allowed).toBe(true);
    });

    it('should allow writes to components/', () => {
      const result = guard.validate('components/Button.tsx');
      expect(result.allowed).toBe(true);
    });

    it('should allow writes to generated/', () => {
      const result = guard.validate('generated/types.ts');
      expect(result.allowed).toBe(true);
    });

    it('should allow writes to .shipgate/', () => {
      const result = guard.validate('.shipgate/evidence.json');
      expect(result.allowed).toBe(true);
    });

    it('should allow nested paths within allowed dirs', () => {
      const result = guard.validate('src/components/forms/Input/index.tsx');
      expect(result.allowed).toBe(true);
    });
  });

  describe('disallowed directories', () => {
    it('should block writes to node_modules/', () => {
      const result = guard.validate('node_modules/lodash/index.js');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('DISALLOWED_DIR');
    });

    it('should block writes to root level files', () => {
      const result = guard.validate('config.json');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('DISALLOWED_DIR');
    });

    it('should block writes to .git/', () => {
      const result = guard.validate('.git/config');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('DISALLOWED_DIR');
    });

    it('should block writes to dist/', () => {
      const result = guard.validate('dist/bundle.js');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('DISALLOWED_DIR');
    });

    it('should block writes to arbitrary directories', () => {
      const result = guard.validate('secrets/passwords.txt');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('DISALLOWED_DIR');
    });
  });

  describe('sensitive file blocking', () => {
    it('should block .env files', () => {
      const result = guard.validate('src/.env');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('SENSITIVE_FILE');
    });

    it('should block .env.local files', () => {
      const result = guard.validate('src/.env.local');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('SENSITIVE_FILE');
    });

    it('should block .env.production files', () => {
      const result = guard.validate('src/.env.production');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('SENSITIVE_FILE');
    });

    it('should block .pem files', () => {
      const result = guard.validate('src/cert.pem');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('SENSITIVE_FILE');
    });

    it('should block .key files', () => {
      const result = guard.validate('src/private.key');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('SENSITIVE_FILE');
    });

    it('should block id_rsa files', () => {
      const result = guard.validate('src/id_rsa');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('SENSITIVE_FILE');
    });

    it('should block credentials.json', () => {
      const result = guard.validate('src/credentials.json');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('SENSITIVE_FILE');
    });

    it('should block secrets.json', () => {
      const result = guard.validate('src/secrets.json');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('SENSITIVE_FILE');
    });

    it('should block secrets.yaml', () => {
      const result = guard.validate('src/secrets.yaml');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('SENSITIVE_FILE');
    });

    it('should allow skipping sensitive check', () => {
      const result = guard.validate('src/secrets.json', { skipSensitiveCheck: true });
      expect(result.allowed).toBe(true);
    });
  });

  describe('path traversal blocking', () => {
    it('should block directory traversal', () => {
      const result = guard.validate('../../../etc/passwd');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('PATH_TRAVERSAL');
    });

    it('should block hidden traversal', () => {
      const result = guard.validate('src/../../../etc/passwd');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('PATH_TRAVERSAL');
    });
  });

  describe('absolute path blocking', () => {
    it('should block Unix absolute paths', () => {
      const result = guard.validate('/etc/passwd');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('ABSOLUTE_PATH');
    });

    it('should block Windows absolute paths', () => {
      const result = guard.validate('C:\\Windows\\System32\\cmd.exe');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('ABSOLUTE_PATH');
    });
  });

  describe('UNC path blocking', () => {
    it('should block UNC paths', () => {
      const result = guard.validate('\\\\server\\share\\file.txt');
      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('UNC_PATH');
    });
  });

  describe('statistics tracking', () => {
    it('should track total attempts', () => {
      guard.validate('src/file1.ts');
      guard.validate('src/file2.ts');
      guard.validate('node_modules/bad.js');

      const stats = guard.getStats();
      expect(stats.totalAttempts).toBe(3);
    });

    it('should track blocked writes', () => {
      guard.validate('src/file.ts');
      guard.validate('node_modules/bad.js');
      guard.validate('../escape.txt');

      const stats = guard.getStats();
      expect(stats.blockedWrites).toBe(2);
    });

    it('should track blocks by code', () => {
      guard.validate('node_modules/bad.js');
      guard.validate('../escape.txt');

      const stats = guard.getStats();
      expect(stats.blocksByCode['DISALLOWED_DIR']).toBe(1);
      expect(stats.blocksByCode['PATH_TRAVERSAL']).toBe(1);
    });

    it('should track last blocked path', () => {
      guard.validate('node_modules/package.json');

      const stats = guard.getStats();
      expect(stats.lastBlockedPath).toBe('node_modules/package.json');
    });

    it('should reset statistics', () => {
      guard.validate('node_modules/bad.js');
      guard.resetStats();

      const stats = guard.getStats();
      expect(stats.totalAttempts).toBe(0);
      expect(stats.blockedWrites).toBe(0);
    });
  });

  describe('batch validation', () => {
    it('should validate multiple paths', () => {
      const paths = [
        'src/index.ts',
        'node_modules/bad.js',
        'app/page.tsx',
        '../escape.txt',
      ];

      const results = guard.validateBatch(paths);

      expect(results.get('src/index.ts')?.allowed).toBe(true);
      expect(results.get('node_modules/bad.js')?.allowed).toBe(false);
      expect(results.get('app/page.tsx')?.allowed).toBe(true);
      expect(results.get('../escape.txt')?.allowed).toBe(false);
    });
  });

  describe('directory management', () => {
    it('should check if directory is allowed', () => {
      expect(guard.isDirectoryAllowed('src/')).toBe(true);
      expect(guard.isDirectoryAllowed('node_modules/')).toBe(false);
    });

    it('should add allowed directory', () => {
      guard.addAllowedDir('custom/');
      const result = guard.validate('custom/file.ts');
      expect(result.allowed).toBe(true);
    });

    it('should remove allowed directory', () => {
      guard.removeAllowedDir('src/');
      const result = guard.validate('src/file.ts');
      expect(result.allowed).toBe(false);
    });

    it('should not add duplicate directories', () => {
      const initialConfig = guard.getConfig();
      const initialCount = initialConfig.allowedDirs.length;

      guard.addAllowedDir('src/');
      guard.addAllowedDir('src/');

      const newConfig = guard.getConfig();
      expect(newConfig.allowedDirs.length).toBe(initialCount);
    });
  });

  describe('custom configuration', () => {
    it('should respect custom allowed directories', () => {
      const customGuard = new WriteGuard({
        root,
        allowedDirs: ['custom/'],
      });

      expect(customGuard.validate('custom/file.ts').allowed).toBe(true);
      expect(customGuard.validate('src/file.ts').allowed).toBe(false);
    });

    it('should respect dry run mode', async () => {
      const dryRunGuard = new WriteGuard({
        root,
        allowedDirs: ['src/'],
        dryRun: true,
      });

      const result = await dryRunGuard.write('src/test.ts', 'content');
      expect(result.allowed).toBe(true);
      expect(result.warnings).toContain('Dry run mode - file not written');
    });

    it('should validate expected file size', () => {
      const guardWithLimit = new WriteGuard({
        root,
        allowedDirs: ['src/'],
        maxFileSize: 1024, // 1KB
      });

      const result = guardWithLimit.validate('src/file.ts', {
        expectedSize: 2048, // 2KB - exceeds limit
      });

      expect(result.allowed).toBe(true); // Still allowed but with warning
      expect(result.warnings?.length).toBeGreaterThan(0);
    });
  });
});

describe('createWriteGuard', () => {
  const root = process.platform === 'win32' ? 'C:\\app' : '/app';

  it('should create guard with default allowed dirs', () => {
    const guard = createWriteGuard(root);
    const config = guard.getConfig();
    expect(config.allowedDirs).toEqual(expect.arrayContaining(DEFAULT_ALLOWED_DIRS));
  });

  it('should create guard with custom allowed dirs', () => {
    const guard = createWriteGuard(root, ['custom/', 'other/']);
    const config = guard.getConfig();
    expect(config.allowedDirs).toContain('custom/');
    expect(config.allowedDirs).toContain('other/');
  });
});

describe('canWriteTo', () => {
  const root = process.platform === 'win32' ? 'C:\\app' : '/app';

  it('should return true for allowed paths', () => {
    expect(canWriteTo(root, 'src/index.ts')).toBe(true);
  });

  it('should return false for disallowed paths', () => {
    expect(canWriteTo(root, 'node_modules/bad.js')).toBe(false);
  });

  it('should return false for traversal paths', () => {
    expect(canWriteTo(root, '../escape.txt')).toBe(false);
  });

  it('should respect custom allowed dirs', () => {
    expect(canWriteTo(root, 'custom/file.ts', ['custom/'])).toBe(true);
    expect(canWriteTo(root, 'src/file.ts', ['custom/'])).toBe(false);
  });
});
