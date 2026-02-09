/**
 * Assumption Enforcement Guards – Tests
 *
 * Validates that every enforced assumption (P1–P4, A1, R1, D1, D2)
 * throws AssumptionViolationError on violation and passes silently
 * when the assumption holds.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  AssumptionViolationError,
  AssumptionViolationCode,
  isAssumptionViolationError,
} from '../errors.js';
import {
  assertWorkspacePath,
  assertPipelineInput,
  assertValidAst,
  assertWritableOutDir,
  assertSerializableState,
  assertImplementationAccessible,
  assertRequiredPackages,
  assertNoSkippedSteps,
  assertPipelineAssumptions,
} from '../guards.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temp directory that auto-cleans. */
async function makeTempDir(prefix = 'guard-test-'): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Minimal valid Domain AST for testing. */
function minimalAst() {
  return {
    kind: 'Domain' as const,
    name: { kind: 'Identifier', name: 'TestDomain' },
    version: { kind: 'StringLiteral', value: '1.0' },
    imports: [],
    types: [],
    entities: [],
    behaviors: [],
    invariants: [],
  };
}

// ---------------------------------------------------------------------------
// P1 – assertWorkspacePath
// ---------------------------------------------------------------------------

describe('P1: assertWorkspacePath', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should pass for an existing directory', async () => {
    await expect(assertWorkspacePath(tempDir)).resolves.toBeUndefined();
  });

  it('should throw for empty string', async () => {
    await expect(assertWorkspacePath('')).rejects.toThrow(AssumptionViolationError);
    try {
      await assertWorkspacePath('');
    } catch (err) {
      expect(isAssumptionViolationError(err)).toBe(true);
      expect((err as AssumptionViolationError).code).toBe(
        AssumptionViolationCode.WORKSPACE_PATH_INVALID
      );
      expect((err as AssumptionViolationError).assumptionId).toBe('P1');
    }
  });

  it('should throw for non-existent path', async () => {
    await expect(
      assertWorkspacePath(path.join(tempDir, 'no-such-dir'))
    ).rejects.toThrow(AssumptionViolationError);
  });

  it('should throw for a file (not a directory)', async () => {
    const filePath = path.join(tempDir, 'not-a-dir.txt');
    await fs.writeFile(filePath, 'hello');
    await expect(assertWorkspacePath(filePath)).rejects.toThrow(
      AssumptionViolationError
    );
  });
});

// ---------------------------------------------------------------------------
// P2 – assertPipelineInput
// ---------------------------------------------------------------------------

describe('P2: assertPipelineInput', () => {
  it('should pass for valid prompt input', () => {
    expect(() =>
      assertPipelineInput({ mode: 'prompt', prompt: 'build auth' })
    ).not.toThrow();
  });

  it('should pass for valid ast input', () => {
    expect(() =>
      assertPipelineInput({ mode: 'ast', ast: minimalAst() as any })
    ).not.toThrow();
  });

  it('should throw for null input', () => {
    expect(() => assertPipelineInput(null as any)).toThrow(
      AssumptionViolationError
    );
  });

  it('should throw for empty prompt', () => {
    expect(() =>
      assertPipelineInput({ mode: 'prompt', prompt: '   ' })
    ).toThrow(AssumptionViolationError);
  });

  it('should throw for prompt mode with non-string prompt', () => {
    expect(() =>
      assertPipelineInput({ mode: 'prompt', prompt: 42 as any })
    ).toThrow(AssumptionViolationError);
  });

  it('should throw for unknown mode', () => {
    expect(() =>
      assertPipelineInput({ mode: 'magic' } as any)
    ).toThrow(AssumptionViolationError);
  });

  it('should throw for ast mode without ast', () => {
    expect(() =>
      assertPipelineInput({ mode: 'ast', ast: null } as any)
    ).toThrow(AssumptionViolationError);
  });

  it('should include assumptionId P2', () => {
    try {
      assertPipelineInput(null as any);
    } catch (err) {
      expect((err as AssumptionViolationError).assumptionId).toBe('P2');
    }
  });
});

// ---------------------------------------------------------------------------
// P3 – assertValidAst
// ---------------------------------------------------------------------------

describe('P3: assertValidAst', () => {
  it('should pass for a minimal valid AST', () => {
    expect(() => assertValidAst(minimalAst())).not.toThrow();
  });

  it('should throw for null', () => {
    expect(() => assertValidAst(null)).toThrow(AssumptionViolationError);
  });

  it('should throw for wrong kind', () => {
    expect(() => assertValidAst({ ...minimalAst(), kind: 'Entity' })).toThrow(
      AssumptionViolationError
    );
  });

  it('should throw for missing name', () => {
    const ast = { ...minimalAst(), name: null };
    expect(() => assertValidAst(ast)).toThrow(AssumptionViolationError);
  });

  it('should throw for missing version', () => {
    const ast = { ...minimalAst(), version: null };
    expect(() => assertValidAst(ast)).toThrow(AssumptionViolationError);
  });

  it('should throw for missing required array (entities)', () => {
    const { entities, ...ast } = minimalAst();
    expect(() => assertValidAst(ast)).toThrow(AssumptionViolationError);
  });

  it('should throw for non-array behaviors', () => {
    const ast = { ...minimalAst(), behaviors: 'not-an-array' };
    expect(() => assertValidAst(ast)).toThrow(AssumptionViolationError);
  });

  it('should include assumptionId P3', () => {
    try {
      assertValidAst(null);
    } catch (err) {
      expect((err as AssumptionViolationError).assumptionId).toBe('P3');
    }
  });
});

