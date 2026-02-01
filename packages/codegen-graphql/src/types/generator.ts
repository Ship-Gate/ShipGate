/**
 * GraphQL Types Generator - Generate TypeScript types from ISL AST.
 */

import type { AST } from './ast';

/**
 * Type generator configuration
 */
export interface TypeGeneratorConfig {
  /** Output file path */
  outputPath?: string;
  /** Include enums */
  includeEnums?: boolean;
  /** Include input types */
  includeInputTypes?: boolean;
  /** Include resolver types */
  includeResolverTypes?: boolean;
  /** Use readonly */
  readonly?: boolean;
}

const defaultConfig: Required<TypeGeneratorConfig> = {
  outputPath: './generated/types.ts',
  includeEnums: true,
  includeInputTypes: true,
  includeResolverTypes: true,
  readonly: true,
};

/**
 * Generate TypeScript types from ISL AST
 */
export function generateTypes(
  ast: AST,
  config: TypeGeneratorConfig = {}
): string {
  const cfg = { ...defaultConfig, ...config };
  const lines: string[] = [];

  // Add header
  lines.push('/**');
  lines.push(' * Generated TypeScript types from ISL specification');
  lines.push(' * DO NOT EDIT - This file is auto-generated');
  lines.push(' */');
  lines.push('');

  // Generate scalar types
  lines.push(generateScalarTypes(cfg));
  lines.push('');

  // Generate types for each domain
  for (const domain of ast.domains ?? []) {
    // Generate enums
    if (cfg.includeEnums) {
      for (const enumDef of domain.enums ?? []) {
        lines.push(generateEnumType(enumDef, cfg));
        lines.push('');
      }
    }

    // Generate entity types
    for (const entity of domain.entities ?? []) {
      lines.push(generateEntityTypeScript(entity, cfg));
      lines.push('');
    }

    // Generate input types
    if (cfg.includeInputTypes) {
      for (const behavior of domain.behaviors ?? []) {
        if (behavior.input) {
          lines.push(generateInputTypeScript(behavior, cfg));
          lines.push('');
        }
      }
    }

    // Generate result types
    for (const behavior of domain.behaviors ?? []) {
      if (behavior.output) {
        lines.push(generateResultTypeScript(behavior, cfg));
        lines.push('');
      }
    }
  }

  // Generate resolver types
  if (cfg.includeResolverTypes) {
    lines.push(generateResolverTypes(ast, cfg));
  }

  return lines.join('\n');
}

function generateScalarTypes(cfg: Required<TypeGeneratorConfig>): string {
  return `// Scalar types
export type DateTime = Date;
export type JSON = Record<string, unknown>;
export type Email = string;
export type URL = string;
export type UUID = string;
export type ID = string;`;
}

function generateEnumType(enumDef: any, cfg: Required<TypeGeneratorConfig>): string {
  const lines: string[] = [];

  lines.push(`export enum ${enumDef.name} {`);

  for (const value of enumDef.values ?? []) {
    const valueName = typeof value === 'string' ? value : value.name;
    lines.push(`  ${valueName} = '${valueName}',`);
  }

  lines.push('}');

  return lines.join('\n');
}

function generateEntityTypeScript(entity: any, cfg: Required<TypeGeneratorConfig>): string {
  const lines: string[] = [];
  const readonlyPrefix = cfg.readonly ? 'readonly ' : '';

  lines.push(`export interface ${entity.name} {`);

  for (const field of entity.fields ?? []) {
    const tsType = islTypeToTypeScript(field.type);
    const optional = field.optional ? '?' : '';
    lines.push(`  ${readonlyPrefix}${field.name}${optional}: ${tsType};`);
  }

  // Add timestamp fields
  lines.push(`  ${readonlyPrefix}createdAt: DateTime;`);
  lines.push(`  ${readonlyPrefix}updatedAt: DateTime;`);

  lines.push('}');

  return lines.join('\n');
}

function generateInputTypeScript(behavior: any, cfg: Required<TypeGeneratorConfig>): string {
  const lines: string[] = [];
  const readonlyPrefix = cfg.readonly ? 'readonly ' : '';
  const inputName = `${behavior.name}Input`;

  lines.push(`export interface ${inputName} {`);

  for (const field of behavior.input?.fields ?? []) {
    const tsType = islTypeToTypeScript(field.type);
    const optional = field.optional ? '?' : '';
    lines.push(`  ${readonlyPrefix}${field.name}${optional}: ${tsType};`);
  }

  lines.push('}');

  return lines.join('\n');
}

