// ============================================================================
// GraphQL Code Generation Types
// ============================================================================

/**
 * Target GraphQL server
 */
export type GraphQLServer =
  | 'apollo-server'
  | 'graphql-yoga'
  | 'mercurius'
  | 'pothos'
  | 'nexus'
  | 'type-graphql';

/**
 * Client library
 */
export type GraphQLClient =
  | 'apollo-client'
  | 'urql'
  | 'graphql-request'
  | 'relay';

/**
 * Generation options
 */
export interface GraphQLGeneratorOptions {
  /** Target server */
  server: GraphQLServer;

  /** Client library */
  client: GraphQLClient;

  /** Output directory */
  outputDir: string;

  /** Generate TypeScript types */
  generateTypes: boolean;

  /** Generate resolvers */
  generateResolvers: boolean;

  /** Generate client hooks */
  generateClientHooks: boolean;

  /** Generate subscriptions */
  generateSubscriptions: boolean;

  /** Use Relay-style connections */
  relayConnections: boolean;

  /** Generate DataLoader */
  generateDataLoader: boolean;

  /** Federation support */
  federation: boolean;

  /** Add ISL validation directives */
  islDirectives: boolean;

  /** Generate SDL file */
  generateSDL: boolean;

  /** Custom scalar mappings */
  scalarMappings?: Record<string, string>;
}

/**
 * Default options
 */
export const DEFAULT_OPTIONS: GraphQLGeneratorOptions = {
  server: 'apollo-server',
  client: 'apollo-client',
  outputDir: './generated',
  generateTypes: true,
  generateResolvers: true,
  generateClientHooks: true,
  generateSubscriptions: false,
  relayConnections: true,
  generateDataLoader: true,
  federation: false,
  islDirectives: true,
  generateSDL: true,
};

/**
 * Generated file
 */
export interface GeneratedFile {
  path: string;
  content: string;
  type: 'schema' | 'resolver' | 'types' | 'hooks' | 'dataloader' | 'config';
}

/**
 * Generation result
 */
export interface GenerationResult {
  files: GeneratedFile[];
  schema: string;
  warnings: string[];
  statistics: {
    types: number;
    queries: number;
    mutations: number;
    subscriptions: number;
    totalLines: number;
  };
}

/**
 * GraphQL type info
 */
export interface GraphQLTypeInfo {
  name: string;
  kind: 'OBJECT' | 'INPUT_OBJECT' | 'ENUM' | 'SCALAR' | 'INTERFACE' | 'UNION';
  isNonNull: boolean;
  isList: boolean;
  description?: string;
}

/**
 * GraphQL field info
 */
export interface GraphQLFieldInfo {
  name: string;
  type: GraphQLTypeInfo;
  args?: GraphQLArgInfo[];
  description?: string;
  deprecationReason?: string;
  directives?: GraphQLDirective[];
}

/**
 * GraphQL argument info
 */
export interface GraphQLArgInfo {
  name: string;
  type: GraphQLTypeInfo;
  defaultValue?: string;
  description?: string;
}

/**
 * GraphQL directive
 */
export interface GraphQLDirective {
  name: string;
  args?: Record<string, unknown>;
}

/**
 * ISL to GraphQL type mapping
 */
export const ISL_TO_GRAPHQL_TYPES: Record<string, string> = {
  'String': 'String',
  'Int': 'Int',
  'Float': 'Float',
  'Boolean': 'Boolean',
  'DateTime': 'DateTime',
  'Date': 'Date',
  'Time': 'Time',
  'UUID': 'ID',
  'Decimal': 'Float',
  'Money': 'Float',
  'Email': 'String',
  'URL': 'String',
  'Phone': 'String',
  'JSON': 'JSON',
  'Binary': 'String',
  'Void': 'Boolean',
  'Any': 'JSON',
};
