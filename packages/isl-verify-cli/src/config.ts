/**
 * Config loading for isl-verify
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import type { IslVerifyConfig } from './types.js';

const DEFAULT_CONFIG: IslVerifyConfig = {
  sourceDirs: ['src', 'app', 'lib', 'pages'],
  exclude: ['node_modules', 'dist', '.next', 'coverage'],
  truthpackPath: '.vibecheck/truthpack',
  threshold: 80,
  verbose: false,
};

export async function loadConfig(projectRoot: string): Promise<IslVerifyConfig> {
  const configPath = join(projectRoot, '.isl-verify.config.json');
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG, projectRoot };
  }

  try {
    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content) as Partial<IslVerifyConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      projectRoot: projectRoot,
    };
  } catch {
    return { ...DEFAULT_CONFIG, projectRoot };
  }
}

export function getReportPath(projectRoot: string): string {
  return join(projectRoot, '.isl-verify', 'report.json');
}

export function getInferredSpecPath(projectRoot: string): string {
  return join(projectRoot, '.isl-verify', 'inferred-spec.isl');
}
