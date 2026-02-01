// ============================================================================
// GraphQL Schema Generator
// ============================================================================

import type { Domain, Entity, Behavior, TypeDeclaration, GraphQLOptions, Field } from './types';

export function generateSchema(domain: Domain, options: GraphQLOptions): string {
  const lines: string[] = [];

  // Header
  lines.push('# ============================================================================');
  lines.push(`# ${domain.name} GraphQL Schema`);
  lines.push(`# Generated from ISL specification${domain.version ? ` v${domain.version}` : ''}`);
  lines.push('# ============================================================================');
  lines.push('');

  // Scalars
  lines.push('# Custom Scalars');
  lines.push('scalar DateTime');
  lines.push('scalar UUID');
  lines.push('scalar Decimal');
  lines.push('scalar Duration');
  lines.push('scalar JSON');
  lines.push('');

  // Custom types
  if (domain.types.length > 0) {
    lines.push('# Custom Types');
    for (const type of domain.types) {
      lines.push(...generateCustomType(type));
      lines.push('');
    }
  }

  // Entity types
  if (domain.entities.length > 0) {
    lines.push('# Entity Types');
    for (const entity of domain.entities) {
      lines.push(...generateEntityType(entity, domain.entities));
      lines.push('');
    }

    // Input types for mutations
    lines.push('# Input Types');
    for (const entity of domain.entities) {
      lines.push(...generateInputType(entity));
      lines.push('');
    }

    // Filter types for queries
    lines.push('# Filter Types');
    for (const entity of domain.entities) {
      lines.push(...generateFilterType(entity));
      lines.push('');
    }

    // Connection types for pagination
    lines.push('# Connection Types (Relay-style pagination)');
    for (const entity of domain.entities) {
      lines.push(...generateConnectionType(entity));
      lines.push('');
    }
  }

  // Behavior result types
  if (domain.behaviors.length > 0) {
    lines.push('# Behavior Result Types');
    for (const behavior of domain.behaviors) {
      lines.push(...generateBehaviorTypes(behavior));
      lines.push('');
    }
  }

  // Query type
  lines.push('# Root Query Type');
  lines.push('type Query {');
  for (const entity of domain.entities) {
    const name = entity.name;
    const nameLower = toCamelCase(name);
    const namePlural = `${nameLower}s`;
    
    lines.push(`  # Get a single ${name} by ID`);
    lines.push(`  ${nameLower}(id: UUID!): ${name}`);
    lines.push('');
    lines.push(`  # Get all ${name}s with filtering and pagination`);
    lines.push(`  ${namePlural}(`);
    lines.push(`    filter: ${name}Filter`);
    lines.push('    first: Int');
    lines.push('    after: String');
    lines.push('    last: Int');
    lines.push('    before: String');
    lines.push(`  ): ${name}Connection!`);
    lines.push('');
  }
  lines.push('}');
  lines.push('');

  // Mutation type
  lines.push('# Root Mutation Type');
  lines.push('type Mutation {');
  
  // Entity CRUD mutations
  for (const entity of domain.entities) {
    const name = entity.name;
    const nameLower = toCamelCase(name);
    
    lines.push(`  # Create a new ${name}`);
    lines.push(`  create${name}(input: Create${name}Input!): ${name}!`);
    lines.push('');
    lines.push(`  # Update an existing ${name}`);
    lines.push(`  update${name}(id: UUID!, input: Update${name}Input!): ${name}!`);
    lines.push('');
    lines.push(`  # Delete a ${name}`);
    lines.push(`  delete${name}(id: UUID!): Boolean!`);
    lines.push('');
  }

  // Behavior mutations
  for (const behavior of domain.behaviors) {
    const name = behavior.name;
    const nameLower = toCamelCase(name);
    
    lines.push(`  # Execute ${name} behavior`);
    if (behavior.inputs.length > 0) {
      lines.push(`  ${nameLower}(input: ${name}Input!): ${name}Result!`);
    } else {
      lines.push(`  ${nameLower}: ${name}Result!`);
    }
    lines.push('');
  }
  
  lines.push('}');
  lines.push('');

  // Subscription type (if enabled)
  if (options.subscriptions) {
    lines.push('# Root Subscription Type');
    lines.push('type Subscription {');
    for (const entity of domain.entities) {
      const name = entity.name;
      const nameLower = toCamelCase(name);
      
      lines.push(`  # Subscribe to ${name} changes`);
      lines.push(`  ${nameLower}Created: ${name}!`);
      lines.push(`  ${nameLower}Updated: ${name}!`);
      lines.push(`  ${nameLower}Deleted: UUID!`);
      lines.push('');
    }
    lines.push('}');
    lines.push('');
  }

  // Page info for pagination
  lines.push('# Pagination Info');
  lines.push('type PageInfo {');
  lines.push('  hasNextPage: Boolean!');
  lines.push('  hasPreviousPage: Boolean!');
  lines.push('  startCursor: String');
  lines.push('  endCursor: String');
  lines.push('}');

  return lines.join('\n');
}

