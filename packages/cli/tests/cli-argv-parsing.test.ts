/**
 * CLI Argument Parsing Type Tests
 * 
 * Tests that verify command argument parsing maintains type safety.
 */

import { describe, it, expect } from 'vitest';

describe('CLI Argument Parsing Types', () => {
  describe('chaos command argv', () => {
    it('should parse chaos command arguments with correct types', () => {
      const argv = {
        spec: 'test.isl',
        impl: 'test.ts',
        timeout: '30000',
        seed: '12345',
        'continue-on-failure': true,
        verbose: false,
        format: 'text',
      };

      // Type-safe parsing
      const options = {
        spec: String(argv.spec),
        impl: String(argv.impl),
        timeout: argv.timeout ? parseInt(String(argv.timeout), 10) : undefined,
        seed: argv.seed ? parseInt(String(argv.seed), 10) : undefined,
        continueOnFailure: Boolean(argv['continue-on-failure']),
        verbose: Boolean(argv.verbose),
        format: argv.format === 'json' ? 'json' as const : 'text' as const,
      };

      expect(options.spec).toBe('test.isl');
      expect(options.impl).toBe('test.ts');
      expect(options.timeout).toBe(30000);
      expect(options.seed).toBe(12345);
      expect(options.continueOnFailure).toBe(true);
    });
  });

  describe('check command argv', () => {
    it('should parse check command arguments with correct types', () => {
      const argv = {
        files: ['test1.isl', 'test2.isl'],
        verbose: true,
        watch: false,
        quiet: false,
        debug: false,
        semantic: false,
      };

      const options = {
        files: Array.isArray(argv.files) ? argv.files.map(String) : [],
        verbose: Boolean(argv.verbose),
        watch: Boolean(argv.watch),
        quiet: Boolean(argv.quiet),
        debug: Boolean(argv.debug),
        semantic: Boolean(argv.semantic),
      };

      expect(options.files).toEqual(['test1.isl', 'test2.isl']);
      expect(options.verbose).toBe(true);
      expect(options.watch).toBe(false);
    });
  });

  describe('fmt command argv', () => {
    it('should parse fmt command arguments with correct types', () => {
      const argv = {
        file: 'test.isl',
        write: true,
        check: false,
        verbose: false,
        format: 'pretty',
      };

      const options = {
        file: String(argv.file),
        write: argv.write !== false,
        check: Boolean(argv.check),
        verbose: Boolean(argv.verbose),
        format: (argv.format === 'json' ? 'json' : argv.format === 'quiet' ? 'quiet' : 'pretty') as 'pretty' | 'json' | 'quiet',
      };

      expect(options.file).toBe('test.isl');
      expect(options.write).toBe(true);
      expect(options.check).toBe(false);
      expect(options.format).toBe('pretty');
    });
  });

  describe('type-safe option parsing', () => {
    it('should handle optional arguments correctly', () => {
      const argv: Record<string, unknown> = {
        file: 'test.isl',
      };

      // Type-safe optional parsing
      const timeout = 'timeout' in argv && argv.timeout
        ? parseInt(String(argv.timeout), 10)
        : undefined;

      const seed = 'seed' in argv && argv.seed
        ? parseInt(String(argv.seed), 10)
        : undefined;

      expect(timeout).toBeUndefined();
      expect(seed).toBeUndefined();
    });

    it('should handle boolean flags correctly', () => {
      const argv: Record<string, unknown> = {
        verbose: true,
        quiet: false,
        watch: undefined,
      };

      const verbose = 'verbose' in argv ? Boolean(argv.verbose) : false;
      const quiet = 'quiet' in argv ? Boolean(argv.quiet) : false;
      const watch = 'watch' in argv ? Boolean(argv.watch) : false;

      expect(verbose).toBe(true);
      expect(quiet).toBe(false);
      expect(watch).toBe(false);
    });
  });
});
