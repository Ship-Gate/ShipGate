// ============================================================================
// GraphQL Generator - Main
// ============================================================================

import type { Domain, GraphQLOptions, GeneratedFile } from './types';
import { generateSchema } from './schema';
import { generateResolvers } from './resolvers';
import { generateTypeScriptTypes } from './typescript';

export function generate(domain: Domain, options: GraphQLOptions): GeneratedFile[] {
  return generateGraphQL(domain, options);
}

export function generateGraphQL(domain: Domain, options: GraphQLOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const { outputDir, generateResolvers: genResolvers = true, generateTypes: genTypes = true } = options;

  // Schema
  files.push({
    path: `${outputDir}/schema.graphql`,
    content: generateSchema(domain, options),
  });

  // Resolvers
  if (genResolvers) {
    files.push({
      path: `${outputDir}/resolvers.ts`,
      content: generateResolvers(domain, options),
    });
  }

  // TypeScript types
  if (genTypes) {
    files.push({
      path: `${outputDir}/types.ts`,
      content: generateTypeScriptTypes(domain),
    });
  }

  // Index file
  files.push({
    path: `${outputDir}/index.ts`,
    content: generateIndexFile(genResolvers, genTypes),
  });

  return files;
}

function generateIndexFile(hasResolvers: boolean, hasTypes: boolean): string {
  const exports: string[] = [];
  
  exports.push("export { typeDefs } from './schema';");
  
  if (hasResolvers) {
    exports.push("export { resolvers } from './resolvers';");
  }
  
  if (hasTypes) {
    exports.push("export * from './types';");
  }

  return exports.join('\n');
}
