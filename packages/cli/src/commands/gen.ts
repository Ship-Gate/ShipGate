/**
 * Gen Command
 * 
 * Generate code from ISL specifications.
 * Usage: isl gen <target> <file>
 * 
 * Targets: ts (typescript), rust, go, openapi, python, graphql
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */

import '../modules.js';

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, relative, dirname, join, basename, extname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parse as parseISL, type Domain as DomainDeclaration, type Entity, type TypeDeclaration, type Behavior, type TypeDefinition } from '@isl-lang/parser';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';
import { loadConfig, type ISLConfig } from '../config.js';
import { findClosestMatch, formatCount } from '../utils.js';
import { withSpan, ISL_ATTR } from '@isl-lang/observability';
import { domainToPython, domainToGraphQL } from './gen-adapters.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GenerationTarget = 'ts' | 'typescript' | 'rust' | 'go' | 'openapi' | 'python' | 'graphql';

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

const VALID_TARGETS: GenerationTarget[] = ['ts', 'typescript', 'rust', 'go', 'openapi', 'python', 'graphql'];

/**
 * Normalize target name
 */
function normalizeTarget(target: string): GenerationTarget | null {
  const lower = target.toLowerCase();
  if (lower === 'ts' || lower === 'typescript') return 'typescript';
  if (lower === 'rust') return 'rust';
  if (lower === 'go' || lower === 'golang') return 'go';
  if (lower === 'openapi' || lower === 'swagger') return 'openapi';
  if (lower === 'python' || lower === 'py') return 'python';
  if (lower === 'graphql' || lower === 'gql') return 'graphql';
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
    case 'python':
      return '.py';
    case 'graphql':
      return '.graphql';
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
  const lines: string[] = [];
  
  lines.push('// Types generated from ISL specification');
  lines.push('');
  
  // Generate type aliases for custom types
  for (const type of domain.types) {
    const tsType = generateTypeDefinition(type.definition);
    lines.push(`export type ${type.name.name} = ${tsType};`);
    lines.push('');
  }
  
  // Generate interfaces for entities
  for (const entity of domain.entities) {
    lines.push(`export interface ${entity.name.name} {`);
    
    if (entity.fields) {
      for (const field of entity.fields) {
        const tsType = mapToTypeScriptType(field.type);
        const optional = field.optional ? '?' : '';
        lines.push(`  ${field.name.name}${optional}: ${tsType};`);
      }
    }
    
    lines.push('}');
    lines.push('');
  }
  
  // Generate function types for behaviors
  for (const behavior of domain.behaviors) {
    const inputParams = behavior.input?.fields?.map(i => 
      `${i.name.name}: ${mapToTypeScriptType(i.type)}`
    ).join(', ') ?? '';
    
    const outputType = behavior.output?.success 
      ? mapToTypeScriptType(behavior.output.success)
      : 'void';
    
    lines.push(`export type ${behavior.name.name}Fn = (${inputParams}) => Promise<${outputType}>;`);
    lines.push('');
    
    // Also generate an interface for the handler
    lines.push(`export interface ${behavior.name.name}Handler {`);
    lines.push(`  ${behavior.name.name[0].toLowerCase() + behavior.name.name.slice(1)}(${inputParams}): Promise<${outputType}>;`);
    lines.push('}');
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * Generate TypeScript type from ISL type definition
 */
function generateTypeDefinition(def: TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      return mapPrimitiveToTS(def.name);
    case 'EnumType':
      return def.variants.map(v => `'${v.name.name}'`).join(' | ');
    case 'StructType':
      const fields = def.fields.map(f => 
        `${f.name.name}${f.optional ? '?' : ''}: ${mapToTypeScriptType(f.type)}`
      ).join('; ');
      return `{ ${fields} }`;
    case 'ListType':
      return `${generateTypeDefinition(def.element)}[]`;
    case 'MapType':
      return `Record<${generateTypeDefinition(def.key)}, ${generateTypeDefinition(def.value)}>`;
    case 'OptionalType':
      return `${generateTypeDefinition(def.inner)} | null`;
    case 'UnionType':
      return def.variants.map(v => `'${v.name.name}'`).join(' | ');
    case 'ReferenceType':
      return def.name.parts.map(p => p.name).join('.');
    case 'ConstrainedType':
      return generateTypeDefinition(def.base);
    default:
      return 'unknown';
  }
}

/**
 * Extract type name from TypeDefinition
 */
function getTypeName(typeDef: TypeDefinition | undefined): string {
  if (!typeDef) return 'unknown';
  
  switch (typeDef.kind) {
    case 'PrimitiveType':
      return typeDef.name;
    case 'ReferenceType':
      return typeDef.name.parts.map(p => p.name).join('.');
    case 'EnumType':
    case 'StructType':
    case 'ListType':
    case 'MapType':
    case 'OptionalType':
    case 'UnionType':
    case 'ConstrainedType':
      // For complex types in schema references, we need a simple name
      // This is a limitation - in practice these should be defined as separate types
      return generateTypeDefinition(typeDef);
    default:
      return 'unknown';
  }
}

/**
 * Map ISL primitive to TypeScript type
 */
function mapPrimitiveToTS(name: string): string {
  const map: Record<string, string> = {
    'String': 'string',
    'Int': 'number',
    'Decimal': 'number',
    'Boolean': 'boolean',
    'Timestamp': 'Date',
    'UUID': 'string',
    'Duration': 'number',
  };
  return map[name] ?? 'unknown';
}

/**
 * Map ISL type reference to TypeScript
 */
function mapToTypeScriptType(typeRef: TypeDefinition | { name: string } | undefined | null): string {
  if (!typeRef) return 'unknown';
  
  // Handle TypeDefinition
  if ('kind' in typeRef) {
    return generateTypeDefinition(typeRef as TypeDefinition);
  }
  
  // Handle simple name reference
  if ('name' in typeRef && typeof typeRef.name === 'string') {
    const name = typeRef.name;
    const primitiveMap: Record<string, string> = {
      'String': 'string',
      'Int': 'number',
      'Integer': 'number',
      'Float': 'number',
      'Decimal': 'number',
      'Boolean': 'boolean',
      'Bool': 'boolean',
      'ID': 'string',
      'UUID': 'string',
      'DateTime': 'Date',
      'Timestamp': 'Date',
      'Date': 'string',
      'Time': 'string',
      'Void': 'void',
      'Any': 'unknown',
    };
    return primitiveMap[name] ?? name;
  }
  
  return 'unknown';
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
        const rustType = mapToRustType(getTypeName(field.type), field.optional);
        lines.push(`    pub ${toSnakeCase(field.name.name)}: ${rustType},`);
      }
    }
    
    lines.push('}');
    lines.push('');
  }
  
  // Generate traits for behaviors
  for (const behavior of domain.behaviors) {
    const inputs = behavior.input?.fields?.map(i => 
      `${toSnakeCase(i.name.name)}: ${mapToRustType(getTypeName(i.type), false)}`
    ).join(', ') ?? '';
    const outputType = mapToRustType(getTypeName(behavior.output?.success), false);
    
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
        const goType = mapToGoType(getTypeName(field.type), field.optional);
        const jsonTag = `json:"${field.name.name}"`;
        lines.push(`\t${toPascalCase(field.name.name)} ${goType} \`${jsonTag}\``);
      }
    }
    
    lines.push('}');
    lines.push('');
  }
  
  // Generate interfaces for behaviors
  for (const behavior of domain.behaviors) {
    const inputType = behavior.input?.fields?.length === 1 
      ? mapToGoType(getTypeName(behavior.input.fields[0].type), false)
      : 'interface{}';
    const outputType = mapToGoType(getTypeName(behavior.output?.success), false);
    
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
      description: `API specification for ${domain.name.name}`,
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
        properties[field.name.name] = mapToOpenAPIType(getTypeName(field.type));
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
        requestBody: behavior.input?.fields?.length ? {
          required: true,
          content: {
            'application/json': {
              schema: behavior.input.fields.length === 1
                ? { '$ref': `#/components/schemas/${getTypeName(behavior.input.fields[0].type)}` }
                : { type: 'object' },
            },
          },
        } : undefined,
        responses: {
          '200': {
            description: 'Success',
            content: behavior.output ? {
              'application/json': {
                schema: { '$ref': `#/components/schemas/${getTypeName(behavior.output.success)}` },
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
    const { domain: ast, errors: parseErrors } = await withSpan('codegen.parse', {
      attributes: { [ISL_ATTR.CODEGEN_SOURCE]: relative(process.cwd(), filePath) },
    }, async (parseSpan) => {
      const parsed = parseISL(source, filePath);
      parseSpan.setAttribute('isl.parse.error_count', parsed.errors.length);
      if (parsed.errors.length > 0) parseSpan.setError(parsed.errors.map(e => e.message).join('; '));
      return parsed;
    });
    
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
    
    await withSpan('codegen.emit', {
      attributes: { [ISL_ATTR.CODEGEN_TARGET]: normalizedTarget },
    }, async (emitSpan) => {
      // Handle multi-file generators (Python, GraphQL)
      if (normalizedTarget === 'python') {
        const { generateFiles } = await import('@isl-lang/codegen-python');
        const pythonDomain = domainToPython(ast);
        const generatedFiles = generateFiles(pythonDomain, {
          style: 'pydantic',
          generateTests: true,
          generateStubs: false,
        });
        
        for (const [filePath, content] of generatedFiles) {
          const fullPath = join(outputDir, 'python', filePath);
          await mkdir(dirname(fullPath), { recursive: true });
          
          const header = `# Auto-generated by ISL CLI\n# DO NOT EDIT - regenerate with: isl gen python ${relative(process.cwd(), filePath)}\n# Generated: ${new Date().toISOString()}\n\n`;
          await writeFile(fullPath, header + content);
          files.push({ path: fullPath, content, target: normalizedTarget });
        }
        
        emitSpan.setAttribute('isl.codegen.output_bytes', Array.from(generatedFiles.values()).join('').length);
        emitSpan.setAttribute('isl.codegen.file_count', generatedFiles.size);
        return;
      }
      
      if (normalizedTarget === 'graphql') {
        const { generateGraphQL } = await import('@isl-lang/codegen-graphql');
        const graphqlDomain = domainToGraphQL(ast);
        const generatedFiles = generateGraphQL(graphqlDomain, {
          outputDir: '.',
          generateResolvers: true,
          generateTypes: true,
        });
        
        for (const file of generatedFiles) {
          const fullPath = join(outputDir, 'graphql', file.path);
          await mkdir(dirname(fullPath), { recursive: true });
          
          const header = file.path.endsWith('.graphql')
            ? `# Auto-generated by ISL CLI\n# DO NOT EDIT - regenerate with: isl gen graphql ${relative(process.cwd(), filePath)}\n# Generated: ${new Date().toISOString()}\n\n`
            : `/**\n * Auto-generated by ISL CLI\n * DO NOT EDIT - regenerate with: isl gen graphql ${relative(process.cwd(), filePath)}\n * Generated: ${new Date().toISOString()}\n */\n\n`;
          
          await writeFile(fullPath, header + file.content);
          files.push({ path: fullPath, content: file.content, target: normalizedTarget });
        }
        
        emitSpan.setAttribute('isl.codegen.output_bytes', generatedFiles.reduce((sum: number, f: GeneratedFile) => sum + f.content.length, 0));
        emitSpan.setAttribute('isl.codegen.file_count', generatedFiles.length);
        return;
      }
      
      // Single-file generators
      let generated: string;
      switch (normalizedTarget) {
        case 'ts':
        case 'typescript':
          generated = generateTypeScript(ast);
          break;
        case 'rust':
          generated = generateRust(ast);
          break;
        case 'go':
          generated = generateGo(ast);
          break;
        case 'openapi':
          // Use OpenAPIGenerator for parser AST (entities, endpoints, constraints, actors)
          try {
            const { OpenAPIGenerator } = await import('@isl-lang/codegen-openapi');
            const generator = new OpenAPIGenerator({
              version: '3.1',
              format: 'yaml',
              defaultServers: true,
              addBearerAuth: true,
              addPaginationParams: true,
            });
            const files = generator.generate(ast);
            generated = files[0]?.content ?? generateOpenAPI(ast);
          } catch {
            generated = generateOpenAPI(ast);
          }
          break;
        default:
          throw new Error(`Generator not implemented for: ${normalizedTarget}`);
      }
      
      emitSpan.setAttribute('isl.codegen.output_bytes', generated.length);
      
      // Write file
      const domainName = ast.name.name.toLowerCase();
      const ext = getExtension(normalizedTarget);
      const outputPath = join(outputDir, normalizedTarget === 'typescript' ? 'ts' : normalizedTarget, `${domainName}${ext}`);
      
      await mkdir(dirname(outputPath), { recursive: true });
      
      // Add header comment
      const header = normalizedTarget === 'openapi' 
        ? `# Auto-generated by ISL CLI\n# DO NOT EDIT - regenerate with: isl gen ${normalizedTarget} ${relative(process.cwd(), filePath)}\n# Generated: ${new Date().toISOString()}\n\n`
        : `/**\n * Auto-generated by ISL CLI\n * DO NOT EDIT - regenerate with: isl gen ${normalizedTarget} ${relative(process.cwd(), filePath)}\n * Generated: ${new Date().toISOString()}\n */\n\n`;
      
      await writeFile(outputPath, header + generated);
      files.push({ path: outputPath, content: generated, target: normalizedTarget });
    });
    
    const duration = Date.now() - startTime;
    
    // Use the last generated file path for success message, or a generic message
    const lastGeneratedPath = files.length > 0 ? files[files.length - 1].path : `${outputDir}`;
    spinner?.succeed(`Generated ${relative(process.cwd(), lastGeneratedPath)} (${duration}ms)`);
    
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
