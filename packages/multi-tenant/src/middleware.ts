/**
 * Tenant Middleware
 * 
 * Request middleware for extracting and validating tenant context.
 */

import { TenantContext } from './context.js';
import type { Tenant, TenantRepository, TenantStatus } from './tenant.js';

// ============================================================================
// Types
// ============================================================================

export interface TenantExtractionStrategy {
  type: 'subdomain' | 'header' | 'path' | 'query' | 'jwt' | 'custom';
  name?: string;
  pattern?: string;
  extract?: (req: IncomingRequest) => string | undefined;
}

export interface TenantMiddlewareOptions {
  strategies: TenantExtractionStrategy[];
  repository: TenantRepository;
  allowedStatuses?: TenantStatus[];
  onNotFound?: (req: IncomingRequest) => Response | Promise<Response>;
  onSuspended?: (req: IncomingRequest, tenant: Tenant) => Response | Promise<Response>;
  onError?: (req: IncomingRequest, error: Error) => Response | Promise<Response>;
  cache?: TenantCache;
}

export interface TenantCache {
  get(key: string): Promise<Tenant | null>;
  set(key: string, tenant: Tenant, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface IncomingRequest {
  url: string;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  path?: string;
  hostname?: string;
  query?: Record<string, string>;
}

export interface Response {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type NextFunction = () => Promise<unknown> | unknown;

// ============================================================================
// Tenant Extraction
// ============================================================================

/**
 * Extract tenant identifier from request using configured strategies
 */
export async function extractTenantId(
  req: IncomingRequest,
  strategies: TenantExtractionStrategy[]
): Promise<string | undefined> {
  for (const strategy of strategies) {
    const id = extractWithStrategy(req, strategy);
    if (id) {
      return id;
    }
  }
  return undefined;
}

function extractWithStrategy(
  req: IncomingRequest,
  strategy: TenantExtractionStrategy
): string | undefined {
  switch (strategy.type) {
    case 'subdomain':
      return extractFromSubdomain(req);
    case 'header':
      return extractFromHeader(req, strategy.name ?? 'X-Tenant-ID');
    case 'path':
      return extractFromPath(req, strategy.pattern ?? '/t/:tenant');
    case 'query':
      return extractFromQuery(req, strategy.name ?? 'tenant');
    case 'jwt':
      return extractFromJwt(req, strategy.name ?? 'tenantId');
    case 'custom':
      return strategy.extract?.(req);
    default:
      return undefined;
  }
}

function extractFromSubdomain(req: IncomingRequest): string | undefined {
  const hostname = req.hostname ?? new URL(req.url).hostname;
  const parts = hostname.split('.');
  
  // Expect format: tenant.example.com
  if (parts.length >= 3) {
    const subdomain = parts[0]!;
    // Exclude common non-tenant subdomains
    if (!['www', 'api', 'app', 'admin'].includes(subdomain)) {
      return subdomain;
    }
  }
  return undefined;
}

function extractFromHeader(req: IncomingRequest, headerName: string): string | undefined {
  const value = req.headers[headerName.toLowerCase()];
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] : undefined;
}

function extractFromPath(req: IncomingRequest, pattern: string): string | undefined {
  const path = req.path ?? new URL(req.url).pathname;
  
  // Convert pattern to regex
  // /t/:tenant -> /t/([^/]+)
  const regexPattern = pattern.replace(/:(\w+)/g, '([^/]+)');
  const match = path.match(new RegExp(`^${regexPattern}`));
  
  return match?.[1];
}

function extractFromQuery(req: IncomingRequest, paramName: string): string | undefined {
  if (req.query) {
    return req.query[paramName];
  }
  
  const url = new URL(req.url);
  return url.searchParams.get(paramName) ?? undefined;
}

function extractFromJwt(req: IncomingRequest, claimName: string): string | undefined {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }

  try {
    const token = authHeader.slice(7);
    const [, payloadBase64] = token.split('.');
    if (!payloadBase64) return undefined;
    
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    return payload[claimName];
  } catch {
    return undefined;
  }
}

// ============================================================================
// Tenant Resolution
// ============================================================================

/**
 * Resolve tenant from request
 */
export async function getTenantFromRequest(
  req: IncomingRequest,
  options: TenantMiddlewareOptions
): Promise<Tenant | null> {
  const { strategies, repository, cache } = options;

  // Extract tenant identifier
  const tenantId = await extractTenantId(req, strategies);
  if (!tenantId) {
    return null;
  }

  // Check cache first
  if (cache) {
    const cached = await cache.get(tenantId);
    if (cached) {
      return cached;
    }
  }

  // Look up by slug or ID
  let tenant = await repository.findBySlug(tenantId);
  if (!tenant) {
    tenant = await repository.findById(tenantId);
  }

  // Cache the result
  if (tenant && cache) {
    await cache.set(tenantId, tenant, 60000); // 1 minute cache
  }

  return tenant;
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create Express-style tenant middleware
 */
export function createTenantMiddleware(options: TenantMiddlewareOptions) {
  const {
    allowedStatuses = ['ACTIVE'],
    onNotFound,
    onSuspended,
    onError,
  } = options;

  return async function tenantMiddleware(
    req: IncomingRequest,
    res: { json: (body: unknown) => void; status: (code: number) => { json: (body: unknown) => void } },
    next: NextFunction
  ): Promise<void> {
    try {
      const tenant = await getTenantFromRequest(req, options);

      if (!tenant) {
        if (onNotFound) {
          const response = await onNotFound(req);
          res.status(response.status).json(response.body);
          return;
        }
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }

      if (!allowedStatuses.includes(tenant.status)) {
        if (tenant.status === 'SUSPENDED' && onSuspended) {
          const response = await onSuspended(req, tenant);
          res.status(response.status).json(response.body);
          return;
        }
        res.status(403).json({ 
          error: 'Tenant access denied',
          status: tenant.status,
        });
        return;
      }

      // Set tenant context and continue
      await TenantContext.runAsync(tenant, async () => {
        await next();
      });
    } catch (error) {
      if (onError) {
        const response = await onError(req, error as Error);
        res.status(response.status).json(response.body);
        return;
      }
      throw error;
    }
  };
}

/**
 * Create a simple function-based middleware
 */
export function createTenantHandler<T>(
  options: TenantMiddlewareOptions,
  handler: (req: IncomingRequest, tenant: Tenant) => Promise<T>
): (req: IncomingRequest) => Promise<T | Response> {
  return async (req) => {
    const tenant = await getTenantFromRequest(req, options);
    
    if (!tenant) {
      return { status: 404, body: { error: 'Tenant not found' } };
    }

    if (tenant.status !== 'ACTIVE') {
      return { status: 403, body: { error: 'Tenant not active' } };
    }

    return TenantContext.runAsync(tenant, () => handler(req, tenant));
  };
}

// ============================================================================
// In-Memory Cache
// ============================================================================

export class InMemoryTenantCache implements TenantCache {
  private cache = new Map<string, { tenant: Tenant; expiresAt: number }>();

  async get(key: string): Promise<Tenant | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.tenant;
  }

  async set(key: string, tenant: Tenant, ttlMs: number = 60000): Promise<void> {
    this.cache.set(key, {
      tenant,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
