// ============================================================================
// Mock Server Generator
// Transforms ISL domains into mock API servers
// ============================================================================

import type * as AST from '@intentos/isl-core';
import type {
  GenerateOptions,
  GeneratedFile,
  MockEndpoint,
  DataFactory,
  FieldGenerator,
} from './types';
import * as msw from './frameworks/msw';
import * as express from './frameworks/express';

/**
 * Generate mock server from ISL domain
 */
export function generate(
  domain: AST.Domain,
  options: GenerateOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Extract endpoints and factories from domain
  const endpoints = extractEndpoints(domain, options);
  const factories = extractFactories(domain, options);

  // Generate factories file (common to all frameworks)
  files.push({
    path: 'factories.ts',
    content: generateFactoriesFile(factories, options),
    type: 'factory',
  });

  switch (options.framework) {
    case 'msw':
      // Generate MSW handlers
      files.push({
        path: 'handlers.ts',
        content: msw.generateMswHandlers(endpoints, factories, options),
        type: 'handler',
      });

      // Generate browser setup
      files.push({
        path: 'browser.ts',
        content: msw.generateMswSetup(options),
        type: 'config',
      });

      // Generate node setup for testing
      files.push({
        path: 'server.ts',
        content: msw.generateMswNodeSetup(options),
        type: 'server',
      });

      // Generate index
      files.push({
        path: 'index.ts',
        content: generateMswIndex(),
        type: 'config',
      });
      break;

    case 'express':
      // Generate Express server
      files.push({
        path: 'server.ts',
        content: express.generateExpressServer(endpoints, factories, options),
        type: 'server',
      });

      // Generate package.json
      files.push({
        path: 'package.json',
        content: express.generateExpressPackageJson(options),
        type: 'config',
      });
      break;

    default:
      throw new Error(`Unsupported framework: ${options.framework}`);
  }

  // Generate seed data if using scenarios
  if (options.useScenarios && domain.scenarios) {
    files.push({
      path: 'seed-data.ts',
      content: generateSeedData(domain, factories, options),
      type: 'data',
    });
  }

  return files;
}

/**
 * Extract endpoints from domain behaviors
 */
function extractEndpoints(domain: AST.Domain, options: GenerateOptions): MockEndpoint[] {
  const endpoints: MockEndpoint[] = [];

  for (const behavior of domain.behaviors || []) {
    const method = inferHttpMethod(behavior.name);
    const path = inferPath(behavior.name);
    const outputType = inferOutputType(behavior, domain);

    const errors = (behavior.output?.errors || []).map((e) => ({
      name: e.name,
      statusCode: inferErrorStatusCode(e.name),
    }));

    endpoints.push({
      method,
      path,
      behaviorName: behavior.name,
      inputType: behavior.input ? `${behavior.name}Input` : undefined,
      outputType,
      errors,
    });
  }

  return endpoints;
}

/**
 * Extract factories from domain entities
 */
function extractFactories(domain: AST.Domain, options: GenerateOptions): DataFactory[] {
  const factories: DataFactory[] = [];

  for (const entity of domain.entities || []) {
    const fields: FieldGenerator[] = [];

    for (const field of entity.fields) {
      fields.push({
        name: field.name,
        generator: getFieldGenerator(field, domain),
        constraints: extractConstraints(field),
      });
    }

    factories.push({
      entityName: entity.name,
      fields,
    });
  }

  return factories;
}

/**
 * Get faker generator for field
 */
function getFieldGenerator(field: AST.Field, domain: AST.Domain): string {
  const type = field.type;

  if (type.kind === 'optional') {
    return `Math.random() > 0.5 ? ${getFieldGenerator({ ...field, type: type.innerType }, domain)} : undefined`;
  }

  if (type.kind === 'primitive') {
    return getPrimitiveGenerator(type.name, field.name);
  }

  if (type.kind === 'reference') {
    // Check if it's an enum
    const typeDecl = domain.types?.find((t) => t.name === type.name);
    if (typeDecl?.definition.kind === 'enum') {
      const values = typeDecl.definition.values.map((v) => `'${v.name}'`).join(', ');
      return `randomItem([${values}])`;
    }
    // Foreign key reference
    return 'crypto.randomUUID()';
  }

  if (type.kind === 'list') {
    const itemGen = getFieldGenerator({ ...field, type: type.elementType }, domain);
    return `Array.from({ length: randomInt(1, 5) }, () => ${itemGen})`;
  }

  return "'mock-value'";
}

