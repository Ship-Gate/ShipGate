// ============================================================================
// Deno Deploy Code Generator
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

export function generateDeno(
  domain: DomainDeclaration,
  _options: EdgeGenOptions
): GeneratedEdgeCode {
  const files: EdgeFile[] = [];

  // Generate main server
  files.push({
    path: 'main.ts',
    type: 'handler',
    content: generateMainServer(domain),
  });

  // Generate behavior handlers
  for (const behavior of domain.behaviors) {
    files.push({
      path: `handlers/${toKebabCase(behavior.name.name)}.ts`,
      type: 'handler',
      content: generateHandler(behavior),
    });
  }

  // Generate deno.json
  files.push({
    path: 'deno.json',
    type: 'config',
    content: generateDenoConfig(domain),
  });

  // Generate KV client
  files.push({
    path: 'lib/kv.ts',
    type: 'middleware',
    content: generateKVClient(),
  });

  const config = generateEdgeConfig(domain);
  const manifest = generateManifest(domain);

  return { files, config, manifest };
}

// ============================================================================
// MAIN SERVER
// ============================================================================

function generateMainServer(domain: DomainDeclaration): string {
  const lines: string[] = [];

  lines.push('// ============================================================================');
  lines.push(`// ${domain.name.name} Deno Deploy Server`);
  lines.push('// Auto-generated from ISL specification');
  lines.push('// ============================================================================');
  lines.push('');

  // Import handlers
  for (const behavior of domain.behaviors) {
    const handlerName = `handle${behavior.name.name}`;
    const fileName = toKebabCase(behavior.name.name);
    lines.push(`import { ${handlerName} } from "./handlers/${fileName}.ts";`);
  }
  lines.push('');

  // Import Oak or native serve
  lines.push('// Using Deno standard library serve');
  lines.push('');

  // Router
  lines.push('const routes = new Map<string, (req: Request) => Promise<Response>>();');
  lines.push('');

  // Register routes
  for (const behavior of domain.behaviors) {
    const route = `/api/${toKebabCase(behavior.name.name)}`;
    const handler = `handle${behavior.name.name}`;
    lines.push(`routes.set("${route}", ${handler});`);
  }
  lines.push('');

  // Handler
  lines.push('async function handler(request: Request): Promise<Response> {');
  lines.push('  const url = new URL(request.url);');
  lines.push('  const path = url.pathname;');
  lines.push('');
  lines.push('  // Health check');
  lines.push('  if (path === "/health") {');
  lines.push('    return new Response(JSON.stringify({ status: "ok" }), {');
  lines.push('      headers: { "Content-Type": "application/json" },');
  lines.push('    });');
  lines.push('  }');
  lines.push('');
  lines.push('  // Find route handler');
  lines.push('  const routeHandler = routes.get(path);');
  lines.push('  if (routeHandler && request.method === "POST") {');
  lines.push('    return await routeHandler(request);');
  lines.push('  }');
  lines.push('');
  lines.push('  return new Response("Not Found", { status: 404 });');
  lines.push('}');
  lines.push('');

  // Start server
  lines.push('// Start server');
  lines.push('const port = parseInt(Deno.env.get("PORT") ?? "8000");');
  lines.push('console.log(`Server starting on port ${port}`);');
  lines.push('');
  lines.push('Deno.serve({ port }, handler);');

  return lines.join('\n');
}

// ============================================================================
// BEHAVIOR HANDLERS
// ============================================================================

