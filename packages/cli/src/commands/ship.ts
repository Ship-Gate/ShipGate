/**
 * Ship Command
 *
 * Generate a complete, runnable full-stack application from an ISL specification.
 * Usage: isl ship <file> [options]
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, relative, dirname, join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ShipCommandOptions {
  output?: string;
  stack?: string;
  /** Database override: sqlite, postgres, mysql, mongodb (default from stack) */
  db?: string;
  /** Override DATABASE_URL connection string */
  dbUrl?: string;
  /** Deployment platform: vercel, docker, railway, fly */
  deploy?: string;
  name?: string;
  force?: boolean;
  noDocker?: boolean;
  noContracts?: boolean;
  verbose?: boolean;
  format?: 'pretty' | 'json' | 'quiet';
}

export interface ShipCommandResult {
  success: boolean;
  projectName: string;
  outputDir: string;
  fileCount: number;
  errors: string[];
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Command
// ─────────────────────────────────────────────────────────────────────────────

export async function shipCommand(
  specFile: string,
  options: ShipCommandOptions
): Promise<ShipCommandResult> {
  const startTime = Date.now();
  const format = options.format ?? 'pretty';
  const spinner = format === 'pretty' ? ora('Shipping...').start() : null;

  try {
    // ── Resolve paths ─────────────────────────────────────────────────────
    const specPath = resolve(specFile);
    const islSource = await readFile(specPath, 'utf-8');

    // ── Parse stack option ────────────────────────────────────────────────
    const stackParts = (options.stack ?? 'express+prisma+postgres').split('+');
    const stackConfig: Record<string, string> = {};
    for (const part of stackParts) {
      const lower = part.toLowerCase().trim();
      if (['express', 'fastify', 'nextjs'].includes(lower)) stackConfig.backend = lower;
      else if (['postgres', 'mysql', 'sqlite', 'mongodb'].includes(lower)) stackConfig.database = lower;
      else if (['prisma', 'drizzle'].includes(lower)) stackConfig.orm = lower;
      else if (['react', 'none'].includes(lower)) stackConfig.frontend = lower;
      else if (['tailwind', 'css-modules'].includes(lower)) stackConfig.css = lower;
    }
    if (options.db && ['postgres', 'mysql', 'sqlite', 'mongodb'].includes(options.db.toLowerCase())) {
      stackConfig.database = options.db.toLowerCase();
    }

    // ── Dynamic import of isl-ship ────────────────────────────────────────
    if (spinner) spinner.text = 'Loading generators...';

    let shipModule: {
      ship: (source: string, opts: {
        specPath: string;
        outputDir: string;
        stack: Record<string, unknown>;
        projectName?: string;
        deploy?: string;
        force?: boolean;
        contracts?: boolean;
        verbose?: boolean;
      }) => {
        success: boolean;
        projectName: string;
        files: Array<{ path: string; content: string; layer: string }>;
        errors: string[];
        warnings: string[];
        duration: number;
        stats: {
          entities: number;
          behaviors: number;
          endpoints: number;
          screens: number;
          events: number;
          workflows: number;
          totalFiles: number;
        };
      };
    };

    try {
      shipModule = await import('@isl-lang/isl-ship');
    } catch {
      spinner?.fail('Failed to load @isl-lang/isl-ship');
      return {
        success: false,
        projectName: '',
        outputDir: '',
        fileCount: 0,
        errors: ['@isl-lang/isl-ship package not found. Run: pnpm add @isl-lang/isl-ship'],
        duration: Date.now() - startTime,
      };
    }

    // ── Generate ──────────────────────────────────────────────────────────
    if (spinner) spinner.text = 'Generating full-stack application...';

    const outputDir = resolve(options.output ?? `./${options.name ?? 'output'}`);

    const result = shipModule.ship(islSource, {
      specPath: specPath,
      outputDir,
      stack: {
        backend: stackConfig.backend ?? 'express',
        database: stackConfig.database ?? 'postgres',
        orm: stackConfig.orm ?? 'prisma',
        frontend: stackConfig.frontend ?? 'none',
        css: stackConfig.css ?? 'tailwind',
        docker: !options.noDocker,
        runtime: !options.noContracts,
      },
      projectName: options.name,
      deploy: options.deploy,
      dbUrl: options.dbUrl,
      force: options.force,
      contracts: !options.noContracts,
      verbose: options.verbose,
    });

    if (!result.success) {
      spinner?.fail('Generation failed');
      for (const err of result.errors) {
        output.error(err);
      }
      return {
        success: false,
        projectName: result.projectName,
        outputDir,
        fileCount: 0,
        errors: result.errors,
        duration: Date.now() - startTime,
      };
    }

    // ── Write files ───────────────────────────────────────────────────────
    if (spinner) spinner.text = `Writing ${result.files.length} files...`;

    let written = 0;
    for (const file of result.files) {
      const filePath = join(outputDir, file.path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content, 'utf-8');
      written++;

      if (options.verbose && format === 'pretty') {
        const layerColor = {
          backend: chalk.blue,
          frontend: chalk.green,
          database: chalk.yellow,
          contracts: chalk.magenta,
          config: chalk.cyan,
          scaffold: chalk.gray,
        }[file.layer] ?? chalk.white;

        output.info(`  ${layerColor(`[${file.layer}]`)} ${relative(process.cwd(), filePath)}`);
      }
    }

    // ── Success output ────────────────────────────────────────────────────
    const duration = Date.now() - startTime;

    if (format === 'json') {
      output.json({
        success: true,
        projectName: result.projectName,
        outputDir,
        files: result.files.map(f => f.path),
        stats: result.stats,
        duration,
      });
    } else if (format === 'pretty') {
      spinner?.succeed(chalk.green(`Shipped ${result.projectName} → ${relative(process.cwd(), outputDir)}/`));
      output.info('');
      output.info(chalk.bold('  📦 Generated Project:'));
      output.info(`     ${chalk.cyan('Entities:')}    ${result.stats.entities}`);
      output.info(`     ${chalk.cyan('Behaviors:')}   ${result.stats.behaviors}`);
      output.info(`     ${chalk.cyan('Endpoints:')}   ${result.stats.endpoints}`);
      output.info(`     ${chalk.cyan('Events:')}      ${result.stats.events}`);
      output.info(`     ${chalk.cyan('Workflows:')}   ${result.stats.workflows}`);
      output.info(`     ${chalk.cyan('Files:')}       ${result.stats.totalFiles}`);
      output.info('');
      output.info(chalk.bold('  🚀 Quick Start:'));
      output.info(`     cd ${relative(process.cwd(), outputDir)}`);
      output.info('     npm install');
      output.info('     docker compose up -d db');
      output.info('     npm run db:generate && npm run db:push');
      output.info('     npm run dev');
      output.info('');

      if (result.warnings.length > 0) {
        for (const warn of result.warnings) {
          output.warn(warn);
        }
      }
    }

    return {
      success: true,
      projectName: result.projectName,
      outputDir,
      fileCount: written,
      errors: [],
      duration,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner?.fail(`Ship failed: ${msg}`);
    return {
      success: false,
      projectName: '',
      outputDir: '',
      fileCount: 0,
      errors: [msg],
      duration: Date.now() - startTime,
    };
  }
}
