/**
 * GraphQL Schema Generator
 * 
 * Generates GraphQL SDL schema from ISL domain declarations.
 */

import type {
  DomainDeclaration,
  EntityDeclaration,
  FieldDeclaration,
  BehaviorDeclaration,
  EnumDeclaration,
  TypeDeclaration,
  TypeExpression,
} from '@isl-lang/isl-core';

import type {
  GraphQLGeneratorOptions,
  GraphQLTypeDefinition,
  GraphQLFieldDefinition,
  GraphQLEnumValue,
  CustomScalar,
  AppliedDirective,
  TypeMapping,
} from '../types.js';

import { DEFAULT_TYPE_MAPPINGS } from '../types.js';

/**
 * Default generator options
 */
const defaultOptions: GraphQLGeneratorOptions = {
  generateTypes: true,
  generateResolvers: true,
  includeDescriptions: true,
  naming: {
    typeCase: 'PascalCase',
    fieldCase: 'camelCase',
    inputSuffix: 'Input',
    filterSuffix: 'Filter',
    connectionSuffix: 'Connection',
  },
  schema: {
    connectionTypes: true,
    inputTypes: true,
    filterTypes: true,
    sortingTypes: true,
  },
};

/**
 * Generate GraphQL schema from ISL domain
 */
export function generateSchema(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions> = {}
): string {
  const opts = mergeOptions(defaultOptions, options);
  const lines: string[] = [];
  const customScalars = new Set<string>();
  
  // Schema description
  lines.push(`"""
Schema generated from ISL domain: ${domain.name.name}
${domain.version ? `Version: ${domain.version.value}` : ''}
"""
`);
  
  // Generate custom scalars
  const scalars = collectCustomScalars(domain, opts);
  if (scalars.length > 0) {
    lines.push('# Custom Scalars');
    for (const scalar of scalars) {
      lines.push(generateScalar(scalar));
    }
    lines.push('');
  }
  
  // Generate enums
  if (domain.enums.length > 0) {
    lines.push('# Enums');
    for (const enumDecl of domain.enums) {
      lines.push(generateEnum(enumDecl, opts));
    }
    lines.push('');
  }
  
  // Generate types from entities
  lines.push('# Types');
  for (const entity of domain.entities) {
    lines.push(generateObjectType(entity, opts));
    
    // Generate input type
    if (opts.schema?.inputTypes) {
      lines.push(generateInputType(entity, opts));
    }
    
    // Generate filter type
    if (opts.schema?.filterTypes) {
      lines.push(generateFilterType(entity, opts));
    }
    
    // Generate connection type
    if (opts.schema?.connectionTypes) {
      lines.push(generateConnectionType(entity, opts));
    }
  }
  lines.push('');
  
  // Generate sorting enum if enabled
  if (opts.schema?.sortingTypes && domain.entities.length > 0) {
    lines.push('# Sorting');
    lines.push(generateSortingTypes(domain.entities, opts));
    lines.push('');
  }
  
  // Generate Query type
  lines.push('# Root Query');
  lines.push(generateQueryType(domain, opts));
  lines.push('');
  
  // Generate Mutation type from behaviors
  const mutations = domain.behaviors.filter(b => hasSideEffects(b));
  if (mutations.length > 0) {
    lines.push('# Root Mutation');
    lines.push(generateMutationType(domain, mutations, opts));
    lines.push('');
  }
  
  // Generate Subscription type if needed
  const subscriptions = domain.behaviors.filter(b => isSubscription(b));
  if (subscriptions.length > 0) {
    lines.push('# Root Subscription');
    lines.push(generateSubscriptionType(subscriptions, opts));
    lines.push('');
  }
  
  // Add directives if federation is enabled
  if (opts.federation?.enabled) {
    lines.unshift(generateFederationDirectives(opts));
  }
  
  return lines.join('\n');
}

/**
 * Generate scalar definition
 */
function generateScalar(scalar: CustomScalar): string {
  const desc = scalar.description 
    ? `"""${scalar.description}"""\n` 
    : '';
  return `${desc}scalar ${scalar.name}\n`;
}

/**
 * Generate enum type
 */
