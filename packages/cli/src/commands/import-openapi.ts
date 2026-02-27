/**
 * Import OpenAPI Command
 * 
 * Converts OpenAPI 3.x specifications to ISL domain specifications.
 * Usage: shipgate import openapi <file> [-o output.isl]
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, dirname, extname, basename } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import * as YAML from 'yaml';
import type { OpenAPISpec, OpenAPISchema, OpenAPIOperation, OpenAPIParameter } from '@isl-lang/codegen-openapi';
import { output } from '../output.js';
import { ExitCode } from '../exit-codes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportOpenAPIOptions {
  /** Output file path */
  output?: string;
  /** Domain name override */
  domainName?: string;
  /** Overwrite existing files */
  force?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Output format */
  format?: 'pretty' | 'json' | 'quiet';
}

export interface ImportOpenAPIResult {
  success: boolean;
  inputFile: string;
  outputFile: string;
  domainName: string;
  entities: number;
  behaviors: number;
  types: number;
  errors: string[];
  warnings: string[];
  duration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Import Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Import OpenAPI spec and convert to ISL
 */
export async function importOpenAPI(
  file: string,
  options: ImportOpenAPIOptions = {}
): Promise<ImportOpenAPIResult> {
  const startTime = Date.now();
  const spinner = options.format !== 'json' ? ora('Loading OpenAPI spec...').start() : null;
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Read and parse OpenAPI file
    spinner && (spinner.text = 'Parsing OpenAPI file...');
    const filePath = resolve(file);
    const content = await readFile(filePath, 'utf-8');
    
    const spec = parseOpenAPIContent(content, filePath);
    if (!spec) {
      spinner?.fail('Failed to parse OpenAPI spec');
      return {
        success: false,
        inputFile: filePath,
        outputFile: '',
        domainName: '',
        entities: 0,
        behaviors: 0,
        types: 0,
        errors: ['Failed to parse OpenAPI spec'],
        warnings: [],
        duration: Date.now() - startTime,
      };
    }

    // Generate ISL code
    spinner && (spinner.text = 'Generating ISL specification...');
    const domainName = options.domainName || inferDomainName(spec);
    const islCode = generateISLFromOpenAPI(spec, domainName, warnings);

    // Determine output path
    const outputPath = options.output 
      ? resolve(options.output)
      : resolve(dirname(filePath), `${basename(filePath, extname(filePath))}.isl`);

    // Write output
    spinner && (spinner.text = 'Writing ISL file...');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, islCode, 'utf-8');

    const duration = Date.now() - startTime;
    spinner?.succeed(`Generated ${outputPath} (${duration}ms)`);

    // Count generated items
    const entityCount = (islCode.match(/^\s*entity\s+\w+/gm) || []).length;
    const behaviorCount = (islCode.match(/^\s*behavior\s+\w+/gm) || []).length;
    const typeCount = (islCode.match(/^\s*type\s+\w+/gm) || []).length;

