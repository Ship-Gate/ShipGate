/**
 * Action Input Parser
 * 
 * Parses and validates GitHub Action inputs.
 */

import * as core from '@actions/core';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface ActionInputs {
  /** Glob pattern for ISL spec files */
  specs: string;
  /** Path to implementation file */
  implementation: string;
  /** Only run syntax/type checking */
  checkOnly: boolean;
  /** Fail if warnings are found */
  failOnWarning: boolean;
  /** Minimum score to pass (0-100) */
  failThreshold: number;
  /** Generate TypeScript types */
  generateTypes: boolean;
  /** Generate test files */
  generateTests: boolean;
  /** Upload proof bundles */
  uploadProofs: boolean;
  /** Working directory */
  workingDirectory: string;
  /** Node.js version */
  nodeVersion: string;
}

// ============================================================================
// Input Parser
// ============================================================================

/**
 * Parse and validate action inputs
 */
export function parseInputs(): ActionInputs {
  const specs = core.getInput('specs', { required: true });
  const implementation = core.getInput('implementation');
  const checkOnly = core.getBooleanInput('check-only');
  const failOnWarning = core.getBooleanInput('fail-on-warning');
  const failThresholdStr = core.getInput('fail-threshold');
  const generateTypes = core.getBooleanInput('generate-types');
  const generateTests = core.getBooleanInput('generate-tests');
  const uploadProofs = core.getBooleanInput('upload-proofs');
  const workingDirectory = core.getInput('working-directory') || '.';
  const nodeVersion = core.getInput('node-version') || '20';

  // Parse fail threshold
  let failThreshold = 0;
  if (failThresholdStr) {
    failThreshold = parseInt(failThresholdStr, 10);
    if (isNaN(failThreshold) || failThreshold < 0 || failThreshold > 100) {
      core.warning(`Invalid fail-threshold "${failThresholdStr}", using 0`);
      failThreshold = 0;
    }
  }

  // Validate specs pattern
  if (!specs) {
    throw new Error('Input "specs" is required');
  }

  // Resolve working directory
  const resolvedWorkingDir = path.resolve(process.cwd(), workingDirectory);

  // Log parsed inputs
  core.debug('Parsed inputs:');
  core.debug(`  specs: ${specs}`);
  core.debug(`  implementation: ${implementation || '(none)'}`);
  core.debug(`  checkOnly: ${checkOnly}`);
  core.debug(`  failOnWarning: ${failOnWarning}`);
  core.debug(`  failThreshold: ${failThreshold}`);
  core.debug(`  generateTypes: ${generateTypes}`);
  core.debug(`  generateTests: ${generateTests}`);
  core.debug(`  uploadProofs: ${uploadProofs}`);
  core.debug(`  workingDirectory: ${resolvedWorkingDir}`);

  return {
    specs,
    implementation,
    checkOnly,
    failOnWarning,
    failThreshold,
    generateTypes,
    generateTests,
    uploadProofs,
    workingDirectory: resolvedWorkingDir,
    nodeVersion,
  };
}

/**
 * Get input with a default value
 */
export function getInputWithDefault(name: string, defaultValue: string): string {
  const value = core.getInput(name);
  return value || defaultValue;
}

/**
 * Parse a boolean input with default
 */
export function getBooleanInputWithDefault(name: string, defaultValue: boolean): boolean {
  const value = core.getInput(name);
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

/**
 * Validate that a file path exists
 */
export async function validateFilePath(filePath: string, description: string): Promise<void> {
  const fs = await import('fs/promises');
  
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${description} not found: ${filePath}`);
  }
}

/**
 * Resolve a path relative to the working directory
 */
export function resolvePath(inputPath: string, workingDir: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(workingDir, inputPath);
}