function generateHandler(behavior: BehaviorDeclaration): string {
  const lines: string[] = [];
  const name = behavior.name.name;
  const inputFields = behavior.input?.fields ?? [];

  lines.push(`// Handler for ${name}`);
  lines.push('import { kv } from "../lib/kv.ts";');
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

  // Handler function
  lines.push(`export async function handle${name}(request: Request): Promise<Response> {`);
  lines.push('  try {');
  lines.push(`    const input = await request.json() as ${name}Input;`);
  lines.push('');
  lines.push('    // Validation');
  lines.push(`    const errors = validate${name}Input(input);`);
  lines.push('    if (errors.length > 0) {');
  lines.push('      return new Response(JSON.stringify({');
  lines.push("        error: 'Validation failed',");
  lines.push('        details: errors,');
  lines.push('      }), {');
  lines.push('        status: 400,');
  lines.push('        headers: { "Content-Type": "application/json" },');
  lines.push('      });');
  lines.push('    }');
  lines.push('');
  lines.push('    // Business logic');
  lines.push('    // TODO: Implement');
  lines.push('');
  lines.push('    return new Response(JSON.stringify({ success: true }), {');
  lines.push('      headers: { "Content-Type": "application/json" },');
  lines.push('    });');
  lines.push('');
  lines.push('  } catch (error) {');
  lines.push('    console.error(`Error in ${name}:`, error);');
  lines.push('    return new Response(JSON.stringify({');
  lines.push("      error: 'Internal server error',");
  lines.push('    }), {');
  lines.push('      status: 500,');
  lines.push('      headers: { "Content-Type": "application/json" },');
  lines.push('    });');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // Validation function
  lines.push(`function validate${name}Input(input: ${name}Input): string[] {`);
  lines.push('  const errors: string[] = [];');
  
  for (const field of inputFields) {
    if (!field.optional) {
      lines.push(`  if (input.${field.name.name} === undefined || input.${field.name.name} === null) {`);
      lines.push(`    errors.push("${field.name.name} is required");`);
      lines.push('  }');
    }
  }
  
  lines.push('  return errors;');
  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// KV CLIENT
// ============================================================================

function generateKVClient(): string {
  return `// ============================================================================
// Deno KV Client
// ============================================================================

// Open KV store
export const kv = await Deno.openKv();

// Entity operations
export async function getEntity<T>(
  type: string,
  id: string
): Promise<T | null> {
  const result = await kv.get([type, id]);
  return result.value as T | null;
}

export async function setEntity<T>(
  type: string,
  id: string,
  entity: T
): Promise<void> {
  await kv.set([type, id], entity);
}

export async function deleteEntity(
  type: string,
  id: string
): Promise<void> {
  await kv.delete([type, id]);
}

export async function listEntities<T>(
  type: string,
  options?: { prefix?: string; limit?: number }
): Promise<T[]> {
  const entities: T[] = [];
  const prefix = options?.prefix ? [type, options.prefix] : [type];
  
  for await (const entry of kv.list<T>({ prefix })) {
    entities.push(entry.value);
    if (options?.limit && entities.length >= options.limit) break;
  }
  
  return entities;
}

// Atomic operations
export async function atomicUpdate<T>(
  type: string,
  id: string,
  update: (current: T | null) => T
): Promise<T> {
  const key = [type, id];
  
  while (true) {
    const current = await kv.get<T>(key);
    const newValue = update(current.value);
    
    const result = await kv.atomic()
      .check(current)
      .set(key, newValue)
      .commit();
    
    if (result.ok) {
      return newValue;
    }
    // Retry on conflict
  }
}

// Queue operations
export async function enqueue(
  queue: string,
  message: unknown,
  options?: { delay?: number }
): Promise<void> {
  await kv.enqueue(message, {
    delay: options?.delay ?? 0,
  });
}

export function listenQueue(
  handler: (message: unknown) => Promise<void>
): void {
  kv.listenQueue(handler);
}
`;
}

// ============================================================================
// CONFIG FILES
// ============================================================================

function generateDenoConfig(domain: DomainDeclaration): string {
  const version = domain.version?.value ?? '0.0.0';
  
  const config = {
    name: toKebabCase(domain.name.name),
    version,
    exports: './main.ts',
    tasks: {
      dev: 'deno run --allow-net --allow-env --watch main.ts',
      start: 'deno run --allow-net --allow-env main.ts',
      test: 'deno test --allow-net --allow-env',
      lint: 'deno lint',
      fmt: 'deno fmt',
    },
    imports: {
      'std/': 'https://deno.land/std@0.210.0/',
    },
    compilerOptions: {
      strict: true,
    },
  };

  return JSON.stringify(config, null, 2);
}

function generateEdgeConfig(domain: DomainDeclaration): EdgeConfig {
  return {
    target: 'deno-deploy',
    entrypoint: 'main.ts',
    bindings: [{ name: 'KV', type: 'kv', config: {} }],
    routes: domain.behaviors.map((b: BehaviorDeclaration) => ({
      pattern: `/api/${toKebabCase(b.name.name)}`,
      handler: `handle${b.name.name}`,
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
    target: 'deno-deploy',
    behaviors: domain.behaviors.map((b: BehaviorDeclaration) => ({
      name: b.name.name,
      route: `/api/${toKebabCase(b.name.name)}`,
      method: 'POST',
      estimatedLatency: 30,
      memoryUsage: 64,
    })),
    storage: [{ type: 'kv', name: 'KV', usage: 'Entity storage' }],
    limits: {
      cpuTime: 50,
      memory: 512,
      requestSize: 1024 * 1024,
      responseSize: 1024 * 1024,
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
