// ============================================================================
// GraphQL Resolvers Generator
// ============================================================================

import type { Domain, Entity, Behavior, GraphQLOptions } from './types';

export function generateResolvers(domain: Domain, options: GraphQLOptions): string {
  const lines: string[] = [];

  // Imports
  lines.push('// ============================================================================');
  lines.push(`// ${domain.name} GraphQL Resolvers`);
  lines.push('// Generated from ISL specification');
  lines.push('// ============================================================================');
  lines.push('');
  lines.push("import { GraphQLScalarType, Kind } from 'graphql';");
  lines.push("import type { Context } from './context';");
  lines.push('');

  // Custom scalars
  lines.push('// Custom Scalars');
  lines.push('const dateTimeScalar = new GraphQLScalarType({');
  lines.push("  name: 'DateTime',");
  lines.push("  description: 'DateTime custom scalar type',");
  lines.push('  serialize(value: unknown): string {');
  lines.push('    if (value instanceof Date) {');
  lines.push('      return value.toISOString();');
  lines.push('    }');
  lines.push("    throw Error('GraphQL DateTime Scalar serializer expected a Date object');");
  lines.push('  },');
  lines.push('  parseValue(value: unknown): Date {');
  lines.push("    if (typeof value === 'string') {");
  lines.push('      return new Date(value);');
  lines.push('    }');
  lines.push("    throw new Error('GraphQL DateTime Scalar parser expected a string');");
  lines.push('  },');
  lines.push('  parseLiteral(ast): Date {');
  lines.push('    if (ast.kind === Kind.STRING) {');
  lines.push('      return new Date(ast.value);');
  lines.push('    }');
  lines.push('    throw new Error("GraphQL DateTime Scalar literal parser expected a string");');
  lines.push('  },');
  lines.push('});');
  lines.push('');

  lines.push('const uuidScalar = new GraphQLScalarType({');
  lines.push("  name: 'UUID',");
  lines.push("  description: 'UUID custom scalar type',");
  lines.push('  serialize(value: unknown): string {');
  lines.push("    if (typeof value === 'string') {");
  lines.push('      return value;');
  lines.push('    }');
  lines.push("    throw Error('GraphQL UUID Scalar serializer expected a string');");
  lines.push('  },');
  lines.push('  parseValue(value: unknown): string {');
  lines.push("    if (typeof value === 'string') {");
  lines.push('      return value;');
  lines.push('    }');
  lines.push("    throw new Error('GraphQL UUID Scalar parser expected a string');");
  lines.push('  },');
  lines.push('  parseLiteral(ast): string {');
  lines.push('    if (ast.kind === Kind.STRING) {');
  lines.push('      return ast.value;');
  lines.push('    }');
  lines.push('    throw new Error("GraphQL UUID Scalar literal parser expected a string");');
  lines.push('  },');
  lines.push('});');
  lines.push('');

  // Resolvers object
  lines.push('export const resolvers = {');
  
  // Scalars
  lines.push('  // Custom Scalars');
  lines.push('  DateTime: dateTimeScalar,');
  lines.push('  UUID: uuidScalar,');
  lines.push('');

  // Query resolvers
  lines.push('  Query: {');
  for (const entity of domain.entities) {
    lines.push(...generateEntityQueryResolvers(entity));
  }
  lines.push('  },');
  lines.push('');

  // Mutation resolvers
  lines.push('  Mutation: {');
  for (const entity of domain.entities) {
    lines.push(...generateEntityMutationResolvers(entity));
  }
  for (const behavior of domain.behaviors) {
    lines.push(...generateBehaviorMutationResolvers(behavior));
  }
  lines.push('  },');
  lines.push('');

  // Subscription resolvers (if enabled)
  if (options.subscriptions) {
    lines.push('  Subscription: {');
    for (const entity of domain.entities) {
      lines.push(...generateEntitySubscriptionResolvers(entity));
    }
    lines.push('  },');
    lines.push('');
  }

  // Type resolvers for relations
  for (const entity of domain.entities) {
    if (entity.relations && entity.relations.length > 0) {
      lines.push(...generateTypeResolvers(entity));
    }
  }

  // Behavior result union resolvers
  for (const behavior of domain.behaviors) {
    if (behavior.errors.length > 0) {
      lines.push(`  ${behavior.name}Result: {`);
      lines.push('    __resolveType(obj: { result?: unknown; error?: string }) {');
      lines.push(`      if (obj.error) return '${behavior.name}Failure';`);
      lines.push(`      return '${behavior.name}Success';`);
      lines.push('    },');
      lines.push('  },');
      lines.push('');
    }
  }

  lines.push('};');

  return lines.join('\n');
}

