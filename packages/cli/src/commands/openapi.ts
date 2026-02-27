/**
 * OpenAPI CLI Commands
 *
 * Usage:
 *   isl openapi generate [file]     → outputs openapi.json
 *   isl openapi validate <file>     → validates spec with swagger-parser
 *   isl openapi diff <old> <new>    → shows changes between two specs
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, dirname, relative } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL } from '@isl-lang/parser';
import { OpenAPIGenerator } from '@isl-lang/codegen-openapi';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenAPIGenerateOptions {
  /** Input ISL file (or use config include) */
  file?: string;
  /** Output path (default: openapi.json) */
  output?: string;
  /** Output format: json or yaml */
  format?: 'json' | 'yaml';
  /** Verbose output */
  verbose?: boolean;
}

export interface OpenAPIGenerateResult {
  success: boolean;
  inputFile: string;
  outputFile: string;
  errors: string[];
  duration: number;
}

export interface OpenAPIValidateOptions {
  /** OpenAPI spec file to validate */
  file: string;
  /** Verbose output */
  verbose?: boolean;
}

export interface OpenAPIValidateResult {
  success: boolean;
  file: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate OpenAPI spec from ISL file
 */
export async function openapiGenerate(
  file: string,
  options: OpenAPIGenerateOptions = {}
): Promise<OpenAPIGenerateResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const outputPath = options.output ?? 'openapi.json';
  const format = options.format ?? (outputPath.endsWith('.yaml') ? 'yaml' : 'json');

  try {
    const filePath = resolve(file);
    const source = await readFile(filePath, 'utf-8');
    const { domain: ast, errors: parseErrors } = parseISL(source, filePath);

    if (parseErrors.length > 0 || !ast) {
      return {
        success: false,
        inputFile: filePath,
        outputFile: '',
        errors: parseErrors.map((e) => e.message),
        duration: Date.now() - startTime,
      };
    }

    const generator = new OpenAPIGenerator({
      version: '3.1',
      format,
      defaultServers: true,
      addBearerAuth: true,
      addPaginationParams: true,
    });

    const files = generator.generate(ast);
    const content = files[0]?.content;

    if (!content) {
      return {
        success: false,
        inputFile: filePath,
        outputFile: '',
        errors: ['No content generated'],
        duration: Date.now() - startTime,
      };
    }

    const outPath = resolve(outputPath);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, content);

    return {
      success: true,
      inputFile: filePath,
      outputFile: outPath,
      errors: [],
      duration: Date.now() - startTime,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return {
      success: false,
      inputFile: resolve(file),
      outputFile: '',
      errors,
      duration: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate Command
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate OpenAPI spec using @apidevtools/swagger-parser
 */
export async function openapiValidate(
  file: string,
  options: Omit<OpenAPIValidateOptions, 'file'> = {}
): Promise<OpenAPIValidateResult> {
  const startTime = Date.now();
  const filePath = resolve(file);

  try {
    const SwaggerParser = (await import('@apidevtools/swagger-parser')).default;
    const content = await readFile(filePath, 'utf-8');

    let spec: object;
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      const YAML = await import('yaml');
      spec = YAML.parse(content);
    } else {
      spec = JSON.parse(content);
    }

    await SwaggerParser.validate(spec as unknown as Parameters<typeof SwaggerParser.validate>[0]);

    return {
      success: true,
      file: filePath,
      valid: true,
      errors: [],
      warnings: [],
      duration: Date.now() - startTime,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      file: filePath,
      valid: false,
      errors: [message],
      warnings: [],
      duration: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Print Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function printOpenAPIGenerateResult(
  result: OpenAPIGenerateResult,
  options?: { format?: string }
): void {
  if (options?.format === 'json') {
    console.log(
      JSON.stringify(
        {
          success: result.success,
          inputFile: result.inputFile,
          outputFile: result.outputFile,
          errors: result.errors,
          duration: result.duration,
        },
        null,
        2
      )
    );
    return;
  }

  if (result.success) {
    output.success(`Generated ${relative(process.cwd(), result.outputFile)}`);
    output.info(`Completed in ${result.duration}ms`);
  } else {
    output.error('OpenAPI generation failed');
    for (const err of result.errors) {
      output.error(`  ${err}`);
    }
  }
}

export function printOpenAPIValidateResult(
  result: OpenAPIValidateResult,
  options?: { format?: string }
): void {
  if (options?.format === 'json') {
    console.log(
      JSON.stringify(
        {
          success: result.success,
          file: result.file,
          valid: result.valid,
          errors: result.errors,
          warnings: result.warnings,
          duration: result.duration,
        },
        null,
        2
      )
    );
    return;
  }

  if (result.success && result.valid) {
    output.success(`Valid OpenAPI spec: ${relative(process.cwd(), result.file)}`);
  } else {
    output.error(`Invalid: ${relative(process.cwd(), result.file)}`);
    for (const err of result.errors) {
      output.error(`  ${err}`);
    }
  }
  output.info(`Completed in ${result.duration}ms`);
}

export function getOpenAPIGenerateExitCode(result: OpenAPIGenerateResult): number {
  return result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR;
}

export function getOpenAPIValidateExitCode(result: OpenAPIValidateResult): number {
  return result.success ? ExitCode.SUCCESS : ExitCode.ISL_ERROR;
}
