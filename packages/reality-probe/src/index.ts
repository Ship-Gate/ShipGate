/**
 * Reality Prober
 * 
 * Makes runtime verification "grounded": probes real routes, env vars, and critical dependencies
 * to detect ghost features.
 * 
 * Features:
 * - HTTP route probing (using OpenAPI or route map)
 * - Environment variable verification
 * - Integration with `isl verify --reality`
 * - Feeds findings into gate score
 */

export * from './types.js';
export * from './route-prober.js';
export * from './env-prober.js';
export * from './reality-probe.js';