function generateEntityQueryResolvers(entity: Entity): string[] {
  const lines: string[] = [];
  const name = entity.name;
  const nameLower = toCamelCase(name);
  const namePlural = `${nameLower}s`;
  const repoName = `${nameLower}Repository`;

  // Single entity query
  lines.push(`    // Get single ${name}`);
  lines.push(`    ${nameLower}: async (`);
  lines.push('      _parent: unknown,');
  lines.push('      args: { id: string },');
  lines.push('      context: Context');
  lines.push('    ) => {');
  lines.push(`      return context.${repoName}.findById(args.id);`);
  lines.push('    },');
  lines.push('');

  // List query with pagination
  lines.push(`    // Get ${name} list with pagination`);
  lines.push(`    ${namePlural}: async (`);
  lines.push('      _parent: unknown,');
  lines.push(`      args: { filter?: Record<string, unknown>; first?: number; after?: string; last?: number; before?: string },`);
  lines.push('      context: Context');
  lines.push('    ) => {');
  lines.push('      const { filter, first = 20, after, last, before } = args;');
  lines.push('');
  lines.push(`      const items = await context.${repoName}.findMany({`);
  lines.push('        filter,');
  lines.push('        limit: first || last,');
  lines.push('        cursor: after || before,');
  lines.push('        direction: last ? "backward" : "forward",');
  lines.push('      });');
  lines.push('');
  lines.push(`      const totalCount = await context.${repoName}.count(filter);`);
  lines.push('');
  lines.push('      return {');
  lines.push('        edges: items.map((item: { id: string }) => ({');
  lines.push('          node: item,');
  lines.push('          cursor: Buffer.from(item.id).toString("base64"),');
  lines.push('        })),');
  lines.push('        pageInfo: {');
  lines.push('          hasNextPage: items.length === (first || 20),');
  lines.push('          hasPreviousPage: !!after,');
  lines.push('          startCursor: items[0] ? Buffer.from(items[0].id).toString("base64") : null,');
  lines.push('          endCursor: items[items.length - 1] ? Buffer.from(items[items.length - 1].id).toString("base64") : null,');
  lines.push('        },');
  lines.push('        totalCount,');
  lines.push('      };');
  lines.push('    },');
  lines.push('');

  return lines;
}

function generateEntityMutationResolvers(entity: Entity): string[] {
  const lines: string[] = [];
  const name = entity.name;
  const nameLower = toCamelCase(name);
  const repoName = `${nameLower}Repository`;

  // Create
  lines.push(`    // Create ${name}`);
  lines.push(`    create${name}: async (`);
  lines.push('      _parent: unknown,');
  lines.push('      args: { input: Record<string, unknown> },');
  lines.push('      context: Context');
  lines.push('    ) => {');
  lines.push(`      return context.${repoName}.create(args.input);`);
  lines.push('    },');
  lines.push('');

  // Update
  lines.push(`    // Update ${name}`);
  lines.push(`    update${name}: async (`);
  lines.push('      _parent: unknown,');
  lines.push('      args: { id: string; input: Record<string, unknown> },');
  lines.push('      context: Context');
  lines.push('    ) => {');
  lines.push(`      return context.${repoName}.update(args.id, args.input);`);
  lines.push('    },');
  lines.push('');

  // Delete
  lines.push(`    // Delete ${name}`);
  lines.push(`    delete${name}: async (`);
  lines.push('      _parent: unknown,');
  lines.push('      args: { id: string },');
  lines.push('      context: Context');
  lines.push('    ) => {');
  lines.push(`      await context.${repoName}.delete(args.id);`);
  lines.push('      return true;');
  lines.push('    },');
  lines.push('');

  return lines;
}

