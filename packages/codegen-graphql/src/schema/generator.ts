/**
 * GraphQL Schema Generator - Generate SDL from ISL AST.
 */

import type { AST, ASTEntity, ASTBehavior, ASTField } from '../types.js';

/**
 * Map ISL type to GraphQL type
 */
function mapISLTypeToGraphQL(type: string, optional?: boolean): string {
  const typeMap: Record<string, string> = {
    String: 'String',
    Int: 'Int',
    Float: 'Float',
    Boolean: 'Boolean',
    ID: 'ID',
    UUID: 'ID',
    DateTime: 'DateTime',
    Timestamp: 'DateTime',
    Decimal: 'Float',
    Email: 'String',
    URL: 'String',
    JSON: 'JSON',
  };
  
  const gqlType = typeMap[type] ?? type;
  return optional ? gqlType : `${gqlType}!`;
}

/**
 * Schema generator configuration
 */
export interface SchemaGeneratorConfig {
  /** Enable Apollo Federation */
  federation?: boolean;
  /** Federation version (1 or 2) */
  federationVersion?: 1 | 2;
  /** Enable subscriptions */
  subscriptions?: boolean;
  /** Custom scalar mappings */
  customScalars?: Record<string, string>;
  /** Input type suffix */
  inputSuffix?: string;
  /** Result type suffix */
  resultSuffix?: string;
  /** Include descriptions */
  includeDescriptions?: boolean;
  /** Generate connection types for pagination */
  connectionTypes?: boolean;
}

const defaultConfig: Required<SchemaGeneratorConfig> = {
  federation: false,
  federationVersion: 2,
  subscriptions: true,
  customScalars: {},
  inputSuffix: 'Input',
  resultSuffix: 'Result',
  includeDescriptions: true,
  connectionTypes: true,
};

/**
 * Generate GraphQL schema from ISL AST
 */
export function generateGraphQLSchema(
  ast: AST,
  config: SchemaGeneratorConfig = {}
): string {
  const cfg = { ...defaultConfig, ...config };
  const lines: string[] = [];

  // Add federation directives if enabled
  if (cfg.federation) {
    lines.push(generateFederationDirectives(cfg.federationVersion));
    lines.push('');
  }

  // Add custom scalars
  lines.push(generateScalars(cfg));
  lines.push('');

  // Generate types for each domain
  for (const domain of ast.domains ?? []) {
    // Generate enums
    for (const enumDef of domain.enums ?? []) {
      lines.push(generateEnum(enumDef, cfg));
      lines.push('');
    }

    // Generate entities as types
    for (const entity of domain.entities ?? []) {
      lines.push(generateEntityType(entity, cfg));
      lines.push('');
    }

    // Generate input types from behaviors
    for (const behavior of domain.behaviors ?? []) {
      if (behavior.input) {
        lines.push(generateInputType(behavior, cfg));
        lines.push('');
      }
    }

    // Generate result union types
    for (const behavior of domain.behaviors ?? []) {
      if (behavior.output) {
        lines.push(generateResultType(behavior, cfg));
        lines.push('');
      }
    }

    // Generate connection types for pagination
    if (cfg.connectionTypes) {
      for (const entity of domain.entities ?? []) {
        lines.push(generateConnectionType(entity, cfg));
        lines.push('');
      }
    }
  }

  // Generate Query type
  lines.push(generateQueryType(ast, cfg));
  lines.push('');

  // Generate Mutation type
  lines.push(generateMutationType(ast, cfg));
  lines.push('');

  // Generate Subscription type if enabled
  if (cfg.subscriptions) {
    lines.push(generateSubscriptionType(ast, cfg));
    lines.push('');
  }

  return lines.join('\n');
}

function generateFederationDirectives(version: 1 | 2): string {
  if (version === 2) {
    return `extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable", "@external", "@requires", "@provides"])`;
  }
  return '';
}

