/**
 * Stack Detector
 * 
 * Detects the primary language, runtime, and package manager.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { StackLanguage, Runtime, Confidence } from '../contextTypes.js';

export interface StackDetectionResult {
  language: StackLanguage;
  languageConfidence: Confidence;
  runtime: Runtime;
  runtimeConfidence: Confidence;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  hasTypeScript: boolean;
  isMonorepo: boolean;
}

/**
 * Detects the primary language and runtime from the workspace
 */
export async function detectStack(workspacePath: string): Promise<StackDetectionResult> {
  const result: StackDetectionResult = {
    language: 'unknown',
    languageConfidence: 'low',
    runtime: 'unknown',
    runtimeConfidence: 'low',
    hasTypeScript: false,
    isMonorepo: false,
  };

  // Check for various config files
  const checks = await Promise.allSettled([
    fileExists(path.join(workspacePath, 'package.json')),
    fileExists(path.join(workspacePath, 'tsconfig.json')),
    fileExists(path.join(workspacePath, 'pnpm-workspace.yaml')),
    fileExists(path.join(workspacePath, 'lerna.json')),
    fileExists(path.join(workspacePath, 'nx.json')),
    fileExists(path.join(workspacePath, 'turbo.json')),
    fileExists(path.join(workspacePath, 'requirements.txt')),
    fileExists(path.join(workspacePath, 'pyproject.toml')),
    fileExists(path.join(workspacePath, 'go.mod')),
    fileExists(path.join(workspacePath, 'Cargo.toml')),
    fileExists(path.join(workspacePath, 'pom.xml')),
    fileExists(path.join(workspacePath, 'build.gradle')),
    fileExists(path.join(workspacePath, '*.csproj')),
    fileExists(path.join(workspacePath, 'deno.json')),
    fileExists(path.join(workspacePath, 'bun.lockb')),
    fileExists(path.join(workspacePath, 'yarn.lock')),
    fileExists(path.join(workspacePath, 'pnpm-lock.yaml')),
    fileExists(path.join(workspacePath, 'package-lock.json')),
  ]);

  const [
    hasPackageJson,
    hasTsConfig,
    hasPnpmWorkspace,
    hasLerna,
    hasNx,
    hasTurbo,
    hasRequirementsTxt,
    hasPyproject,
    hasGoMod,
    hasCargoToml,
    hasPomXml,
    hasGradle,
    hasCsproj,
    hasDenoJson,
    hasBunLock,
    hasYarnLock,
    hasPnpmLock,
    hasNpmLock,
  ] = checks.map(r => r.status === 'fulfilled' && r.value);

  // Detect package manager
  if (hasBunLock) {
    result.packageManager = 'bun';
  } else if (hasPnpmLock) {
    result.packageManager = 'pnpm';
  } else if (hasYarnLock) {
    result.packageManager = 'yarn';
  } else if (hasNpmLock) {
    result.packageManager = 'npm';
  }

  // Detect monorepo
  result.isMonorepo = !!(hasPnpmWorkspace || hasLerna || hasNx || hasTurbo);

  // Detect TypeScript
  result.hasTypeScript = !!hasTsConfig;

  // Detect language
  if (hasPackageJson) {
    result.language = hasTsConfig ? 'typescript' : 'javascript';
    result.languageConfidence = 'high';
    result.runtime = 'node';
    result.runtimeConfidence = 'high';

    // Check for Deno or Bun
    if (hasDenoJson) {
      result.runtime = 'deno';
    } else if (hasBunLock) {
      result.runtime = 'bun';
    }
  } else if (hasRequirementsTxt || hasPyproject) {
    result.language = 'python';
    result.languageConfidence = 'high';
  } else if (hasGoMod) {
    result.language = 'go';
    result.languageConfidence = 'high';
  } else if (hasCargoToml) {
    result.language = 'rust';
    result.languageConfidence = 'high';
  } else if (hasPomXml || hasGradle) {
    result.language = 'java';
    result.languageConfidence = 'high';
  } else if (hasCsproj) {
    result.language = 'csharp';
    result.languageConfidence = 'high';
  }

  return result;
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    // Handle glob patterns
    if (filePath.includes('*')) {
      const dir = path.dirname(filePath);
      const pattern = path.basename(filePath);
      const files = await fs.readdir(dir);
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return files.some(f => regex.test(f));
    }
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