function generateBehaviorMutationResolvers(behavior: Behavior): string[] {
  const lines: string[] = [];
  const name = behavior.name;
  const nameLower = toCamelCase(name);

  lines.push(`    // Execute ${name} behavior`);
  lines.push(`    ${nameLower}: async (`);
  lines.push('      _parent: unknown,');
  
  if (behavior.inputs.length > 0) {
    lines.push('      args: { input: Record<string, unknown> },');
  } else {
    lines.push('      _args: Record<string, never>,');
  }
  
  lines.push('      context: Context');
  lines.push('    ) => {');
  lines.push('      try {');
  
  if (behavior.inputs.length > 0) {
    lines.push(`        const result = await context.${nameLower}Service.execute(args.input);`);
  } else {
    lines.push(`        const result = await context.${nameLower}Service.execute();`);
  }
  
  if (behavior.errors.length > 0) {
    lines.push('        return { result };');
  } else {
    lines.push('        return { success: true, result };');
  }
  
  lines.push('      } catch (error) {');
  
  if (behavior.errors.length > 0) {
    lines.push('        return {');
    lines.push('          error: (error as Error).name,');
    lines.push('          message: (error as Error).message,');
    lines.push('        };');
  } else {
    lines.push('        return { success: false, result: null };');
  }
  
  lines.push('      }');
  lines.push('    },');
  lines.push('');

  return lines;
}

function generateEntitySubscriptionResolvers(entity: Entity): string[] {
  const lines: string[] = [];
  const name = entity.name;
  const nameLower = toCamelCase(name);

  lines.push(`    ${nameLower}Created: {`);
  lines.push('      subscribe: (_: unknown, __: unknown, context: Context) => {');
  lines.push(`        return context.pubsub.asyncIterator(['${name.toUpperCase()}_CREATED']);`);
  lines.push('      },');
  lines.push('    },');

  lines.push(`    ${nameLower}Updated: {`);
  lines.push('      subscribe: (_: unknown, __: unknown, context: Context) => {');
  lines.push(`        return context.pubsub.asyncIterator(['${name.toUpperCase()}_UPDATED']);`);
  lines.push('      },');
  lines.push('    },');

  lines.push(`    ${nameLower}Deleted: {`);
  lines.push('      subscribe: (_: unknown, __: unknown, context: Context) => {');
  lines.push(`        return context.pubsub.asyncIterator(['${name.toUpperCase()}_DELETED']);`);
  lines.push('      },');
  lines.push('    },');
  lines.push('');

  return lines;
}

function generateTypeResolvers(entity: Entity): string[] {
  const lines: string[] = [];
  
  if (!entity.relations || entity.relations.length === 0) {
    return lines;
  }

  lines.push(`  ${entity.name}: {`);
  
  for (const relation of entity.relations) {
    const targetLower = toCamelCase(relation.target);
    
    lines.push(`    ${relation.name}: async (`);
    lines.push(`      parent: { id: string; ${relation.name}Id?: string; ${relation.name}Ids?: string[] },`);
    lines.push('      _args: unknown,');
    lines.push('      context: Context');
    lines.push('    ) => {');
    
    if (relation.type === 'one-to-one') {
      lines.push(`      if (!parent.${relation.name}Id) return null;`);
      lines.push(`      return context.${targetLower}Repository.findById(parent.${relation.name}Id);`);
    } else if (relation.type === 'one-to-many') {
      lines.push(`      return context.${targetLower}Repository.findMany({`);
      lines.push(`        filter: { ${toCamelCase(entity.name)}Id: parent.id },`);
      lines.push('      });');
    } else if (relation.type === 'many-to-many') {
      lines.push(`      if (!parent.${relation.name}Ids) return [];`);
      lines.push(`      return context.${targetLower}Repository.findMany({`);
      lines.push(`        filter: { id: { in: parent.${relation.name}Ids } },`);
      lines.push('      });');
    }
    
    lines.push('    },');
  }
  
  lines.push('  },');
  lines.push('');

  return lines;
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}
