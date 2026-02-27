// ============================================================================
// Netlify Edge Functions Code Generator
// ============================================================================

import type {
  DomainDeclaration,
  BehaviorDeclaration,
  TypeExpression,
} from '@isl-lang/isl-core';
import type {
  GeneratedEdgeCode,
  EdgeFile,
  EdgeConfig,
  EdgeManifest,
} from '../types';
import type { EdgeGenOptions } from '../generator';

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateNetlify(
  domain: DomainDeclaration,
  _options: EdgeGenOptions
): GeneratedEdgeCode {
  const files: EdgeFile[] = [];

  // Generate edge functions
  for (const behavior of domain.behaviors) {
    files.push({
      path: `netlify/edge-functions/${toKebabCase(behavior.name.name)}.ts`,
      type: 'handler',
      content: generateEdgeFunction(behavior),
    });
  }

  // Generate netlify.toml
  files.push({
    path: 'netlify.toml',
    type: 'config',
    content: generateNetlifyConfig(domain),
  });

  // Generate shared utilities
  files.push({
    path: 'netlify/edge-functions/lib/response.ts',
    type: 'middleware',
    content: generateResponseUtils(),
  });

  files.push({
    path: 'netlify/edge-functions/lib/context.ts',
    type: 'middleware',
    content: generateContextUtils(),
  });

  const config = generateEdgeConfig(domain);
  const manifest = generateManifest(domain);

  return { files, config, manifest };
}

// ============================================================================
// EDGE FUNCTIONS
// ============================================================================

