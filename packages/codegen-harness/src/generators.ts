/**
 * Deterministic Code Generators
 *
 * Pure functions that transform ISL Domain AST into code strings.
 * These mirror the CLI gen.ts generators but are fully deterministic
 * (no timestamps, no disk I/O) for golden-file comparison.
 */

import type { Domain, Entity, Behavior, TypeDeclaration, TypeDefinition, Field, QualifiedName } from '@isl-lang/parser';
import type { CodeGenerator, GeneratedFile } from './types.js';

// ============================================================================
// Type Mapping Helpers (shared)
// ============================================================================

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
 * Resolve a QualifiedName to a plain string (e.g. Foo.Bar -> "Foo.Bar")
 */
function resolveQualifiedName(qn: QualifiedName | any): string {
  if (qn && typeof qn === 'object' && 'parts' in qn && Array.isArray(qn.parts)) {
    return qn.parts.map((p: any) => p.name ?? String(p)).join('.');
  }
  if (qn && typeof qn === 'object' && 'name' in qn) {
    return String(qn.name);
  }
  return String(qn);
}

function mapToTypeScriptType(typeRef: TypeDefinition | { name: string } | undefined | null): string {
  if (!typeRef) return 'unknown';

  if ('kind' in typeRef) {
    return generateTSTypeDefinition(typeRef as TypeDefinition);
  }

  if ('name' in typeRef) {
    const ref = typeRef as { name: string | QualifiedName };
    const name = typeof ref.name === 'string' ? ref.name : resolveQualifiedName(ref.name);
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

function generateTSTypeDefinition(def: TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      return mapPrimitiveToTS(def.name);
    case 'EnumType':
      return def.variants.map(v => `'${v.name.name}'`).join(' | ');
    case 'StructType': {
      const fields = def.fields.map(f =>
        `${f.name.name}${f.optional ? '?' : ''}: ${mapToTypeScriptType(f.type)}`
      ).join('; ');
      return `{ ${fields} }`;
    }
    case 'ListType':
      return `${generateTSTypeDefinition(def.element)}[]`;
    case 'MapType':
      return `Record<${generateTSTypeDefinition(def.key)}, ${generateTSTypeDefinition(def.value)}>`;
    case 'OptionalType':
      return `${generateTSTypeDefinition(def.inner)} | null`;
    case 'UnionType':
      return def.variants.map(v => v.name.name).join(' | ');
    case 'ReferenceType': {
      return resolveQualifiedName(def.name);
    }
    case 'ConstrainedType':
      return generateTSTypeDefinition(def.base);
    default:
      return 'unknown';
  }
}

function resolveFieldType(field: Field): string {
  return mapToTypeScriptType(field.type);
}

function resolveFieldTypeName(field: Field): string {
  if (field.type && 'name' in field.type) {
    const n = field.type.name;
    return typeof n === 'string' ? n : (n as any).name ?? 'unknown';
  }
  return 'unknown';
}

// ============================================================================
// String case helpers
// ============================================================================

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function toPascalCase(str: string): string {
  return str.replace(/(?:^|_)([a-z])/g, (_, c) => c.toUpperCase());
}

function toKebabCase(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

// ============================================================================
// TypeScript Generator
// ============================================================================

function generateTypeScript(domain: Domain): string {
  const lines: string[] = [];

  lines.push('// Types generated from ISL specification');
  lines.push('');

  // Generate type aliases for custom types
  for (const type of domain.types) {
    const tsType = generateTSTypeDefinition(type.definition);
    lines.push(`export type ${type.name.name} = ${tsType};`);
    lines.push('');
  }

  // Generate enum types (from entities referencing enums, or from type declarations with EnumType)
  for (const type of domain.types) {
    if (type.definition.kind === 'EnumType') {
      // Already handled above as type alias
    }
  }

  // Generate interfaces for entities
  for (const entity of domain.entities) {
    lines.push(`export interface ${entity.name.name} {`);

    if (entity.fields) {
      for (const field of entity.fields) {
        const tsType = resolveFieldType(field);
        const optional = field.optional ? '?' : '';
        lines.push(`  ${field.name.name}${optional}: ${tsType};`);
      }
    }

    lines.push('}');
    lines.push('');
  }

  // Generate function types for behaviors
  for (const behavior of domain.behaviors) {
    const inputParams = behavior.input?.fields?.map(f =>
      `${f.name.name}: ${resolveFieldType(f)}`
    ).join(', ') ?? '';

    const outputType = behavior.output?.success
      ? mapToTypeScriptType(behavior.output.success)
      : 'void';

    lines.push(`export type ${behavior.name.name}Fn = (${inputParams}) => Promise<${outputType}>;`);
    lines.push('');

    // Also generate an interface for the handler
    const methodName = behavior.name.name[0].toLowerCase() + behavior.name.name.slice(1);
    lines.push(`export interface ${behavior.name.name}Handler {`);
    lines.push(`  ${methodName}(${inputParams}): Promise<${outputType}>;`);
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

export const typescriptGenerator: CodeGenerator = {
  name: 'typescript',
  extension: '.ts',
  generate(domain: Domain): GeneratedFile[] {
    const name = domain.name.name.toLowerCase();
    return [{
      path: `${name}.ts`,
      content: generateTypeScript(domain),
    }];
  },
};

// ============================================================================
// Rust Generator
// ============================================================================

function mapToRustType(typeDef: TypeDefinition | undefined, optional?: boolean): string {
  if (!typeDef) return 'String';

  let rustType: string;
  if (typeDef.kind === 'PrimitiveType') {
    const typeMap: Record<string, string> = {
      'String': 'String',
      'Int': 'i64',
      'Decimal': 'f64',
      'Boolean': 'bool',
      'UUID': 'String',
      'Timestamp': 'chrono::DateTime<chrono::Utc>',
      'Duration': 'i64',
    };
    rustType = typeMap[typeDef.name] ?? 'String';
  } else if (typeDef.kind === 'ReferenceType') {
    rustType = resolveQualifiedName(typeDef.name);
  } else {
    rustType = 'String';
  }

  return optional ? `Option<${rustType}>` : rustType;
}

function generateRust(domain: Domain): string {
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
        const rustType = mapToRustType(field.type, field.optional);
        lines.push(`    pub ${toSnakeCase(field.name.name)}: ${rustType},`);
      }
    }

    lines.push('}');
    lines.push('');
  }

  // Generate traits for behaviors
  for (const behavior of domain.behaviors) {
    const inputs = behavior.input?.fields?.map(f =>
      `${toSnakeCase(f.name.name)}: ${mapToRustType(f.type, false)}`
    ).join(', ') ?? '';
    const outputType = mapToRustType(behavior.output?.success, false);

    lines.push(`pub trait ${behavior.name.name}Handler {`);
    lines.push(`    fn ${toSnakeCase(behavior.name.name)}(&self, ${inputs}) -> Result<${outputType}, Box<dyn std::error::Error>>;`);
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

export const rustGenerator: CodeGenerator = {
  name: 'rust',
  extension: '.rs',
  generate(domain: Domain): GeneratedFile[] {
    const name = domain.name.name.toLowerCase();
    return [{
      path: `${name}.rs`,
      content: generateRust(domain),
    }];
  },
};

// ============================================================================
// Go Generator
// ============================================================================

function mapToGoType(typeDef: TypeDefinition | undefined, optional?: boolean): string {
  if (!typeDef) return 'interface{}';

  let goType: string;
  if (typeDef.kind === 'PrimitiveType') {
    const typeMap: Record<string, string> = {
      'String': 'string',
      'Int': 'int64',
      'Decimal': 'float64',
      'Boolean': 'bool',
      'UUID': 'string',
      'Timestamp': 'time.Time',
      'Duration': 'int64',
    };
    goType = typeMap[typeDef.name] ?? 'interface{}';
  } else if (typeDef.kind === 'ReferenceType') {
    goType = resolveQualifiedName(typeDef.name);
  } else {
    goType = 'interface{}';
  }

  return optional ? `*${goType}` : goType;
}

function generateGo(domain: Domain): string {
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
        const goType = mapToGoType(field.type, field.optional);
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
      ? mapToGoType(behavior.input.fields[0].type, false)
      : 'interface{}';
    const outputType = mapToGoType(behavior.output?.success, false);

    lines.push(`type ${behavior.name.name}Handler interface {`);
    lines.push(`\t${behavior.name.name}(input ${inputType}) (${outputType}, error)`);
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

export const goGenerator: CodeGenerator = {
  name: 'go',
  extension: '.go',
  generate(domain: Domain): GeneratedFile[] {
    const name = domain.name.name.toLowerCase();
    return [{
      path: `${name}.go`,
      content: generateGo(domain),
    }];
  },
};

// ============================================================================
// OpenAPI Generator
// ============================================================================

function mapToOpenAPIType(typeDef: TypeDefinition | undefined): Record<string, unknown> {
  if (!typeDef) return { type: 'string' };

  if (typeDef.kind === 'PrimitiveType') {
    const typeMap: Record<string, Record<string, unknown>> = {
      'String': { type: 'string' },
      'Int': { type: 'integer', format: 'int64' },
      'Decimal': { type: 'number', format: 'double' },
      'Boolean': { type: 'boolean' },
      'UUID': { type: 'string', format: 'uuid' },
      'Timestamp': { type: 'string', format: 'date-time' },
      'Duration': { type: 'integer' },
    };
    return typeMap[typeDef.name] ?? { type: 'string' };
  }

  if (typeDef.kind === 'ReferenceType') {
    return { '$ref': `#/components/schemas/${resolveQualifiedName(typeDef.name)}` };
  }

  return { type: 'string' };
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

function generateOpenAPI(domain: Domain): string {
  const spec: Record<string, unknown> = {
    openapi: '3.0.3',
    info: {
      title: `${domain.name.name} API`,
      version: '1.0.0',
      description: `API specification for ${domain.name.name}`,
    },
    paths: {} as Record<string, unknown>,
    components: {
      schemas: {} as Record<string, unknown>,
    },
  };

  const schemas = (spec.components as { schemas: Record<string, unknown> }).schemas;

  // Generate schemas for entities
  for (const entity of domain.entities) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    if (entity.fields) {
      for (const field of entity.fields) {
        properties[field.name.name] = mapToOpenAPIType(field.type);
        if (!field.optional) {
          required.push(field.name.name);
        }
      }
    }

    schemas[entity.name.name] = {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  // Generate paths for behaviors
  const paths = spec.paths as Record<string, unknown>;
  for (const behavior of domain.behaviors) {
    const pathName = `/${toKebabCase(behavior.name.name)}`;

    const inputFields = behavior.input?.fields ?? [];
    paths[pathName] = {
      post: {
        operationId: behavior.name.name,
        summary: behavior.name.name,
        requestBody: inputFields.length ? {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: Object.fromEntries(
                  inputFields.map(f => [f.name.name, mapToOpenAPIType(f.type)])
                ),
              },
            },
          },
        } : undefined,
        responses: {
          '200': {
            description: 'Success',
            content: behavior.output?.success ? {
              'application/json': {
                schema: mapToOpenAPIType(behavior.output.success),
              },
            } : undefined,
          },
        },
      },
    };
  }

  return toYAML(spec);
}

export const openapiGenerator: CodeGenerator = {
  name: 'openapi',
  extension: '.yaml',
  generate(domain: Domain): GeneratedFile[] {
    const name = domain.name.name.toLowerCase();
    return [{
      path: `${name}.yaml`,
      content: generateOpenAPI(domain),
    }];
  },
};

// ============================================================================
// Registry
// ============================================================================

export const ALL_GENERATORS: CodeGenerator[] = [
  typescriptGenerator,
  rustGenerator,
  goGenerator,
  openapiGenerator,
];

/**
 * Get all generators including test generators if available
 * This function can be used to dynamically include test-generator
 */
export function getAllGeneratorsWithTests(): CodeGenerator[] {
  const generators = [...ALL_GENERATORS];
  
  // Try to include test generators if available
  try {
    // Dynamic import for optional dependency
    const testGen = require('@isl-lang/test-generator');
    if (testGen.vitestGenerator) {
      generators.push(testGen.vitestGenerator);
    }
    if (testGen.jestGenerator) {
      generators.push(testGen.jestGenerator);
    }
  } catch {
    // test-generator not available, skip
  }
  
  return generators;
}

/**
 * Get test generators only
 */
export function getTestGenerators(): CodeGenerator[] {
  const generators: CodeGenerator[] = [];
  
  try {
    const testGen = require('@isl-lang/test-generator');
    if (testGen.vitestGenerator) {
      generators.push(testGen.vitestGenerator);
    }
    if (testGen.jestGenerator) {
      generators.push(testGen.jestGenerator);
    }
  } catch {
    // test-generator not available
  }
  
  return generators;
}

export function getGenerator(name: string): CodeGenerator | undefined {
  return ALL_GENERATORS.find(g => g.name === name);
}
