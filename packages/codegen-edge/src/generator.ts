// ============================================================================
// Edge Code Generator
// Main generator that converts ISL Domain to edge-optimized code
// ============================================================================

import type {
  DomainDeclaration,
  EntityDeclaration,
  TypeExpression,
  DurationLiteral,
} from '@isl-lang/isl-core';
import type {
  EdgeTarget,
  GeneratedEdgeCode,
  EdgeFile,
} from './types';
import { generateCloudflare } from './targets/cloudflare';
import { generateDeno } from './targets/deno';
import { generateVercel } from './targets/vercel';
import { generateNetlify } from './targets/netlify';

// ============================================================================
// TYPES
// ============================================================================

export interface EdgeGenOptions {
  target: EdgeTarget;
  outputDir?: string;
  typescript?: boolean;
  includeTests?: boolean;
  storageBackend?: 'kv' | 'd1' | 'external';
  authentication?: 'jwt' | 'api-key' | 'none';
  cors?: boolean;
  rateLimit?: { requests: number; window: number };
}

export interface EdgeGenResult {
  success: boolean;
  code: GeneratedEdgeCode;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate edge-optimized code from ISL domain
 */
export function generate(
  domain: DomainDeclaration,
  options: EdgeGenOptions
): EdgeGenResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Validate domain for edge compatibility
    const validation = validateForEdge(domain);
    warnings.push(...validation.warnings);
    if (validation.errors.length > 0) {
      return { success: false, code: emptyCode(options.target), errors: validation.errors, warnings };
    }

    // Generate target-specific code
    let code: GeneratedEdgeCode;

    switch (options.target) {
      case 'cloudflare-workers':
      case 'cloudflare-pages':
        code = generateCloudflare(domain, options);
        break;
      case 'deno-deploy':
        code = generateDeno(domain, options);
        break;
      case 'vercel-edge':
        code = generateVercel(domain, options);
        break;
      case 'netlify-edge':
        code = generateNetlify(domain, options);
        break;
      default:
        errors.push(`Unsupported target: ${options.target}`);
        return { success: false, code: emptyCode(options.target), errors, warnings };
    }

    // Add shared utilities
    code.files.push(...generateSharedUtils(domain, options));

    // Add tests if requested
    if (options.includeTests) {
      code.files.push(...generateTests(domain, options));
    }

    return { success: true, code, errors, warnings };

  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { success: false, code: emptyCode(options.target), errors, warnings };
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateForEdge(domain: DomainDeclaration): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for edge-incompatible features
  for (const behavior of domain.behaviors) {
    // Check for long-running operations
    const temporalRequirements = behavior.temporal?.requirements ?? [];
    for (const temporal of temporalRequirements) {
      if (temporal.type === 'within') {
        // Parse timeout duration
        const duration = temporal.duration;
        const timeout = duration ? parseDurationLiteral(duration) : 0;
        if (timeout > 30000) {
          warnings.push(
            `Behavior ${behavior.name.name} has timeout > 30s which exceeds edge limits`
          );
        }
      }
    }

    // Check for file system operations (not available on edge)
    // This would be detected through annotations or specific patterns
  }

  // Check entity sizes
  for (const entity of domain.entities) {
    const estimatedSize = estimateEntitySize(entity);
    if (estimatedSize > 25 * 1024) { // 25KB limit for KV values
      warnings.push(
        `Entity ${entity.name.name} may exceed KV value size limits (${estimatedSize} bytes)`
      );
    }
  }

  return { errors, warnings };
}

function parseDurationLiteral(duration: DurationLiteral): number {
  const value = duration.value;
  const unit = duration.unit;
  
  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return value;
  }
}

function estimateEntitySize(entity: EntityDeclaration): number {
  let size = 0;
  for (const field of entity.fields) {
    size += estimateFieldSize(field.type);
  }
  return size;
}