function generateEdgeFunction(behavior: BehaviorDeclaration): string {
  const lines: string[] = [];
  const name = behavior.name.name;
  const inputFields = behavior.input?.fields ?? [];

  lines.push('// ============================================================================');
  lines.push(`// ${name} Edge Function`);
  lines.push('// ============================================================================');
  lines.push('');
  lines.push("import type { Context } from 'https://edge.netlify.com';");
  lines.push("import { jsonResponse, errorResponse } from './lib/response.ts';");
  lines.push('');

  // Input type
  lines.push(`interface ${name}Input {`);
  for (const field of inputFields) {
    const tsType = islTypeToTS(field.type);
    const optional = field.optional ? '?' : '';
    lines.push(`  ${field.name.name}${optional}: ${tsType};`);
  }
  lines.push('}');
  lines.push('');

  // Main handler
  lines.push('export default async function handler(');
  lines.push('  request: Request,');
  lines.push('  context: Context');
  lines.push('): Promise<Response> {');
  lines.push('  // Only handle POST');
  lines.push("  if (request.method !== 'POST') {");
  lines.push("    return errorResponse('Method not allowed', 405);");
  lines.push('  }');
  lines.push('');
  lines.push('  try {');
  lines.push(`    const input = await request.json() as ${name}Input;`);
  lines.push('');
  lines.push('    // Validate');
  lines.push('    const errors = validate(input);');
  lines.push('    if (errors.length > 0) {');
  lines.push("      return jsonResponse({ error: 'Validation failed', details: errors }, 400);");
  lines.push('    }');
  lines.push('');

  // Geo info available in Netlify
  lines.push('    // Geo information available from context');
  lines.push('    const geo = context.geo;');
  lines.push('    console.log(`Request from ${geo.city}, ${geo.country?.name}`);');
  lines.push('');

  lines.push('    // Business logic');
  lines.push('    // TODO: Implement');
  lines.push('');
  lines.push('    return jsonResponse({ success: true });');
  lines.push('');
  lines.push('  } catch (error) {');
  lines.push(`    console.error('${name} error:', error);`);
  lines.push("    return errorResponse('Internal server error', 500);");
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // Validation
  lines.push(`function validate(input: ${name}Input): string[] {`);
  lines.push('  const errors: string[] = [];');
  
  for (const field of inputFields) {
    if (!field.optional) {
      lines.push(`  if (input.${field.name.name} === undefined) {`);
      lines.push(`    errors.push('${field.name.name} is required');`);
      lines.push('  }');
    }
  }
  
  lines.push('  return errors;');
  lines.push('}');
  lines.push('');

  // Export config
  lines.push('export const config = {');
  lines.push(`  path: '/api/${toKebabCase(name)}',`);
  lines.push('};');

  return lines.join('\n');
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateResponseUtils(): string {
  return `// Response utilities for Netlify Edge Functions

export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

export function redirectResponse(url: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: { Location: url },
  });
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html' },
  });
}
`;
}

function generateContextUtils(): string {
  return `// Context utilities for Netlify Edge Functions

import type { Context } from 'https://edge.netlify.com';

export function getRequestId(request: Request): string {
  return request.headers.get('x-nf-request-id') ?? crypto.randomUUID();
}

export function getClientIp(request: Request): string {
  return request.headers.get('x-nf-client-connection-ip') ?? 'unknown';
}

export function getGeoInfo(context: Context) {
  return {
    country: context.geo.country?.code,
    countryName: context.geo.country?.name,
    city: context.geo.city,
    subdivision: context.geo.subdivision?.code,
    timezone: context.geo.timezone,
    latitude: context.geo.latitude,
    longitude: context.geo.longitude,
  };
}

export function getSiteInfo(context: Context) {
  return {
    id: context.site.id,
    name: context.site.name,
    url: context.site.url,
  };
}

export function getAccountInfo(context: Context) {
  return {
    id: context.account.id,
  };
}

// Blob store access
export async function getBlob(context: Context, key: string): Promise<string | null> {
  try {
    const store = context.cookies;  // Note: Use Netlify Blobs in production
    return store.get(key)?.value ?? null;
  } catch {
    return null;
  }
}
`;
}

// ============================================================================
// CONFIG
// ============================================================================

function generateNetlifyConfig(domain: DomainDeclaration): string {
  const lines: string[] = [];

  lines.push('[build]');
  lines.push('  publish = "dist"');
  lines.push('');

  lines.push('[dev]');
  lines.push('  framework = "#custom"');
  lines.push('  command = "npm run dev"');
  lines.push('  port = 3000');
  lines.push('');

  // Edge functions
  lines.push('[[edge_functions]]');
  for (const behavior of domain.behaviors) {
    const kebabName = toKebabCase(behavior.name.name);
    lines.push(`  path = "/api/${kebabName}"`);
    lines.push(`  function = "${kebabName}"`);
    lines.push('');
  }

  // Headers
  lines.push('[[headers]]');
  lines.push('  for = "/api/*"');
  lines.push('  [headers.values]');
  lines.push('    Access-Control-Allow-Origin = "*"');
  lines.push('    Access-Control-Allow-Methods = "GET, POST, OPTIONS"');
  lines.push('    Access-Control-Allow-Headers = "Content-Type, Authorization"');
  lines.push('');

  // Redirects for SPA
  lines.push('[[redirects]]');
  lines.push('  from = "/*"');
  lines.push('  to = "/index.html"');
  lines.push('  status = 200');

  return lines.join('\n');
}

function generateEdgeConfig(domain: DomainDeclaration): EdgeConfig {
  return {
    target: 'netlify-edge',
    entrypoint: 'netlify/edge-functions',
    bindings: [],
    routes: domain.behaviors.map((b: BehaviorDeclaration) => ({
      pattern: `/api/${toKebabCase(b.name.name)}`,
      handler: toKebabCase(b.name.name),
      method: 'POST',
    })),
    environment: {},
  };
}

function generateManifest(domain: DomainDeclaration): EdgeManifest {
  const version = domain.version?.value ?? '0.0.0';
  
  return {
    name: toKebabCase(domain.name.name),
    version,
    target: 'netlify-edge',
    behaviors: domain.behaviors.map((b: BehaviorDeclaration) => ({
      name: b.name.name,
      route: `/api/${toKebabCase(b.name.name)}`,
      method: 'POST',
      estimatedLatency: 30,
      memoryUsage: 128,
    })),
    storage: [],
    limits: {
      cpuTime: 50,
      memory: 128,
      requestSize: 2 * 1024 * 1024,
      responseSize: 2 * 1024 * 1024,
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function islTypeToTS(type: TypeExpression): string {
  switch (type.kind) {
    case 'SimpleType':
      switch (type.name.name) {
        case 'String': return 'string';
        case 'Int': return 'number';
        case 'Decimal': return 'number';
        case 'Boolean': return 'boolean';
        case 'Timestamp': return 'Date | string';
        case 'UUID': return 'string';
        default: return type.name.name;
      }
    case 'ArrayType':
      return type.elementType ? `${islTypeToTS(type.elementType)}[]` : 'unknown[]';
    case 'GenericType': {
      const typeArgs = type.typeArguments ?? [];
      if (type.name.name === 'Optional' && typeArgs.length === 1 && typeArgs[0]) {
        return `${islTypeToTS(typeArgs[0])} | null`;
      }
      return 'unknown';
    }
    default:
      return 'unknown';
  }
}
