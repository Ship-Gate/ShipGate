// ============================================================================
// GraphQL Generator Types
// ============================================================================

export interface Domain {
  name: string;
  version?: string;
  types: TypeDeclaration[];
  entities: Entity[];
  behaviors: Behavior[];
}

export interface TypeDeclaration {
  name: string;
  baseType: string;
  constraints: string[];
}

export interface Entity {
  name: string;
  fields: Field[];
  relations?: Relation[];
}

export interface Field {
  name: string;
  type: string;
  optional: boolean;
  annotations: string[];
  constraints?: Constraint[];
}

export interface Constraint {
  expression: string;
  message?: string;
}

export interface Relation {
  name: string;
  target: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface Behavior {
  name: string;
  inputs: Field[];
  outputType: string;
  errors: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GraphQLOptions {
  outputDir: string;
  generateResolvers?: boolean;
  generateTypes?: boolean;
  federation?: boolean;
  subscriptions?: boolean;
}

// ============================================================================
// Advanced Generator Types
// ============================================================================

export interface GraphQLGeneratorOptions {
  /** Generate TypeScript types */
  generateTypes?: boolean;
  /** Generate resolver implementations */
  generateResolvers?: boolean;
  /** Include descriptions in schema */
  includeDescriptions?: boolean;
  /** Naming conventions */
  naming?: NamingOptions;
  /** Schema options */
  schema?: SchemaOptions;
  /** Apollo Federation options */
  federation?: FederationOptions;
  /** Resolver framework */
  resolverFramework?: ResolverFramework;
  /** Client framework */
  clientFramework?: ClientFramework;
  /** Handle deprecated fields */
  handleDeprecation?: boolean;
}

export interface NamingOptions {
  typeCase?: 'PascalCase' | 'camelCase';
  fieldCase?: 'camelCase' | 'snake_case';
  inputSuffix?: string;
  filterSuffix?: string;
  connectionSuffix?: string;
}

export interface SchemaOptions {
  connectionTypes?: boolean;
  inputTypes?: boolean;
  filterTypes?: boolean;
  sortingTypes?: boolean;
  relayStyleNodes?: boolean;
  customScalars?: CustomScalar[];
}

export interface FederationOptions {
  enabled?: boolean;
  version?: 1 | 2;
  entityKeys?: Record<string, string[]>;
  shareableTypes?: string[];
}

export type ResolverFramework = 'apollo-server' | 'graphql-yoga' | 'pothos' | 'type-graphql';

export type ClientFramework = 'apollo-client' | 'urql' | 'react-query';

export interface CustomScalar {
  name: string;
  description?: string;
  islType: string;
}

export interface TypeMapping {
  graphqlType: string;
  customScalar?: CustomScalar;
}

export const DEFAULT_TYPE_MAPPINGS: Record<string, TypeMapping> = {
  String: { graphqlType: 'String' },
  Int: { graphqlType: 'Int' },
  Float: { graphqlType: 'Float' },
  Boolean: { graphqlType: 'Boolean' },
  ID: { graphqlType: 'ID' },
  UUID: { graphqlType: 'ID', customScalar: { name: 'UUID', islType: 'UUID', description: 'UUID scalar' } },
  DateTime: { graphqlType: 'DateTime', customScalar: { name: 'DateTime', islType: 'DateTime', description: 'DateTime scalar' } },
  Timestamp: { graphqlType: 'DateTime', customScalar: { name: 'DateTime', islType: 'Timestamp', description: 'DateTime scalar' } },
  Decimal: { graphqlType: 'Decimal', customScalar: { name: 'Decimal', islType: 'Decimal', description: 'Decimal scalar' } },
  Email: { graphqlType: 'String' },
  URL: { graphqlType: 'String' },
  JSON: { graphqlType: 'JSON', customScalar: { name: 'JSON', islType: 'JSON', description: 'JSON scalar' } },
};

export interface GraphQLTypeDefinition {
  name: string;
  kind: 'type' | 'input' | 'enum' | 'union' | 'interface' | 'scalar';
  fields?: GraphQLFieldDefinition[];
  values?: GraphQLEnumValue[];
  interfaces?: string[];
  directives?: AppliedDirective[];
}

export interface GraphQLFieldDefinition {
  name: string;
  type: string;
  nullable: boolean;
  description?: string;
  directives?: AppliedDirective[];
  args?: GraphQLArgument[];
}

export interface GraphQLArgument {
  name: string;
  type: string;
  defaultValue?: string;
}

export interface GraphQLEnumValue {
  name: string;
  description?: string;
  deprecated?: string;
}

export interface AppliedDirective {
  name: string;
  args?: Record<string, unknown>;
}

export interface ResolverDefinition {
  type: string;
  field: string;
  resolver: string;
}

export interface ResolverMap {
  [type: string]: {
    [field: string]: string;
  };
}

export interface ClientOutput {
  queries: string;
  mutations: string;
  fragments: string;
  operationTypes: string;
  hooks: string;
}

// ============================================================================
// AST Types (for use in generators that need AST access)
// ============================================================================

export interface AST {
  domains?: ASTDomain[];
}

export interface ASTDomain {
  name: string;
  entities?: ASTEntity[];
  behaviors?: ASTBehavior[];
  enums?: ASTEnum[];
}

export interface ASTEntity {
  name: string;
  fields?: ASTField[];
  description?: string;
}

export interface ASTBehavior {
  name: string;
  input?: { fields?: ASTField[] };
  output?: { variants?: ASTVariant[] };
  description?: string;
}

export interface ASTField {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
}

export interface ASTEnum {
  name: string;
  values?: Array<string | { name: string; description?: string }>;
  description?: string;
}

export interface ASTVariant {
  name: string;
  fields?: ASTField[];
}
