/**
 * Truthpack Loader
 *
 * Loads routes, env vars, and auth rules from the .guardrail/truthpack
 * directory to feed the runtime prober.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  Truthpack,
  TruthpackRoute,
  TruthpackEnvVar,
  TruthpackAuthRule,
  TruthpackMeta,
} from './types.js';

export interface LoadTruthpackResult {
  success: boolean;
  truthpack?: Truthpack;
  errors: string[];
}

/**
 * Load the full truthpack from a directory.
 */
export function loadTruthpack(truthpackDir: string): LoadTruthpackResult {
  const errors: string[] = [];
  const absDir = path.resolve(truthpackDir);

  if (!fs.existsSync(absDir)) {
    return {
      success: false,
      errors: [`Truthpack directory not found: ${absDir}`],
    };
  }

  const routes = loadJsonFile<{ routes: TruthpackRoute[] }>(
    path.join(absDir, 'routes.json'),
    errors,
  );
  const env = loadJsonFile<{ variables: TruthpackEnvVar[] }>(
    path.join(absDir, 'env.json'),
    errors,
  );
  const auth = loadJsonFile<{ rules: TruthpackAuthRule[] }>(
    path.join(absDir, 'auth.json'),
    errors,
  );
  const meta = loadJsonFile<TruthpackMeta>(
    path.join(absDir, 'meta.json'),
    errors,
  );

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    truthpack: {
      routes: routes?.routes ?? [],
      env: env?.variables ?? [],
      auth: auth?.rules ?? [],
      meta: meta ?? {
        version: '0.0.0',
        generatedAt: new Date().toISOString(),
        hash: '',
        scannerVersions: {},
        summary: { routes: 0, envVars: 0, authRules: 0, contracts: 0 },
      },
    },
    errors: [],
  };
}

/**
 * Filter routes by path prefixes.
 */
export function filterRoutes(
  routes: TruthpackRoute[],
  prefixes: string[],
): TruthpackRoute[] {
  if (prefixes.length === 0) return routes;
  return routes.filter((r) =>
    prefixes.some((prefix) => r.path.startsWith(prefix)),
  );
}

/**
 * Get only safe-method routes (GET, HEAD, OPTIONS) for probing.
 */
export function getSafeRoutes(routes: TruthpackRoute[]): TruthpackRoute[] {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  return routes.filter((r) => safeMethods.has(r.method.toUpperCase()));
}

/**
 * Get routes that require authentication.
 */
export function getAuthRoutes(routes: TruthpackRoute[]): TruthpackRoute[] {
  return routes.filter((r) => r.auth?.required === true);
}

/**
 * Get routes that do NOT require authentication.
 */
export function getPublicRoutes(routes: TruthpackRoute[]): TruthpackRoute[] {
  return routes.filter((r) => !r.auth?.required);
}

/**
 * Deduplicate routes by path + method.
 */
export function deduplicateRoutes(routes: TruthpackRoute[]): TruthpackRoute[] {
  const seen = new Set<string>();
  return routes.filter((r) => {
    const key = `${r.method}:${r.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Internal helpers ───────────────────────────────────────────────────────

function loadJsonFile<T>(filePath: string, errors: string[]): T | undefined {
  try {
    if (!fs.existsSync(filePath)) {
      errors.push(`File not found: ${filePath}`);
      return undefined;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    errors.push(
      `Failed to load ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}