/**
 * Get generator for primitive type
 */
function getPrimitiveGenerator(typeName: string, fieldName: string): string {
  // Use field name hints
  const lowerName = fieldName.toLowerCase();

  if (lowerName === 'id') return 'crypto.randomUUID()';
  if (lowerName.includes('email')) return "randomEmail()";
  if (lowerName.includes('name') && lowerName.includes('first')) return "randomFirstName()";
  if (lowerName.includes('name') && lowerName.includes('last')) return "randomLastName()";
  if (lowerName.includes('name')) return "randomFullName()";
  if (lowerName.includes('phone')) return "randomPhone()";
  if (lowerName.includes('url') || lowerName.includes('website')) return "randomUrl()";
  if (lowerName.includes('description') || lowerName.includes('content')) return "randomParagraph()";
  if (lowerName.includes('title')) return "randomTitle()";
  if (lowerName.includes('address')) return "randomAddress()";
  if (lowerName.includes('city')) return "randomCity()";
  if (lowerName.includes('country')) return "randomCountry()";

  // Use type hints
  const primitiveGenerators: Record<string, string> = {
    'String': "randomString(10)",
    'Int': 'randomInt(1, 100)',
    'Integer': 'randomInt(1, 100)',
    'Float': 'randomFloat(0, 100)',
    'Double': 'randomFloat(0, 100)',
    'Decimal': 'randomDecimal(0, 1000)',
    'Boolean': 'randomBoolean()',
    'Bool': 'randomBoolean()',
    'UUID': 'crypto.randomUUID()',
    'Timestamp': 'randomDate()',
    'Date': 'randomDate()',
    'DateTime': 'randomDate()',
    'Email': 'randomEmail()',
    'URL': 'randomUrl()',
    'Money': 'randomDecimal(0, 10000)',
  };

  return primitiveGenerators[typeName] || "'mock-value'";
}

/**
 * Extract constraints from field annotations
 */
function extractConstraints(field: AST.Field): Record<string, unknown> {
  const constraints: Record<string, unknown> = {};

  for (const annotation of field.annotations || []) {
    if (annotation.args && annotation.args.length > 0) {
      constraints[annotation.name] = annotation.args[0];
    }
  }

  return constraints;
}

/**
 * Generate factories file
 */
function generateFactoriesFile(factories: DataFactory[], options: GenerateOptions): string {
  const lines: string[] = [];

  // Header
  lines.push('// Auto-generated by @intentos/codegen-mocks');
  lines.push('');

  // Helper functions
  lines.push('// Helper functions');
  lines.push('const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;');
  lines.push('const randomFloat = (min: number, max: number) => Math.random() * (max - min) + min;');
  lines.push('const randomDecimal = (min: number, max: number) => Math.round(randomFloat(min, max) * 100) / 100;');
  lines.push('const randomBoolean = () => Math.random() > 0.5;');
  lines.push("const randomString = (length: number) => Array.from({ length }, () => String.fromCharCode(97 + randomInt(0, 25))).join('');");
  lines.push('const randomItem = <T>(items: T[]): T => items[randomInt(0, items.length - 1)];');
  lines.push('const randomDate = () => new Date(Date.now() - randomInt(0, 365 * 24 * 60 * 60 * 1000));');
  lines.push('');

  // Name generators
  lines.push('const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda"];');
  lines.push('const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"];');
  lines.push('const randomFirstName = () => randomItem(firstNames);');
  lines.push('const randomLastName = () => randomItem(lastNames);');
  lines.push('const randomFullName = () => `${randomFirstName()} ${randomLastName()}`;');
  lines.push('const randomEmail = () => `${randomString(8)}@example.com`;');
  lines.push('const randomPhone = () => `+1${randomInt(100, 999)}${randomInt(100, 999)}${randomInt(1000, 9999)}`;');
  lines.push('const randomUrl = () => `https://${randomString(10)}.example.com`;');
  lines.push('const randomParagraph = () => `Lorem ipsum dolor sit amet, ${randomString(50)}.`;');
  lines.push('const randomTitle = () => `${randomItem(["The", "A", "An"])} ${randomString(10)}`;');
  lines.push('const randomAddress = () => `${randomInt(1, 999)} ${randomString(10)} St`;');
  lines.push('const randomCity = () => randomItem(["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"]);');
  lines.push('const randomCountry = () => randomItem(["USA", "Canada", "UK", "Germany", "France"]);');
  lines.push('');

  // Factory functions
  lines.push('// Factory functions');
  lines.push('export const factories = {');

  for (const factory of factories) {
    // Single item factory
    lines.push(`  ${factory.entityName}: (overrides: Partial<Record<string, unknown>> = {}) => ({`);
    for (const field of factory.fields) {
      lines.push(`    ${field.name}: overrides.${field.name} ?? ${field.generator},`);
    }
    lines.push('  }),');
    lines.push('');

    // List factory
    lines.push(`  ${factory.entityName}List: (count: number, overrides: Partial<Record<string, unknown>> = {}) =>`);
    lines.push(`    Array.from({ length: count }, () => factories.${factory.entityName}(overrides)),`);
    lines.push('');
  }

  lines.push('};');
  lines.push('');
  lines.push('export default factories;');

  return lines.join('\n');
}

