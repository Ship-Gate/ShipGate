// ============================================================================
// ISL Standard Library - GraphQL Types
// @isl-lang/stdlib-api
// ============================================================================

/**
 * GraphQL error location
 */
export interface GraphQLLocation {
  line: number;
  column: number;
}

/**
 * GraphQL error
 */
export interface GraphQLError {
  message: string;
  locations?: GraphQLLocation[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

/**
 * GraphQL query input
 */
export interface GraphQLQueryInput {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

/**
 * GraphQL query result
 */
export interface GraphQLResult<T = unknown> {
  data?: T;
  errors?: GraphQLError[];
  extensions?: Record<string, unknown>;
}

/**
 * GraphQL type kinds
 */
export const GraphQLTypeKind = {
  SCALAR: 'SCALAR',
  OBJECT: 'OBJECT',
  INTERFACE: 'INTERFACE',
  UNION: 'UNION',
  ENUM: 'ENUM',
  INPUT_OBJECT: 'INPUT_OBJECT',
  LIST: 'LIST',
  NON_NULL: 'NON_NULL',
} as const;

export type GraphQLTypeKind =
  (typeof GraphQLTypeKind)[keyof typeof GraphQLTypeKind];

/**
 * GraphQL type reference
 */
export interface GraphQLTypeRef {
  name: string;
  kind: GraphQLTypeKind;
  ofType?: GraphQLTypeRef;
}

/**
 * GraphQL input field
 */
export interface GraphQLInputField {
  name: string;
  type: GraphQLTypeRef;
  defaultValue?: unknown;
  description?: string;
}

/**
 * GraphQL directive usage
 */
export interface GraphQLDirectiveUsage {
  name: string;
  args?: Record<string, unknown>;
}

/**
 * GraphQL field
 */
export interface GraphQLField {
  name: string;
  type: GraphQLTypeRef;
  args?: GraphQLInputField[];
  description?: string;
  deprecated?: boolean;
  deprecationReason?: string;
  resolver?: string;
  directives?: GraphQLDirectiveUsage[];
}

/**
 * GraphQL type definition
 */
export interface GraphQLType {
  name: string;
  kind: GraphQLTypeKind;
  fields?: GraphQLField[];
  interfaces?: string[];
  enumValues?: string[];
  inputFields?: GraphQLInputField[];
  possibleTypes?: string[];
}

/**
 * GraphQL directive locations
 */
export const DirectiveLocation = {
  // Executable
  QUERY: 'QUERY',
  MUTATION: 'MUTATION',
  SUBSCRIPTION: 'SUBSCRIPTION',
  FIELD: 'FIELD',
  FRAGMENT_DEFINITION: 'FRAGMENT_DEFINITION',
  FRAGMENT_SPREAD: 'FRAGMENT_SPREAD',
  INLINE_FRAGMENT: 'INLINE_FRAGMENT',
  // Type System
  SCHEMA: 'SCHEMA',
  SCALAR: 'SCALAR',
  OBJECT: 'OBJECT',
  FIELD_DEFINITION: 'FIELD_DEFINITION',
  ARGUMENT_DEFINITION: 'ARGUMENT_DEFINITION',
  INTERFACE: 'INTERFACE',
  UNION: 'UNION',
  ENUM: 'ENUM',
  ENUM_VALUE: 'ENUM_VALUE',
  INPUT_OBJECT: 'INPUT_OBJECT',
  INPUT_FIELD_DEFINITION: 'INPUT_FIELD_DEFINITION',
} as const;

export type DirectiveLocation =
  (typeof DirectiveLocation)[keyof typeof DirectiveLocation];

/**
 * GraphQL directive definition
 */
export interface GraphQLDirective {
  name: string;
  description?: string;
  locations: DirectiveLocation[];
  args?: GraphQLInputField[];
}

/**
 * GraphQL schema definition
 */
export interface GraphQLSchema {
  types: GraphQLType[];
  queries: GraphQLField[];
  mutations?: GraphQLField[];
  subscriptions?: GraphQLField[];
  directives?: GraphQLDirective[];

  // Security
  depthLimit?: number;
  complexityLimit?: number;
  introspectionEnabled?: boolean;
}

/**
 * Create a GraphQL schema with defaults
 */
export function createSchema(
  config: Partial<GraphQLSchema> & { types: GraphQLType[]; queries: GraphQLField[] }
): GraphQLSchema {
  return {
    depthLimit: 10,
    complexityLimit: 1000,
    introspectionEnabled: true,
    ...config,
  };
}

/**
 * Generate SDL (Schema Definition Language) from a schema
 */
export function generateSdl(schema: GraphQLSchema): string {
  const lines: string[] = [];

  // Generate type definitions
  for (const type of schema.types) {
    switch (type.kind) {
      case 'SCALAR':
        lines.push(`scalar ${type.name}`);
        break;

      case 'ENUM':
        lines.push(`enum ${type.name} {`);
        for (const value of type.enumValues ?? []) {
          lines.push(`  ${value}`);
        }
        lines.push('}');
        break;

      case 'OBJECT':
        const implements_ = type.interfaces?.length
          ? ` implements ${type.interfaces.join(' & ')}`
          : '';
        lines.push(`type ${type.name}${implements_} {`);
        for (const field of type.fields ?? []) {
          const args = formatArgs(field.args);
          lines.push(`  ${field.name}${args}: ${formatTypeRef(field.type)}`);
        }
        lines.push('}');
        break;

      case 'INPUT_OBJECT':
        lines.push(`input ${type.name} {`);
        for (const field of type.inputFields ?? []) {
          lines.push(`  ${field.name}: ${formatTypeRef(field.type)}`);
        }
        lines.push('}');
        break;

      case 'INTERFACE':
        lines.push(`interface ${type.name} {`);
        for (const field of type.fields ?? []) {
          const args = formatArgs(field.args);
          lines.push(`  ${field.name}${args}: ${formatTypeRef(field.type)}`);
        }
        lines.push('}');
        break;

      case 'UNION':
        lines.push(`union ${type.name} = ${type.possibleTypes?.join(' | ') ?? ''}`);
        break;
    }
    lines.push('');
  }

  // Generate Query type
  if (schema.queries.length > 0) {
    lines.push('type Query {');
    for (const query of schema.queries) {
      const args = formatArgs(query.args);
      lines.push(`  ${query.name}${args}: ${formatTypeRef(query.type)}`);
    }
    lines.push('}');
    lines.push('');
  }

  // Generate Mutation type
  if (schema.mutations && schema.mutations.length > 0) {
    lines.push('type Mutation {');
    for (const mutation of schema.mutations) {
      const args = formatArgs(mutation.args);
      lines.push(`  ${mutation.name}${args}: ${formatTypeRef(mutation.type)}`);
    }
    lines.push('}');
    lines.push('');
  }

  // Generate Subscription type
  if (schema.subscriptions && schema.subscriptions.length > 0) {
    lines.push('type Subscription {');
    for (const subscription of schema.subscriptions) {
      const args = formatArgs(subscription.args);
      lines.push(`  ${subscription.name}${args}: ${formatTypeRef(subscription.type)}`);
    }
    lines.push('}');
  }

  return lines.join('\n');
}

/**
 * Format a type reference as SDL
 */
function formatTypeRef(typeRef: GraphQLTypeRef): string {
  if (typeRef.kind === 'NON_NULL' && typeRef.ofType) {
    return `${formatTypeRef(typeRef.ofType)}!`;
  }
  if (typeRef.kind === 'LIST' && typeRef.ofType) {
    return `[${formatTypeRef(typeRef.ofType)}]`;
  }
  return typeRef.name;
}

/**
 * Format field arguments as SDL
 */
function formatArgs(args?: GraphQLInputField[]): string {
  if (!args || args.length === 0) return '';

  const formatted = args.map((arg) => {
    let str = `${arg.name}: ${formatTypeRef(arg.type)}`;
    if (arg.defaultValue !== undefined) {
      str += ` = ${JSON.stringify(arg.defaultValue)}`;
    }
    return str;
  });

  return `(${formatted.join(', ')})`;
}

/**
 * Calculate query complexity
 */
export function calculateComplexity(
  query: string,
  _schema?: GraphQLSchema
): number {
  // Simple complexity calculation based on field count
  // In a real implementation, this would parse the query and calculate
  // based on field weights and list multipliers using the schema
  const fieldMatches = query.match(/\w+\s*[({]/g);
  return fieldMatches ? fieldMatches.length : 1;
}

/**
 * Calculate query depth
 */
export function calculateDepth(query: string): number {
  // Simple depth calculation based on nesting
  let maxDepth = 0;
  let currentDepth = 0;

  for (const char of query) {
    if (char === '{') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === '}') {
      currentDepth--;
    }
  }

  return maxDepth;
}

/**
 * Validate a query against schema limits
 */
export function validateQueryLimits(
  query: string,
  schema: GraphQLSchema
): string[] {
  const errors: string[] = [];

  const depth = calculateDepth(query);
  if (schema.depthLimit && depth > schema.depthLimit) {
    errors.push(`Query depth ${depth} exceeds limit of ${schema.depthLimit}`);
  }

  const complexity = calculateComplexity(query, schema);
  if (schema.complexityLimit && complexity > schema.complexityLimit) {
    errors.push(
      `Query complexity ${complexity} exceeds limit of ${schema.complexityLimit}`
    );
  }

  return errors;
}

export default {
  GraphQLTypeKind,
  DirectiveLocation,
  createSchema,
  generateSdl,
  calculateComplexity,
  calculateDepth,
  validateQueryLimits,
};