function generateEnum(enumDecl: EnumDeclaration, opts: GraphQLGeneratorOptions): string {
  const lines: string[] = [];
  
  lines.push(`enum ${enumDecl.name.name} {`);
  
  for (const variant of enumDecl.variants) {
    lines.push(`  ${variant.name}`);
  }
  
  lines.push('}\n');
  
  return lines.join('\n');
}

/**
 * Generate object type from entity
 */
function generateObjectType(entity: EntityDeclaration, opts: GraphQLGeneratorOptions): string {
  const lines: string[] = [];
  const typeName = entity.name.name;
  
  // Type description
  if (opts.includeDescriptions) {
    lines.push(`"""Entity: ${typeName}"""`);
  }
  
  // Interfaces
  const interfaces: string[] = [];
  if (opts.schema?.relayStyleNodes && hasIdField(entity)) {
    interfaces.push('Node');
  }
  
  const implementsClause = interfaces.length > 0 
    ? ` implements ${interfaces.join(' & ')}` 
    : '';
  
  // Federation directives
  const federationDirectives = opts.federation?.enabled
    ? getFederationDirectives(typeName, opts)
    : '';
  
  lines.push(`type ${typeName}${implementsClause}${federationDirectives} {`);
  
  // Fields
  for (const field of entity.fields) {
    const fieldDef = generateFieldDefinition(field, opts);
    lines.push(`  ${fieldDef}`);
  }
  
  lines.push('}\n');
  
  return lines.join('\n');
}

/**
 * Generate field definition
 */
function generateFieldDefinition(field: FieldDeclaration, opts: GraphQLGeneratorOptions): string {
  const fieldName = toFieldCase(field.name.name, opts);
  const graphqlType = islTypeToGraphQL(field.type, opts);
  const nullable = field.optional ? '' : '!';
  
  let description = '';
  if (opts.includeDescriptions) {
    // Check for description annotation
    const descAnnotation = field.annotations.find(a => a.name.name === 'description');
    if (descAnnotation && descAnnotation.value?.kind === 'StringLiteral') {
      description = `"""${descAnnotation.value.value}"""\n  `;
    }
  }
  
  // Check for deprecated annotation
  let deprecated = '';
  const deprecatedAnnotation = field.annotations.find(a => a.name.name === 'deprecated');
  if (deprecatedAnnotation && opts.handleDeprecation) {
    const reason = deprecatedAnnotation.value?.kind === 'StringLiteral'
      ? deprecatedAnnotation.value.value
      : 'No longer supported';
    deprecated = ` @deprecated(reason: "${reason}")`;
  }
  
  return `${description}${fieldName}: ${graphqlType}${nullable}${deprecated}`;
}

/**
 * Generate input type for mutations
 */
function generateInputType(entity: EntityDeclaration, opts: GraphQLGeneratorOptions): string {
  const lines: string[] = [];
  const typeName = `${entity.name.name}${opts.naming?.inputSuffix || 'Input'}`;
  
  lines.push(`input ${typeName} {`);
  
  for (const field of entity.fields) {
    // Skip computed fields and id for create inputs
    if (field.computed || field.name.name.toLowerCase() === 'id') continue;
    
    const fieldName = toFieldCase(field.name.name, opts);
    const graphqlType = islTypeToGraphQL(field.type, opts, true);
    
    // All input fields are optional for updates
    lines.push(`  ${fieldName}: ${graphqlType}`);
  }
  
  lines.push('}\n');
  
  return lines.join('\n');
}

/**
 * Generate filter type for queries
 */
function generateFilterType(entity: EntityDeclaration, opts: GraphQLGeneratorOptions): string {
  const lines: string[] = [];
  const typeName = `${entity.name.name}${opts.naming?.filterSuffix || 'Filter'}`;
  
  lines.push(`input ${typeName} {`);
  
  // AND/OR/NOT for combining filters
  lines.push(`  AND: [${typeName}!]`);
  lines.push(`  OR: [${typeName}!]`);
  lines.push(`  NOT: ${typeName}`);
  
  for (const field of entity.fields) {
    const fieldName = toFieldCase(field.name.name, opts);
    const baseType = getBaseTypeName(field.type);
    
    // Generate filter operators based on type
    const filterFields = generateFilterFieldsForType(fieldName, baseType);
    lines.push(...filterFields.map(f => `  ${f}`));
  }
  
  lines.push('}\n');
  
  return lines.join('\n');
}

