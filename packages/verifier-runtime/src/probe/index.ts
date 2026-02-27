/**
 * Runtime Probe Orchestrator
 *
 * Top-level entry point that:
 *  1. Loads Truthpack data (routes, env vars, auth rules).
 *  2. Probes routes via fetch (and optionally Playwright).
 *  3. Checks environment variables.
 *  4. Converts everything into claims for the verdict scorer.
 *  5. Produces a machine-readable report and human summary.
 *  6. Writes artifacts to disk for proof bundle integration.
 */

import type {
  RuntimeProbeConfig,
  RuntimeProbeReport,
  RouteProbeResult,
  EnvCheckResult,
  SideEffectResult,
  Truthpack,
} from './types.js';
import { computeHash } from './types.js';
import {
  loadTruthpack,
  filterRoutes,
  deduplicateRoutes,
} from './truthpack-loader.js';
import { probeRoutes, probeBrowserRoute } from './route-prober.js';
import { checkEnvVars } from './env-checker.js';
import { buildAllClaims } from './claim-builder.js';
import {
  buildReport,
  writeReportToDir,
  formatCliSummary,
  formatHumanSummary,
  buildProofArtifact,
} from './report-generator.js';

// ── Public API ─────────────────────────────────────────────────────────────

export interface RuntimeProbeResult {
  report: RuntimeProbeReport;
  summary: string;
  cliSummary: string;
  paths?: {
    reportPath: string;
    artifactPath: string;
    summaryPath: string;
  };
}

/**
 * Run the full runtime verification probe.
 */
export async function runRuntimeProbe(
  config: RuntimeProbeConfig,
): Promise<RuntimeProbeResult> {
  const startTime = performance.now();

  // 1. Load Truthpack
  const tp = loadTruthpack(config.truthpackDir);
  if (!tp.success || !tp.truthpack) {
    throw new Error(
      `Failed to load Truthpack from ${config.truthpackDir}:\n  ${tp.errors.join('\n  ')}`,
    );
  }
  const truthpack = tp.truthpack;
  const truthpackHash = computeHash(JSON.stringify(truthpack));

  if (config.verbose) {
    process.stderr.write(
      `[runtime-probe] Loaded Truthpack: ${truthpack.routes.length} routes, ` +
      `${truthpack.env.length} env vars, ${truthpack.auth.length} auth rules\n`,
    );
  }

  // 2. Prepare routes
  let routes = deduplicateRoutes(truthpack.routes);
  if (config.routeFilter && config.routeFilter.length > 0) {
    routes = filterRoutes(routes, config.routeFilter);
  }

  // 3. Probe routes
  const probeOpts = {
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs ?? 10_000,
    concurrency: config.concurrency ?? 4,
    headers: config.headers ?? {},
    authToken: config.authToken,
    skipAuthRoutes: config.skipAuthRoutes ?? false,
    browserProbe: config.browserProbe ?? false,
    verbose: config.verbose ?? false,
  };

  if (config.verbose) {
    process.stderr.write(
      `[runtime-probe] Probing ${routes.length} routes against ${config.baseUrl}...\n`,
    );
  }

  let routeResults: RouteProbeResult[];
  if (probeOpts.browserProbe) {
    routeResults = await probeBrowserRoutes(routes, probeOpts);
  } else {
    routeResults = await probeRoutes(routes, probeOpts);
  }

  // 4. Check environment variables
  if (config.verbose) {
    process.stderr.write(
      `[runtime-probe] Checking ${truthpack.env.length} environment variables...\n`,
    );
  }
  const envResults: EnvCheckResult[] = checkEnvVars(truthpack.env, {
    verbose: config.verbose,
  });

  // 5. Side effects (extensible — currently empty, ready for future hooks)
  const sideEffectResults: SideEffectResult[] = [];

  // 6. Build claims
  const claims = buildAllClaims(routeResults, envResults, sideEffectResults);

  if (config.verbose) {
    process.stderr.write(
      `[runtime-probe] Generated ${claims.length} claims\n`,
    );
  }

  // 7. Build report
  const durationMs = performance.now() - startTime;
  const report = buildReport({
    baseUrl: config.baseUrl,
    truthpackHash,
    routeResults,
    envResults,
    sideEffectResults,
    claims,
    durationMs,
  });

  // 8. Write artifacts to disk
  let paths: RuntimeProbeResult['paths'];
  if (config.outputDir) {
    paths = writeReportToDir(report, config.outputDir);
    if (config.verbose) {
      process.stderr.write(
        `[runtime-probe] Wrote report to ${paths.reportPath}\n`,
      );
    }
  }

  // 9. Format summaries
  const summary = formatHumanSummary(report);
  const cliSummary = formatCliSummary(report);

  return { report, summary, cliSummary, paths };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Probe routes using Playwright browser mode, falling back to fetch.
 */
async function probeBrowserRoutes(
  routes: import('./types.js').TruthpackRoute[],
  options: Parameters<typeof probeRoutes>[1],
): Promise<RouteProbeResult[]> {
  const results: RouteProbeResult[] = [];

  for (const route of routes) {
    const result = await probeBrowserRoute(route, options);
    results.push(result);
  }

  return results;
}

// ── Re-exports for convenience ─────────────────────────────────────────────

export type { RuntimeProbeConfig, RuntimeProbeReport, RuntimeProofArtifact } from './types.js';
export { loadTruthpack } from './truthpack-loader.js';
export { probeRoutes, probeSingleRoute, probeBrowserRoute } from './route-prober.js';
export { checkEnvVars, checkSingleEnvVar } from './env-checker.js';
export { buildAllClaims, buildRouteClaims, buildEnvClaims, scoreClaims } from './claim-builder.js';
export {
  buildReport,
  buildProofArtifact,
  writeReportToDir,
  formatHumanSummary,
  formatCliSummary,
} from './report-generator.js';
