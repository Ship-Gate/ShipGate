/**
 * CLI Type Correctness Tests
 * 
 * Tests that verify CLI commands have correct TypeScript types
 * and can be imported/used without type errors.
 */

import { describe, it, expect } from 'vitest';
import type { ChaosOptions, ChaosResult } from '../src/commands/chaos.js';
import type { CheckOptions, CheckResult } from '../src/commands/check.js';
import type { FmtOptions, FmtResult } from '../src/commands/fmt.js';
import type { CommandContext, CommandResult } from '../src/commands/types.js';

describe('CLI Type Correctness', () => {
  describe('chaos.ts types', () => {
    it('should have correct ChaosOptions type', () => {
      const options: ChaosOptions = {
        spec: 'test.isl',
        impl: 'test.ts',
        timeout: 30000,
        seed: 12345,
        continueOnFailure: true,
        verbose: false,
        format: 'text',
      };
      
      expect(options.spec).toBe('test.isl');
      expect(options.impl).toBe('test.ts');
      expect(options.timeout).toBe(30000);
    });

    it('should have correct ChaosResult type', () => {
      const result: ChaosResult = {
        success: true,
        specFile: 'test.isl',
        implFile: 'test.ts',
        errors: [],
        duration: 100,
      };
      
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('check.ts types', () => {
    it('should have correct CheckOptions type', () => {
      const options: CheckOptions = {
        verbose: true,
        watch: false,
        quiet: false,
        debug: false,
        semantic: false,
      };
      
      expect(options.verbose).toBe(true);
      expect(options.watch).toBe(false);
    });

    it('should have correct CheckResult type', () => {
      const result: CheckResult = {
        success: true,
        files: [],
        totalErrors: 0,
        totalWarnings: 0,
        duration: 50,
      };
      
      expect(result.success).toBe(true);
      expect(result.totalErrors).toBe(0);
    });
  });

  describe('fmt.ts types', () => {
    it('should have correct FmtOptions type', () => {
      const options: FmtOptions = {
        write: true,
        check: false,
        verbose: false,
        format: 'pretty',
      };
      
      expect(options.write).toBe(true);
      expect(options.check).toBe(false);
    });

    it('should have correct FmtResult type', () => {
      const result: FmtResult = {
        success: true,
        file: 'test.isl',
        formatted: true,
        errors: [],
        duration: 25,
      };
      
      expect(result.success).toBe(true);
      expect(result.formatted).toBe(true);
    });
  });

  describe('shared types', () => {
    it('should have correct CommandContext type', () => {
      const ctx: CommandContext = {
        logger: {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
        },
        cwd: '/test',
        config: null,
        fs: {
          readFile: async () => '',
          writeFile: async () => {},
          exists: async () => false,
        },
        exitCodes: {
          SUCCESS: 0,
          ISL_ERROR: 1,
          USAGE_ERROR: 2,
          INTERNAL_ERROR: 3,
        },
      };
      
      expect(ctx.cwd).toBe('/test');
      expect(ctx.config).toBeNull();
    });

    it('should have correct CommandResult type', () => {
      const result: CommandResult = {
        exitCode: 0,
        success: true,
        duration: 100,
      };
      
      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
    });
  });
});