function generateCustomType(type: TypeDeclaration): string[] {
  const lines: string[] = [];
  
  // Map to GraphQL scalar if possible
  const gqlType = mapISLToGraphQL(type.baseType);
  
  lines.push(`"""${type.name}: ${type.baseType} with constraints"""`);
  lines.push(`scalar ${type.name}`);
  
  return lines;
}

function generateEntityType(entity: Entity, allEntities: Entity[]): string[] {
  const lines: string[] = [];
  
  lines.push(`"""${entity.name} entity"""`);
  lines.push(`type ${entity.name} {`);
  
  for (const field of entity.fields) {
    const gqlType = mapISLToGraphQL(field.type);
    const nullable = field.optional ? '' : '!';
    const description = getFieldDescription(field);
    
    if (description) {
      lines.push(`  """${description}"""`);
    }
    lines.push(`  ${field.name}: ${gqlType}${nullable}`);
  }

  // Add relations
  if (entity.relations) {
    for (const relation of entity.relations) {
      const targetEntity = allEntities.find(e => e.name === relation.target);
      if (targetEntity) {
        if (relation.type === 'one-to-many' || relation.type === 'many-to-many') {
          lines.push(`  ${relation.name}: [${relation.target}!]!`);
        } else {
          lines.push(`  ${relation.name}: ${relation.target}`);
        }
      }
    }
  }
  
  lines.push('}');
  
  return lines;
}

function generateInputType(entity: Entity): string[] {
  const lines: string[] = [];
  
  // Create input
  lines.push(`input Create${entity.name}Input {`);
  for (const field of entity.fields) {
    // Skip auto-generated fields
    if (isAutoGeneratedField(field)) continue;
    
    const gqlType = mapISLToGraphQL(field.type);
    const nullable = field.optional ? '' : '!';
    lines.push(`  ${field.name}: ${gqlType}${nullable}`);
  }
  lines.push('}');
  lines.push('');
  
  // Update input (all fields optional)
  lines.push(`input Update${entity.name}Input {`);
  for (const field of entity.fields) {
    if (isAutoGeneratedField(field)) continue;
    
    const gqlType = mapISLToGraphQL(field.type);
    lines.push(`  ${field.name}: ${gqlType}`);
  }
  lines.push('}');
  
  return lines;
}