function estimateFieldSize(type: TypeExpression): number {
  switch (type.kind) {
    case 'SimpleType':
      switch (type.name.name) {
        case 'String': return 256; // Average string size
        case 'Int': return 8;
        case 'Decimal': return 8;
        case 'Boolean': return 1;
        case 'UUID': return 36;
        case 'Timestamp': return 8;
        default: return 64;
      }
    case 'ArrayType':
      return estimateFieldSize(type.elementType) * 10; // Assume 10 items avg
    case 'GenericType':
      // Handle Map<K, V> type
      if (type.name.name === 'Map' && type.typeArguments.length === 2) {
        const keyArg = type.typeArguments[0];
        const valueArg = type.typeArguments[1];
        if (keyArg && valueArg) {
          return (estimateFieldSize(keyArg) + estimateFieldSize(valueArg)) * 5;
        }
      }
      return 64;
    default:
      return 64;
  }
}

// ============================================================================
// SHARED UTILITIES
// ============================================================================

function generateSharedUtils(domain: DomainDeclaration, options: EdgeGenOptions): EdgeFile[] {
  const files: EdgeFile[] = [];

  // Types file
  files.push({
    path: 'types.ts',
    type: 'types',
    content: generateTypesFile(domain),
  });

  // Validation utilities
  files.push({
    path: 'validation.ts',
    type: 'middleware',
    content: generateValidationUtils(),
  });

  // Response utilities
  files.push({
    path: 'response.ts',
    type: 'middleware',
    content: generateResponseUtils(),
  });

  // CORS middleware if enabled
  if (options.cors) {
    files.push({
      path: 'cors.ts',
      type: 'middleware',
      content: generateCorsMiddleware(),
    });
  }

  // Rate limiting if enabled
  if (options.rateLimit) {
    files.push({
      path: 'rate-limit.ts',
      type: 'middleware',
      content: generateRateLimitMiddleware(options.rateLimit),
    });
  }

  return files;
}

