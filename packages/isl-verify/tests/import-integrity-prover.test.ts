import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ImportIntegrityProver } from '../src/proof/import-integrity-prover.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('ImportIntegrityProver', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-integrity-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createFile(relativePath: string, content: string): string {
    const fullPath = path.join(tempDir, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
    return fullPath;
  }

  describe('relative imports', () => {
    test('verifies valid relative imports', async () => {
      createFile('src/utils.ts', `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `);
      
      createFile('src/index.ts', `
        import { add } from './utils';
        console.log(add(1, 2));
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.property).toBe('import-integrity');
      expect(proof.status).toBe('PROVEN');
      expect(proof.evidence.length).toBeGreaterThan(0);
      
      const addImport = proof.evidence.find(e => e.importPath === './utils');
      expect(addImport).toBeDefined();
      expect(addImport?.status).toBe('verified');
      expect(addImport?.symbols).toContain('add');
      expect(addImport?.symbolsVerified).toBe(true);
    });

    test('detects hallucinated relative imports', async () => {
      createFile('src/index.ts', `
        import { nonExistent } from './missing-file';
        console.log(nonExistent);
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.length).toBeGreaterThan(0);
      
      const finding = proof.findings[0];
      expect(finding.severity).toBe('error');
      expect(finding.message).toContain('cannot be resolved');
      expect(proof.summary).toContain('hallucinated');
    });

    test('detects missing symbols in existing file', async () => {
      createFile('src/utils.ts', `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `);
      
      createFile('src/index.ts', `
        import { add, multiply } from './utils';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).not.toBe('PROVEN');
      
      const importEvidence = proof.evidence.find(e => e.importPath === './utils');
      expect(importEvidence?.status).toBe('unresolved_symbol');
      expect(importEvidence?.symbolsVerified).toBe(false);
    });

    test('handles default imports', async () => {
      createFile('src/logger.ts', `
        export default class Logger {
          log(msg: string) { console.log(msg); }
        }
      `);
      
      createFile('src/index.ts', `
        import Logger from './logger';
        const logger = new Logger();
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PROVEN');
      const importEvidence = proof.evidence.find(e => e.importPath === './logger');
      expect(importEvidence?.symbols).toContain('default');
      expect(importEvidence?.status).toBe('verified');
    });

    test('handles namespace imports', async () => {
      createFile('src/utils.ts', `
        export const PI = 3.14;
        export function add(a: number, b: number) { return a + b; }
      `);
      
      createFile('src/index.ts', `
        import * as Utils from './utils';
        console.log(Utils.PI);
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PROVEN');
      const importEvidence = proof.evidence.find(e => e.importPath === './utils');
      expect(importEvidence?.symbols).toContain('*');
      expect(importEvidence?.status).toBe('verified');
    });
  });

  describe('path aliases', () => {
    test('resolves path aliases from tsconfig.json', async () => {
      createFile('tsconfig.json', JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@/lib/*': ['src/lib/*'],
            '~/utils': ['src/utils']
          }
        }
      }));

      createFile('src/lib/auth.ts', `
        export function authenticate() { return true; }
      `);

      createFile('src/utils.ts', `
        export const VERSION = '1.0.0';
      `);
      
      createFile('src/index.ts', `
        import { authenticate } from '@/lib/auth';
        import { VERSION } from '~/utils';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PROVEN');
      
      const authImport = proof.evidence.find(e => e.importPath === '@/lib/auth');
      expect(authImport?.status).toBe('verified');
      
      const utilsImport = proof.evidence.find(e => e.importPath === '~/utils');
      expect(utilsImport?.status).toBe('verified');
    });

    test('detects hallucinated alias imports', async () => {
      createFile('tsconfig.json', JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@/*': ['src/*']
          }
        }
      }));
      
      createFile('src/index.ts', `
        import { fake } from '@/nonexistent';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.length).toBeGreaterThan(0);
    });
  });

  describe('package imports', () => {
    test('verifies package imports when node_modules exists', async () => {
      createFile('package.json', JSON.stringify({ name: 'test-project' }));
      
      createFile('node_modules/lodash/package.json', JSON.stringify({
        name: 'lodash',
        main: 'index.js'
      }));
      
      createFile('node_modules/lodash/index.js', `
        module.exports = { chunk: function() {} };
      `);
      
      createFile('src/index.ts', `
        import { chunk } from 'lodash';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PROVEN');
      const lodashImport = proof.evidence.find(e => e.importPath === 'lodash');
      expect(lodashImport?.status).toBe('verified');
    });

    test('handles scoped packages', async () => {
      createFile('node_modules/@types/node/package.json', JSON.stringify({
        name: '@types/node',
        main: 'index.d.ts'
      }));
      
      createFile('node_modules/@types/node/index.d.ts', `
        export function setTimeout(cb: Function, ms: number): void;
      `);
      
      createFile('src/index.ts', `
        import { setTimeout } from '@types/node';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PROVEN');
    });

    test('detects missing packages', async () => {
      createFile('src/index.ts', `
        import React from 'react';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('FAILED');
      const reactImport = proof.evidence.find(e => e.importPath === 'react');
      expect(reactImport?.status).toBe('missing_types');
    });
  });

  describe('dynamic imports', () => {
    test('detects dynamic imports', async () => {
      createFile('src/module.ts', `
        export const data = 'test';
      `);
      
      createFile('src/index.ts', `
        async function load() {
          const mod = await import('./module');
          return mod.data;
        }
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PROVEN');
      const dynamicImport = proof.evidence.find(e => e.importPath === './module');
      expect(dynamicImport).toBeDefined();
      expect(dynamicImport?.status).toBe('verified');
    });

    test('detects hallucinated dynamic imports', async () => {
      createFile('src/index.ts', `
        async function load() {
          const mod = await import('./nonexistent');
        }
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('nonexistent'))).toBe(true);
    });
  });

  describe('re-exports and barrel files', () => {
    test('handles re-exports', async () => {
      createFile('src/utils/add.ts', `
        export function add(a: number, b: number) { return a + b; }
      `);
      
      createFile('src/utils/index.ts', `
        export { add } from './add';
      `);
      
      createFile('src/index.ts', `
        import { add } from './utils';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PROVEN');
      
      // Should verify both the re-export and the final import
      const reExport = proof.evidence.find(e => e.source.includes('utils/index.ts') && e.importPath === './add');
      expect(reExport?.status).toBe('verified');
      
      const finalImport = proof.evidence.find(e => e.source.includes('src/index.ts'));
      expect(finalImport?.status).toBe('verified');
    });

    test('detects broken re-export chains', async () => {
      createFile('src/utils/index.ts', `
        export { missing } from './nonexistent';
      `);
      
      createFile('src/index.ts', `
        import { missing } from './utils';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.length).toBeGreaterThan(0);
    });

    test('handles barrel files with index.ts', async () => {
      createFile('src/lib/index.ts', `
        export const VERSION = '1.0.0';
      `);
      
      createFile('src/index.ts', `
        import { VERSION } from './lib';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PROVEN');
    });
  });

  describe('type-only imports', () => {
    test('verifies type-only imports', async () => {
      createFile('src/types.ts', `
        export interface User {
          id: string;
          name: string;
        }
      `);
      
      createFile('src/index.ts', `
        import type { User } from './types';
        const user: User = { id: '1', name: 'Alice' };
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PROVEN');
      const typeImport = proof.evidence.find(e => e.importPath === './types');
      expect(typeImport?.status).toBe('verified');
      expect(typeImport?.symbols).toContain('User');
    });
  });

  describe('edge cases', () => {
    test('handles mixed extensions in imports', async () => {
      createFile('src/module.ts', `
        export const value = 42;
      `);
      
      createFile('src/index.js', `
        import { value } from './module';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PROVEN');
    });

    test('warns about missing node_modules', async () => {
      createFile('src/index.ts', `
        import express from 'express';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('FAILED');
      const expressImport = proof.evidence.find(e => e.importPath === 'express');
      expect(expressImport?.status).toBe('missing_types');
      expect(expressImport?.resolvedTo).toBeNull();
    });

    test('handles complex barrel file structures', async () => {
      createFile('src/features/auth/login.ts', `
        export function login() { return true; }
      `);
      
      createFile('src/features/auth/index.ts', `
        export { login } from './login';
        export { logout } from './logout';
      `);
      
      createFile('src/features/auth/logout.ts', `
        export function logout() { return false; }
      `);
      
      createFile('src/features/index.ts', `
        export * from './auth';
      `);
      
      createFile('src/index.ts', `
        import { login, logout } from './features';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.status).toBe('PROVEN');
    });

    test('completes under 3 seconds for 200 files', async () => {
      // Create 200 files with various imports
      for (let i = 0; i < 200; i++) {
        const dir = Math.floor(i / 50);
        createFile(`src/dir${dir}/file${i}.ts`, `
          export function func${i}() { return ${i}; }
        `);
      }
      
      createFile('src/index.ts', `
        import { func0 } from './dir0/file0';
        import { func50 } from './dir1/file50';
        import { func100 } from './dir2/file100';
        import { func150 } from './dir3/file150';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const startTime = Date.now();
      const proof = await prover.prove();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(3000);
      expect(proof.status).toBe('PROVEN');
    }, 10000); // 10 second timeout for the test itself
  });

  describe('proof bundle format', () => {
    test('includes all required fields', async () => {
      createFile('src/utils.ts', `export const x = 1;`);
      createFile('src/index.ts', `import { x } from './utils';`);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof).toHaveProperty('property', 'import-integrity');
      expect(proof).toHaveProperty('status');
      expect(proof).toHaveProperty('summary');
      expect(proof).toHaveProperty('evidence');
      expect(proof).toHaveProperty('findings');
      expect(proof).toHaveProperty('method', 'static-ast-analysis');
      expect(proof).toHaveProperty('confidence', 'definitive');
      expect(proof).toHaveProperty('duration_ms');
      expect(typeof proof.duration_ms).toBe('number');
      expect(proof.duration_ms).toBeGreaterThan(0);
    });

    test('evidence includes all required fields', async () => {
      createFile('src/utils.ts', `export function test() {}`);
      createFile('src/index.ts', `import { test } from './utils';`);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      const evidence = proof.evidence[0];
      expect(evidence).toHaveProperty('source');
      expect(evidence).toHaveProperty('line');
      expect(evidence).toHaveProperty('importPath');
      expect(evidence).toHaveProperty('symbols');
      expect(evidence).toHaveProperty('resolvedTo');
      expect(evidence).toHaveProperty('symbolsVerified');
      expect(evidence).toHaveProperty('status');
      expect(['verified', 'unresolved_module', 'unresolved_symbol', 'missing_types']).toContain(evidence.status);
    });

    test('findings include suggestions', async () => {
      createFile('src/index.ts', `import { x } from './missing';`);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.findings.length).toBeGreaterThan(0);
      const finding = proof.findings[0];
      expect(finding).toHaveProperty('file');
      expect(finding).toHaveProperty('line');
      expect(finding).toHaveProperty('severity');
      expect(finding).toHaveProperty('message');
      expect(finding).toHaveProperty('suggestion');
      expect(finding.suggestion).toBeTruthy();
    });
  });

  describe('summary generation', () => {
    test('generates correct summary for all verified', async () => {
      createFile('src/a.ts', `export const a = 1;`);
      createFile('src/b.ts', `export const b = 2;`);
      createFile('src/index.ts', `
        import { a } from './a';
        import { b } from './b';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.summary).toMatch(/2\/2 imports resolve$/);
      expect(proof.status).toBe('PROVEN');
    });

    test('generates correct summary with hallucinations', async () => {
      createFile('src/a.ts', `export const a = 1;`);
      createFile('src/index.ts', `
        import { a } from './a';
        import { b } from './missing';
        import { c } from './also-missing';
      `);

      const prover = new ImportIntegrityProver(tempDir);
      const proof = await prover.prove();

      expect(proof.summary).toContain('1/3 imports resolve');
      expect(proof.summary).toContain('2 hallucinated');
      expect(proof.status).toBe('FAILED');
    });
  });
});
