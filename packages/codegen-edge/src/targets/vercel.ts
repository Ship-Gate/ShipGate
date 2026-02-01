// ============================================================================
// Vercel Edge Functions Code Generator
// ============================================================================

import type * as AST from '../../../../master_contracts/ast';
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

export function generateVercel(
  domain: AST.Domain,
  options: EdgeGenOptions
): GeneratedEdgeCode {
  const files: EdgeFile[] = [];

  // Generate API routes
  for (const behavior of domain.behaviors) {
    files.push({
      path: `api/${toKebabCase(behavior.name.name)}/route.ts`,
      type: 'handler',
      content: generateRouteHandler(behavior, domain),
    });
  }

  // Generate middleware
  files.push({
    path: 'middleware.ts',
    type: 'middleware',
    content: generateMiddleware(domain, options),
  });

  // Generate vercel.json
  files.push({
    path: 'vercel.json',
    type: 'config',
    content: generateVercelConfig(domain, options),
  });

  // Generate edge-config client
  files.push({
    path: 'lib/edge-config.ts',
    type: 'middleware',
    content: generateEdgeConfigClient(),
  });

  // Generate KV client
  files.push({
    path: 'lib/kv.ts',
    type: 'middleware',
    content: generateKVClient(),
  });

  const config = generateEdgeConfig(domain, options);
  const manifest = generateManifest(domain, options);

  return { files, config, manifest };
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

function generateRouteHandler(behavior: AST.Behavior, domain: AST.Domain): string {
  const lines: string[] = [];
  const name = behavior.name.name;

  lines.push(`// ${name} Edge Function`);
  lines.push("import { NextRequest, NextResponse } from 'next/server';");
  lines.push("import { kv } from '../../lib/kv';");
  lines.push('');

  // Edge runtime directive
  lines.push("export const runtime = 'edge';");
  lines.push('');

  // Input type
  lines.push(`interface ${name}Input {`);
  for (const field of behavior.input.fields) {
    const tsType = islTypeToTS(field.type);
    const optional = field.optional ? '?' : '';
    lines.push(`  ${field.name.name}${optional}: ${tsType};`);
  }
  lines.push('}');
  lines.push('');

  // POST handler
  lines.push('export async function POST(request: NextRequest) {');
  lines.push('  try {');
  lines.push(`    const input = await request.json() as ${name}Input;`);
  lines.push('');
  lines.push('    // Validate input');
  lines.push(`    const errors = validate(input);`);
  lines.push('    if (errors.length > 0) {');
  lines.push('      return NextResponse.json(');
  lines.push("        { error: 'Validation failed', details: errors },");
  lines.push('        { status: 400 }');
  lines.push('      );');
  lines.push('    }');
  lines.push('');
  lines.push('    // Business logic');
  lines.push('    // TODO: Implement');
  lines.push('');
  lines.push('    return NextResponse.json({ success: true });');
  lines.push('');
  lines.push('  } catch (error) {');
  lines.push(`    console.error('Error in ${name}:', error);`);
  lines.push('    return NextResponse.json(');
  lines.push("      { error: 'Internal server error' },");
  lines.push('      { status: 500 }');
  lines.push('    );');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // Validation
  lines.push(`function validate(input: ${name}Input): string[] {`);
  lines.push('  const errors: string[] = [];');
  
  for (const field of behavior.input.fields) {
    if (!field.optional) {
      lines.push(`  if (input.${field.name.name} === undefined) {`);
      lines.push(`    errors.push('${field.name.name} is required');`);
      lines.push('  }');
    }
  }
  
  lines.push('  return errors;');
  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

function generateMiddleware(domain: AST.Domain, options: EdgeGenOptions): string {
  const lines: string[] = [];

  lines.push('// ============================================================================');
  lines.push(`// ${domain.name.name} Edge Middleware`);
  lines.push('// ============================================================================');
  lines.push('');
  lines.push("import { NextRequest, NextResponse } from 'next/server';");
  lines.push('');

  lines.push('export function middleware(request: NextRequest) {');
  lines.push('  const response = NextResponse.next();');
  lines.push('');
  
  // Add request ID
  lines.push("  // Add request ID");
  lines.push("  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();");
  lines.push("  response.headers.set('x-request-id', requestId);");
  lines.push('');

  // CORS
  if (options.cors) {
    lines.push('  // CORS headers');
    lines.push("  response.headers.set('Access-Control-Allow-Origin', '*');");
    lines.push("  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');");
    lines.push("  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');");
    lines.push('');
  }

  // Rate limiting headers
  if (options.rateLimit) {
    lines.push('  // Rate limit headers');
    lines.push("  response.headers.set('X-RateLimit-Limit', '100');");
    lines.push('');
  }

  lines.push('  return response;');
  lines.push('}');
  lines.push('');

  // Config
  lines.push('export const config = {');
  lines.push("  matcher: '/api/:path*',");
  lines.push('};');

  return lines.join('\n');
}

// ============================================================================
// CLIENTS
// ============================================================================

function generateEdgeConfigClient(): string {
  return `// ============================================================================
// Vercel Edge Config Client
// ============================================================================

import { createClient } from '@vercel/edge-config';

const edgeConfig = createClient(process.env.EDGE_CONFIG);

export async function getConfig<T>(key: string): Promise<T | undefined> {
  return edgeConfig.get<T>(key);
}

export async function getAllConfig(): Promise<Record<string, unknown>> {
  return edgeConfig.getAll() ?? {};
}

export async function hasConfig(key: string): Promise<boolean> {
  return edgeConfig.has(key);
}
`;
}

function generateKVClient(): string {
  return `// ============================================================================
// Vercel KV Client
// ============================================================================

import { kv as vercelKV } from '@vercel/kv';

export const kv = {
  async get<T>(key: string): Promise<T | null> {
    return vercelKV.get<T>(key);
  },

  async set<T>(key: string, value: T, options?: { ex?: number }): Promise<void> {
    if (options?.ex) {
      await vercelKV.set(key, value, { ex: options.ex });
    } else {
      await vercelKV.set(key, value);
    }
  },

  async del(key: string): Promise<void> {
    await vercelKV.del(key);
  },

  async exists(key: string): Promise<boolean> {
    return (await vercelKV.exists(key)) > 0;
  },

  async incr(key: string): Promise<number> {
    return vercelKV.incr(key);
  },

  async expire(key: string, seconds: number): Promise<void> {
    await vercelKV.expire(key, seconds);
  },

  // Hash operations
  async hget<T>(key: string, field: string): Promise<T | null> {
    return vercelKV.hget<T>(key, field);
  },

  async hset(key: string, field: string, value: unknown): Promise<void> {
    await vercelKV.hset(key, { [field]: value });
  },

  async hgetall<T>(key: string): Promise<T | null> {
    return vercelKV.hgetall<T>(key);
  },

  // List operations
  async lpush(key: string, ...values: unknown[]): Promise<number> {
    return vercelKV.lpush(key, ...values);
  },

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    return vercelKV.lrange<T>(key, start, stop);
  },
};

// Entity helpers
export async function getEntity<T>(type: string, id: string): Promise<T | null> {
  return kv.get<T>(\`\${type}:\${id}\`);
}

export async function setEntity<T>(
  type: string,
  id: string,
  entity: T,
  ttl?: number
): Promise<void> {
  await kv.set(\`\${type}:\${id}\`, entity, ttl ? { ex: ttl } : undefined);
}

export async function deleteEntity(type: string, id: string): Promise<void> {
  await kv.del(\`\${type}:\${id}\`);
}
`;
}

// ============================================================================
// CONFIG FILES
// ============================================================================

function generateVercelConfig(domain: AST.Domain, options: EdgeGenOptions): string {
  const config = {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    buildCommand: 'next build',
    framework: 'nextjs',
    functions: Object.fromEntries(
      domain.behaviors.map(b => [
        `api/${toKebabCase(b.name.name)}/route.ts`,
        {
          runtime: 'edge',
          maxDuration: 30,
        },
      ])
    ),
    env: {
      DOMAIN_NAME: domain.name.name,
      DOMAIN_VERSION: domain.version.value,
    },
  };

  return JSON.stringify(config, null, 2);
}

function generateEdgeConfig(domain: AST.Domain, options: EdgeGenOptions): EdgeConfig {
  return {
    target: 'vercel-edge',
    entrypoint: 'middleware.ts',
    bindings: [{ name: 'KV', type: 'kv', config: {} }],
    routes: domain.behaviors.map(b => ({
      pattern: `/api/${toKebabCase(b.name.name)}`,
      handler: `api/${toKebabCase(b.name.name)}/route.ts`,
      method: 'POST',
    })),
    environment: {},
  };
}

function generateManifest(domain: AST.Domain, options: EdgeGenOptions): EdgeManifest {
  return {
    name: toKebabCase(domain.name.name),
    version: domain.version.value,
    target: 'vercel-edge',
    behaviors: domain.behaviors.map(b => ({
      name: b.name.name,
      route: `/api/${toKebabCase(b.name.name)}`,
      method: 'POST',
      estimatedLatency: 25,
      memoryUsage: 128,
    })),
    storage: [{ type: 'kv', name: 'KV', usage: 'Entity storage' }],
    limits: {
      cpuTime: 30000,
      memory: 128,
      requestSize: 4 * 1024 * 1024,
      responseSize: 4 * 1024 * 1024,
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function islTypeToTS(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return 'string';
        case 'Int': return 'number';
        case 'Decimal': return 'number';
        case 'Boolean': return 'boolean';
        case 'Timestamp': return 'Date | string';
        case 'UUID': return 'string';
        default: return 'unknown';
      }
    case 'ListType':
      return `${islTypeToTS(type.element)}[]`;
    case 'OptionalType':
      return `${islTypeToTS(type.inner)} | null`;
    default:
      return 'unknown';
  }
}
