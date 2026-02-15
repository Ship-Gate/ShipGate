/**
 * Seed Command
 *
 * Generate and run Prisma seed from ISL spec.
 * Usage:
 *   isl seed generate [spec]  - Generate prisma/seed.ts from ISL
 *   isl seed run              - Execute seed (prisma db seed)
 *   isl seed reset            - Wipe DB + re-seed
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { execSync } from 'child_process';
import { resolve, dirname, join } from 'path';
import chalk from 'chalk';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';

export interface SeedGenerateOptions {
  output?: string;
  recordsPerEntity?: number;
  format?: 'pretty' | 'json' | 'quiet';
}

export interface SeedRunOptions {
  cwd?: string;
  format?: 'pretty' | 'json' | 'quiet';
}

export interface SeedResetOptions {
  cwd?: string;
  format?: 'pretty' | 'json' | 'quiet';
}

export interface SeedGenerateResult {
  success: boolean;
  outputPath: string;
  error?: string;
}

export interface SeedRunResult {
  success: boolean;
  error?: string;
}

export interface SeedResetResult {
  success: boolean;
  error?: string;
}

export async function seedGenerate(
  specPath: string,
  options: SeedGenerateOptions = {}
): Promise<SeedGenerateResult> {
  try {
    const resolvedSpec = resolve(specPath);
    const islSource = await readFile(resolvedSpec, 'utf-8');
    const outputDir = options.output ? resolve(options.output) : process.cwd();

    const { parse } = await import('@isl-lang/parser');
    const { generateSeed } = await import('@isl-lang/isl-ship');
    const { resolveStack } = await import('@isl-lang/isl-ship');

    const parseResult = parse(islSource, resolvedSpec);
    if (!parseResult.success || !parseResult.domain) {
      const errMsg = parseResult.errors?.[0]?.message ?? 'Parse failed';
      return { success: false, outputPath: '', error: errMsg };
    }

    const stack = resolveStack({ backend: 'express', database: 'postgres', orm: 'prisma' });
    const seedFile = generateSeed(parseResult.domain, stack, {
      recordsPerEntity: options.recordsPerEntity ?? 10,
    });

    const outPath = join(outputDir, seedFile.path);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, seedFile.content, 'utf-8');

    return { success: true, outputPath: outPath };
  } catch (error) {
    return {
      success: false,
      outputPath: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function seedRun(options: SeedRunOptions = {}): Promise<SeedRunResult> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  try {
    execSync('npx prisma db seed', { cwd, stdio: 'inherit' });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function seedReset(options: SeedResetOptions = {}): Promise<SeedResetResult> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  try {
    execSync('npx prisma migrate reset --force', { cwd, stdio: 'inherit' });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function printSeedGenerateResult(result: SeedGenerateResult, format: 'pretty' | 'json' | 'quiet' = 'pretty'): void {
  if (format === 'json') {
    output.json(result);
    return;
  }
  if (format === 'quiet') return;

  if (result.success) {
    output.info(chalk.green('Seed file generated: ') + result.outputPath);
  } else {
    output.error(chalk.red('Seed generation failed: ') + (result.error ?? 'Unknown error'));
  }
}

export function printSeedRunResult(result: SeedRunResult, format: 'pretty' | 'json' | 'quiet' = 'pretty'): void {
  if (format === 'json') {
    output.json(result);
    return;
  }
  if (format === 'quiet') return;

  if (result.success) {
    output.info(chalk.green('Seed completed.'));
  } else {
    output.error(chalk.red('Seed failed: ') + (result.error ?? 'Unknown error'));
  }
}

export function printSeedResetResult(result: SeedResetResult, format: 'pretty' | 'json' | 'quiet' = 'pretty'): void {
  if (format === 'json') {
    output.json(result);
    return;
  }
  if (format === 'quiet') return;

  if (result.success) {
    output.info(chalk.green('Database reset and seeded.'));
  } else {
    output.error(chalk.red('Reset failed: ') + (result.error ?? 'Unknown error'));
  }
}

export function getSeedGenerateExitCode(result: SeedGenerateResult): ExitCode {
  return result.success ? ExitCode.OK : ExitCode.RUNTIME_ERROR;
}

export function getSeedRunExitCode(result: SeedRunResult): ExitCode {
  return result.success ? ExitCode.OK : ExitCode.RUNTIME_ERROR;
}

export function getSeedResetExitCode(result: SeedResetResult): ExitCode {
  return result.success ? ExitCode.OK : ExitCode.RUNTIME_ERROR;
}
