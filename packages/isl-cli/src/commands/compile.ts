/**
 * Compile Command
 * 
 * Compiles ISL to TypeScript types and tests.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname, basename } from 'path';
import chalk from 'chalk';
import { parseISL } from '@isl-lang/isl-core';
import { compile as compileISL } from '@isl-lang/isl-compiler';

export interface CompileOptions {
  output?: string;
  types?: boolean;
  tests?: boolean;
}

export interface CompileResult {
  success: boolean;
  files: string[];
  errors: string[];
}

export async function compile(filePath: string, options: CompileOptions = {}): Promise<CompileResult> {
  const errors: string[] = [];
  const files: string[] = [];

  try {
    // Read and parse
    const source = await readFile(filePath, 'utf-8');
    const { ast, errors: parseErrors } = parseISL(source, filePath);

    if (parseErrors.length > 0 || !ast) {
      return {
        success: false,
        files: [],
        errors: parseErrors.map(e => 'message' in e ? e.message : String(e)),
      };
    }

    // Determine output directory
    const outputDir = options.output ?? dirname(filePath);
    await mkdir(outputDir, { recursive: true });

    // Compile
    const result = compileISL(ast, {
      types: { includeValidation: true, includeComments: true },
      tests: { framework: 'vitest', generateMocks: true },
    });

    // Write types
    if (options.types !== false) {
      const typesPath = join(outputDir, result.types.filename);
      await writeFile(typesPath, result.types.content);
      files.push(typesPath);
    }

    // Write tests
    if (options.tests !== false) {
      const testsPath = join(outputDir, result.tests.filename);
      await writeFile(testsPath, result.tests.content);
      files.push(testsPath);
    }

    return { success: true, files, errors };
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    } else {
      errors.push(String(error));
    }
    return { success: false, files, errors };
  }
}

export function printCompileResult(result: CompileResult): void {
  if (result.success) {
    console.log(chalk.green('✓') + ' Compilation successful');
    for (const file of result.files) {
      console.log(chalk.gray(`  → ${file}`));
    }
  } else {
    console.log(chalk.red('✗') + ' Compilation failed');
    for (const error of result.errors) {
      console.log(chalk.red(`  Error: ${error}`));
    }
  }
}