function generateScalars(cfg: Required<SchemaGeneratorConfig>): string {
  const scalars = [
    'scalar DateTime',
    'scalar JSON',
    'scalar Email',
    'scalar URL',
    'scalar UUID',
    ...Object.entries(cfg.customScalars).map(([name, _]) => `scalar ${name}`),
  ];
  return scalars.join('\n');
}

function generateEnum(enumDef: any, cfg: Required<SchemaGeneratorConfig>): string {
  const lines: string[] = [];

  if (cfg.includeDescriptions && enumDef.description) {
    lines.push(`"""${enumDef.description}"""`);
  }

  lines.push(`enum ${enumDef.name} {`);

  for (const value of enumDef.values ?? []) {
    if (typeof value === 'string') {
      lines.push(`  ${value}`);
    } else {
      if (cfg.includeDescriptions && value.description) {
        lines.push(`  """${value.description}"""`);
      }
      lines.push(`  ${value.name}`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

function generateEntityType(entity: any, cfg: Required<SchemaGeneratorConfig>): string {
  const lines: string[] = [];

  if (cfg.includeDescriptions && entity.description) {
    lines.push(`"""${entity.description}"""`);
  }

  // Add federation key directive if enabled
  const keyField = entity.fields?.find((f: any) => f.name === 'id');
  const federationDirective = cfg.federation && keyField ? ' @key(fields: "id")' : '';

  lines.push(`type ${entity.name}${federationDirective} {`);

  for (const field of entity.fields ?? []) {
    const graphqlType = mapISLTypeToGraphQL(field.type, field.optional);
    
    if (cfg.includeDescriptions && field.description) {
      lines.push(`  """${field.description}"""`);
    }
    
    lines.push(`  ${field.name}: ${graphqlType}`);
  }

  // Add standard timestamp fields
  lines.push('  createdAt: DateTime!');
  lines.push('  updatedAt: DateTime!');

  lines.push('}');
  return lines.join('\n');
}

function generateInputType(behavior: any, cfg: Required<SchemaGeneratorConfig>): string {
  const lines: string[] = [];
  const inputName = `${behavior.name}${cfg.inputSuffix}`;

  if (cfg.includeDescriptions && behavior.description) {
    lines.push(`"""Input for ${behavior.name}"""`);
  }

  lines.push(`input ${inputName} {`);

  for (const field of behavior.input?.fields ?? []) {
    const graphqlType = mapISLTypeToGraphQL(field.type, field.optional);
    lines.push(`  ${field.name}: ${graphqlType}`);
  }

  lines.push('}');
  return lines.join('\n');
}

function generateResultType(behavior: any, cfg: Required<SchemaGeneratorConfig>): string {
  const lines: string[] = [];
  const resultName = `${behavior.name}${cfg.resultSuffix}`;
  const variants: string[] = [];

  // Generate variant types
  for (const variant of behavior.output?.variants ?? []) {
    const variantTypeName = `${behavior.name}${variant.name}`;
    variants.push(variantTypeName);

    if (variant.fields?.length > 0) {
      lines.push(`type ${variantTypeName} {`);
      for (const field of variant.fields) {
        const graphqlType = mapISLTypeToGraphQL(field.type, field.optional);
        lines.push(`  ${field.name}: ${graphqlType}`);
      }
      lines.push('}');
      lines.push('');
    } else {
      // Empty variant becomes a type with just a message field
      lines.push(`type ${variantTypeName} {`);
      lines.push('  message: String!');
      lines.push('}');
      lines.push('');
    }
  }

  // Generate union type
  lines.push(`union ${resultName} = ${variants.join(' | ')}`);

  return lines.join('\n');
}

function generateConnectionType(entity: any, cfg: Required<SchemaGeneratorConfig>): string {
  const lines: string[] = [];
  const typeName = entity.name;

  lines.push(`type ${typeName}Connection {`);
  lines.push(`  edges: [${typeName}Edge!]!`);
  lines.push('  pageInfo: PageInfo!');
  lines.push('  totalCount: Int');
  lines.push('}');
  lines.push('');
  lines.push(`type ${typeName}Edge {`);
  lines.push(`  node: ${typeName}!`);
  lines.push('  cursor: String!');
  lines.push('}');

  return lines.join('\n');
}

function generateQueryType(ast: AST, cfg: Required<SchemaGeneratorConfig>): string {
  const lines: string[] = [];
  lines.push('type Query {');

  for (const domain of ast.domains ?? []) {
    for (const behavior of domain.behaviors ?? []) {
      // Only generate queries for "Get" and "List" behaviors
      if (behavior.name.startsWith('Get') || behavior.name.startsWith('List') || behavior.name.startsWith('Search')) {
        const fieldName = behaviorToQueryField(behavior.name);
        const resultType = `${behavior.name}${cfg.resultSuffix}`;
        
        const inputFields = behavior.input?.fields;
        if (inputFields && inputFields.length > 0) {
          const args = inputFields
            .map((f: ASTField) => `${f.name}: ${mapISLTypeToGraphQL(f.type, f.optional)}`)
            .join(', ');
          lines.push(`  ${fieldName}(${args}): ${resultType}!`);
        } else {
          lines.push(`  ${fieldName}: ${resultType}!`);
        }
      }
    }

    // Add connection queries for entities
    if (cfg.connectionTypes) {
      for (const entity of domain.entities ?? []) {
        const fieldName = entity.name.toLowerCase() + 's';
        lines.push(`  ${fieldName}(first: Int, after: String, last: Int, before: String): ${entity.name}Connection!`);
      }
    }
  }

  lines.push('}');
  return lines.join('\n');
}

function generateMutationType(ast: AST, cfg: Required<SchemaGeneratorConfig>): string {
  const lines: string[] = [];
  lines.push('type Mutation {');

  for (const domain of ast.domains ?? []) {
    for (const behavior of domain.behaviors ?? []) {
      // Generate mutations for "Create", "Update", "Delete" behaviors
      if (
        behavior.name.startsWith('Create') ||
        behavior.name.startsWith('Update') ||
        behavior.name.startsWith('Delete')
      ) {
        const fieldName = behaviorToMutationField(behavior.name);
        const inputType = `${behavior.name}${cfg.inputSuffix}`;
        const resultType = `${behavior.name}${cfg.resultSuffix}`;

        const mutationInputFields = behavior.input?.fields;
        if (mutationInputFields && mutationInputFields.length > 0) {
          lines.push(`  ${fieldName}(input: ${inputType}!): ${resultType}!`);
        } else {
          lines.push(`  ${fieldName}: ${resultType}!`);
        }
      }
    }
  }

  lines.push('}');
  return lines.join('\n');
}

function generateSubscriptionType(ast: AST, cfg: Required<SchemaGeneratorConfig>): string {
  const lines: string[] = [];
  lines.push('type Subscription {');

  for (const domain of ast.domains ?? []) {
    for (const entity of domain.entities ?? []) {
      const typeName = entity.name;
      const fieldName = typeName.charAt(0).toLowerCase() + typeName.slice(1);
      
      lines.push(`  ${fieldName}Created: ${typeName}!`);
      lines.push(`  ${fieldName}Updated(id: ID!): ${typeName}!`);
      lines.push(`  ${fieldName}Deleted: ID!`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

function behaviorToQueryField(name: string): string {
  // GetUser -> user, ListUsers -> users, SearchUsers -> searchUsers
  if (name.startsWith('Get')) {
    const entity = name.slice(3);
    return entity.charAt(0).toLowerCase() + entity.slice(1);
  }
  if (name.startsWith('List')) {
    const entity = name.slice(4);
    return entity.charAt(0).toLowerCase() + entity.slice(1);
  }
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function behaviorToMutationField(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

// Add PageInfo type to scalars/common types
const pageInfoType = `
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
`;
