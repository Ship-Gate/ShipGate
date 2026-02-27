/**
 * Main Generation Entry Point
 *
 * Generate all GraphQL artifacts from ISL specifications.
 */

import { SchemaGenerator, SchemaGeneratorOptions } from './schema-generator.js';
import { ResolverGenerator, ResolverGeneratorOptions } from './resolver-generator.js';
import { ClientGenerator, ClientGeneratorOptions } from './client-generator.js';
import { SubscriptionGenerator, SubscriptionOptions } from './subscription-generator.js';
import { DataLoaderGenerator, DataLoaderOptions } from './dataloader-generator.js';

export interface GenerateOptions {
  /** Schema generation options */
  schema?: SchemaGeneratorOptions;
  /** Resolver generation options */
  resolvers?: ResolverGeneratorOptions;
  /** Client generation options */
  client?: ClientGeneratorOptions;
  /** Subscription generation options */
  subscriptions?: SubscriptionOptions;
  /** DataLoader generation options */
  dataLoaders?: DataLoaderOptions;
  /** What to generate */
  generate?: {
    schema?: boolean;
    resolvers?: boolean;
    client?: boolean;
    subscriptions?: boolean;
    dataLoaders?: boolean;
  };
}

export interface GeneratedOutput {
  /** Generated GraphQL schema */
  schema?: string;
  /** Generated resolver implementations */
  resolvers?: string;
  /** Generated client code */
  client?: string;
  /** Generated subscription infrastructure */
  subscriptions?: string;
  /** Generated DataLoader configurations */
  dataLoaders?: string;
}

/**
 * Generate all GraphQL artifacts from ISL
 */
export function generateGraphQL(
  islContent: string,
  options: GenerateOptions = {}
): GeneratedOutput {
  const generate = options.generate ?? {
    schema: true,
    resolvers: true,
    client: true,
    subscriptions: true,
    dataLoaders: true,
  };

  const output: GeneratedOutput = {};

  if (generate.schema) {
    const generator = new SchemaGenerator(options.schema);
    output.schema = generator.generate(islContent);
  }

  if (generate.resolvers) {
    const generator = new ResolverGenerator(options.resolvers);
    output.resolvers = generator.generate(islContent);
  }

  if (generate.client) {
    const generator = new ClientGenerator(options.client);
    output.client = generator.generate(islContent);
  }

  if (generate.subscriptions) {
    const generator = new SubscriptionGenerator(options.subscriptions);
    output.subscriptions = generator.generate(islContent);
  }

  if (generate.dataLoaders) {
    const generator = new DataLoaderGenerator(options.dataLoaders);
    output.dataLoaders = generator.generate(islContent);
  }

  return output;
}

/**
 * Generate schema string from ISL
 */
export function generateSchema(
  islContent: string,
  options?: SchemaGeneratorOptions
): string {
  const generator = new SchemaGenerator(options);
  return generator.generate(islContent);
}

/**
 * Generate resolver code from ISL
 */
export function generateResolvers(
  islContent: string,
  options?: ResolverGeneratorOptions
): string {
  const generator = new ResolverGenerator(options);
  return generator.generate(islContent);
}

/**
 * Generate client code from ISL
 */
export function generateClient(
  islContent: string,
  options?: ClientGeneratorOptions
): string {
  const generator = new ClientGenerator(options);
  return generator.generate(islContent);
}
