/**
 * Chaos Report Generator
 *
 * Produces a structured, JSON-serialisable report from chaos-scenario
 * execution results.  The report is consumed by:
 *
 *   - The proof-bundle writer   (proof.ts)
 *   - The pipeline step         (pipeline.ts)
 *   - The CLI renderer          (cli.ts)
 *   - External dashboards / CI gates
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';
import type { ScenarioResult, InjectionResult, AssertionResult } from './executor.js';
import type { ParsedChaosScenario, InjectionType } from './scenarios.js';

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

export interface ChaosReport {
  /** Report format version. */
  version: '1.0.0';
  /** ISO-8601 timestamp of when the report was generated. */
  generatedAt: string;
  /** Domain that was verified (name only). */
  domainName: string;
  /** Summary block. */
  summary: ChaosReportSummary;
  /** Per-scenario detail. */
  scenarios: ChaosScenarioReport[];
  /** Coverage analysis. */
  coverage: ChaosReportCoverage;
  /** Aggregated injection statistics. */
  injectionStats: InjectionTypeStats[];
  /** Timing breakdown. */
  timing: ChaosReportTiming;
}

export interface ChaosReportSummary {
  totalScenarios: number;
  passed: number;
  failed: number;
  skipped: number;
  score: number;
  verdict: 'verified' | 'risky' | 'unsafe';
}

export interface ChaosScenarioReport {
  name: string;
  behaviorName: string;
  passed: boolean;
  durationMs: number;
  injections: InjectionResult[];
  assertions: AssertionResult[];
  error?: { message: string; injectionType?: string };
}

export interface ChaosReportCoverage {
  injectionTypes: { type: string; covered: boolean }[];
  injectionTypeCoverage: number;
  scenarioCoverage: number;
  behaviorCoverage: number;
  overallCoverage: number;
}

export interface InjectionTypeStats {
  type: string;
  activations: number;
  scenariosUsing: number;
  passRate: number;
}

export interface ChaosReportTiming {
  totalMs: number;
  avgScenarioMs: number;
  maxScenarioMs: number;
  minScenarioMs: number;
  byScenario: { name: string; durationMs: number }[];
}

/* ------------------------------------------------------------------ */
/*  Generator                                                         */
/* ------------------------------------------------------------------ */

const ALL_INJECTION_TYPES: InjectionType[] = [
  'database_failure',
  'network_latency',
  'network_partition',
  'service_unavailable',
  'cpu_pressure',
  'memory_pressure',
  'clock_skew',
  'concurrent_requests',
  'rate_limit_storm',
  'rate_limit',
];

export function generateChaosReport(
  results: ScenarioResult[],
  scenarios: ParsedChaosScenario[],
  domain: DomainDeclaration | null,
  totalDurationMs: number,
): ChaosReport {
  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);
  const executedNames = new Set(results.map((r) => r.name));
  const skippedScenarios = scenarios.filter((s) => !executedNames.has(s.name));

  const score = computeScore(passed.length, failed.length, skippedScenarios.length);
  const verdict = computeVerdict(score, failed.length);

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    domainName: domain?.name?.name ?? 'unknown',
    summary: {
      totalScenarios: scenarios.length,
      passed: passed.length,
      failed: failed.length,
      skipped: skippedScenarios.length,
      score,
      verdict,
    },
    scenarios: results.map((r) => buildScenarioReport(r, scenarios)),
    coverage: buildCoverage(results, scenarios, domain),
    injectionStats: buildInjectionStats(results, scenarios),
    timing: buildTiming(results, totalDurationMs),
  };
}

/* ------------------------------------------------------------------ */
/*  Score & verdict                                                   */
/* ------------------------------------------------------------------ */

function computeScore(passed: number, failed: number, skipped: number): number {
  const total = passed + failed + skipped;
  if (total === 0) return 100;
  return Math.round(((passed + skipped * 0.5) / total) * 100);
}

function computeVerdict(
  score: number,
  failedCount: number,
): 'verified' | 'risky' | 'unsafe' {
  if (failedCount === 0 && score >= 80) return 'verified';
  if (failedCount > 0 && score < 50) return 'unsafe';
  return 'risky';
}

/* ------------------------------------------------------------------ */
/*  Per-scenario                                                      */
/* ------------------------------------------------------------------ */

