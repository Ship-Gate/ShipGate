// ============================================================================
// Execution Verifier
// Runs generated tests in a temporary workspace to verify they work
// ============================================================================

import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { GeneratedFile } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface VerificationOptions {
  /** Temporary directory for test execution */
  tempDir?: string;
  /** Test framework to use */
  framework?: 'vitest' | 'jest';
  /** Timeout in milliseconds */
  timeout?: number;
  /** Skip execution (just verify files are valid) */
  skipExecution?: boolean;
}

export interface VerificationResult {
  success: boolean;
  errors: string[];
  output?: string;
}

// ============================================================================
// EXECUTION VERIFIER
// ============================================================================

/**
 * Verify generated tests by running them in a temp workspace
 */
export async function verifyGeneratedTests(
  files: GeneratedFile[],
  options: VerificationOptions = {}
): Promise<VerificationResult> {
  const {
    tempDir = join(process.cwd(), '.test-temp'),
    framework = 'vitest',
    timeout = 30000,
    skipExecution = false,
  } = options;

  const errors: string[] = [];

  try {
    // Create temp directory
    mkdirSync(tempDir, { recursive: true });

    // Write all files
    for (const file of files) {
      const filePath = join(tempDir, file.path);
      const dir = require('path').dirname(filePath);
      mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, file.content, 'utf-8');
    }

    // Create package.json if needed
    const packageJsonPath = join(tempDir, 'package.json');
    if (!require('fs').existsSync(packageJsonPath)) {
      writeFileSync(
        packageJsonPath,
        JSON.stringify({
          name: 'test-verification',
          version: '1.0.0',
          type: 'module',
          scripts: {
            test: framework === 'vitest' ? 'vitest run' : 'jest',
          },
          devDependencies: {
            [framework]: '^1.0.0',
            typescript: '^5.0.0',
            '@types/node': '^20.0.0',
          },
        }, null, 2),
        'utf-8'
      );
    }

    // Create tsconfig.json if needed
    const tsconfigPath = join(tempDir, 'tsconfig.json');
    if (!require('fs').existsSync(tsconfigPath)) {
      writeFileSync(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            moduleResolution: 'node',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
          },
        }, null, 2),
        'utf-8'
      );
    }

    if (skipExecution) {
      return {
        success: true,
        errors: [],
        output: 'Skipped execution verification',
      };
    }

    // Install dependencies (if needed)
    try {
      execSync('pnpm install', { cwd: tempDir, stdio: 'pipe', timeout: 60000 });
    } catch (error) {
      // Ignore install errors, might already be installed
    }

    // Run tests
    try {
      const output = execSync('pnpm test', {
        cwd: tempDir,
        encoding: 'utf-8',
        timeout,
        stdio: 'pipe',
      });

      return {
        success: true,
        errors: [],
        output,
      };
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; message?: string };
      errors.push(execError.message || 'Test execution failed');
      
      return {
        success: false,
        errors,
        output: execError.stdout || execError.stderr || '',
      };
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      success: false,
      errors,
    };
  } finally {
    // Cleanup temp directory (optional, comment out for debugging)
    // rmSync(tempDir, { recursive: true, force: true });
  }
}
