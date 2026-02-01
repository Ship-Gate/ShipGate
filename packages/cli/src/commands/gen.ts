/**
 * Gen Command
 * 
 * Generate code from ISL specifications.
 * Usage: isl gen <target> <file>
 * 
 * Targets: ts (typescript), rust, go, openapi
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, relative, dirname, join, basename, extname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parseISL, type DomainDeclaration } from '@intentos/isl-core';
import { compile, generateTypes, generateTests } from '@intentos/isl-compiler';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { loadConfig, type ISLConfig } from '../config.js';
import { findClosestMatch, formatCount } from '../utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GenerationTarget = 'ts' | 'typescript' | 'rust' | 'go' | 'openapi';

export interface GenOptions {
  /** Output directory */
  output?: string;
  /** Overwrite existing files */
  force?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
}

export interface GeneratedFile {
  path: string;
  content: string;
  target: GenerationTarget;
}

export interface GenResult {
  success: boolean;
  target: GenerationTarget;
  sourceFile: string;
  files: GeneratedFile[];
  errors: string[];
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Valid Targets
// ─────────────────────────────────────────────────────────────────────────────

const VALID_TARGETS: GenerationTarget[] = ['ts', 'typescript', 'rust', 'go', 'openapi'];

/**
 * Normalize target name
 */
function normalizeTarget(target: string): GenerationTarget | null {
  const lower = target.toLowerCase();
  if (lower === 'ts' || lower === 'typescript') return 'typescript';
  if (lower === 'rust') return 'rust';
  if (lower === 'go' || lower === 'golang') return 'go';
  if (lower === 'openapi' || lower === 'swagger') return 'openapi';
  return null;
}

/**
 * Get file extension for target
 */
function getExtension(target: GenerationTarget): string {
  switch (target) {
    case 'ts':
    case 'typescript':
      return '.ts';
    case 'rust':
      return '.rs';
    case 'go':
      return '.go';
    case 'openapi':
      return '.yaml';
    default:
      return '.txt';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Generators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate TypeScript code
 */
function generateTypeScript(domain: DomainDeclaration): string {
  const result = generateTypes(domain);
  return result.code;
}

/**
 * Generate Rust code
 */
function generateRust(domain: DomainDeclaration): string {
  const lines: string[] = [];
  
  lines.push('// Auto-generated from ISL specification');
  lines.push('// DO NOT EDIT MANUALLY');
  lines.push('');
  lines.push('use serde::{Deserialize, Serialize};');
  lines.push('');
  
  // Generate structs for entities
  for (const entity of domain.entities) {
    lines.push('#[derive(Debug, Clone, Serialize, Deserialize)]');
    lines.push(`pub struct ${entity.name.name} {`);
    
    if (entity.fields) {
      for (const field of entity.fields) {
        const rustType = mapToRustType(field.type?.name ?? 'unknown', field.optional);
        lines.push(`    pub ${toSnakeCase(field.name.name)}: ${rustType},`);
      }
    }
    
    lines.push('}');
    lines.push('');
  }
  
  // Generate traits for behaviors
  for (const behavior of domain.behaviors) {
    const inputs = behavior.inputs?.map(i => 
      `${toSnakeCase(i.name.name)}: ${mapToRustType(i.type?.name ?? 'unknown', false)}`
    ).join(', ') ?? '';
    const outputType = mapToRustType(behavior.output?.name ?? '()', false);
    
    lines.push(`pub trait ${behavior.name.name}Handler {`);
    lines.push(`    fn ${toSnakeCase(behavior.name.name)}(&self, ${inputs}) -> Result<${outputType}, Box<dyn std::error::Error>>;`);
    lines.push('}');
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Generate Go code
 */
function generateGo(domain: DomainDeclaration): string {
  const lines: string[] = [];
  const packageName = domain.name.name.toLowerCase();
  
  lines.push('// Auto-generated from ISL specification');
  lines.push('// DO NOT EDIT MANUALLY');
  lines.push('');
  lines.push(`package ${packageName}`);
  lines.push('');
  lines.push('import (');
  lines.push('\t"time"');
  lines.push(')');
  lines.push('');
  
  // Generate structs for entities
  for (const entity of domain.entities) {
    lines.push(`type ${entity.name.name} struct {`);
    
    if (entity.fields) {
      for (const field of entity.fields) {
        const goType = mapToGoType(field.type?.name ?? 'unknown', field.optional);
        const jsonTag = `json:"${field.name.name}"`;
        lines.push(`\t${toPascalCase(field.name.name)} ${goType} \`${jsonTag}\``);
      }
    }
    
    lines.push('}');
    lines.push('');
  }
  
  // Generate interfaces for behaviors
  for (const behavior of domain.behaviors) {
    const inputType = behavior.inputs?.length === 1 
      ? mapToGoType(behavior.inputs[0].type?.name ?? 'interface{}', false)
      : 'interface{}';
    const outputType = mapToGoType(behavior.output?.name ?? 'interface{}', false);
    
    lines.push(`type ${behavior.name.name}Handler interface {`);
    lines.push(`\t${behavior.name.name}(input ${inputType}) (${outputType}, error)`);
    lines.push('}');
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Generate OpenAPI spec
 */
function generateOpenAPI(domain: DomainDeclaration): string {
  const spec: Record<string, unknown> = {
    openapi: '3.0.3',
    info: {
      title: `${domain.name.name} API`,
      version: '1.0.0',
      description: domain.description ?? `API specification for ${domain.name.name}`,
    },
    paths: {},
    components: {
      schemas: {} as Record<string, unknown>,
    },
  };
  
  const schemas = spec.components as { schemas: Record<string, unknown> };
  
  // Generate schemas for entities
  for (const entity of domain.entities) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    
    if (entity.fields) {
      for (const field of entity.fields) {
        properties[field.name.name] = mapToOpenAPIType(field.type?.name ?? 'string');
        if (!field.optional) {
          required.push(field.name.name);
        }
      }
    }
    
    schemas.schemas[entity.name.name] = {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }
  
  // Generate paths for behaviors
  const paths = spec.paths as Record<string, unknown>;
  for (const behavior of domain.behaviors) {
    const pathName = `/${toKebabCase(behavior.name.name)}`;
    
    paths[pathName] = {
      post: {
        operationId: behavior.name.name,
        summary: behavior.name.name,
        requestBody: behavior.inputs?.length ? {
          required: true,
          content: {
            'application/json': {
              schema: behavior.inputs.length === 1
                ? { '$ref': `#/components/schemas/${behavior.inputs[0].type?.name}` }
                : { type: 'object' },
            },
          },
        } : undefined,
        responses: {
          '200': {
            description: 'Success',
            content: behavior.output ? {
              'application/json': {
                schema: { '$ref': `#/components/schemas/${behavior.output.name}` },
              },
            } : undefined,
          },
        },
      },
    };
  }
  
  return toYAML(spec);
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Mapping Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapToRustType(islType: string, optional?: boolean): string {
  const typeMap: Record<string, string> = {
    'String': 'String',
    'Integer': 'i64',
    'Float': 'f64',
    'Boolean': 'bool',
    'ID': 'String',
    'DateTime': 'chrono::DateTime<chrono::Utc>',
  };
  const rustType = typeMap[islType] ?? islType;
  return optional ? `Option<${rustType}>` : rustType;
}

function mapToGoType(islType: string, optional?: boolean): string {
  const typeMap: Record<string, string> = {
    'String': 'string',
    'Integer': 'int64',
    'Float': 'float64',
    'Boolean': 'bool',
    'ID': 'string',
    'DateTime': 'time.Time',
  };
  const goType = typeMap[islType] ?? islType;
  return optional ? `*${goType}` : goType;
}

function mapToOpenAPIType(islType: string): Record<string, unknown> {
  const typeMap: Record<string, Record<string, unknown>> = {
    'String': { type: 'string' },
    'Integer': { type: 'integer', format: 'int64' },
    'Float': { type: 'number', format: 'double' },
    'Boolean': { type: 'boolean' },
    'ID': { type: 'string' },
    'DateTime': { type: 'string', format: 'date-time' },
  };
  return typeMap[islType] ?? { '$ref': `#/components/schemas/${islType}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// String Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function toPascalCase(str: string): string {
  return str.replace(/(?:^|_)([a-z])/g, (_, c) => c.toUpperCase());
}

function toKebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

function toYAML(obj: unknown, indent = 0): string {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);
  
  if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === 'object') {
          lines.push(`${prefix}-`);
          lines.push(toYAML(item, indent + 1));
        } else {
          lines.push(`${prefix}- ${item}`);
        }
      }
    } else {
      for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) continue;
        if (typeof value === 'object' && value !== null) {
          lines.push(`${prefix}${key}:`);
          lines.push(toYAML(value, indent + 1));
        } else {
          lines.push(`${prefix}${key}: ${JSON.stringify(value)}`);
        }
      }
    }
  }
  
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Gen Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate code from an ISL file
 */
export async function gen(target: string, file: string, options: GenOptions = {}): Promise<GenResult> {
  const startTime = Date.now();
  const spinner = options.format !== 'json' ? ora('Loading configuration...').start() : null;
  
  // Normalize and validate target
  const normalizedTarget = normalizeTarget(target);
  if (!normalizedTarget) {
    spinner?.fail(`Unknown target: ${target}`);
    
    const suggestion = findClosestMatch(target, VALID_TARGETS);
    if (suggestion) {
      console.log(chalk.gray(`Did you mean: ${suggestion}?`));
    }
    console.log(chalk.gray(`Valid targets: ${VALID_TARGETS.join(', ')}`));
    
    return {
      success: false,
      target: target as GenerationTarget,
      sourceFile: file,
      files: [],
      errors: [`Unknown target: ${target}. Valid targets: ${VALID_TARGETS.join(', ')}`],
      duration: Date.now() - startTime,
    };
  }
  
  // Load config
  const { config } = await loadConfig();
  const outputDir = resolve(options.output ?? config?.output?.dir ?? './generated');
  const filePath = resolve(file);
  
  const files: GeneratedFile[] = [];
  const errors: string[] = [];
  
  try {
    // Parse ISL file
    spinner && (spinner.text = 'Parsing ISL file...');
    const source = await readFile(filePath, 'utf-8');
    const { ast, errors: parseErrors } = parseISL(source, filePath);
    
    if (parseErrors.length > 0 || !ast) {
      spinner?.fail('Parse failed');
      return {
        success: false,
        target: normalizedTarget,
        sourceFile: filePath,
        files: [],
        errors: parseErrors.map(e => `${filePath}: ${e.message}`),
        duration: Date.now() - startTime,
      };
    }
    
    // Generate code
    spinner && (spinner.text = `Generating ${normalizedTarget} code...`);
    
    let content: string;
    switch (normalizedTarget) {
      case 'ts':
      case 'typescript':
        content = generateTypeScript(ast);
        break;
      case 'rust':
        content = generateRust(ast);
        break;
      case 'go':
        content = generateGo(ast);
        break;
      case 'openapi':
        content = generateOpenAPI(ast);
        break;
      default:
        throw new Error(`Generator not implemented for: ${normalizedTarget}`);
    }
    
    // Write file
    const domainName = ast.name.name.toLowerCase();
    const ext = getExtension(normalizedTarget);
    const outputPath = join(outputDir, normalizedTarget === 'typescript' ? 'ts' : normalizedTarget, `${domainName}${ext}`);
    
    await mkdir(dirname(outputPath), { recursive: true });
    
    // Add header comment
    const header = normalizedTarget === 'openapi' 
      ? `# Auto-generated by ISL CLI\n# DO NOT EDIT - regenerate with: isl gen ${normalizedTarget} ${relative(process.cwd(), filePath)}\n# Generated: ${new Date().toISOString()}\n\n`
      : `/**\n * Auto-generated by ISL CLI\n * DO NOT EDIT - regenerate with: isl gen ${normalizedTarget} ${relative(process.cwd(), filePath)}\n * Generated: ${new Date().toISOString()}\n */\n\n`;
    
    await writeFile(outputPath, header + content);
    files.push({ path: outputPath, content, target: normalizedTarget });
    
    const duration = Date.now() - startTime;
    spinner?.succeed(`Generated ${relative(process.cwd(), outputPath)} (${duration}ms)`);
    
    return {
      success: true,
      target: normalizedTarget,
      sourceFile: filePath,
      files,
      errors,
      duration,
    };
  } catch (err) {
    spinner?.fail('Generation failed');
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(errorMsg);
    
    return {
      success: false,
      target: normalizedTarget,
      sourceFile: filePath,
      files,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print gen results to console
 */
export function printGenResult(result: GenResult, options?: GenOptions): void {
  // JSON output
  if (options?.format === 'json') {
    console.log(JSON.stringify({
      success: result.success,
      target: result.target,
      sourceFile: result.sourceFile,
      files: result.files.map(f => ({
        path: f.path,
        target: f.target,
      })),
      errors: result.errors,
      duration: result.duration,
    }, null, 2));
    return;
  }
  
  // Quiet output
  if (options?.format === 'quiet') {
    if (!result.success) {
      for (const err of result.errors) {
        console.error(err);
      }
    }
    return;
  }
  
  console.log('');
  
  if (result.success) {
    console.log(chalk.bold('Generated files:'));
    for (const file of result.files) {
      output.filePath(relative(process.cwd(), file.path), 'created');
    }
    console.log('');
    console.log(chalk.green(`✓ Generated ${formatCount(result.files.length, 'file')}`));
  } else {
    console.log(chalk.red('✗ Generation failed'));
    console.log('');
    for (const error of result.errors) {
      console.log(chalk.red(`  ${error}`));
    }
  }
  
  console.log(chalk.gray(`  Completed in ${result.duration}ms`));
}

/**
 * Get exit code for gen result
 */
export function getGenExitCode(result: GenResult): number {
  if (result.success) return ExitCode.SUCCESS;
  
  // Check if it's a usage error (bad target)
  if (result.errors.some(e => e.includes('Unknown target'))) {
    return ExitCode.USAGE_ERROR;
  }
  
  return ExitCode.ISL_ERROR;
}

export { VALID_TARGETS };
export default gen;
