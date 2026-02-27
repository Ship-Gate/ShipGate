/**
 * Init command — Setup .isl-verify/ and config
 */

import { mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import chalk from 'chalk';
import { SpecInferenceEngine } from '@isl-lang/spec-inference';
import { getInferredSpecPath } from './config.js';

export interface InitOptions {
  path?: string;
  force?: boolean;
}

export interface InitResult {
  success: boolean;
  projectRoot: string;
  created: string[];
  errors: string[];
}

const DEFAULT_CONFIG = {
  projectRoot: '.',
  sourceDirs: ['src', 'app', 'lib', 'pages'],
  exclude: ['node_modules', 'dist', '.next', 'coverage'],
  truthpackPath: '.vibecheck/truthpack',
  threshold: 80,
  verbose: false,
};

export async function runInit(options: InitOptions = {}): Promise<InitResult> {
  const projectRoot = resolve(options.path ?? process.cwd());
  const created: string[] = [];
  const errors: string[] = [];

  const islVerifyDir = join(projectRoot, '.isl-verify');
  const configPath = join(projectRoot, '.isl-verify.config.json');
  const inferredSpecPath = getInferredSpecPath(projectRoot);

  try {
    // 1. Create .isl-verify/ directory
    if (!existsSync(islVerifyDir)) {
      await mkdir(islVerifyDir, { recursive: true });
      created.push('.isl-verify/');
    }

    // 2. Create config file
    if (!existsSync(configPath) || options.force) {
      await writeFile(
        configPath,
        JSON.stringify({ ...DEFAULT_CONFIG, projectRoot: '.' }, null, 2),
        'utf-8'
      );
      created.push('.isl-verify.config.json');
    }

    // 3. Infer and save initial specs
    const engine = new SpecInferenceEngine({ projectRoot });
    const result = await engine.infer({
      writeFile: true,
      outputPath: inferredSpecPath,
    });
    created.push('.isl-verify/inferred-spec.isl');

    // 4. Add .isl-verify/ to .gitignore (except config)
    const gitignorePath = join(projectRoot, '.gitignore');
    if (existsSync(gitignorePath)) {
      let content = await readFile(gitignorePath, 'utf-8');
      if (!content.includes('.isl-verify/')) {
        content = content.trimEnd() + '\n\n# ISL Verify (report cache - config is .isl-verify.config.json)\n.isl-verify/\n';
        await writeFile(gitignorePath, content, 'utf-8');
        created.push('.gitignore (updated)');
      }
    } else {
      await writeFile(
        gitignorePath,
        '# ISL Verify\n.isl-verify/\n',
        'utf-8'
      );
      created.push('.gitignore');
    }

    return {
      success: true,
      projectRoot,
      created,
      errors,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      success: false,
      projectRoot,
      created,
      errors,
    };
  }
}

export function formatInitOutput(result: InitResult): string {
  const lines: string[] = [];
  lines.push('');

  if (result.success) {
    lines.push(chalk.green('✓') + ' ISL Verify initialized');
    lines.push('');
    lines.push(chalk.bold('Created:'));
    for (const f of result.created) {
      lines.push('  ' + chalk.cyan(f));
    }
    lines.push('');
    lines.push(chalk.gray('Run ') + chalk.cyan('isl-verify .') + chalk.gray(' to scan your project.'));
  } else {
    lines.push(chalk.red('✗') + ' Init failed');
    for (const e of result.errors) {
      lines.push('  ' + chalk.red(e));
    }
  }

  lines.push('');
  return lines.join('\n');
}