function generateResultTypeScript(behavior: any, cfg: Required<TypeGeneratorConfig>): string {
  const lines: string[] = [];
  const resultName = `${behavior.name}Result`;
  const variants: string[] = [];

  // Generate variant types
  for (const variant of behavior.output?.variants ?? []) {
    const variantTypeName = `${behavior.name}${variant.name}`;
    variants.push(variantTypeName);

    lines.push(`export interface ${variantTypeName} {`);
    lines.push(`  readonly __typename: '${variantTypeName}';`);
    
    for (const field of variant.fields ?? []) {
      const tsType = islTypeToTypeScript(field.type);
      lines.push(`  readonly ${field.name}: ${tsType};`);
    }
    
    if (!variant.fields?.length) {
      lines.push('  readonly message: string;');
    }
    
    lines.push('}');
    lines.push('');
  }

  // Generate union type
  lines.push(`export type ${resultName} = ${variants.join(' | ')};`);

  return lines.join('\n');
}

function generateResolverTypes(ast: AST, cfg: Required<TypeGeneratorConfig>): string {
  const lines: string[] = [];

  lines.push('// Resolver types');
  lines.push('export interface Resolvers {');
  lines.push('  Query: QueryResolvers;');
  lines.push('  Mutation: MutationResolvers;');
  lines.push('  Subscription: SubscriptionResolvers;');
  lines.push('}');
  lines.push('');

  // Generate Query resolvers type
  lines.push('export interface QueryResolvers {');
  for (const domain of ast.domains ?? []) {
    for (const behavior of domain.behaviors ?? []) {
      if (behavior.name.startsWith('Get') || behavior.name.startsWith('List')) {
        const fieldName = behavior.name.charAt(0).toLowerCase() + behavior.name.slice(1);
        const inputType = behavior.input?.fields?.length ? `${behavior.name}Input` : 'void';
        const resultType = `${behavior.name}Result`;
        lines.push(`  ${fieldName}: (parent: unknown, args: { input: ${inputType} }, context: Context) => Promise<${resultType}>;`);
      }
    }
  }
  lines.push('}');
  lines.push('');

  // Generate Mutation resolvers type
  lines.push('export interface MutationResolvers {');
  for (const domain of ast.domains ?? []) {
    for (const behavior of domain.behaviors ?? []) {
      if (
        behavior.name.startsWith('Create') ||
        behavior.name.startsWith('Update') ||
        behavior.name.startsWith('Delete')
      ) {
        const fieldName = behavior.name.charAt(0).toLowerCase() + behavior.name.slice(1);
        const inputType = `${behavior.name}Input`;
        const resultType = `${behavior.name}Result`;
        lines.push(`  ${fieldName}: (parent: unknown, args: { input: ${inputType} }, context: Context) => Promise<${resultType}>;`);
      }
    }
  }
  lines.push('}');
  lines.push('');

  // Generate Subscription resolvers type
  lines.push('export interface SubscriptionResolvers {');
  for (const domain of ast.domains ?? []) {
    for (const entity of domain.entities ?? []) {
      const fieldName = entity.name.charAt(0).toLowerCase() + entity.name.slice(1);
      lines.push(`  ${fieldName}Created: { subscribe: (parent: unknown, args: unknown, context: Context) => AsyncIterator<${entity.name}>; };`);
      lines.push(`  ${fieldName}Updated: { subscribe: (parent: unknown, args: { id: string }, context: Context) => AsyncIterator<${entity.name}>; };`);
      lines.push(`  ${fieldName}Deleted: { subscribe: (parent: unknown, args: unknown, context: Context) => AsyncIterator<string>; };`);
    }
  }
  lines.push('}');

  return lines.join('\n');
}

function islTypeToTypeScript(type: string): string {
  // Handle optional types
  if (type.endsWith('?')) {
    return `${islTypeToTypeScript(type.slice(0, -1))} | null`;
  }

  // Handle list types
  if (type.startsWith('List<') && type.endsWith('>')) {
    const innerType = type.slice(5, -1);
    return `readonly ${islTypeToTypeScript(innerType)}[]`;
  }

  // Handle map types
  if (type.startsWith('Map<') && type.endsWith('>')) {
    const innerTypes = type.slice(4, -1).split(',').map(t => t.trim());
    return `Record<${islTypeToTypeScript(innerTypes[0])}, ${islTypeToTypeScript(innerTypes[1])}>`;
  }

  // Primitive type mappings
  const typeMap: Record<string, string> = {
    String: 'string',
    Int: 'number',
    Float: 'number',
    Boolean: 'boolean',
    ID: 'string',
    DateTime: 'Date',
    Timestamp: 'Date',
    Email: 'string',
    URL: 'string',
    JSON: 'Record<string, unknown>',
    UUID: 'string',
  };

  return typeMap[type] ?? type;
}
