/**
 * Truthpack Claim Integration
 *
 * Convert truthpack routes to claim graph format (local types; no @isl-lang/proof dependency).
 */

import type { TruthpackRoute } from './schema.js';

/** Route claim shape for proof/claim integration */
export interface RouteClaim {
  route: string;
  method: string;
  locations: Array<{ file: string; line: number; column?: number }>;
}

/** Env var claim shape for proof/claim integration */
export interface EnvVarClaim {
  name: string;
  locations: Array<{ file: string; line: number; column?: number }>;
}

/**
 * Convert truthpack routes to claim collection format
 */
export function truthpackRoutesToClaims(
  routes: TruthpackRoute[]
): RouteClaim[] {
  return routes.map(route => ({
    route: route.path,
    method: route.method,
    locations: [
      {
        file: route.file,
        line: route.line,
      },
    ],
  }));
}

/**
 * Convert truthpack env vars to claim collection format
 */
export function truthpackEnvVarsToClaims(
  envVars: Array<{ name: string; file: string; line: number }>
): EnvVarClaim[] {
  return envVars.map(envVar => ({
    name: envVar.name,
    locations: [
      {
        file: envVar.file,
        line: envVar.line,
      },
    ],
  }));
}
