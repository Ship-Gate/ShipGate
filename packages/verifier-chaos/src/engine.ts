/**
 * Chaos Engine
 *
 * Top-level orchestrator that owns the full chaos-verification lifecycle:
 *
 *   1. Parse domain → extract chaos scenarios
 *   2. Resolve & create injectors
 *   3. Execute scenarios (sequential or parallel)
 *   4. Collect timeline events
 *   5. Produce a structured ChaosReport + proof bundle
 *
 * This is the single entry-point consumed by the pipeline step and the CLI.
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';
import {
  parseChaosScenarios,
  type ParsedChaosScenario,
  type InjectionType,
} from './scenarios.js';
import { ChaosExecutor, type ScenarioResult, type BehaviorImplementation } from './executor.js';
import { createTimeline, Timeline, type TimelineReport } from './timeline.js';
import { generateChaosReport, type ChaosReport } from './report.js';
import { buildProofBundle, type ChaosProofBundle } from './proof.js';

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

export interface EngineConfig {
  /** Timeout per scenario (ms). */
  timeoutMs?: number;
  /** Continue executing after a scenario fails. */
  continueOnFailure?: boolean;
  /** Verbose logging to stderr. */
  verbose?: boolean;
  /** Only run scenarios whose names match these patterns. */
  scenarioFilter?: string[];
  /** Only run scenarios that use these injection types. */
  injectionFilter?: InjectionType[];
  /** Run scenarios in parallel (default: sequential). */
  parallel?: boolean;
  /** Maximum parallel workers when parallel=true. */
  parallelLimit?: number;
  /** Output directory for report / proof bundle. */
  outputDir?: string;
}

export interface EngineResult {
  /** Overall pass / fail. */
  success: boolean;
  /** Verdict: verified | risky | unsafe. */
  verdict: 'verified' | 'risky' | 'unsafe';
  /** 0-100 score. */
  score: number;
  /** Per-scenario results. */
  scenarios: ScenarioResult[];
  /** Merged timeline of all events. */
  timeline: TimelineReport;
  /** Structured chaos report (JSON-serialisable). */
  report: ChaosReport;
  /** Proof bundle (JSON-serialisable). */
  proof: ChaosProofBundle;
  /** Wall-clock duration (ms). */
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/*  Engine                                                            */
/* ------------------------------------------------------------------ */

export class ChaosEngine {
  private config: Required<EngineConfig>;

  constructor(config: EngineConfig = {}) {
    this.config = {
      timeoutMs: config.timeoutMs ?? 30_000,
      continueOnFailure: config.continueOnFailure ?? true,
      verbose: config.verbose ?? false,
      scenarioFilter: config.scenarioFilter ?? [],
      injectionFilter: config.injectionFilter ?? [],
      parallel: config.parallel ?? false,
      parallelLimit: config.parallelLimit ?? 4,
      outputDir: config.outputDir ?? '.chaos-output',
    };
  }

