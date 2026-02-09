/**
 * Runtime guards for implicit assumptions.
 *
 * Each guard throws AssumptionViolationError when the assumption is violated.
 * Use at pipeline start (or when strictMode is enabled) to fail loudly.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Domain } from '@isl-lang/parser';
import {
  AssumptionViolationError,
  AssumptionViolationCode,
  type AssumptionViolationCodeType,
} from './errors.js';
import { createRequire } from 'node:module';
import type { PipelineInput, StepResult } from '../pipeline/pipelineTypes.js';

/**
 * Assert workspace path exists and is a directory.
 * Violates: P1 – environment assumption.
 */
export async function assertWorkspacePath(workspacePath: string): Promise<void> {
  const code = AssumptionViolationCode.WORKSPACE_PATH_INVALID as AssumptionViolationCodeType;
  if (!workspacePath || typeof workspacePath !== 'string') {
    throw new AssumptionViolationError(
      code,
      `workspacePath must be a non-empty string; got ${typeof workspacePath}`,
      { assumptionId: 'P1', context: { workspacePath } }
    );
  }
  const resolved = path.resolve(workspacePath);
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(resolved);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    throw new AssumptionViolationError(
      code,
      `workspacePath does not exist or is not accessible: ${resolved}. ${message}`,
      { assumptionId: 'P1', context: { workspacePath: resolved }, cause: err instanceof Error ? err : undefined }
    );
  }
  if (!stat.isDirectory()) {
    throw new AssumptionViolationError(
      code,
      `workspacePath must be a directory: ${resolved}`,
      { assumptionId: 'P1', context: { workspacePath: resolved } }
    );
  }
}

/**
 * Assert pipeline input is well-formed (prompt non-empty string or ast mode with AST).
 * Violates: P2 – input assumption.
 */
export function assertPipelineInput(input: PipelineInput): void {
  const code = AssumptionViolationCode.PIPELINE_INPUT_INVALID as AssumptionViolationCodeType;
  if (!input || typeof input !== 'object') {
    throw new AssumptionViolationError(
      code,
      'Pipeline input must be an object with mode "prompt" or "ast"',
      { assumptionId: 'P2', context: { input } }
    );
  }
  if (input.mode === 'prompt') {
    if (typeof input.prompt !== 'string') {
      throw new AssumptionViolationError(
        code,
        'Pipeline input in prompt mode must have a string "prompt"',
        { assumptionId: 'P2', context: { mode: 'prompt' } }
      );
    }
    if (input.prompt.trim().length === 0) {
      throw new AssumptionViolationError(
        code,
        'Pipeline input prompt must be non-empty',
        { assumptionId: 'P2', context: { mode: 'prompt' } }
      );
    }
    return;
  }
  if (input.mode === 'ast') {
    if (!input.ast) {
      throw new AssumptionViolationError(
        code,
        'Pipeline input in ast mode must have an "ast" object',
        { assumptionId: 'P2', context: { mode: 'ast' } }
      );
    }
    assertValidAst(input.ast);
    return;
  }
  throw new AssumptionViolationError(
    code,
    `Pipeline input mode must be "prompt" or "ast"; got "${(input as { mode?: string }).mode}"`,
    { assumptionId: 'P2', context: { mode: (input as { mode?: string }).mode } }
  );
}

/**
 * Assert AST has required Domain shape (kind, name, version, arrays).
 * Violates: P3 – input assumption.
 */
export function assertValidAst(ast: unknown): asserts ast is Domain {
  const code = AssumptionViolationCode.AST_INVALID as AssumptionViolationCodeType;
  if (!ast || typeof ast !== 'object') {
    throw new AssumptionViolationError(
      code,
      'AST must be a non-null object',
      { assumptionId: 'P3', context: { ast } }
    );
  }
  const d = ast as Record<string, unknown>;
  if (d.kind !== 'Domain') {
    throw new AssumptionViolationError(
      code,
      `AST must have kind "Domain"; got "${String(d.kind)}"`,
      { assumptionId: 'P3', context: { kind: d.kind } }
    );
  }
  if (!d.name || typeof d.name !== 'object') {
    throw new AssumptionViolationError(
      code,
      'AST must have a "name" identifier',
      { assumptionId: 'P3', context: {} }
    );
  }
  if (!d.version || typeof d.version !== 'object') {
    throw new AssumptionViolationError(
      code,
      'AST must have a "version" literal',
      { assumptionId: 'P3', context: {} }
    );
  }
  const requiredArrays = ['imports', 'types', 'entities', 'behaviors', 'invariants'] as const;
  for (const key of requiredArrays) {
    if (!Array.isArray(d[key])) {
      throw new AssumptionViolationError(
        code,
        `AST must have "${key}" as an array`,
        { assumptionId: 'P3', context: { key } }
      );
    }
  }
}

/**
 * Assert outDir exists (or can be created) and is writable.
 * Violates: P4 – environment assumption.
 */
