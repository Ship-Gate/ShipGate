/**
 * Reality Probe Orchestrator
 * 
 * Main entry point that coordinates route and env var probing.
 */

import { probeRoutesFromSource } from './route-prober.js';
import { probeEnvVarsFromSource } from './env-prober.js';
import type { RealityProbeConfig, RealityProbeResult } from './types.js';

/**
 * Run full reality probe
 */
export async function runRealityProbe(
  config: RealityProbeConfig
): Promise<RealityProbeResult> {
  const startTime = Date.now();
  const results: RealityProbeResult = {
    routes: [],
    envVars: [],
    summary: {
      totalRoutes: 0,
      existingRoutes: 0,
      ghostRoutes: 0,
      totalEnvVars: 0,
      existingEnvVars: 0,
      ghostEnvVars: 0,
    },
    success: true,
    durationMs: 0,
  };

  // Probe routes if baseUrl is provided
  if (config.baseUrl && (config.openApiPath || config.routeMapPath)) {
    if (config.verbose) {
      process.stderr.write(`[reality-probe] Probing routes against ${config.baseUrl}\n`);
    }

    try {
      results.routes = await probeRoutesFromSource(config);
    } catch (error) {
      if (config.verbose) {
        process.stderr.write(
          `[reality-probe] Route probing failed: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }
      // Continue with env var probing even if route probing fails
    }
  }

  // Probe environment variables if path is provided
  if (config.envVarsPath) {
    if (config.verbose) {
      process.stderr.write(`[reality-probe] Probing environment variables\n`);
    }

    try {
      results.envVars = await probeEnvVarsFromSource(config.envVarsPath);
    } catch (error) {
      if (config.verbose) {
        process.stderr.write(
          `[reality-probe] Env var probing failed: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }
    }
  }

  // Calculate summary
  results.summary.totalRoutes = results.routes.length;
  results.summary.existingRoutes = results.routes.filter(r => r.exists).length;
  results.summary.ghostRoutes = results.routes.filter(r => r.isGhost).length;

  results.summary.totalEnvVars = results.envVars.length;
  results.summary.existingEnvVars = results.envVars.filter(e => e.exists).length;
  results.summary.ghostEnvVars = results.envVars.filter(e => e.isGhost).length;

  // Overall success: no ghost features detected
  results.success = results.summary.ghostRoutes === 0 && results.summary.ghostEnvVars === 0;

  results.durationMs = Date.now() - startTime;

  return results;
}

/**
 * Convert reality probe results to evidence for gate score
 */
export function realityProbeToEvidence(result: RealityProbeResult): {
  category: 'reality';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    impact: 'critical' | 'high' | 'medium' | 'low';
  }>;
} {
  const checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    impact: 'critical' | 'high' | 'medium' | 'low';
  }> = [];

  // Add route checks
  for (const route of result.routes) {
    if (route.isGhost) {
      checks.push({
        name: `Route ${route.method} ${route.path}`,
        status: 'fail',
        message: `Ghost route detected: ${route.error || 'Route does not exist'}`,
        impact: 'critical',
      });
    } else if (!route.exists) {
      checks.push({
        name: `Route ${route.method} ${route.path}`,
        status: 'warn',
        message: `Route not accessible: ${route.error || 'Unknown error'}`,
        impact: 'medium',
      });
    } else {
      checks.push({
        name: `Route ${route.method} ${route.path}`,
        status: 'pass',
        message: `Route exists (${route.statusCode}, ${route.latencyMs}ms)`,
        impact: 'low',
      });
    }
  }

  // Add env var checks
  for (const envVar of result.envVars) {
    if (envVar.isGhost) {
      checks.push({
        name: `Env var ${envVar.name}`,
        status: 'fail',
        message: `Ghost env var detected: ${envVar.error || 'Required but missing'}`,
        impact: 'critical',
      });
    } else if (!envVar.exists) {
      checks.push({
        name: `Env var ${envVar.name}`,
        status: 'warn',
        message: 'Environment variable not set',
        impact: 'medium',
      });
    } else if (envVar.isPlaceholder) {
      checks.push({
        name: `Env var ${envVar.name}`,
        status: 'warn',
        message: 'Environment variable has placeholder value',
        impact: 'high',
      });
    } else {
      checks.push({
        name: `Env var ${envVar.name}`,
        status: 'pass',
        message: 'Environment variable exists and has valid value',
        impact: 'low',
      });
    }
  }

  return {
    category: 'reality',
    checks,
  };
}
