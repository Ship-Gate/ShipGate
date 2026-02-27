/**
 * Heal Plan Executor
 *
 * Analyzes failures, groups by root cause, orders by dependency,
 * executes fixes in phases (structural → types/impl → tests).
 */

import type {
  VerificationFailureInput,
  AnalyzedFailure,
  HealPlanGroup,
  HealPhase,
  HealIterationResult,
  HealReport,
  SurgicalDiff,
} from './types.js';
import { RootCauseAnalyzer } from './root-cause-analyzer.js';
import { buildFixPrompt, buildBatchFixPrompt } from './fix-prompts.js';
import { parseAIResponse, applySurgicalDiffs } from './surgical-diff.js';

/** Phase order for execution */
const PHASE_ORDER: HealPhase[] = ['structural', 'types_impl', 'tests'];

/** Options for HealPlan execution */
export interface HealPlanOptions {
  projectRoot: string;
  maxIterations?: number;
  islContent?: string;
  /** Callback to invoke AI with prompt; returns raw response string */
  invokeAI?: (prompt: string, context?: Record<string, unknown>) => Promise<string>;
  /** Callback to re-run verification; returns new failure entries */
  verify?: () => Promise<VerificationFailureInput[]>;
}

/**
 * Heal Plan Executor
 *
 * 1. Analyze all failures
 * 2. Group by root cause
 * 3. Order by dependency (imports before types, types before tests)
 * 4. Execute fixes in order, re-verify after each phase
 */
export class HealPlanExecutor {
  private analyzer: RootCauseAnalyzer;
  private options: HealPlanOptions;

  constructor(options: HealPlanOptions) {
    this.analyzer = new RootCauseAnalyzer();
    this.options = {
      maxIterations: 3,
      ...options,
    };
  }

  /**
   * Build the heal plan from failure entries
   */
  buildPlan(entries: VerificationFailureInput[]): HealPlanGroup[] {
    const analyzed = this.analyzer.analyzeAll(entries);

    // Group by (phase, category)
    const groupMap = new Map<string, AnalyzedFailure[]>();
    for (const a of analyzed) {
      const key = `${a.phase}:${a.category}`;
      const existing = groupMap.get(key) ?? [];
      existing.push(a);
      groupMap.set(key, existing);
    }

    // Build ordered groups
    const groups: HealPlanGroup[] = [];
    for (const phase of PHASE_ORDER) {
      for (const [key, failures] of groupMap) {
        if (!key.startsWith(phase + ':')) continue;
        const category = key.split(':')[1]!;
        groups.push({
          phase,
          category: category as HealPlanGroup['category'],
          failures,
          promptKey: category,
        });
      }
    }

    return groups;
  }

  /**
   * Execute the heal plan
   *
   * Iteration 1: structural (imports, missing files)
   * Iteration 2: types + implementation
   * Iteration 3: test failures
   */
  async execute(
    entries: VerificationFailureInput[],
  ): Promise<{
    report: HealReport;
    fixesApplied: string[];
  }> {
    const maxIterations = this.options.maxIterations ?? 3;
    const iterations: HealIterationResult[] = [];
    let currentEntries = entries;
    let totalFixesApplied: string[] = [];
    const tokensTotal = { input: 0, output: 0 };

    const invokeAI = this.options.invokeAI;
    const verify = this.options.verify;

    for (let iter = 1; iter <= maxIterations; iter++) {
      const phaseForIter = PHASE_ORDER[iter - 1] ?? 'types_impl';
      const plan = this.buildPlan(currentEntries).filter((g) => g.phase === phaseForIter);

      if (plan.length === 0) {
        iterations.push({
          iteration: iter,
          phase: phaseForIter,
          fixesApplied: [],
          failuresBefore: currentEntries.length,
          failuresAfter: currentEntries.length,
        });
        continue;
      }

      const fixesThisIter: string[] = [];

      for (const group of plan) {
        if (!invokeAI) continue;

        const prompt = this.buildPromptForGroup(group);
        const response = await invokeAI(prompt);

        const parsed = parseAIResponse(response);
        const diffs: SurgicalDiff[] = parsed.map((p) => ({
          file: p.path,
          diff: p.diff ?? '',
          fullReplacement: p.fullReplacement,
        }));

        const results = await applySurgicalDiffs(diffs, this.options.projectRoot);
        const applied = results.filter((r) => r.applied).map((r) => `${r.file}: applied`);
        fixesThisIter.push(...applied);
        totalFixesApplied.push(...applied);
      }

      const failuresBefore = currentEntries.length;
      let failuresAfter = failuresBefore;

      if (verify && fixesThisIter.length > 0) {
        currentEntries = await verify();
        failuresAfter = currentEntries.length;
        if (failuresAfter === 0) {
          iterations.push({
            iteration: iter,
            phase: phaseForIter,
            fixesApplied: fixesThisIter,
            failuresBefore,
            failuresAfter: 0,
            tokensSpent: tokensTotal.input + tokensTotal.output > 0 ? tokensTotal : undefined,
          });
          break;
        }
      }

      iterations.push({
        iteration: iter,
        phase: phaseForIter,
        fixesApplied: fixesThisIter,
        failuresBefore,
        failuresAfter,
        tokensSpent: tokensTotal.input + tokensTotal.output > 0 ? tokensTotal : undefined,
      });
    }

    const report: HealReport = {
      failuresBeforeHeal: entries.length,
      failuresAfterHeal: currentEntries.length,
      iterations,
      tokensSpentTotal: tokensTotal.input + tokensTotal.output > 0 ? tokensTotal : undefined,
      verdict: currentEntries.length === 0 ? 'SHIP' : 'NO_SHIP',
    };

    return { report, fixesApplied: totalFixesApplied };
  }

  private buildPromptForGroup(group: HealPlanGroup): string {
    if (group.failures.length === 1) {
      return buildFixPrompt(group.failures[0]!, {
        islContent: this.options.islContent,
      });
    }
    return buildBatchFixPrompt(group.failures, group.category, {
      islContent: this.options.islContent,
    });
  }
}