/**
 * Generate filter fields for a specific type
 */
function generateFilterFieldsForType(fieldName: string, typeName: string): string[] {
  const fields: string[] = [];
  
  // Equality
  fields.push(`${fieldName}: ${typeName}`);
  fields.push(`${fieldName}_not: ${typeName}`);
  fields.push(`${fieldName}_in: [${typeName}!]`);
  fields.push(`${fieldName}_notIn: [${typeName}!]`);
  
  // Comparison (for numeric/date types)
  if (['Int', 'Float', 'DateTime', 'Date', 'BigInt', 'Decimal'].includes(typeName)) {
    fields.push(`${fieldName}_lt: ${typeName}`);
    fields.push(`${fieldName}_lte: ${typeName}`);
    fields.push(`${fieldName}_gt: ${typeName}`);
    fields.push(`${fieldName}_gte: ${typeName}`);
  }
  
  // String operations
  if (typeName === 'String') {
    fields.push(`${fieldName}_contains: String`);
    fields.push(`${fieldName}_startsWith: String`);
    fields.push(`${fieldName}_endsWith: String`);
  }
  
  // Null check
  fields.push(`${fieldName}_isNull: Boolean`);
  
  return fields;
}

/**
 * Generate connection type for pagination
 */
function generateConnectionType(entity: EntityDeclaration, opts: GraphQLGeneratorOptions): string {
  const typeName = entity.name.name;
  const connectionName = `${typeName}${opts.naming?.connectionSuffix || 'Connection'}`;
  const edgeName = `${typeName}Edge`;
  
  return `type ${connectionName} {
  edges: [${edgeName}!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ${edgeName} {
  node: ${typeName}!
  cursor: String!
}
`;
}

/**
 * Generate sorting types
 */
function generateSortingTypes(entities: EntityDeclaration[], opts: GraphQLGeneratorOptions): string {
  const lines: string[] = [];
  
  // Sort direction enum
  lines.push(`enum SortDirection {
  ASC
  DESC
}
`);
  
  // Sort input for each entity
  for (const entity of entities) {
    const typeName = entity.name.name;
    lines.push(`input ${typeName}SortInput {`);
    
    for (const field of entity.fields) {
      const fieldName = toFieldCase(field.name.name, opts);
      lines.push(`  ${fieldName}: SortDirection`);
    }
    
    lines.push('}\n');
  }
  
  return lines.join('\n');
}

/**
 * Generate Query type
 */
function generateQueryType(domain: DomainDeclaration, opts: GraphQLGeneratorOptions): string {
  const lines: string[] = [];
  
  lines.push('type Query {');
  
  // Node interface for Relay
  if (opts.schema?.relayStyleNodes) {
    lines.push('  """Fetch any node by ID"""');
    lines.push('  node(id: ID!): Node');
  }
  
  // Generate queries for each entity
  for (const entity of domain.entities) {
    const typeName = entity.name.name;
    const fieldName = toCamelCase(typeName);
    const pluralName = pluralize(fieldName);
    
    // Single item query
    lines.push(`  """Fetch a single ${typeName} by ID"""`);
    lines.push(`  ${fieldName}(id: ID!): ${typeName}`);
    
    // List query with filtering and pagination
    if (opts.schema?.connectionTypes) {
      const filterType = `${typeName}${opts.naming?.filterSuffix || 'Filter'}`;
      const sortType = `${typeName}SortInput`;
      
      lines.push(`  """Fetch ${typeName} list with filtering and pagination"""`);
      lines.push(`  ${pluralName}(`);
      lines.push(`    where: ${filterType}`);
      lines.push(`    orderBy: ${sortType}`);
      lines.push(`    first: Int`);
      lines.push(`    after: String`);
      lines.push(`    last: Int`);
      lines.push(`    before: String`);
      lines.push(`  ): ${typeName}Connection!`);
    } else {
      lines.push(`  """Fetch all ${typeName} records"""`);
      lines.push(`  ${pluralName}: [${typeName}!]!`);
    }
  }
  
  // Add queries from behaviors that don't have side effects
  const queries = domain.behaviors.filter(b => !hasSideEffects(b) && !isSubscription(b));
  for (const behavior of queries) {
    lines.push(generateBehaviorField(behavior, opts));
  }
  
  lines.push('}\n');
  
  return lines.join('\n');
}