  /**
   * Run the full chaos verification lifecycle.
   */
  async run(
    domain: DomainDeclaration,
    implementation: BehaviorImplementation,
    behaviorName?: string,
  ): Promise<EngineResult> {
    const startTime = Date.now();
    const globalTimeline = createTimeline();

    /* 1. Parse scenarios ------------------------------------------------ */
    globalTimeline.record('injection_start', { phase: 'parse_scenarios' });
    let scenarios = this.parseScenarios(domain, behaviorName);
    scenarios = this.applyFilters(scenarios);
    globalTimeline.record('injection_end', {
      phase: 'parse_scenarios',
      count: scenarios.length,
    });

    if (scenarios.length === 0) {
      return this.emptyResult(startTime, globalTimeline);
    }

    /* 2. Execute scenarios ---------------------------------------------- */
    globalTimeline.record('behavior_start', { phase: 'execution' });
    const results = this.config.parallel
      ? await this.executeParallel(scenarios, domain, implementation, globalTimeline)
      : await this.executeSequential(scenarios, domain, implementation, globalTimeline);
    globalTimeline.record('behavior_end', { phase: 'execution' });

    /* 3. Build report --------------------------------------------------- */
    const durationMs = Date.now() - startTime;
    const timeline = this.mergeTimelines(results, globalTimeline);
    const report = generateChaosReport(results, scenarios, domain, durationMs);
    const proof = buildProofBundle(report, timeline);

    const score = this.computeScore(results);
    const verdict = this.computeVerdict(score, results);

    return {
      success: results.every((r) => r.passed),
      verdict,
      score,
      scenarios: results,
      timeline,
      report,
      proof,
      durationMs,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Scenario parsing & filtering                                      */
  /* ------------------------------------------------------------------ */

  private parseScenarios(
    domain: DomainDeclaration,
    behaviorName?: string,
  ): ParsedChaosScenario[] {
    const result = parseChaosScenarios(domain, behaviorName);
    if (!result.success && this.config.verbose) {
      for (const err of result.errors) {
        process.stderr.write(`[chaos] parse error: ${err.message}\n`);
      }
    }
    return result.scenarios;
  }

  private applyFilters(scenarios: ParsedChaosScenario[]): ParsedChaosScenario[] {
    let filtered = scenarios;

    if (this.config.scenarioFilter.length > 0) {
      filtered = filtered.filter((s) =>
        this.config.scenarioFilter.some(
          (pattern) => s.name.includes(pattern) || s.name === pattern,
        ),
      );
    }

    if (this.config.injectionFilter.length > 0) {
      filtered = filtered.filter((s) =>
        s.injections.some((inj) =>
          this.config.injectionFilter.includes(inj.type),
        ),
      );
    }

    return filtered;
  }

  /* ------------------------------------------------------------------ */
  /*  Execution strategies                                              */
  /* ------------------------------------------------------------------ */

  private async executeSequential(
    scenarios: ParsedChaosScenario[],
    domain: DomainDeclaration,
    implementation: BehaviorImplementation,
    _timeline: Timeline,
  ): Promise<ScenarioResult[]> {
    const executor = new ChaosExecutor({
      timeoutMs: this.config.timeoutMs,
      continueOnFailure: this.config.continueOnFailure,
      verbose: this.config.verbose,
    });
    return executor.executeScenarios(scenarios, domain, implementation);
  }

  private async executeParallel(
    scenarios: ParsedChaosScenario[],
    domain: DomainDeclaration,
    implementation: BehaviorImplementation,
    _timeline: Timeline,
  ): Promise<ScenarioResult[]> {
    const limit = this.config.parallelLimit;
    const results: ScenarioResult[] = [];
    const queue = [...scenarios];

    const runBatch = async (): Promise<void> => {
      const batch = queue.splice(0, limit);
      if (batch.length === 0) return;

      const batchResults = await Promise.all(
        batch.map((scenario) => {
          const executor = new ChaosExecutor({
            timeoutMs: this.config.timeoutMs,
            continueOnFailure: true,
            verbose: this.config.verbose,
          });
          return executor.executeScenario(scenario, domain, implementation);
        }),
      );
      results.push(...batchResults);

      if (!this.config.continueOnFailure && batchResults.some((r) => !r.passed)) {
        return; // stop early
      }
      await runBatch();
    };

    await runBatch();
    return results;
  }

  /* ------------------------------------------------------------------ */
  /*  Scoring & verdict                                                 */
  /* ------------------------------------------------------------------ */

  private computeScore(results: ScenarioResult[]): number {
    if (results.length === 0) return 0;
    const passed = results.filter((r) => r.passed).length;
    return Math.round((passed / results.length) * 100);
  }

  private computeVerdict(
    score: number,
    results: ScenarioResult[],
  ): 'verified' | 'risky' | 'unsafe' {
    const failedCount = results.filter((r) => !r.passed).length;
    if (failedCount === 0 && score >= 80) return 'verified';
    if (failedCount > 0 && score < 50) return 'unsafe';
    return 'risky';
  }

  /* ------------------------------------------------------------------ */
  /*  Timeline helpers                                                  */
  /* ------------------------------------------------------------------ */

  private mergeTimelines(
    results: ScenarioResult[],
    global: Timeline,
  ): TimelineReport {
    const globalReport = global.generateReport();
    const allEvents = [...globalReport.events];
    let totalInjections = globalReport.injectionCount;
    let totalErrors = globalReport.errorCount;
    let totalRecoveries = globalReport.recoveryCount;

    for (const r of results) {
      allEvents.push(...r.timeline.events);
      totalInjections += r.timeline.injectionCount;
      totalErrors += r.timeline.errorCount;
      totalRecoveries += r.timeline.recoveryCount;
    }

    allEvents.sort((a, b) => a.timestamp - b.timestamp);

    return {
      events: allEvents,
      startTime: globalReport.startTime,
      endTime: Date.now(),
      totalDuration: Date.now() - globalReport.startTime,
      injectionCount: totalInjections,
      errorCount: totalErrors,
      recoveryCount: totalRecoveries,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Edge case: no scenarios                                           */
  /* ------------------------------------------------------------------ */

  private emptyResult(startTime: number, timeline: Timeline): EngineResult {
    const report = generateChaosReport([], [], undefined as unknown as DomainDeclaration, Date.now() - startTime);
    const timelineReport = timeline.generateReport();
    return {
      success: true,
      verdict: 'verified',
      score: 100,
      scenarios: [],
      timeline: timelineReport,
      report,
      proof: buildProofBundle(report, timelineReport),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Create a new chaos engine.
 */
export function createEngine(config?: EngineConfig): ChaosEngine {
  return new ChaosEngine(config);
}