// ---------------------------------------------------------------------------
// P4 – assertWritableOutDir
// ---------------------------------------------------------------------------

describe('P4: assertWritableOutDir', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should pass for a writable directory', async () => {
    const outDir = path.join(tempDir, 'reports');
    await expect(assertWritableOutDir(outDir, tempDir)).resolves.toBeUndefined();
  });

  it('should pass for a relative outDir resolved against workspacePath', async () => {
    await expect(
      assertWritableOutDir('output/reports', tempDir)
    ).resolves.toBeUndefined();
  });

  it('should include assumptionId P4 on failure', async () => {
    // Use a path we know is invalid on any OS
    const bad = path.join(tempDir, '\0invalid');
    try {
      await assertWritableOutDir(bad, tempDir);
    } catch (err) {
      expect((err as AssumptionViolationError).assumptionId).toBe('P4');
    }
  });
});

// ---------------------------------------------------------------------------
// R1 – assertSerializableState
// ---------------------------------------------------------------------------

describe('R1: assertSerializableState', () => {
  it('should pass for plain JSON values', () => {
    expect(() => assertSerializableState({ a: 1, b: 'two' })).not.toThrow();
    expect(() => assertSerializableState([1, 2, 3])).not.toThrow();
    expect(() => assertSerializableState(null)).not.toThrow();
    expect(() => assertSerializableState('hello')).not.toThrow();
  });

  it('should throw for circular references', () => {
    const obj: any = {};
    obj.self = obj;
    expect(() => assertSerializableState(obj)).toThrow(
      AssumptionViolationError
    );
  });

  it('should throw for BigInt', () => {
    expect(() => assertSerializableState(BigInt(42))).toThrow(
      AssumptionViolationError
    );
  });

  it('should include label in error message', () => {
    const obj: any = {};
    obj.self = obj;
    try {
      assertSerializableState(obj, 'captureState');
    } catch (err) {
      expect((err as AssumptionViolationError).message).toContain(
        'captureState'
      );
    }
  });

  it('should include assumptionId R1', () => {
    const obj: any = {};
    obj.self = obj;
    try {
      assertSerializableState(obj);
    } catch (err) {
      expect((err as AssumptionViolationError).assumptionId).toBe('R1');
    }
  });
});

// ---------------------------------------------------------------------------
// A1 – assertImplementationAccessible
// ---------------------------------------------------------------------------

describe('A1: assertImplementationAccessible', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should pass for an existing readable file', async () => {
    const filePath = path.join(tempDir, 'impl.ts');
    await fs.writeFile(filePath, 'export const x = 1;');
    await expect(
      assertImplementationAccessible(filePath)
    ).resolves.toBeUndefined();
  });

  it('should pass for an existing directory', async () => {
    await expect(
      assertImplementationAccessible(tempDir)
    ).resolves.toBeUndefined();
  });

  it('should throw for a non-existent path', async () => {
    await expect(
      assertImplementationAccessible(path.join(tempDir, 'missing.ts'))
    ).rejects.toThrow(AssumptionViolationError);
  });

  it('should include assumptionId A1', async () => {
    try {
      await assertImplementationAccessible(path.join(tempDir, 'nope'));
    } catch (err) {
      expect((err as AssumptionViolationError).assumptionId).toBe('A1');
    }
  });
});

// ---------------------------------------------------------------------------
// D1 – assertRequiredPackages
// ---------------------------------------------------------------------------

describe('D1: assertRequiredPackages', () => {
  it('should pass for packages that exist (node builtins)', () => {
    expect(() => assertRequiredPackages(['node:fs', 'node:path'])).not.toThrow();
  });

  it('should throw for a missing package', () => {
    expect(() =>
      assertRequiredPackages(['@totally-fake/nonexistent-pkg-12345'])
    ).toThrow(AssumptionViolationError);
  });

  it('should report all missing packages at once', () => {
    try {
      assertRequiredPackages([
        'node:fs',
        '@fake/a',
        '@fake/b',
      ]);
    } catch (err) {
      const e = err as AssumptionViolationError;
      expect(e.code).toBe(AssumptionViolationCode.REQUIRED_PACKAGE_MISSING);
      expect(e.assumptionId).toBe('D1');
      expect((e.context as any).missing).toEqual(['@fake/a', '@fake/b']);
    }
  });

  it('should include assumptionId D1', () => {
    try {
      assertRequiredPackages(['@fake/pkg']);
    } catch (err) {
      expect((err as AssumptionViolationError).assumptionId).toBe('D1');
    }
  });
});

// ---------------------------------------------------------------------------
// D2 – assertNoSkippedSteps
// ---------------------------------------------------------------------------