/**
 * Generate Mutation type
 */
function generateMutationType(
  domain: DomainDeclaration,
  mutations: BehaviorDeclaration[],
  opts: GraphQLGeneratorOptions
): string {
  const lines: string[] = [];
  
  lines.push('type Mutation {');
  
  // CRUD mutations for each entity
  for (const entity of domain.entities) {
    const typeName = entity.name.name;
    const fieldName = toCamelCase(typeName);
    const inputType = `${typeName}${opts.naming?.inputSuffix || 'Input'}`;
    
    // Create
    lines.push(`  """Create a new ${typeName}"""`);
    lines.push(`  create${typeName}(input: ${inputType}!): ${typeName}!`);
    
    // Update
    lines.push(`  """Update an existing ${typeName}"""`);
    lines.push(`  update${typeName}(id: ID!, input: ${inputType}!): ${typeName}!`);
    
    // Delete
    lines.push(`  """Delete a ${typeName}"""`);
    lines.push(`  delete${typeName}(id: ID!): Boolean!`);
  }
  
  // Add mutations from behaviors
  for (const behavior of mutations) {
    lines.push(generateBehaviorField(behavior, opts));
  }
  
  lines.push('}\n');
  
  return lines.join('\n');
}

/**
 * Generate Subscription type
 */
function generateSubscriptionType(
  subscriptions: BehaviorDeclaration[],
  opts: GraphQLGeneratorOptions
): string {
  const lines: string[] = [];
  
  lines.push('type Subscription {');
  
  for (const sub of subscriptions) {
    lines.push(generateBehaviorField(sub, opts));
  }
  
  lines.push('}\n');
  
  return lines.join('\n');
}

/**
 * Generate field from behavior
 */
function generateBehaviorField(behavior: BehaviorDeclaration, opts: GraphQLGeneratorOptions): string {
  const fieldName = toCamelCase(behavior.name.name);
  const lines: string[] = [];
  
  // Description
  if (opts.includeDescriptions && behavior.description) {
    lines.push(`  """${behavior.description.value}"""`);
  }
  
  // Arguments from input block
  const args: string[] = [];
  if (behavior.input?.fields) {
    for (const field of behavior.input.fields) {
      const argName = toFieldCase(field.name.name, opts);
      const argType = islTypeToGraphQL(field.type, opts);
      const nullable = field.optional ? '' : '!';
      args.push(`${argName}: ${argType}${nullable}`);
    }
  }
  
  // Return type from output block
  let returnType = 'Boolean';
  if (behavior.output?.success) {
    returnType = islTypeToGraphQL(behavior.output.success, opts);
  }
  
  const argsStr = args.length > 0 ? `(${args.join(', ')})` : '';
  lines.push(`  ${fieldName}${argsStr}: ${returnType}!`);
  
  return lines.join('\n');
}

/**
 * Generate federation directives
 */
function generateFederationDirectives(opts: GraphQLGeneratorOptions): string {
  if (opts.federation?.version === 2) {
    return `extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0",
        import: ["@key", "@shareable", "@external", "@requires", "@provides"])

`;
  }
  
  return '';
}

/**
 * Get federation directives for a type
 */
function getFederationDirectives(typeName: string, opts: GraphQLGeneratorOptions): string {
  if (!opts.federation?.enabled) return '';
  
  const directives: string[] = [];
  
  // Key directive
  const keys = opts.federation.entityKeys?.[typeName];
  if (keys && keys.length > 0) {
    directives.push(`@key(fields: "${keys.join(' ')}")`);
  }
  
  // Shareable directive
  if (opts.federation.shareableTypes?.includes(typeName)) {
    directives.push('@shareable');
  }
  
  return directives.length > 0 ? ` ${directives.join(' ')}` : '';
}

/**
 * Collect custom scalars needed
 */
