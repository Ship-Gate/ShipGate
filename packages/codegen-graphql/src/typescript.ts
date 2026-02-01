// ============================================================================
// TypeScript Types Generator for GraphQL
// ============================================================================

import type { Domain, Entity, Behavior, TypeDeclaration, Field } from './types';

export function generateTypeScriptTypes(domain: Domain): string {
  const lines: string[] = [];

  lines.push('// ============================================================================');
  lines.push(`// ${domain.name} GraphQL TypeScript Types`);
  lines.push('// Generated from ISL specification');
  lines.push('// ============================================================================');
  lines.push('');

  // Base scalars
  lines.push('// Custom Scalar Types');
  lines.push('export type UUID = string;');
  lines.push('export type DateTime = Date | string;');
  lines.push('export type Decimal = number | string;');
  lines.push('export type Duration = string;');
  lines.push('export type JSON = Record<string, unknown>;');
  lines.push('');

  // Custom types
  if (domain.types.length > 0) {
    lines.push('// Custom Types');
    for (const type of domain.types) {
      lines.push(`export type ${type.name} = ${mapISLToTypeScript(type.baseType)};`);
    }
    lines.push('');
  }

  // Entity types
  if (domain.entities.length > 0) {
    lines.push('// Entity Types');
    for (const entity of domain.entities) {
      lines.push(...generateEntityInterface(entity));
      lines.push('');
    }

    // Input types
    lines.push('// Input Types');
    for (const entity of domain.entities) {
      lines.push(...generateInputInterface(entity, 'Create'));
      lines.push('');
      lines.push(...generateInputInterface(entity, 'Update', true));
      lines.push('');
    }

    // Filter types
    lines.push('// Filter Types');
    for (const entity of domain.entities) {
      lines.push(...generateFilterInterface(entity));
      lines.push('');
    }

    // Connection types
    lines.push('// Connection Types');
    for (const entity of domain.entities) {
      lines.push(...generateConnectionTypes(entity));
      lines.push('');
    }
  }

  // Behavior types
  if (domain.behaviors.length > 0) {
    lines.push('// Behavior Types');
    for (const behavior of domain.behaviors) {
      lines.push(...generateBehaviorTypes(behavior));
      lines.push('');
    }
  }

  // Query and Mutation types
  lines.push('// Query Arguments');
  for (const entity of domain.entities) {
    const name = entity.name;
    lines.push(`export interface ${name}QueryArgs {`);
    lines.push('  id: UUID;');
    lines.push('}');
    lines.push('');
    lines.push(`export interface ${name}ListQueryArgs {`);
    lines.push(`  filter?: ${name}Filter;`);
    lines.push('  first?: number;');
    lines.push('  after?: string;');
    lines.push('  last?: number;');
    lines.push('  before?: string;');
    lines.push('}');
    lines.push('');
  }

  // Context type
  lines.push('// Context Type');
  lines.push('export interface Context {');
  for (const entity of domain.entities) {
    const nameLower = toCamelCase(entity.name);
    lines.push(`  ${nameLower}Repository: Repository<${entity.name}>;`);
  }
  for (const behavior of domain.behaviors) {
    const nameLower = toCamelCase(behavior.name);
    lines.push(`  ${nameLower}Service: ${behavior.name}Service;`);
  }
  lines.push('  pubsub: PubSub;');
  lines.push('}');
  lines.push('');

  // Repository interface
  lines.push('// Repository Interface');
  lines.push('export interface Repository<T> {');
  lines.push('  findById(id: string): Promise<T | null>;');
  lines.push('  findMany(options: { filter?: Record<string, unknown>; limit?: number; cursor?: string; direction?: "forward" | "backward" }): Promise<T[]>;');
  lines.push('  count(filter?: Record<string, unknown>): Promise<number>;');
  lines.push('  create(data: Partial<T>): Promise<T>;');
  lines.push('  update(id: string, data: Partial<T>): Promise<T>;');
  lines.push('  delete(id: string): Promise<void>;');
  lines.push('}');
  lines.push('');

  // PubSub interface
  lines.push('// PubSub Interface');
  lines.push('export interface PubSub {');
  lines.push('  publish(channel: string, payload: unknown): Promise<void>;');
  lines.push('  asyncIterator(channels: string[]): AsyncIterator<unknown>;');
  lines.push('}');
  lines.push('');

  // Service interfaces
  for (const behavior of domain.behaviors) {
    lines.push(`export interface ${behavior.name}Service {`);
    if (behavior.inputs.length > 0) {
      lines.push(`  execute(input: ${behavior.name}Input): Promise<${mapISLToTypeScript(behavior.outputType)}>;`);
    } else {
      lines.push(`  execute(): Promise<${mapISLToTypeScript(behavior.outputType)}>;`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

function generateEntityInterface(entity: Entity): string[] {
  const lines: string[] = [];
  
  lines.push(`export interface ${entity.name} {`);
  for (const field of entity.fields) {
    const tsType = mapISLToTypeScript(field.type);
    const optional = field.optional ? '?' : '';
    lines.push(`  ${field.name}${optional}: ${tsType};`);
  }
  
  if (entity.relations) {
    for (const relation of entity.relations) {
      if (relation.type === 'one-to-one') {
        lines.push(`  ${relation.name}?: ${relation.target};`);
        lines.push(`  ${relation.name}Id?: UUID;`);
      } else {
        lines.push(`  ${relation.name}?: ${relation.target}[];`);
        lines.push(`  ${relation.name}Ids?: UUID[];`);
      }
    }
  }
  
  lines.push('}');
  
  return lines;
}

function generateInputInterface(entity: Entity, prefix: string, allOptional = false): string[] {
  const lines: string[] = [];
  
  lines.push(`export interface ${prefix}${entity.name}Input {`);
  for (const field of entity.fields) {
    if (isAutoGeneratedField(field)) continue;
    
    const tsType = mapISLToTypeScript(field.type);
    const optional = allOptional || field.optional ? '?' : '';
    lines.push(`  ${field.name}${optional}: ${tsType};`);
  }
  lines.push('}');
  
  return lines;
}

function generateFilterInterface(entity: Entity): string[] {
  const lines: string[] = [];
  
  lines.push(`export interface ${entity.name}Filter {`);
  lines.push(`  AND?: ${entity.name}Filter[];`);
  lines.push(`  OR?: ${entity.name}Filter[];`);
  lines.push(`  NOT?: ${entity.name}Filter;`);
  
  for (const field of entity.fields) {
    const tsType = mapISLToTypeScript(field.type);
    
    lines.push(`  ${field.name}?: ${tsType};`);
    
    if (isComparableType(field.type)) {
      lines.push(`  ${field.name}_gt?: ${tsType};`);
      lines.push(`  ${field.name}_gte?: ${tsType};`);
      lines.push(`  ${field.name}_lt?: ${tsType};`);
      lines.push(`  ${field.name}_lte?: ${tsType};`);
    }
    
    if (field.type === 'String') {
      lines.push(`  ${field.name}_contains?: string;`);
      lines.push(`  ${field.name}_startsWith?: string;`);
      lines.push(`  ${field.name}_endsWith?: string;`);
    }
    
    lines.push(`  ${field.name}_in?: ${tsType}[];`);
    lines.push(`  ${field.name}_notIn?: ${tsType}[];`);
  }
  
  lines.push('}');
  
  return lines;
}

function generateConnectionTypes(entity: Entity): string[] {
  const lines: string[] = [];
  
  lines.push(`export interface ${entity.name}Connection {`);
  lines.push(`  edges: ${entity.name}Edge[];`);
  lines.push('  pageInfo: PageInfo;');
  lines.push('  totalCount: number;');
  lines.push('}');
  lines.push('');
  
  lines.push(`export interface ${entity.name}Edge {`);
  lines.push(`  node: ${entity.name};`);
  lines.push('  cursor: string;');
  lines.push('}');
  lines.push('');
  
  lines.push('export interface PageInfo {');
  lines.push('  hasNextPage: boolean;');
  lines.push('  hasPreviousPage: boolean;');
  lines.push('  startCursor: string | null;');
  lines.push('  endCursor: string | null;');
  lines.push('}');
  
  return lines;
}

function generateBehaviorTypes(behavior: Behavior): string[] {
  const lines: string[] = [];
  
  // Input type
  if (behavior.inputs.length > 0) {
    lines.push(`export interface ${behavior.name}Input {`);
    for (const input of behavior.inputs) {
      const tsType = mapISLToTypeScript(input.type);
      const optional = input.optional ? '?' : '';
      lines.push(`  ${input.name}${optional}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
  }
  
  // Error enum
  if (behavior.errors.length > 0) {
    lines.push(`export enum ${behavior.name}Error {`);
    for (const error of behavior.errors) {
      lines.push(`  ${toScreamingSnakeCase(error)} = '${toScreamingSnakeCase(error)}',`);
    }
    lines.push('}');
    lines.push('');
  }
  
  // Result types
  const outputType = mapISLToTypeScript(behavior.outputType);
  
  lines.push(`export interface ${behavior.name}Success {`);
  lines.push(`  result: ${outputType};`);
  lines.push('}');
  lines.push('');
  
  if (behavior.errors.length > 0) {
    lines.push(`export interface ${behavior.name}Failure {`);
    lines.push(`  error: ${behavior.name}Error;`);
    lines.push('  message?: string;');
    lines.push('}');
    lines.push('');
    
    lines.push(`export type ${behavior.name}Result = ${behavior.name}Success | ${behavior.name}Failure;`);
  } else {
    lines.push(`export interface ${behavior.name}Result {`);
    lines.push('  success: boolean;');
    lines.push(`  result?: ${outputType};`);
    lines.push('}');
  }
  
  return lines;
}

function mapISLToTypeScript(islType: string): string {
  // Handle generic types
  const genericMatch = islType.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, containerType, innerType] = genericMatch;
    
    switch (containerType) {
      case 'List':
        return `${mapISLToTypeScript(innerType)}[]`;
      case 'Map':
        const [keyType, valueType] = innerType.split(',').map(s => s.trim());
        return `Record<${mapISLToTypeScript(keyType)}, ${mapISLToTypeScript(valueType)}>`;
      case 'Optional':
        return `${mapISLToTypeScript(innerType)} | null`;
      case 'Set':
        return `Set<${mapISLToTypeScript(innerType)}>`;
    }
  }

  // Primitive types
  switch (islType) {
    case 'String':
      return 'string';
    case 'Int':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'UUID':
      return 'UUID';
    case 'Timestamp':
      return 'DateTime';
    case 'Date':
      return 'DateTime';
    case 'Time':
      return 'string';
    case 'Decimal':
      return 'Decimal';
    case 'Duration':
      return 'Duration';
    default:
      return islType;
  }
}

function isAutoGeneratedField(field: Field): boolean {
  return (
    field.annotations.includes('@computed') ||
    (field.name === 'id' && field.type === 'UUID') ||
    field.name === 'createdAt' ||
    field.name === 'updatedAt'
  );
}

function isComparableType(type: string): boolean {
  return ['Int', 'Decimal', 'Timestamp', 'Date', 'Time', 'Duration'].includes(type);
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toScreamingSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}
