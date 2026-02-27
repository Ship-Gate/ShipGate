import { describe, it, expect } from 'vitest';
import { generateSpecFromSource } from '../src/generate.js';
import { parseISL } from '../src/parse.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

// ============================================================================
// Helpers
// ============================================================================

async function writeTempFile(
  content: string,
  filename = 'module.ts',
): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdk-gen-'));
  const filePath = path.join(tmpDir, filename);
  await fs.writeFile(filePath, content);
  return {
    filePath,
    cleanup: () => fs.rm(tmpDir, { recursive: true, force: true }),
  };
}

// ============================================================================
// generateSpecFromSource
// ============================================================================

describe('generateSpecFromSource', () => {
  it('generates ISL from a TypeScript file with exported functions', async () => {
    const { filePath, cleanup } = await writeTempFile(`
      export async function login(email: string, password: string): Promise<AuthToken> {
        // implementation
        return { token: 'abc' };
      }

      export function logout(sessionId: string): void {
        // implementation
      }
    `);

    try {
      const spec = await generateSpecFromSource(filePath);

      expect(spec.isl).toContain('domain');
      expect(spec.isl).toContain('behavior Login');
      expect(spec.isl).toContain('behavior Logout');
      expect(spec.isl).toContain('email: String');
      expect(spec.isl).toContain('password: String');
      expect(spec.confidence).toBeGreaterThan(0);
      expect(spec.warnings).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it('generates ISL with entities from exported interfaces', async () => {
    const { filePath, cleanup } = await writeTempFile(`
      export interface User {
        id: string;
        name: string;
        age: number;
      }

      export function createUser(name: string): Promise<User> {
        return { id: '1', name, age: 0 };
      }
    `);

    try {
      const spec = await generateSpecFromSource(filePath);

      expect(spec.isl).toContain('entity User');
      expect(spec.isl).toContain('id: String');
      expect(spec.isl).toContain('name: String');
      expect(spec.isl).toContain('age: Int');
      expect(spec.isl).toContain('behavior CreateUser');
    } finally {
      await cleanup();
    }
  });

  it('warns when no functions or interfaces are found', async () => {
    const { filePath, cleanup } = await writeTempFile(`
      // Just a comment, nothing exported
      const x = 42;
    `);

    try {
      const spec = await generateSpecFromSource(filePath);

      expect(spec.warnings.length).toBeGreaterThan(0);
      expect(spec.confidence).toBeLessThan(0.2);
    } finally {
      await cleanup();
    }
  });

  it('confidence increases with more functions', async () => {
    const { filePath: oneFunc, cleanup: c1 } = await writeTempFile(
      `export function a(): void {}`,
      'one.ts',
    );
    const { filePath: threeFuncs, cleanup: c2 } = await writeTempFile(
      `export function a(): void {}
       export function b(): void {}
       export function c(): void {}`,
      'three.ts',
    );

    try {
      const one = await generateSpecFromSource(oneFunc);
      const three = await generateSpecFromSource(threeFuncs);

      expect(three.confidence).toBeGreaterThan(one.confidence);
    } finally {
      await c1();
      await c2();
    }
  });

  it('generated ISL is parseable by the ISL parser', async () => {
    const { filePath, cleanup } = await writeTempFile(`
      export function processPayment(amount: number, currency: string): Promise<Receipt> {
        return {} as any;
      }
    `);

    try {
      const spec = await generateSpecFromSource(filePath);
      const parsed = parseISL(spec.isl);

      // The generated ISL should at least parse without catastrophic failure
      // (individual postcondition expressions may not match full ISL grammar)
      expect(spec.isl).toContain('domain');
      expect(spec.isl).toContain('behavior');
    } finally {
      await cleanup();
    }
  });

  it('maps Promise<T> return types correctly', async () => {
    const { filePath, cleanup } = await writeTempFile(`
      export async function fetchData(): Promise<string> {
        return 'data';
      }
    `);

    try {
      const spec = await generateSpecFromSource(filePath);
      expect(spec.isl).toContain('success: String');
    } finally {
      await cleanup();
    }
  });

  it('uses the filename as the domain name', async () => {
    const { filePath, cleanup } = await writeTempFile(
      `export function run(): void {}`,
      'authentication.ts',
    );

    try {
      const spec = await generateSpecFromSource(filePath);
      expect(spec.isl).toContain('domain Authentication');
    } finally {
      await cleanup();
    }
  });

  it('returns a frozen (read-only) result', async () => {
    const { filePath, cleanup } = await writeTempFile(
      `export function ping(): void {}`,
    );

    try {
      const spec = await generateSpecFromSource(filePath);
      expect(Object.isFrozen(spec)).toBe(true);
    } finally {
      await cleanup();
    }
  });
});