function collectCustomScalars(domain: DomainDeclaration, opts: GraphQLGeneratorOptions): CustomScalar[] {
  const scalars = new Set<string>();
  const result: CustomScalar[] = [];
  
  // Check all entity fields
  for (const entity of domain.entities) {
    for (const field of entity.fields) {
      const typeName = getBaseTypeName(field.type);
      const mapping = DEFAULT_TYPE_MAPPINGS[typeName];
      if (mapping?.customScalar && !scalars.has(mapping.customScalar.name)) {
        scalars.add(mapping.customScalar.name);
        result.push(mapping.customScalar);
      }
    }
  }
  
  // Add configured custom scalars
  if (opts.schema?.customScalars) {
    for (const scalar of opts.schema.customScalars) {
      if (!scalars.has(scalar.name)) {
        scalars.add(scalar.name);
        result.push(scalar);
      }
    }
  }
  
  // Add PageInfo for connections
  if (opts.schema?.connectionTypes) {
    result.unshift({
      name: 'PageInfo',
      description: 'Information about pagination',
      islType: 'PageInfo',
    });
  }
  
  return result;
}

/**
 * Convert ISL type to GraphQL type
 */
function islTypeToGraphQL(type: TypeExpression, opts: GraphQLGeneratorOptions, isInput = false): string {
  switch (type.kind) {
    case 'SimpleType': {
      const typeName = type.name.name;
      const mapping = DEFAULT_TYPE_MAPPINGS[typeName];
      return mapping?.graphqlType || typeName;
    }
    
    case 'ArrayType': {
      const elementType = islTypeToGraphQL(type.elementType, opts, isInput);
      return `[${elementType}!]`;
    }
    
    case 'GenericType': {
      const baseName = type.name.name;
      if (baseName === 'List' || baseName === 'Set') {
        const elementType = islTypeToGraphQL(type.typeArguments[0], opts, isInput);
        return `[${elementType}!]`;
      }
      if (baseName === 'Optional') {
        return islTypeToGraphQL(type.typeArguments[0], opts, isInput);
      }
      return baseName;
    }
    
    case 'UnionType': {
      // GraphQL unions are handled separately
      return type.variants.map(v => v.name.name).join(' | ');
    }
    
    default:
      return 'String';
  }
}

/**
 * Get base type name from type expression
 */
function getBaseTypeName(type: TypeExpression): string {
  switch (type.kind) {
    case 'SimpleType':
      return type.name.name;
    case 'ArrayType':
      return getBaseTypeName(type.elementType);
    case 'GenericType':
      if (type.typeArguments.length > 0) {
        return getBaseTypeName(type.typeArguments[0]);
      }
      return type.name.name;
    default:
      return 'String';
  }
}

// ============================================
// Utility Functions
// ============================================

function mergeOptions(
  defaults: GraphQLGeneratorOptions,
  overrides: Partial<GraphQLGeneratorOptions>
): GraphQLGeneratorOptions {
  return {
    ...defaults,
    ...overrides,
    naming: { ...defaults.naming, ...overrides.naming },
    schema: { ...defaults.schema, ...overrides.schema },
    federation: { ...defaults.federation, ...overrides.federation },
  };
}

function toFieldCase(name: string, opts: GraphQLGeneratorOptions): string {
  const caseStyle = opts.naming?.fieldCase || 'camelCase';
  if (caseStyle === 'snake_case') {
    return toSnakeCase(name);
  }
  return toCamelCase(name);
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function pluralize(str: string): string {
  if (str.endsWith('s')) return str + 'es';
  if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
  return str + 's';
}

function hasIdField(entity: EntityDeclaration): boolean {
  return entity.fields.some(f => f.name.name.toLowerCase() === 'id');
}

function hasSideEffects(behavior: BehaviorDeclaration): boolean {
  // Check for postconditions that modify state
  if (behavior.postconditions?.conditions) {
    return true;
  }
  // Check for naming conventions
  const name = behavior.name.name.toLowerCase();
  return name.startsWith('create') || 
         name.startsWith('update') || 
         name.startsWith('delete') ||
         name.startsWith('add') ||
         name.startsWith('remove') ||
         name.startsWith('set');
}

function isSubscription(behavior: BehaviorDeclaration): boolean {
  const name = behavior.name.name.toLowerCase();
  return name.startsWith('on') || name.includes('subscribe') || name.includes('watch');
}

// Export PageInfo type generator
export function generatePageInfoType(): string {
  return `type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

interface Node {
  id: ID!
}
`;
}
