// ============================================================================
// SDK Generator for Type-Safe Clients
// ============================================================================

import type { Domain, Behavior, Entity, HttpMethod } from './types.js';

/**
 * Generate a type-safe SDK client from domain specification
 */
export function generateSDK(domain: Domain): string {
  const entityTypes = generateEntityTypes(domain.entities ?? []);
  const behaviorMethods = generateBehaviorMethods(domain);
  const clientClass = generateClientClass(domain);

  return `/**
 * ${domain.name} SDK
 * 
 * Auto-generated type-safe client for ${domain.name} domain.
 */
import { ISLClient, type RequestConfig, type ApiResponse } from '@isl-lang/sdk-web';

// Entity Types
${entityTypes}

// Request/Response Types
${generateRequestResponseTypes(domain.behaviors)}

// Client Class
${clientClass}

// Factory function
export function create${pascalCase(domain.name)}Client(config?: Partial<RequestConfig>): ${pascalCase(domain.name)}Client {
  return new ${pascalCase(domain.name)}Client(config);
}
`;
}

/**
 * Generate TypeScript types for entities
 */
function generateEntityTypes(entities: Entity[]): string {
  return entities.map(entity => {
    const props = Object.entries(entity.properties)
      .map(([name, prop]) => {
        const optional = prop.required === false ? '?' : '';
        return `  ${name}${optional}: ${mapToTSType(prop.type)};`;
      })
      .join('\n');

    return `export interface ${entity.name} {
  id: string;
${props}
  createdAt: Date;
  updatedAt: Date;
}`;
  }).join('\n\n');
}

/**
 * Generate request/response types for behaviors
 */
function generateRequestResponseTypes(behaviors: Behavior[]): string {
  const types: string[] = [];

  for (const behavior of behaviors) {
    const baseName = pascalCase(behavior.name);

    // Input type
    if (behavior.input && Object.keys(behavior.input).length > 0) {
      const props = Object.entries(behavior.input)
        .map(([name, prop]) => {
          const optional = prop.required === false ? '?' : '';
          return `  ${name}${optional}: ${mapToTSType(prop.type)};`;
        })
        .join('\n');

      types.push(`export interface ${baseName}Request {
${props}
}`);
    }

    // Output type
    if (behavior.output && Object.keys(behavior.output).length > 0) {
      const props = Object.entries(behavior.output)
        .map(([name, prop]) => {
          const optional = prop.required === false ? '?' : '';
          return `  ${name}${optional}: ${mapToTSType(prop.type)};`;
        })
        .join('\n');

      types.push(`export interface ${baseName}Response {
${props}
}`);
    }

    // Error types
    if (behavior.errors) {
      for (const error of behavior.errors) {
        types.push(`export interface ${baseName}${pascalCase(error.name)}Error {
  code: string;
  message: string;
  status: ${error.status ?? 400};
}`);
      }
    }
  }

  return types.join('\n\n');
}

/**
 * Generate client class
 */
function generateClientClass(domain: Domain): string {
  const className = pascalCase(domain.name) + 'Client';
  const methods = domain.behaviors.map(b => generateMethod(b)).join('\n\n');

  return `export class ${className} extends ISLClient {
  constructor(config?: Partial<RequestConfig>) {
    super({
      baseUrl: '${domain.baseUrl ?? '/api/' + domain.name.toLowerCase()}',
      ...config,
    });
  }

${methods}
}`;
}

/**
 * Generate method from behavior
 */
function generateMethod(behavior: Behavior): string {
  const methodName = camelCase(behavior.name);
  const baseName = pascalCase(behavior.name);
  const httpMethod = behavior.method ?? inferHttpMethod(behavior.name);
  const path = behavior.path ?? inferPath(behavior.name);
  
  const hasInput = behavior.input && Object.keys(behavior.input).length > 0;
  const hasOutput = behavior.output && Object.keys(behavior.output).length > 0;

  const inputType = hasInput ? `${baseName}Request` : '';
  const outputType = hasOutput ? `${baseName}Response` : 'void';

  const params = hasInput ? `request: ${inputType}` : '';
  const returnType = `Promise<ApiResponse<${outputType}>>`;

  // Generate method body based on HTTP method
  let body: string;
  switch (httpMethod) {
    case 'GET':
      body = hasInput 
        ? `return this.get<${outputType}>(\`${path}\`, request as unknown as Record<string, string>);`
        : `return this.get<${outputType}>('${path}');`;
      break;
    case 'POST':
      body = `return this.post<${outputType}>('${path}'${hasInput ? ', request' : ''});`;
      break;
    case 'PUT':
      body = `return this.put<${outputType}>('${path}'${hasInput ? ', request' : ''});`;
      break;
    case 'PATCH':
      body = `return this.patch<${outputType}>('${path}'${hasInput ? ', request' : ''});`;
      break;
    case 'DELETE':
      body = `return this.delete<${outputType}>('${path}');`;
      break;
    default:
      body = `return this.post<${outputType}>('${path}'${hasInput ? ', request' : ''});`;
  }

  return `  /**
   * ${behavior.name}
   */
  async ${methodName}(${params}): ${returnType} {
    ${body}
  }`;
}

/**
 * Generate behavior methods for the class
 */
function generateBehaviorMethods(domain: Domain): string[] {
  return domain.behaviors.map(b => generateMethod(b));
}

// Helper functions
function inferHttpMethod(name: string): HttpMethod {
  const lower = name.toLowerCase();
  if (lower.startsWith('get') || lower.startsWith('list') || lower.startsWith('find')) return 'GET';
  if (lower.startsWith('create') || lower.startsWith('add')) return 'POST';
  if (lower.startsWith('update')) return 'PUT';
  if (lower.startsWith('patch')) return 'PATCH';
  if (lower.startsWith('delete') || lower.startsWith('remove')) return 'DELETE';
  return 'POST';
}

function inferPath(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('byid') || lower.includes('by_id')) return '/${id}';
  if (lower.startsWith('list')) return '/';
  if (lower.startsWith('create')) return '/';
  if (lower.startsWith('update') || lower.startsWith('delete')) return '/${id}';
  return '/' + snakeCase(name);
}

function mapToTSType(type: string): string {
  const mapping: Record<string, string> = {
    string: 'string',
    number: 'number',
    integer: 'number',
    boolean: 'boolean',
    object: 'Record<string, unknown>',
    array: 'unknown[]',
    date: 'Date',
    datetime: 'Date',
    uuid: 'string',
    email: 'string',
  };
  
  if (type.endsWith('[]')) {
    const inner = type.slice(0, -2);
    return `${mapToTSType(inner)}[]`;
  }

  return mapping[type] ?? type;
}

function pascalCase(str: string): string {
  return str.split(/[_\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function camelCase(str: string): string {
  const pascal = pascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function snakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}
