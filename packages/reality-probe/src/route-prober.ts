/**
 * HTTP Route Prober
 * 
 * Probes routes against a running server to detect ghost routes.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { RouteProbeResult, RouteMapEntry, RealityProbeConfig } from './types.js';

/**
 * Load route map from JSON file (truthpack routes.json format)
 */
export async function loadRouteMap(path: string): Promise<RouteMapEntry[]> {
  if (!existsSync(path)) {
    throw new Error(`Route map file not found: ${path}`);
  }

  const content = await readFile(path, 'utf-8');
  const data = JSON.parse(content);

  // Handle truthpack format: { routes: [...] }
  if (data.routes && Array.isArray(data.routes)) {
    return data.routes.map((r: any) => ({
      path: r.path,
      method: r.method || 'GET',
      auth: r.auth,
      parameters: r.parameters || [],
    }));
  }

  // Handle direct array format
  if (Array.isArray(data)) {
    return data.map((r: any) => ({
      path: r.path,
      method: r.method || 'GET',
      auth: r.auth,
      parameters: r.parameters || [],
    }));
  }

  throw new Error(`Invalid route map format in ${path}`);
}

/**
 * Load OpenAPI spec and extract routes
 */
export async function loadOpenAPISpec(path: string): Promise<RouteMapEntry[]> {
  if (!existsSync(path)) {
    throw new Error(`OpenAPI spec file not found: ${path}`);
  }

  const content = await readFile(path, 'utf-8');
  const spec = JSON.parse(content);

  const routes: RouteMapEntry[] = [];

  if (!spec.paths) {
    return routes;
  }

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const pathItemObj = pathItem as any;
    
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']) {
      if (pathItemObj[method]) {
        const operation = pathItemObj[method];
        routes.push({
          path,
          method: method.toUpperCase(),
          auth: operation.security ? { required: true } : undefined,
          parameters: operation.parameters || [],
        });
      }
    }
  }

  return routes;
}

/**
 * Probe a single route
 */
async function probeRoute(
  route: RouteMapEntry,
  baseUrl: string,
  config: Pick<RealityProbeConfig, 'timeoutMs' | 'headers' | 'authToken' | 'skipAuth'>
): Promise<RouteProbeResult> {
  const startTime = Date.now();
  const url = `${baseUrl}${route.path}`;

  // Skip auth routes if configured
  if (config.skipAuth && route.auth?.required) {
    return {
      path: route.path,
      method: route.method,
      exists: false,
      isGhost: false,
      error: 'Skipped (auth required)',
    };
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'reality-probe/0.1.0',
      ...config.headers,
    };

    if (config.authToken && route.auth?.required) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 10000);

    const response = await fetch(url, {
      method: route.method,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    return {
      path: route.path,
      method: route.method,
      exists: true,
      statusCode: response.status,
      latencyMs,
      isGhost: false,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Determine if this is a ghost route
    // If we get a connection error or timeout, it might be a ghost route
    const isGhost = errorMessage.includes('fetch failed') || 
                    errorMessage.includes('aborted') ||
                    errorMessage.includes('ECONNREFUSED');

    return {
      path: route.path,
      method: route.method,
      exists: false,
      latencyMs,
      isGhost,
      error: errorMessage,
    };
  }
}

/**
 * Probe multiple routes concurrently
 */
export async function probeRoutes(
  routes: RouteMapEntry[],
  baseUrl: string,
  config: RealityProbeConfig = {}
): Promise<RouteProbeResult[]> {
  const concurrency = config.concurrency || 4;
  const results: RouteProbeResult[] = [];

  // Process routes in batches
  for (let i = 0; i < routes.length; i += concurrency) {
    const batch = routes.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(route => probeRoute(route, baseUrl, config))
    );
    results.push(...batchResults);

    if (config.verbose) {
      process.stderr.write(
        `[reality-probe] Probed ${Math.min(i + concurrency, routes.length)}/${routes.length} routes\n`
      );
    }
  }

  return results;
}

/**
 * Load and probe routes from route map or OpenAPI spec
 */
export async function probeRoutesFromSource(
  config: RealityProbeConfig
): Promise<RouteProbeResult[]> {
  if (!config.baseUrl) {
    throw new Error('baseUrl is required for route probing');
  }

  let routes: RouteMapEntry[] = [];

  if (config.openApiPath) {
    routes = await loadOpenAPISpec(config.openApiPath);
  } else if (config.routeMapPath) {
    routes = await loadRouteMap(config.routeMapPath);
  } else {
    throw new Error('Either openApiPath or routeMapPath must be provided');
  }

  if (config.verbose) {
    process.stderr.write(`[reality-probe] Loaded ${routes.length} routes\n`);
  }

  return probeRoutes(routes, config.baseUrl, config);
}