function buildScenarioReport(
  result: ScenarioResult,
  _scenarios: ParsedChaosScenario[],
): ChaosScenarioReport {
  const failedAssertion = result.assertions.find((a) => !a.passed);

  return {
    name: result.name,
    behaviorName: result.name.split('_')[0] ?? result.name,
    passed: result.passed,
    durationMs: result.duration,
    injections: result.injections,
    assertions: result.assertions,
    error: result.passed
      ? undefined
      : {
          message:
            failedAssertion?.message ??
            result.error?.message ??
            'Scenario failed',
          injectionType: result.injections[0]?.type,
        },
  };
}

/* ------------------------------------------------------------------ */
/*  Coverage                                                          */
/* ------------------------------------------------------------------ */

function buildCoverage(
  results: ScenarioResult[],
  scenarios: ParsedChaosScenario[],
  domain: DomainDeclaration | null,
): ChaosReportCoverage {
  const coveredTypes = new Set<string>();
  for (const r of results) {
    for (const inj of r.injections) {
      coveredTypes.add(inj.type);
    }
  }

  const injectionTypes = ALL_INJECTION_TYPES.map((type) => ({
    type,
    covered: coveredTypes.has(type),
  }));

  const injectionTypeCoverage =
    ALL_INJECTION_TYPES.length > 0
      ? Math.round((coveredTypes.size / ALL_INJECTION_TYPES.length) * 100)
      : 0;

  const scenarioCoverage =
    scenarios.length > 0
      ? Math.round((results.length / scenarios.length) * 100)
      : 0;

  const totalBehaviors = domain?.behaviors?.length ?? 0;
  const coveredBehaviors = new Set(scenarios.map((s) => s.behaviorName)).size;
  const behaviorCoverage =
    totalBehaviors > 0
      ? Math.round((coveredBehaviors / totalBehaviors) * 100)
      : 0;

  const overallCoverage = Math.round(
    injectionTypeCoverage * 0.3 +
      scenarioCoverage * 0.5 +
      behaviorCoverage * 0.2,
  );

  return {
    injectionTypes,
    injectionTypeCoverage,
    scenarioCoverage,
    behaviorCoverage,
    overallCoverage,
  };
}

/* ------------------------------------------------------------------ */
/*  Injection statistics                                              */
/* ------------------------------------------------------------------ */

function buildInjectionStats(
  results: ScenarioResult[],
  scenarios: ParsedChaosScenario[],
): InjectionTypeStats[] {
  const statsMap = new Map<
    string,
    { activations: number; scenariosUsing: number; passedScenarios: number }
  >();

  for (const s of scenarios) {
    for (const inj of s.injections) {
      const entry = statsMap.get(inj.type) ?? {
        activations: 0,
        scenariosUsing: 0,
        passedScenarios: 0,
      };
      entry.scenariosUsing++;
      statsMap.set(inj.type, entry);
    }
  }

  for (const r of results) {
    for (const inj of r.injections) {
      const entry = statsMap.get(inj.type);
      if (entry) {
        entry.activations++;
        if (r.passed) entry.passedScenarios++;
      }
    }
  }

  return Array.from(statsMap.entries()).map(([type, stats]) => ({
    type,
    activations: stats.activations,
    scenariosUsing: stats.scenariosUsing,
    passRate:
      stats.scenariosUsing > 0
        ? Math.round((stats.passedScenarios / stats.scenariosUsing) * 100)
        : 0,
  }));
}

/* ------------------------------------------------------------------ */
/*  Timing                                                            */
/* ------------------------------------------------------------------ */

function buildTiming(
  results: ScenarioResult[],
  totalMs: number,
): ChaosReportTiming {
  const durations = results.map((r) => r.duration);
  const sum = durations.reduce((a, b) => a + b, 0);

  return {
    totalMs,
    avgScenarioMs: durations.length > 0 ? Math.round(sum / durations.length) : 0,
    maxScenarioMs: durations.length > 0 ? Math.max(...durations) : 0,
    minScenarioMs: durations.length > 0 ? Math.min(...durations) : 0,
    byScenario: results.map((r) => ({
      name: r.name,
      durationMs: r.duration,
    })),
  };
}