describe('D2: assertNoSkippedSteps', () => {
  it('should be a no-op when strict is false', () => {
    expect(() =>
      assertNoSkippedSteps({}, { strict: false })
    ).not.toThrow();
  });

  it('should be a no-op when options is undefined', () => {
    expect(() => assertNoSkippedSteps({})).not.toThrow();
  });

  it('should pass when all steps succeed in strict mode', () => {
    expect(() =>
      assertNoSkippedSteps(
        {
          context: { success: true, durationMs: 10, warnings: [] },
          translate: { success: true, durationMs: 5, warnings: [] },
        },
        { strict: true }
      )
    ).not.toThrow();
  });

  it('should throw for a missing (undefined) step in strict mode', () => {
    expect(() =>
      assertNoSkippedSteps(
        { context: undefined },
        { strict: true }
      )
    ).toThrow(AssumptionViolationError);
  });

  it('should throw for a failed step in strict mode', () => {
    expect(() =>
      assertNoSkippedSteps(
        {
          translate: {
            success: false,
            error: 'translation unavailable',
            durationMs: 0,
            warnings: [],
          },
        },
        { strict: true }
      )
    ).toThrow(AssumptionViolationError);
  });

  it('should throw for a step with stub/skipped warnings in strict mode', () => {
    expect(() =>
      assertNoSkippedSteps(
        {
          context: {
            success: true,
            durationMs: 1,
            warnings: ['Using stub context extractor'],
          },
        },
        { strict: true }
      )
    ).toThrow(AssumptionViolationError);
  });

  it('should detect "skipped" keyword in warnings', () => {
    expect(() =>
      assertNoSkippedSteps(
        {
          verify: {
            success: true,
            durationMs: 1,
            warnings: ['Verification skipped due to missing solver'],
          },
        },
        { strict: true }
      )
    ).toThrow(AssumptionViolationError);
  });

  it('should include assumptionId D2 and list violations', () => {
    try {
      assertNoSkippedSteps(
        {
          context: undefined,
          translate: {
            success: true,
            durationMs: 1,
            warnings: ['Using stub translator'],
          },
        },
        { strict: true }
      );
    } catch (err) {
      const e = err as AssumptionViolationError;
      expect(e.assumptionId).toBe('D2');
      expect(e.code).toBe(AssumptionViolationCode.SKIPPED_STEP_IN_STRICT);
      expect((e.context as any).violations.length).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// assertPipelineAssumptions (composite guard)
// ---------------------------------------------------------------------------

describe('assertPipelineAssumptions', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should pass for valid input + valid workspace', async () => {
    await expect(
      assertPipelineAssumptions(
        { mode: 'prompt', prompt: 'build auth' },
        { workspacePath: tempDir, writeReport: false }
      )
    ).resolves.toBeUndefined();
  });

  it('should throw when workspacePath is invalid', async () => {
    await expect(
      assertPipelineAssumptions(
        { mode: 'prompt', prompt: 'build auth' },
        { workspacePath: '/does/not/exist/at/all' }
      )
    ).rejects.toThrow(AssumptionViolationError);
  });

  it('should throw when input is invalid', async () => {
    await expect(
      assertPipelineAssumptions(null as any, { workspacePath: tempDir })
    ).rejects.toThrow(AssumptionViolationError);
  });

  it('should check required packages when provided', async () => {
    await expect(
      assertPipelineAssumptions(
        { mode: 'prompt', prompt: 'test' },
        {
          workspacePath: tempDir,
          writeReport: false,
          requiredPackages: ['@fake/nope'],
        }
      )
    ).rejects.toThrow(AssumptionViolationError);
  });
});

// ---------------------------------------------------------------------------
// Error class behavior
// ---------------------------------------------------------------------------

describe('AssumptionViolationError', () => {
  it('should be instanceof Error', () => {
    const err = new AssumptionViolationError(
      AssumptionViolationCode.AST_INVALID,
      'test'
    );
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AssumptionViolationError);
  });

  it('should serialize to JSON', () => {
    const err = new AssumptionViolationError(
      AssumptionViolationCode.AST_INVALID,
      'bad ast',
      { assumptionId: 'P3', context: { key: 'imports' } }
    );
    const json = err.toJSON();
    expect(json.name).toBe('AssumptionViolationError');
    expect(json.code).toBe('ASSUMPTION_AST_INVALID');
    expect(json.assumptionId).toBe('P3');
    expect(json.message).toBe('bad ast');
  });

  it('should be detected by isAssumptionViolationError', () => {
    const err = new AssumptionViolationError(
      AssumptionViolationCode.AST_INVALID,
      'x'
    );
    expect(isAssumptionViolationError(err)).toBe(true);
    expect(isAssumptionViolationError(new Error('x'))).toBe(false);
    expect(isAssumptionViolationError(null)).toBe(false);
  });

  it('should preserve cause', () => {
    const cause = new Error('root cause');
    const err = new AssumptionViolationError(
      AssumptionViolationCode.WORKSPACE_PATH_INVALID,
      'fail',
      { cause }
    );
    expect((err as any).cause).toBe(cause);
  });
});