/**
 * Generate seed data from scenarios
 */
function generateSeedData(
  domain: AST.Domain,
  factories: DataFactory[],
  options: GenerateOptions
): string {
  const lines: string[] = [];

  lines.push('// Auto-generated seed data from ISL scenarios');
  lines.push("import { factories } from './factories';");
  lines.push('');
  lines.push('export const seedData: Record<string, unknown[]> = {');

  for (const factory of factories) {
    lines.push(`  ${factory.entityName}: [`);
    // Generate 5 sample items
    lines.push(`    ...factories.${factory.entityName}List(5),`);
    lines.push('  ],');
  }

  lines.push('};');
  lines.push('');
  lines.push('export default seedData;');

  return lines.join('\n');
}

/**
 * Generate MSW index file
 */
function generateMswIndex(): string {
  return `// Auto-generated by @intentos/codegen-mocks

export { handlers } from './handlers';
export { worker } from './browser';
export { server, setupMockServer, addHandler } from './server';
export { factories } from './factories';
`;
}

// Utility functions
function inferHttpMethod(name: string): MockEndpoint['method'] {
  const lowerName = name.toLowerCase();

  if (lowerName.startsWith('get') || lowerName.startsWith('list') || lowerName.startsWith('find')) {
    return 'GET';
  }
  if (lowerName.startsWith('create') || lowerName.startsWith('add')) {
    return 'POST';
  }
  if (lowerName.startsWith('update') || lowerName.startsWith('modify')) {
    return 'PUT';
  }
  if (lowerName.startsWith('patch')) {
    return 'PATCH';
  }
  if (lowerName.startsWith('delete') || lowerName.startsWith('remove')) {
    return 'DELETE';
  }

  return 'POST';
}

function inferPath(name: string): string {
  const match = name.match(/^(Get|Create|Update|Delete|List|Find|Add|Remove|Patch)(.+)$/i);

  if (match) {
    const [, action, resource] = match;
    const resourcePath = `/${toKebabCase(resource)}s`;

    switch (action.toLowerCase()) {
      case 'get':
      case 'delete':
      case 'update':
      case 'patch':
        return `${resourcePath}/:id`;
      default:
        return resourcePath;
    }
  }

  return `/${toKebabCase(name)}`;
}

function inferOutputType(behavior: AST.Behavior, domain: AST.Domain): string {
  if (!behavior.output?.success) {
    return 'void';
  }

  const success = behavior.output.success;

  if (success.kind === 'reference') {
    return success.name;
  }

  if (success.kind === 'list' && success.elementType.kind === 'reference') {
    return success.elementType.name;
  }

  // Try to infer from behavior name
  const match = behavior.name.match(/^(Get|Create|Update|Delete|List|Find)(.+)$/i);
  if (match) {
    return match[2];
  }

  return 'Unknown';
}

function inferErrorStatusCode(name: string): number {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('not_found')) return 404;
  if (lowerName.includes('unauthorized')) return 401;
  if (lowerName.includes('forbidden')) return 403;
  if (lowerName.includes('conflict') || lowerName.includes('exists')) return 409;
  if (lowerName.includes('invalid') || lowerName.includes('validation')) return 400;
  if (lowerName.includes('rate')) return 429;

  return 400;
}

function toKebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}
