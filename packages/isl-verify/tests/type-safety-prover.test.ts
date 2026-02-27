import { describe, it, expect, beforeEach } from 'vitest';
import { TypeSafetyProver } from '../src/proof/type-safety-prover.js';
import type { ProjectContext } from '../src/proof/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('TypeSafetyProver', () => {
  let prover: TypeSafetyProver;
  const testDir = path.join(__dirname, '.test-temp', 'type-safety');

  beforeEach(async () => {
    prover = new TypeSafetyProver();
    
    await fs.promises.rm(testDir, { recursive: true, force: true });
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  describe('TypeScript Detection', () => {
    it('should fail for JavaScript projects', async () => {
      const file = path.join(testDir, 'app.js');
      await fs.promises.writeFile(file, `
        function greet(name) {
          return "Hello " + name;
        }
      `);

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.summary).toContain('JavaScript');
    });

    it('should process TypeScript projects', async () => {
      const file = path.join(testDir, 'app.ts');
      await fs.promises.writeFile(file, `
        function greet(name: string): string {
          return "Hello " + name;
        }
      `);

      const tsconfigPath = path.join(testDir, 'tsconfig.json');
      await fs.promises.writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          strict: true,
        },
      }));

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        tsconfigPath,
      };

      const proof = await prover.prove(context);

      expect(proof.property).toBe('type-safety');
    });
  });

  describe('Type Coverage Analysis', () => {
    it('should count function return types', async () => {
      const file = path.join(testDir, 'functions.ts');
      await fs.promises.writeFile(file, `
        export function typed(x: number): number {
          return x * 2;
        }

        export function untyped(x: number) {
          return x * 2;
        }

        function internal(x: number) {
          return x * 2;
        }
      `);

      const tsconfigPath = path.join(testDir, 'tsconfig.json');
      await fs.promises.writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: { strict: true },
      }));

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        tsconfigPath,
      };

      const proof = await prover.prove(context);

      expect(proof.evidence.length).toBeGreaterThan(0);
      const evidence = proof.evidence[0];
      if (evidence && 'totalFunctions' in evidence) {
        expect(evidence.totalFunctions).toBeGreaterThan(0);
      }
    });

    it('should detect "any" usage', async () => {
      const file = path.join(testDir, 'any.ts');
      await fs.promises.writeFile(file, `
        function process(data: any) {
          return data;
        }

        const value: any = getData();
      `);

      const tsconfigPath = path.join(testDir, 'tsconfig.json');
      await fs.promises.writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: { strict: true },
      }));

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        tsconfigPath,
      };

      const proof = await prover.prove(context);

      const evidence = proof.evidence[0];
      if (evidence && 'anyUsages' in evidence) {
        expect(evidence.anyUsages).toBeGreaterThan(0);
      }
    });
  });

  describe('Type Escape Hatches', () => {
    it('should detect @ts-ignore comments', async () => {
      const file = path.join(testDir, 'ignore.ts');
      await fs.promises.writeFile(file, `
        // @ts-ignore
        const value = undefinedVariable;
      `);

      const tsconfigPath = path.join(testDir, 'tsconfig.json');
      await fs.promises.writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: { strict: true },
      }));

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        tsconfigPath,
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.message.includes('@ts-ignore'))).toBe(true);
    });

    it('should detect @ts-expect-error comments', async () => {
      const file = path.join(testDir, 'expect-error.ts');
      await fs.promises.writeFile(file, `
        // @ts-expect-error Testing error condition
        const value = undefinedVariable;
      `);

      const tsconfigPath = path.join(testDir, 'tsconfig.json');
      await fs.promises.writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: { strict: true },
      }));

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        tsconfigPath,
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.message.includes('@ts-expect-error'))).toBe(true);
    });

    it('should detect "as any" casts', async () => {
      const file = path.join(testDir, 'as-any.ts');
      await fs.promises.writeFile(file, `
        const value = getData() as any;
        const result = (value as any).someProperty;
      `);

      const tsconfigPath = path.join(testDir, 'tsconfig.json');
      await fs.promises.writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: { strict: true },
      }));

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        tsconfigPath,
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.message.includes('"any" bypasses type safety'))).toBe(true);
    });

    it('should detect untyped exported functions', async () => {
      const file = path.join(testDir, 'export.ts');
      await fs.promises.writeFile(file, `
        export function calculate(x: number) {
          return x * 2;
        }
      `);

      const tsconfigPath = path.join(testDir, 'tsconfig.json');
      await fs.promises.writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: { strict: true },
      }));

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        tsconfigPath,
      };

      const proof = await prover.prove(context);

      expect(proof.findings.some(f => f.message.includes('without explicit return type'))).toBe(true);
    });
  });

  describe('TypeScript Compiler Validation', () => {
    it('should pass for valid TypeScript', async () => {
      const file = path.join(testDir, 'valid.ts');
      await fs.promises.writeFile(file, `
        export function add(a: number, b: number): number {
          return a + b;
        }

        export interface User {
          id: number;
          name: string;
        }
      `);

      const tsconfigPath = path.join(testDir, 'tsconfig.json');
      await fs.promises.writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          strict: true,
        },
      }));

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        tsconfigPath,
      };

      const proof = await prover.prove(context);

      const evidence = proof.evidence[0];
      if (evidence && 'tscResult' in evidence) {
        expect(evidence.tscResult).toBe('pass');
      }
    });

    it('should detect type errors', async () => {
      const file = path.join(testDir, 'errors.ts');
      await fs.promises.writeFile(file, `
        function add(a: number, b: number): number {
          return a + b;
        }

        const result: string = add(1, 2);
      `);

      const tsconfigPath = path.join(testDir, 'tsconfig.json');
      await fs.promises.writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          strict: true,
        },
      }));

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        tsconfigPath,
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('FAILED');
      expect(proof.findings.some(f => f.message.includes('TypeScript:'))).toBe(true);
    });
  });

  describe('Status Determination', () => {
    it('should return PROVEN for perfect type safety', async () => {
      const file = path.join(testDir, 'perfect.ts');
      await fs.promises.writeFile(file, `
        export function multiply(a: number, b: number): number {
          return a * b;
        }
      `);

      const tsconfigPath = path.join(testDir, 'tsconfig.json');
      await fs.promises.writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: { strict: true },
      }));

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        tsconfigPath,
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('PROVEN');
    });

    it('should return PARTIAL for passing tsc but with escape hatches', async () => {
      const file = path.join(testDir, 'partial.ts');
      await fs.promises.writeFile(file, `
        export function process(data: unknown): number {
          return (data as any).value;
        }
      `);

      const tsconfigPath = path.join(testDir, 'tsconfig.json');
      await fs.promises.writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: { strict: true },
      }));

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        tsconfigPath,
      };

      const proof = await prover.prove(context);

      expect(proof.status).toBe('PARTIAL');
    });
  });

  describe('Proof Metadata', () => {
    it('should have correct tier and ID', () => {
      expect(prover.tier).toBe(1);
      expect(prover.id).toBe('tier1-type-safety');
      expect(prover.name).toBe('TypeScript Type Safety');
    });

    it('should include evidence and timing', async () => {
      const file = path.join(testDir, 'test.ts');
      await fs.promises.writeFile(file, `
        function test() {
          return 42;
        }
      `);

      const tsconfigPath = path.join(testDir, 'tsconfig.json');
      await fs.promises.writeFile(tsconfigPath, JSON.stringify({
        compilerOptions: { strict: true },
      }));

      const context: ProjectContext = {
        rootPath: testDir,
        sourceFiles: [file],
        tsconfigPath,
      };

      const proof = await prover.prove(context);

      expect(proof.evidence.length).toBeGreaterThan(0);
      expect(proof.duration_ms).toBeGreaterThan(0);
      expect(proof.method).toBe('tsc-validation');
      expect(proof.confidence).toBe('definitive');
    });
  });
});
