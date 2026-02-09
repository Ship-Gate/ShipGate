/**
 * Truthpack Claim Integration
 * 
 * Convert truthpack routes to claim graph format
 */

import type { TruthpackRoute } from './schema.js';
import type { ClaimCollection } from '@isl-lang/proof/claim-integration';

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