function generateTypesFile(domain: DomainDeclaration): string {
  const lines: string[] = [];

  lines.push('// ============================================================================');
  lines.push(`// ${domain.name.name} Types`);
  lines.push('// Auto-generated from ISL specification');
  lines.push('// ============================================================================');
  lines.push('');

  // Generate entity types
  for (const entity of domain.entities) {
    lines.push(`export interface ${entity.name.name} {`);
    for (const field of entity.fields) {
      const tsType = islTypeToTS(field.type);
      const optional = field.optional ? '?' : '';
      lines.push(`  ${field.name.name}${optional}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
  }

  // Generate behavior input/output types
  for (const behavior of domain.behaviors) {
    const inputFields = behavior.input?.fields ?? [];
    lines.push(`export interface ${behavior.name.name}Input {`);
    for (const field of inputFields) {
      const tsType = islTypeToTS(field.type);
      const optional = field.optional ? '?' : '';
      lines.push(`  ${field.name.name}${optional}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');

    if (behavior.output?.success) {
      const outputType = islTypeToTS(behavior.output.success);
      lines.push(`export type ${behavior.name.name}Output = ${outputType};`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateValidationUtils(): string {
  return `
// Validation utilities for edge runtime
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateRequired<T>(value: T | undefined | null, field: string): T {
  if (value === undefined || value === null) {
    throw new ValidationError(\`\${field} is required\`, field, 'REQUIRED');
  }
  return value;
}

export function validateString(value: unknown, field: string, options?: { min?: number; max?: number; pattern?: RegExp }): string {
  if (typeof value !== 'string') {
    throw new ValidationError(\`\${field} must be a string\`, field, 'TYPE_ERROR');
  }
  if (options?.min && value.length < options.min) {
    throw new ValidationError(\`\${field} must be at least \${options.min} characters\`, field, 'MIN_LENGTH');
  }
  if (options?.max && value.length > options.max) {
    throw new ValidationError(\`\${field} must be at most \${options.max} characters\`, field, 'MAX_LENGTH');
  }
  if (options?.pattern && !options.pattern.test(value)) {
    throw new ValidationError(\`\${field} has invalid format\`, field, 'PATTERN');
  }
  return value;
}

export function validateNumber(value: unknown, field: string, options?: { min?: number; max?: number }): number {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (typeof num !== 'number' || isNaN(num)) {
    throw new ValidationError(\`\${field} must be a number\`, field, 'TYPE_ERROR');
  }
  if (options?.min !== undefined && num < options.min) {
    throw new ValidationError(\`\${field} must be >= \${options.min}\`, field, 'MIN');
  }
  if (options?.max !== undefined && num > options.max) {
    throw new ValidationError(\`\${field} must be <= \${options.max}\`, field, 'MAX');
  }
  return num;
}

export function validateEmail(value: unknown, field: string): string {
  const str = validateString(value, field);
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(str)) {
    throw new ValidationError(\`\${field} must be a valid email\`, field, 'EMAIL');
  }
  return str;
}

export function validateUUID(value: unknown, field: string): string {
  const str = validateString(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    throw new ValidationError(\`\${field} must be a valid UUID\`, field, 'UUID');
  }
  return str;
}
`;
}

function generateResponseUtils(): string {
  return `
// Response utilities for edge runtime
export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function errorResponse(message: string, status = 500, code?: string): Response {
  return jsonResponse({
    error: true,
    message,
    code: code ?? 'INTERNAL_ERROR',
  }, status);
}

export function validationErrorResponse(errors: Array<{ field: string; message: string; code: string }>): Response {
  return jsonResponse({
    error: true,
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: errors,
  }, 400);
}

export function notFoundResponse(resource?: string): Response {
  return errorResponse(resource ? \`\${resource} not found\` : 'Not found', 404, 'NOT_FOUND');
}

export function unauthorizedResponse(message = 'Unauthorized'): Response {
  return errorResponse(message, 401, 'UNAUTHORIZED');
}

export function rateLimitResponse(retryAfter: number): Response {
  return new Response(JSON.stringify({
    error: true,
    message: 'Rate limit exceeded',
    code: 'RATE_LIMITED',
    retryAfter,
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfter.toString(),
    },
  });
}
`;
}

function generateCorsMiddleware(): string {
  return `
// CORS middleware for edge runtime
export interface CorsOptions {
  origins: string[] | '*';
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function cors(options: CorsOptions) {
  const methods = options.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
  const headers = options.headers ?? ['Content-Type', 'Authorization'];

  return (request: Request, response: Response): Response => {
    const origin = request.headers.get('Origin');
    
    if (!origin) return response;

    const allowedOrigin = options.origins === '*' 
      ? '*' 
      : options.origins.includes(origin) ? origin : null;

    if (!allowedOrigin) return response;

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', allowedOrigin);
    newHeaders.set('Access-Control-Allow-Methods', methods.join(', '));
    newHeaders.set('Access-Control-Allow-Headers', headers.join(', '));
    
    if (options.credentials) {
      newHeaders.set('Access-Control-Allow-Credentials', 'true');
    }
    
    if (options.maxAge) {
      newHeaders.set('Access-Control-Max-Age', options.maxAge.toString());
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

export function handleCorsPreFlight(request: Request, options: CorsOptions): Response | null {
  if (request.method !== 'OPTIONS') return null;

  const origin = request.headers.get('Origin');
  if (!origin) return new Response(null, { status: 204 });

  const allowedOrigin = options.origins === '*' 
    ? '*' 
    : options.origins.includes(origin) ? origin : null;

  if (!allowedOrigin) {
    return new Response(null, { status: 403 });
  }

  const methods = options.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
  const headers = options.headers ?? ['Content-Type', 'Authorization'];

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': methods.join(', '),
      'Access-Control-Allow-Headers': headers.join(', '),
      'Access-Control-Max-Age': (options.maxAge ?? 86400).toString(),
    },
  });
}
`;
}

function generateRateLimitMiddleware(config: { requests: number; window: number }): string {
  return `
// Rate limiting middleware for edge runtime
// Uses KV or in-memory storage depending on platform

export interface RateLimitConfig {
  requests: number;  // Max requests
  window: number;    // Window in seconds
}

export interface RateLimitStore {
  get(key: string): Promise<number | null>;
  set(key: string, value: number, ttl: number): Promise<void>;
  increment(key: string): Promise<number>;
}

const config: RateLimitConfig = {
  requests: ${config.requests},
  window: ${config.window},
};

export async function checkRateLimit(
  key: string,
  store: RateLimitStore
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = \`ratelimit:\${key}:\${Math.floor(now / config.window)}\`;
  
  const count = await store.increment(windowKey);
  const remaining = Math.max(0, config.requests - count);
  const reset = (Math.floor(now / config.window) + 1) * config.window;

  return {
    allowed: count <= config.requests,
    remaining,
    reset,
  };
}

export function getRateLimitKey(request: Request, by: 'ip' | 'user' | 'api-key'): string {
  switch (by) {
    case 'ip':
      return request.headers.get('CF-Connecting-IP') ?? 
             request.headers.get('X-Forwarded-For')?.split(',')[0] ?? 
             'unknown';
    case 'user':
      return request.headers.get('X-User-ID') ?? 'anonymous';
    case 'api-key':
      return request.headers.get('X-API-Key') ?? 'no-key';
    default:
      return 'default';
  }
}
`;
}

// ============================================================================
// TESTS
// ============================================================================

function generateTests(domain: DomainDeclaration, _options: EdgeGenOptions): EdgeFile[] {
  const lines: string[] = [];

  lines.push('// ============================================================================');
  lines.push(`// ${domain.name.name} Edge Function Tests`);
  lines.push('// ============================================================================');
  lines.push('');
  lines.push("import { describe, it, expect } from 'vitest';");
  lines.push('');

  for (const behavior of domain.behaviors) {
    lines.push(`describe('${behavior.name.name}', () => {`);
    lines.push(`  it('should handle valid request', async () => {`);
    lines.push('    // TODO: Add test');
    lines.push(`  });`);
    lines.push('');
    lines.push(`  it('should reject invalid request', async () => {`);
    lines.push('    // TODO: Add test');
    lines.push(`  });`);
    lines.push('});');
    lines.push('');
  }

  return [{
    path: 'test/handlers.test.ts',
    type: 'test',
    content: lines.join('\n'),
  }];
}

// ============================================================================
// HELPERS
// ============================================================================

function emptyCode(target: EdgeTarget): GeneratedEdgeCode {
  return {
    files: [],
    config: {
      target,
      entrypoint: 'index.ts',
      bindings: [],
      routes: [],
      environment: {},
    },
    manifest: {
      name: 'empty',
      version: '0.0.0',
      target,
      behaviors: [],
      storage: [],
      limits: { cpuTime: 50, memory: 128, requestSize: 1024 * 1024, responseSize: 1024 * 1024 },
    },
  };
}

function islTypeToTS(type: TypeExpression): string {
  switch (type.kind) {
    case 'SimpleType':
      switch (type.name.name) {
        case 'String': return 'string';
        case 'Int': return 'number';
        case 'Decimal': return 'number';
        case 'Boolean': return 'boolean';
        case 'Timestamp': return 'Date';
        case 'UUID': return 'string';
        default: return type.name.name;
      }
    case 'GenericType': {
      const typeArgs = type.typeArguments ?? [];
      if (type.name.name === 'List' && typeArgs.length === 1 && typeArgs[0]) {
        return `${islTypeToTS(typeArgs[0])}[]`;
      }
      if (type.name.name === 'Map' && typeArgs.length === 2 && typeArgs[0] && typeArgs[1]) {
        return `Map<${islTypeToTS(typeArgs[0])}, ${islTypeToTS(typeArgs[1])}>`;
      }
      if (type.name.name === 'Optional' && typeArgs.length === 1 && typeArgs[0]) {
        return `${islTypeToTS(typeArgs[0])} | null`;
      }
      return 'unknown';
    }
    case 'ArrayType':
      return type.elementType ? `${islTypeToTS(type.elementType)}[]` : 'unknown[]';
    case 'UnionType':
      return type.variants.map(v => `'${v.name.name}'`).join(' | ');
    case 'ObjectType': {
      const fields = type.fields.map(f => {
        const opt = f.optional ? '?' : '';
        return `${f.name.name}${opt}: ${islTypeToTS(f.type)}`;
      });
      return `{ ${fields.join('; ')} }`;
    }
    default:
      return 'unknown';
  }
}
