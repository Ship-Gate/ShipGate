// ============================================================================
// Cloudflare Workers/Pages Code Generator
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

export function generateCloudflare(
  domain: DomainDeclaration,
  options: EdgeGenOptions
): GeneratedEdgeCode {
  const files: EdgeFile[] = [];
  const isPages = options.target === 'cloudflare-pages';

  // Generate main handler
  files.push({
    path: isPages ? 'functions/[[path]].ts' : 'src/index.ts',
    type: 'handler',
    content: generateMainHandler(domain, options, isPages),
  });

  // Generate behavior handlers
  for (const behavior of domain.behaviors) {
    if (isPages) {
      files.push({
        path: `functions/api/${toKebabCase(behavior.name.name)}.ts`,
        type: 'handler',
        content: generatePagesHandler(behavior),
      });
    } else {
      files.push({
        path: `src/handlers/${toKebabCase(behavior.name.name)}.ts`,
        type: 'handler',
        content: generateWorkerHandler(behavior),
      });
    }
  }

  // Generate wrangler.toml
  files.push({
    path: 'wrangler.toml',
    type: 'config',
    content: generateWranglerConfig(domain, options),
  });

  // Generate Durable Object if needed
  if (hasStatefulEntities(domain)) {
    files.push({
      path: 'src/durable-objects/entity-store.ts',
      type: 'handler',
      content: generateDurableObject(),
    });
  }

  const config = generateEdgeConfig(domain, options);
  const manifest = generateManifest(domain, options);

  return { files, config, manifest };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

function generateMainHandler(
  domain: DomainDeclaration,
  options: EdgeGenOptions,
  isPages: boolean
): string {
  const lines: string[] = [];

  lines.push('// ============================================================================');
  lines.push(`// ${domain.name.name} Cloudflare ${isPages ? 'Pages' : 'Worker'}`);
  lines.push('// Auto-generated from ISL specification');
  lines.push('// ============================================================================');
  lines.push('');

  if (!isPages) {
    // Worker imports
    lines.push("import { Router } from 'itty-router';");
    
    // Import handlers
    for (const behavior of domain.behaviors) {
      const handlerName = `handle${behavior.name.name}`;
      const fileName = toKebabCase(behavior.name.name);
      lines.push(`import { ${handlerName} } from './handlers/${fileName}';`);
    }
    lines.push('');

    // Define environment interface
    lines.push('export interface Env {');
    lines.push('  KV: KVNamespace;');
    if (options.storageBackend === 'd1') {
      lines.push('  DB: D1Database;');
    }
    lines.push('}');
    lines.push('');

    // Create router
    lines.push('const router = Router();');
    lines.push('');

    // Add routes
    for (const behavior of domain.behaviors) {
      const route = `/api/${toKebabCase(behavior.name.name)}`;
      const handler = `handle${behavior.name.name}`;
      lines.push(`router.post('${route}', ${handler});`);
    }
    lines.push('');

    // Health check
    lines.push("router.get('/health', () => new Response(JSON.stringify({ status: 'ok' }), {");
    lines.push("  headers: { 'Content-Type': 'application/json' },");
    lines.push('}));');
    lines.push('');

    // 404 handler
    lines.push('router.all(\'*\', () => new Response(\'Not Found\', { status: 404 }));');
    lines.push('');

    // Export default
    lines.push('export default {');
    lines.push('  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {');
    lines.push('    return router.handle(request, env, ctx);');
    lines.push('  },');
    lines.push('};');
  } else {
    // Pages function (catch-all)
    lines.push('export const onRequest: PagesFunction = async (context) => {');
    lines.push('  return new Response(\'Not Found\', { status: 404 });');
    lines.push('};');
  }

  return lines.join('\n');
}

// ============================================================================
// BEHAVIOR HANDLERS
// ============================================================================

function generateWorkerHandler(behavior: BehaviorDeclaration): string {
  const lines: string[] = [];
  const name = behavior.name.name;
  const inputFields = behavior.input?.fields ?? [];

  lines.push(`// Handler for ${name}`);
  lines.push('');
  lines.push("import type { Env } from '../index';");
  lines.push("import { jsonResponse, errorResponse, validationErrorResponse } from '../response';");
  lines.push(`import { validate${name}Input } from '../validation';`);
  lines.push('');

  // Input/Output types
  lines.push(`export interface ${name}Input {`);
  for (const field of inputFields) {
    const tsType = islTypeToTS(field.type);
    const optional = field.optional ? '?' : '';
    lines.push(`  ${field.name.name}${optional}: ${tsType};`);
  }
  lines.push('}');
  lines.push('');

  // Handler function
  lines.push(`export async function handle${name}(`);
  lines.push('  request: Request,');
  lines.push('  _env: Env,');
  lines.push('  _ctx: ExecutionContext');
  lines.push('): Promise<Response> {');
  lines.push('  try {');
  lines.push('    // Parse request body');
  lines.push(`    const input = await request.json() as ${name}Input;`);
  lines.push('');
  lines.push('    // Validate input');
  lines.push(`    const validation = validate${name}Input(input);`);
  lines.push('    if (!validation.valid) {');
  lines.push('      return validationErrorResponse(validation.errors);');
  lines.push('    }');
  lines.push('');

  // Generate precondition checks
  const preconditions = behavior.preconditions?.conditions ?? [];
  if (preconditions.length > 0) {
    lines.push('    // Precondition checks');
    for (let i = 0; i < preconditions.length; i++) {
      lines.push(`    // TODO: Implement precondition ${i + 1}`);
    }
    lines.push('');
  }

  // Main logic placeholder
  lines.push('    // Business logic');
  lines.push('    // TODO: Implement behavior logic');
  lines.push('');

  // Generate result
  lines.push('    const result = { success: true };');
  lines.push('    return jsonResponse(result);');
  lines.push('');
  lines.push('  } catch (error) {');
  lines.push('    console.error(`Error in ${name}:`, error);');
  lines.push("    return errorResponse('Internal server error');");
  lines.push('  }');
  lines.push('}');

  return lines.join('\n');
}

function generatePagesHandler(behavior: BehaviorDeclaration): string {
  const lines: string[] = [];
  const name = behavior.name.name;

  lines.push(`// ${name} Pages Function`);
  lines.push('');
  lines.push('export const onRequestPost: PagesFunction = async (context) => {');
  lines.push('  try {');
  lines.push('    const input = await context.request.json();');
  lines.push('');
  lines.push('    // TODO: Implement validation and business logic');
  lines.push('');
  lines.push('    return new Response(JSON.stringify({ success: true }), {');
  lines.push("      headers: { 'Content-Type': 'application/json' },");
  lines.push('    });');
  lines.push('  } catch (error) {');
  lines.push('    return new Response(JSON.stringify({ error: String(error) }), {');
  lines.push('      status: 500,');
  lines.push("      headers: { 'Content-Type': 'application/json' },");
  lines.push('    });');
  lines.push('  }');
  lines.push('};');

  return lines.join('\n');
}

// ============================================================================
// DURABLE OBJECTS
// ============================================================================

function generateDurableObject(): string {
  const lines: string[] = [];

  lines.push('// ============================================================================');
  lines.push('// Entity Store Durable Object');
  lines.push('// Provides strongly consistent entity storage');
  lines.push('// ============================================================================');
  lines.push('');
  lines.push('export class EntityStore implements DurableObject {');
  lines.push('  private state: DurableObjectState;');
  lines.push('  private storage: DurableObjectStorage;');
  lines.push('');
  lines.push('  constructor(state: DurableObjectState) {');
  lines.push('    this.state = state;');
  lines.push('    this.storage = state.storage;');
  lines.push('  }');
  lines.push('');
  lines.push('  async fetch(request: Request): Promise<Response> {');
  lines.push('    const url = new URL(request.url);');
  lines.push('    const action = url.pathname.split(\'/\').pop();');
  lines.push('');
  lines.push("    switch (action) {");
  lines.push("      case 'get': {");
  lines.push("        const key = url.searchParams.get('key');");
  lines.push("        if (!key) return new Response('Missing key', { status: 400 });");
  lines.push('        const value = await this.storage.get(key);');
  lines.push('        if (!value) return new Response(null, { status: 404 });');
  lines.push('        return new Response(JSON.stringify(value), {');
  lines.push("          headers: { 'Content-Type': 'application/json' },");
  lines.push('        });');
  lines.push('      }');
  lines.push('');
  lines.push("      case 'put': {");
  lines.push('        const body = await request.json();');
  lines.push('        const { key, value } = body as { key: string; value: unknown };');
  lines.push('        await this.storage.put(key, value);');
  lines.push("        return new Response('OK');");
  lines.push('      }');
  lines.push('');
  lines.push("      case 'delete': {");
  lines.push("        const key = url.searchParams.get('key');");
  lines.push("        if (!key) return new Response('Missing key', { status: 400 });");
  lines.push('        await this.storage.delete(key);');
  lines.push("        return new Response('OK');");
  lines.push('      }');
  lines.push('');
  lines.push("      case 'list': {");
  lines.push("        const prefix = url.searchParams.get('prefix') ?? '';");
  lines.push('        const entries = await this.storage.list({ prefix });');
  lines.push('        return new Response(JSON.stringify(Object.fromEntries(entries)), {');
  lines.push("          headers: { 'Content-Type': 'application/json' },");
  lines.push('        });');
  lines.push('      }');
  lines.push('');
  lines.push('      default:');
  lines.push("        return new Response('Unknown action', { status: 400 });");
  lines.push('    }');
  lines.push('  }');
  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// CONFIG FILES
// ============================================================================

function generateWranglerConfig(domain: DomainDeclaration, options: EdgeGenOptions): string {
  const lines: string[] = [];
  const name = toKebabCase(domain.name.name);
  const version = domain.version?.value ?? '0.0.0';

  lines.push(`name = "${name}"`);
  lines.push('main = "src/index.ts"');
  lines.push(`compatibility_date = "2024-01-01"`);
  lines.push('');

  // KV namespace
  lines.push('[[kv_namespaces]]');
  lines.push(`binding = "KV"`);
  lines.push(`id = "your-kv-namespace-id"`);
  lines.push('');

  // D1 database if needed
  if (options.storageBackend === 'd1') {
    lines.push('[[d1_databases]]');
    lines.push(`binding = "DB"`);
    lines.push(`database_name = "${name}"`);
    lines.push(`database_id = "your-d1-database-id"`);
    lines.push('');
  }

  // Durable Objects if needed
  if (hasStatefulEntities(domain)) {
    lines.push('[durable_objects]');
    lines.push('bindings = [');
    lines.push(`  { name = "ENTITY_STORE", class_name = "EntityStore" }`);
    lines.push(']');
    lines.push('');
    lines.push('[[migrations]]');
    lines.push(`tag = "v1"`);
    lines.push('new_classes = ["EntityStore"]');
    lines.push('');
  }

  // Environment variables
  lines.push('[vars]');
  lines.push(`DOMAIN_NAME = "${domain.name.name}"`);
  lines.push(`DOMAIN_VERSION = "${version}"`);

  return lines.join('\n');
}

function generateEdgeConfig(domain: DomainDeclaration, options: EdgeGenOptions): EdgeConfig {
  const version = domain.version?.value ?? '0.0.0';
  
  return {
    target: options.target,
    entrypoint: 'src/index.ts',
    bindings: [
      { name: 'KV', type: 'kv', config: {} },
      ...(options.storageBackend === 'd1' ? [{ name: 'DB', type: 'd1' as const, config: {} }] : []),
    ],
    routes: domain.behaviors.map((b: BehaviorDeclaration) => ({
      pattern: `/api/${toKebabCase(b.name.name)}`,
      handler: `handle${b.name.name}`,
      method: 'POST',
    })),
    environment: {
      DOMAIN_NAME: domain.name.name,
      DOMAIN_VERSION: version,
    },
  };
}

function generateManifest(domain: DomainDeclaration, options: EdgeGenOptions): EdgeManifest {
  const version = domain.version?.value ?? '0.0.0';
  
  return {
    name: toKebabCase(domain.name.name),
    version,
    target: options.target,
    behaviors: domain.behaviors.map((b: BehaviorDeclaration) => ({
      name: b.name.name,
      route: `/api/${toKebabCase(b.name.name)}`,
      method: 'POST',
      estimatedLatency: 50,
      memoryUsage: 64,
    })),
    storage: [
      { type: 'kv', name: 'KV', usage: 'Entity storage' },
    ],
    limits: {
      cpuTime: 50,
      memory: 128,
      requestSize: 1024 * 1024,
      responseSize: 1024 * 1024,
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function hasStatefulEntities(domain: DomainDeclaration): boolean {
  return domain.entities.some((e) => 
    e.fields.some((f) => 
      f.annotations.some((a) => 
        a.name.name === 'persistent' || a.name.name === 'stateful'
      )
    )
  );
}

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
        return `${islTypeToTS(typeArgs[0])} | null | undefined`;
      }
      return 'unknown';
    }
    default:
      return 'unknown';
  }
}
