/**
 * ISL Checker
 * 
 * Runs ISL syntax and type checking on specification files.
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import * as path from 'path';

import type { ActionInputs } from './inputs.js';
import type { Diagnostic } from './reporter.js';

// ============================================================================
// Types
// ============================================================================

export interface CheckResult {
  /** List of errors found */
  errors: Diagnostic[];
  /** List of warnings found */
  warnings: Diagnostic[];
  /** Number of spec files checked */
  specsChecked: number;
  /** List of spec files checked */
  specFiles: string[];
  /** Check passed without errors */
  success: boolean;
}

interface ISLCheckOutput {
  errors: ISLDiagnostic[];
  warnings: ISLDiagnostic[];
  specsChecked: number;
}

interface ISLDiagnostic {
  code: string;
  message: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: 'error' | 'warning' | 'info';
}

// ============================================================================
// ISL Checker
// ============================================================================

export class ISLChecker {
  private inputs: ActionInputs;

  constructor(inputs: ActionInputs) {
    this.inputs = inputs;
  }

  /**
   * Run ISL check on all spec files
   */
  async check(): Promise<CheckResult> {
    const specFiles = await this.findSpecFiles();

    if (specFiles.length === 0) {
      core.warning(`No ISL spec files found matching pattern: ${this.inputs.specs}`);
      return {
        errors: [],
        warnings: [],
        specsChecked: 0,
        specFiles: [],
        success: true,
      };
    }

    core.info(`Found ${specFiles.length} ISL spec files`);

    const errors: Diagnostic[] = [];
    const warnings: Diagnostic[] = [];

    // Check each spec file
    for (const specFile of specFiles) {
      core.debug(`Checking: ${specFile}`);
      
      try {
        const result = await this.checkFile(specFile);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({
          code: 'ISL000',
          message: `Failed to check file: ${message}`,
          file: specFile,
          line: 1,
          column: 1,
          severity: 'error',
        });
      }
    }

    return {
      errors,
      warnings,
      specsChecked: specFiles.length,
      specFiles,
      success: errors.length === 0,
    };
  }

  /**
   * Find all spec files matching the glob pattern
   */
  private async findSpecFiles(): Promise<string[]> {
    const pattern = path.join(this.inputs.workingDirectory, this.inputs.specs);
    core.debug(`Searching for specs with pattern: ${pattern}`);

    const globber = await glob.create(pattern, {
      followSymbolicLinks: false,
    });

    const files = await globber.glob();
    
    // Filter to only .isl files
    return files.filter(f => f.endsWith('.isl'));
  }

  /**
   * Check a single spec file
   */
  private async checkFile(specFile: string): Promise<{ errors: Diagnostic[]; warnings: Diagnostic[] }> {
    const errors: Diagnostic[] = [];
    const warnings: Diagnostic[] = [];

    let output = '';
    let errorOutput = '';

    const options: exec.ExecOptions = {
      cwd: this.inputs.workingDirectory,
      silent: true,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
        stderr: (data: Buffer) => {
          errorOutput += data.toString();
        },
      },
    };

    // Run isl check command
    const exitCode = await exec.exec(
      'npx',
      ['isl', 'check', specFile, '--format', 'json'],
      options
    );

    // Parse output
    if (output) {
      try {
        const parsed = JSON.parse(output) as ISLCheckOutput;
        
        for (const diag of parsed.errors) {
          errors.push(this.convertDiagnostic(diag, specFile));
        }
        
        for (const diag of parsed.warnings) {
          warnings.push(this.convertDiagnostic(diag, specFile));
        }
      } catch {
        // If JSON parsing fails, treat output as plain text error
        if (exitCode !== 0) {
          errors.push({
            code: 'ISL000',
            message: output || errorOutput || 'Unknown error',
            file: specFile,
            line: 1,
            column: 1,
            severity: 'error',
          });
        }
      }
    } else if (exitCode !== 0) {
      errors.push({
        code: 'ISL000',
        message: errorOutput || 'Check failed with no output',
        file: specFile,
        line: 1,
        column: 1,
        severity: 'error',
      });
    }

    return { errors, warnings };
  }

  /**
   * Convert ISL diagnostic to our format
   */
  private convertDiagnostic(diag: ISLDiagnostic, defaultFile: string): Diagnostic {
    return {
      code: diag.code,
      message: diag.message,
      file: diag.file || defaultFile,
      line: diag.line,
      column: diag.column,
      endLine: diag.endLine,
      endColumn: diag.endColumn,
      severity: diag.severity,
    };
  }

  /**
   * Run type generation if enabled
   */
  async generateTypes(specFiles: string[]): Promise<void> {
    if (!this.inputs.generateTypes) {
      return;
    }

    core.info('Generating TypeScript types...');

    for (const specFile of specFiles) {
      const options: exec.ExecOptions = {
        cwd: this.inputs.workingDirectory,
        silent: false,
      };

      await exec.exec(
        'npx',
        ['isl', 'generate', specFile, '--output', 'types', '--language', 'typescript'],
        options
      );
    }
  }

  /**
   * Run test generation if enabled
   */
  async generateTests(specFiles: string[]): Promise<void> {
    if (!this.inputs.generateTests) {
      return;
    }

    core.info('Generating test files...');

    for (const specFile of specFiles) {
      const options: exec.ExecOptions = {
        cwd: this.inputs.workingDirectory,
        silent: false,
      };

      await exec.exec(
        'npx',
        ['isl', 'generate', specFile, '--output', 'tests'],
        options
      );
    }
  }
}