function generateFilterType(entity: Entity): string[] {
  const lines: string[] = [];
  
  lines.push(`input ${entity.name}Filter {`);
  lines.push('  AND: [${entity.name}Filter!]');
  lines.push('  OR: [${entity.name}Filter!]');
  lines.push('  NOT: ${entity.name}Filter');
  lines.push('');
  
  for (const field of entity.fields) {
    const gqlType = mapISLToGraphQL(field.type);
    
    // Add filter operators based on type
    lines.push(`  ${field.name}: ${gqlType}`);
    
    if (isComparableType(field.type)) {
      lines.push(`  ${field.name}_gt: ${gqlType}`);
      lines.push(`  ${field.name}_gte: ${gqlType}`);
      lines.push(`  ${field.name}_lt: ${gqlType}`);
      lines.push(`  ${field.name}_lte: ${gqlType}`);
    }
    
    if (field.type === 'String') {
      lines.push(`  ${field.name}_contains: String`);
      lines.push(`  ${field.name}_startsWith: String`);
      lines.push(`  ${field.name}_endsWith: String`);
    }
    
    lines.push(`  ${field.name}_in: [${gqlType}!]`);
    lines.push(`  ${field.name}_notIn: [${gqlType}!]`);
  }
  
  lines.push('}');
  
  return lines;
}

function generateConnectionType(entity: Entity): string[] {
  const lines: string[] = [];
  
  lines.push(`type ${entity.name}Connection {`);
  lines.push(`  edges: [${entity.name}Edge!]!`);
  lines.push('  pageInfo: PageInfo!');
  lines.push('  totalCount: Int!');
  lines.push('}');
  lines.push('');
  
  lines.push(`type ${entity.name}Edge {`);
  lines.push(`  node: ${entity.name}!`);
  lines.push('  cursor: String!');
  lines.push('}');
  
  return lines;
}

function generateBehaviorTypes(behavior: Behavior): string[] {
  const lines: string[] = [];
  
  // Input type
  if (behavior.inputs.length > 0) {
    lines.push(`input ${behavior.name}Input {`);
    for (const input of behavior.inputs) {
      const gqlType = mapISLToGraphQL(input.type);
      const nullable = input.optional ? '' : '!';
      lines.push(`  ${input.name}: ${gqlType}${nullable}`);
    }
    lines.push('}');
    lines.push('');
  }
  
  // Error enum
  if (behavior.errors.length > 0) {
    lines.push(`enum ${behavior.name}Error {`);
    for (const error of behavior.errors) {
      lines.push(`  ${toScreamingSnakeCase(error)}`);
    }
    lines.push('}');
    lines.push('');
  }
  
  // Result union
  lines.push(`type ${behavior.name}Success {`);
  lines.push(`  result: ${mapISLToGraphQL(behavior.outputType)}!`);
  lines.push('}');
  lines.push('');
  
  if (behavior.errors.length > 0) {
    lines.push(`type ${behavior.name}Failure {`);
    lines.push(`  error: ${behavior.name}Error!`);
    lines.push('  message: String');
    lines.push('}');
    lines.push('');
    
    lines.push(`union ${behavior.name}Result = ${behavior.name}Success | ${behavior.name}Failure`);
  } else {
    lines.push(`type ${behavior.name}Result {`);
    lines.push(`  success: Boolean!`);
    lines.push(`  result: ${mapISLToGraphQL(behavior.outputType)}`);
    lines.push('}');
  }
  
  return lines;
}

function mapISLToGraphQL(islType: string): string {
  // Handle generic types
  const genericMatch = islType.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, containerType, innerType] = genericMatch;
    
    switch (containerType) {
      case 'List':
        return `[${mapISLToGraphQL(innerType)}!]`;
      case 'Map':
        return 'JSON';
      case 'Optional':
        return mapISLToGraphQL(innerType);
      case 'Set':
        return `[${mapISLToGraphQL(innerType)}!]`;
    }
  }

  // Primitive types
  switch (islType) {
    case 'String':
      return 'String';
    case 'Int':
      return 'Int';
    case 'Boolean':
      return 'Boolean';
    case 'UUID':
      return 'UUID';
    case 'Timestamp':
      return 'DateTime';
    case 'Date':
      return 'DateTime';
    case 'Time':
      return 'String';
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

function getFieldDescription(field: Field): string | null {
  if (field.annotations.includes('@unique')) return 'Unique identifier';
  if (field.annotations.includes('@indexed')) return 'Indexed field';
  if (field.annotations.includes('@sensitive')) return 'Contains sensitive data';
  return null;
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toScreamingSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}