    return {
      success: true,
      inputFile: filePath,
      outputFile: outputPath,
      domainName,
      entities: entityCount,
      behaviors: behaviorCount,
      types: typeCount,
      errors,
      warnings,
      duration,
    };
  } catch (err) {
    spinner?.fail('Import failed');
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(errorMsg);

    return {
      success: false,
      inputFile: file,
      outputFile: '',
      domainName: '',
      entities: 0,
      behaviors: 0,
      types: 0,
      errors,
      warnings,
      duration: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse OpenAPI content (JSON or YAML)
 */
function parseOpenAPIContent(content: string, filePath: string): OpenAPISpec | null {
  try {
    // Try JSON first
    return JSON.parse(content) as OpenAPISpec;
  } catch {
    // Try YAML
    try {
      return YAML.parse(content) as OpenAPISpec;
    } catch (err) {
      console.error(chalk.red(`Failed to parse ${filePath}: ${err instanceof Error ? err.message : String(err)}`));
      return null;
    }
  }
}

/**
 * Infer domain name from OpenAPI spec
 */
function inferDomainName(spec: OpenAPISpec): string {
  const title = spec.info?.title || 'API';
  // Convert "User Service API" -> "UserService"
  return title
    .replace(/\s+(API|Service|REST|GraphQL)/gi, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/^[a-z]/, (c) => c.toUpperCase()) || 'Api';
}

// ─────────────────────────────────────────────────────────────────────────────
// ISL Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate ISL code from OpenAPI spec
 */
function generateISLFromOpenAPI(
  spec: OpenAPISpec,
  domainName: string,
  warnings: string[]
): string {
  const lines: string[] = [];
  
  // Domain header
  lines.push(`domain ${domainName} {`);
  lines.push(`  version: "${spec.info?.version || '1.0.0'}"`);
  if (spec.info?.description) {
    lines.push(`  # ${spec.info.description.split('\n')[0]}`);
  }
  lines.push('');

  // Extract schemas and convert to types/entities
  const schemas = spec.components?.schemas || {};
  const schemaNames = Object.keys(schemas);
  
  // Separate enums, types, and entities
  const enums: Array<{ name: string; values: string[] }> = [];
  const types: Array<{ name: string; schema: OpenAPISchema }> = [];
  const entities: Array<{ name: string; schema: OpenAPISchema }> = [];

  for (const [name, schema] of Object.entries(schemas)) {
    if (schema.enum && Array.isArray(schema.enum)) {
      enums.push({
        name,
        values: schema.enum.map(v => String(v).toUpperCase().replace(/[^A-Z0-9_]/g, '_')),
      });
    } else if (schema.type === 'object' || schema.properties) {
      // Heuristic: if it has an 'id' field, it's likely an entity
      const hasId = schema.properties && 'id' in schema.properties;
      if (hasId) {
        entities.push({ name, schema });
      } else {
        types.push({ name, schema });
      }
    } else {
      types.push({ name, schema });
    }
  }

  // Generate enums
  if (enums.length > 0) {
    lines.push('  # Enumerations');
    for (const enumDef of enums) {
      lines.push('');
      lines.push(`  enum ${enumDef.name} {`);
      for (const value of enumDef.values) {
        lines.push(`    ${value}`);
      }
      lines.push('  }');
    }
    lines.push('');
  }

  // Generate types
  if (types.length > 0) {
    lines.push('  # Type Definitions');
    for (const typeDef of types) {
      lines.push('');
      const islType = schemaToISLType(typeDef.schema, typeDef.name, warnings);
      if (islType) {
        lines.push(`  type ${typeDef.name} = ${islType}`);
      }
    }
    lines.push('');
  }

  // Generate entities
  if (entities.length > 0) {
    lines.push('  # Entities');
    for (const entityDef of entities) {
      lines.push('');
      lines.push(`  entity ${entityDef.name} {`);
      const fields = schemaToFields(entityDef.schema, warnings);
      for (const field of fields) {
        lines.push(`    ${field}`);
      }
      lines.push('  }');
    }
    lines.push('');
  }

  // Generate behaviors from paths
  const behaviors = extractBehaviors(spec, warnings);
  if (behaviors.length > 0) {
    lines.push('  # Behaviors');
    for (const behavior of behaviors) {
      lines.push('');
      lines.push(`  behavior ${behavior.name} {`);
      if (behavior.description) {
        lines.push(`    description: "${behavior.description}"`);
      }
      if (behavior.inputs.length > 0) {
        lines.push('    input {');
        for (const input of behavior.inputs) {
          lines.push(`      ${input}`);
        }
        lines.push('    }');
      }
      if (behavior.output) {
        lines.push(`    output: ${behavior.output}`);
      }
      if (behavior.errors.length > 0) {
        lines.push('    errors {');
        for (const error of behavior.errors) {
          lines.push(`      ${error}`);
        }
        lines.push('    }');
      }
      lines.push('  }');
    }
    lines.push('');
  }

  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Convert OpenAPI schema to ISL type expression
 */
function schemaToISLType(schema: OpenAPISchema, name: string, warnings: string[]): string | null {
  // Handle $ref
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop() || 'Unknown';
    return refName;
  }

  // Handle enum
  if (schema.enum && Array.isArray(schema.enum)) {
    return `String { enum: [${schema.enum.map(v => `"${v}"`).join(', ')}] }`;
  }

  // Handle array
  if (schema.type === 'array' || schema.items) {
    const itemType = schema.items 
      ? schemaToISLType(schema.items, '', warnings) || 'String'
      : 'String';
    return `List<${itemType}>`;
  }

  // Handle object
  if (schema.type === 'object' || schema.properties) {
    // For inline objects, return as reference (will be generated as type)
    return name;
  }

  // Handle primitives
  const primitive = mapOpenAPITypeToISL(schema.type, schema.format);
  if (primitive) {
    const constraints: string[] = [];
    if (schema.minimum !== undefined) constraints.push(`min: ${schema.minimum}`);
    if (schema.maximum !== undefined) constraints.push(`max: ${schema.maximum}`);
    if (schema.minLength !== undefined) constraints.push(`min_length: ${schema.minLength}`);
    if (schema.maxLength !== undefined) constraints.push(`max_length: ${schema.maxLength}`);
    if (schema.pattern) constraints.push(`pattern: "${schema.pattern}"`);
    
    if (constraints.length > 0) {
      return `${primitive} { ${constraints.join(', ')} }`;
    }
    return primitive;
  }

  warnings.push(`Unknown schema type for ${name}: ${JSON.stringify(schema)}`);
  return 'String';
}

/**
 * Convert OpenAPI schema to entity fields
 */
function schemaToFields(schema: OpenAPISchema, warnings: string[]): string[] {
  const fields: string[] = [];
  const required = new Set(schema.required || []);

  if (!schema.properties) {
    return fields;
  }

  for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
    const isOptional = !required.has(fieldName);
    const optional = isOptional ? '?' : '';
    
    const islType = schemaToISLType(fieldSchema, fieldName, warnings) || 'String';
    
    const annotations: string[] = [];
    if (fieldSchema.readOnly) annotations.push('immutable');
    if (fieldSchema.writeOnly) annotations.push('secret');
    
    const annotationStr = annotations.length > 0 ? ` [${annotations.join(', ')}]` : '';
    
    fields.push(`    ${fieldName}: ${islType}${optional}${annotationStr}`);
  }

  return fields;
}

/**
 * Extract behaviors from OpenAPI paths
 */
function extractBehaviors(spec: OpenAPISpec, warnings: string[]): Array<{
  name: string;
  description?: string;
  inputs: string[];
  output?: string;
  errors: string[];
}> {
  const behaviors: Array<{
    name: string;
    description?: string;
  inputs: string[];
    output?: string;
    errors: string[];
  }> = [];

  const paths = spec.paths || {};
  for (const [path, pathItem] of Object.entries(paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
    
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const behaviorName = operation.operationId || generateBehaviorName(method, path);
      const inputs: string[] = [];
      const errors: string[] = [];

      // Extract parameters
      const allParams = [
        ...(pathItem.parameters || []),
        ...(operation.parameters || []),
      ];

      for (const param of allParams) {
        const paramSchema = typeof param === 'object' && 'schema' in param 
          ? param.schema 
          : { type: 'string' };
        const islType = schemaToISLType(paramSchema, param.name || 'param', warnings) || 'String';
        const optional = param.required === false ? '?' : '';
        inputs.push(`      ${param.name}: ${islType}${optional}`);
      }

      // Extract request body
      if (operation.requestBody?.content?.['application/json']?.schema) {
        const bodySchema = operation.requestBody.content['application/json'].schema;
        const islType = schemaToISLType(bodySchema, 'body', warnings) || 'String';
        inputs.push(`      body: ${islType}`);
      }

      // Extract output
      const successResponse = operation.responses?.['200'] 
        || operation.responses?.['201'] 
        || operation.responses?.['204'];
      
      let output: string | undefined;
      if (successResponse?.content?.['application/json']?.schema) {
        const outputSchema = successResponse.content['application/json'].schema;
        const outputType = schemaToISLType(outputSchema, 'output', warnings);
        if (outputType) {
          output = outputType;
        }
      }

      // Extract errors
      for (const [code, response] of Object.entries(operation.responses || {})) {
        const statusCode = parseInt(code, 10);
        if (statusCode >= 400) {
          const errorName = `Error${code}`;
          errors.push(`      ${errorName}: "${response.description || code}"`);
        }
      }

      behaviors.push({
        name: behaviorName,
        description: operation.summary || operation.description,
        inputs,
        output,
        errors,
      });
    }
  }

  return behaviors;
}

/**
 * Generate behavior name from HTTP method and path
 */
function generateBehaviorName(method: string, path: string): string {
  const methodPrefix = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
  const pathParts = path
    .split('/')
    .filter(p => p && !p.startsWith('{'))
    .map(p => p.charAt(0).toUpperCase() + p.slice(1));
  
  return methodPrefix + pathParts.join('');
}

/**
 * Map OpenAPI type/format to ISL primitive
 */
function mapOpenAPITypeToISL(type?: string | string[], format?: string): string {
  const typeStr = Array.isArray(type) ? type[0] : type;
  
  if (!typeStr) return 'String';

  switch (typeStr) {
    case 'string':
      switch (format) {
        case 'date-time':
          return 'Timestamp';
        case 'date':
          return 'Date';
        case 'uuid':
          return 'UUID';
        case 'email':
          return 'String { format: "email" }';
        case 'uri':
          return 'String { format: "uri" }';
        default:
          return 'String';
      }
    case 'integer':
      return 'Int';
    case 'number':
      return 'Decimal';
    case 'boolean':
      return 'Boolean';
    default:
      return 'String';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print import result to console
 */
export function printImportOpenAPIResult(
  result: ImportOpenAPIResult,
  options?: ImportOpenAPIOptions
): void {
  if (options?.format === 'json') {
    console.log(JSON.stringify({
      success: result.success,
      inputFile: result.inputFile,
      outputFile: result.outputFile,
      domainName: result.domainName,
      entities: result.entities,
      behaviors: result.behaviors,
      types: result.types,
      errors: result.errors,
      warnings: result.warnings,
      duration: result.duration,
    }, null, 2));
    return;
  }

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
    console.log(chalk.bold.green('✓ OpenAPI import successful'));
    console.log('');
    console.log(chalk.gray(`  Domain: ${result.domainName}`));
    console.log(chalk.gray(`  Entities: ${result.entities}`));
    console.log(chalk.gray(`  Behaviors: ${result.behaviors}`));
    console.log(chalk.gray(`  Types: ${result.types}`));
    console.log('');
    output.filePath(result.outputFile, 'created');
  } else {
    console.log(chalk.red('✗ Import failed'));
    console.log('');
    for (const error of result.errors) {
      console.log(chalk.red(`  ${error}`));
    }
  }

  if (result.warnings.length > 0) {
    console.log('');
    console.log(chalk.yellow('Warnings:'));
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`  ${warning}`));
    }
  }

  console.log(chalk.gray(`  Completed in ${result.duration}ms`));
}

/**
 * Get exit code for import result
 */
export function getImportOpenAPIExitCode(result: ImportOpenAPIResult): number {
  if (result.success) return ExitCode.SUCCESS;
  return ExitCode.ISL_ERROR;
}