export async function assertWritableOutDir(
  outDir: string,
  workspacePath: string
): Promise<void> {
  const code = AssumptionViolationCode.OUT_DIR_NOT_WRITABLE as AssumptionViolationCodeType;
  const resolved = path.isAbsolute(outDir)
    ? path.resolve(outDir)
    : path.resolve(workspacePath, outDir);

  try {
    await fs.mkdir(resolved, { recursive: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AssumptionViolationError(
      code,
      `outDir could not be created or is not writable: ${resolved}. ${message}`,
      { assumptionId: 'P4', context: { outDir: resolved }, cause: err instanceof Error ? err : undefined }
    );
  }

  const testFile = path.join(resolved, `.write-test-${Date.now()}`);
  try {
    await fs.writeFile(testFile, '', 'utf-8');
    await fs.unlink(testFile);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AssumptionViolationError(
      code,
      `outDir is not writable: ${resolved}. ${message}`,
      { assumptionId: 'P4', context: { outDir: resolved }, cause: err instanceof Error ? err : undefined }
    );
  }
}

/**
 * Assert state is JSON-serializable (for captureState/old).
 * Violates: R1 – runtime/evidence assumption.
 */
export function assertSerializableState(state: unknown, label?: string): void {
  const code = AssumptionViolationCode.STATE_NOT_SERIALIZABLE as AssumptionViolationCodeType;
  const labelStr = label ? ` (${label})` : '';
  try {
    JSON.stringify(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AssumptionViolationError(
      code,
      `State must be JSON-serializable${labelStr}. ${message}`,
      { assumptionId: 'R1', context: { label }, cause: err instanceof Error ? err : undefined }
    );
  }
}

/**
 * Assert a path (implementation file or directory) exists and is readable.
 * Violates: A1 – auto-verify environment assumption.
 */
export async function assertImplementationAccessible(targetPath: string): Promise<void> {
  const code = AssumptionViolationCode.IMPLEMENTATION_NOT_ACCESSIBLE as AssumptionViolationCodeType;
  const resolved = path.resolve(targetPath);
  try {
    await fs.access(resolved, fs.constants.R_OK);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AssumptionViolationError(
      code,
      `Implementation path is not accessible (readable): ${resolved}. ${message}`,
      { assumptionId: 'A1', context: { targetPath: resolved }, cause: err instanceof Error ? err : undefined }
    );
  }
}

/**
 * Assert that required packages can be resolved at runtime.
 * Violates: D1 – dependency assumption.
 *
 * Uses createRequire for ESM-compatible resolution.
 * Call at startup or pipeline init to surface missing deps early.
 */
export function assertRequiredPackages(
  packages: string[],
  fromDir?: string
): void {
  const code = AssumptionViolationCode.REQUIRED_PACKAGE_MISSING as AssumptionViolationCodeType;
  const resolver = createRequire(fromDir ? path.resolve(fromDir, 'package.json') : import.meta.url);
  const missing: string[] = [];
  for (const pkg of packages) {
    try {
      resolver.resolve(pkg);
    } catch {
      missing.push(pkg);
    }
  }
  if (missing.length > 0) {
    throw new AssumptionViolationError(
      code,
      `Required packages not resolvable: ${missing.join(', ')}`,
      { assumptionId: 'D1', context: { missing, fromDir } }
    );
  }
}

/**
 * Assert no pipeline steps were skipped or stubbed when strict mode is active.
 * Violates: D2 – environment assumption.
 *
 * Inspects step results for non-success entries or warnings containing
 * "stub" / "skipped". Throws if any are found and strict is true.
 */
export function assertNoSkippedSteps(
  stepResults: Record<string, StepResult<unknown> | undefined>,
  options?: { strict?: boolean }
): void {
  if (!options?.strict) return;

  const code = AssumptionViolationCode.SKIPPED_STEP_IN_STRICT as AssumptionViolationCodeType;
  const violations: string[] = [];

  for (const [name, result] of Object.entries(stepResults)) {
    if (!result) {
      violations.push(`Step "${name}" was not executed`);
      continue;
    }
    if (!result.success && result.error) {
      violations.push(`Step "${name}" failed: ${result.error}`);
    }
    for (const w of result.warnings) {
      if (/\b(stub|skipped)\b/i.test(w)) {
        violations.push(`Step "${name}" used stub/skip: ${w}`);
      }
    }
  }

  if (violations.length > 0) {
    throw new AssumptionViolationError(
      code,
      `Strict mode disallows skipped or stubbed steps:\n  - ${violations.join('\n  - ')}`,
      { assumptionId: 'D2', context: { violations } }
    );
  }
}

/**
 * Run all pipeline-related guards (P1–P4, optionally D1).
 * Call before runPipeline when options.enforceAssumptions is true.
 */
export async function assertPipelineAssumptions(
  input: PipelineInput,
  options: {
    workspacePath: string;
    outDir?: string;
    writeReport?: boolean;
    requiredPackages?: string[];
  }
): Promise<void> {
  assertPipelineInput(input);
  await assertWorkspacePath(options.workspacePath);
  const outDir = options.outDir ?? '.shipgate/reports';
  if (options.writeReport !== false) {
    await assertWritableOutDir(outDir, options.workspacePath);
  }
  if (options.requiredPackages && options.requiredPackages.length > 0) {
    assertRequiredPackages(options.requiredPackages, options.workspacePath);
  }
}
