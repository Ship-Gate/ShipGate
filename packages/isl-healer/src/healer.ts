/**
 * ISL Healer v2 - Self-Healing Pipeline
 *
 * Heal until ship: run gate → map violations → apply patches → rerun gate
 *
 * The healer is allowed to:
 * ✓ Add missing enforcement (rate limiting, audit, validation, encryption)
 * ✓ Add missing intent anchors in required places
 * ✓ Refactor within touched files minimally
 * ✓ Add tests required by the spec
 *
 * The healer is NOT allowed to:
 * ✗ Remove intents from the ISL spec
 * ✗ Add suppressions automatically
 * ✗ Downgrade severity
 * ✗ Change gate rules/packs
 * ✗ Broaden allowlists / weaken security
 * ✗ "Make it pass" by hiding violations
 * ✗ Guess fixes for unknown rules
 *
 * @module @isl-lang/healer
 */

import * as crypto from 'crypto';
import type {
  ISLAST,
  HealResult,
  HealOptions,
  HealReason,
  GateResult,
  Violation,
  IterationSnapshot,
  PatchOperation,
  PatchRecord,
  FrameworkAdapter,
  SupportedFramework,
  FixRecipeRegistry,
} from './types.js';
import { createDefaultRegistry } from './recipe-registry.js';
import { WeakeningGuard, WeakeningError } from './weakening-guard.js';
import { ProofBundleV2Builder, generateClauseEvidence } from './proof-builder.js';
// Note: getFrameworkAdapter is async; we use sync adapter lookup in constructor
// Note: BUILTIN_RECIPES are auto-registered via createDefaultRegistry

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<HealOptions> = {
  maxIterations: 8,
  stopOnRepeat: 2,
  allowNewFiles: false,
  runBuild: false,
  runTests: false,
  requireTests: false,
  verbose: true,
  customRecipes: [],
  framework: undefined as unknown as SupportedFramework,
  onIteration: () => {},
  onComplete: () => {},
};

// ============================================================================
// Clause-Level Tracker
// ============================================================================

/**
 * Tracks individual clause/violation progress to detect stuck violations
 */
class ClauseTracker {
  private clauseHistory: Map<string, number[]> = new Map(); // ruleId -> iteration numbers seen
  private stuckClauses: Set<string> = new Set();

  /**
   * Record a violation at this iteration
   */
  recordViolation(ruleId: string, iteration: number): void {
    const history = this.clauseHistory.get(ruleId) ?? [];
    history.push(iteration);
    this.clauseHistory.set(ruleId, history);
  }

  /**
   * Check if a specific clause is stuck (appeared in consecutive iterations)
   */
  isClauseStuck(ruleId: string, threshold: number = 3): boolean {
    const history = this.clauseHistory.get(ruleId) ?? [];
    if (history.length < threshold) return false;

    // Check if the last N iterations all had this violation
    const recentIterations = history.slice(-threshold);
    const isConsecutive = recentIterations.every((iter, i, arr) => 
      i === 0 || iter === (arr[i - 1] ?? 0) + 1
    );

    if (isConsecutive) {
      this.stuckClauses.add(ruleId);
    }

    return isConsecutive;
  }

  /**
   * Get all stuck clauses
   */
  getStuckClauses(): string[] {
    return Array.from(this.stuckClauses);
  }

  /**
   * Get clause progress report
   */
  getProgressReport(): { ruleId: string; iterations: number; trend: 'improving' | 'stuck' | 'new' }[] {
    const report: { ruleId: string; iterations: number; trend: 'improving' | 'stuck' | 'new' }[] = [];

    for (const [ruleId, history] of this.clauseHistory) {
      const iterations = history.length;
      let trend: 'improving' | 'stuck' | 'new';

      if (iterations === 1) {
        trend = 'new';
      } else if (this.stuckClauses.has(ruleId)) {
        trend = 'stuck';
      } else {
        trend = 'improving';
      }

      report.push({ ruleId, iterations, trend });
    }

    return report;
  }
}

// ============================================================================
// Fingerprint Tracker (Enhanced)
// ============================================================================

class FingerprintTracker {
  private fingerprints: Map<string, number> = new Map();
  private history: string[] = [];
  private maxIterations: number;
  private repeatThreshold: number;
  private clauseTracker: ClauseTracker = new ClauseTracker();

  constructor(maxIterations: number, repeatThreshold: number) {
    this.maxIterations = maxIterations;
    this.repeatThreshold = repeatThreshold;
  }

  /**
   * Record violations for clause-level tracking
   */
  recordViolations(violations: Violation[], iteration: number): void {
    for (const v of violations) {
      this.clauseTracker.recordViolation(v.ruleId, iteration);
    }
  }

  record(fingerprint: string): {
    shouldAbort: boolean;
    reason?: 'stuck' | 'max_iterations' | 'oscillating' | 'clause_stuck';
    details?: string;
    stuckClauses?: string[];
  } {
    this.history.push(fingerprint);

    // Increment count
    const count = (this.fingerprints.get(fingerprint) ?? 0) + 1;
    this.fingerprints.set(fingerprint, count);

    // Check max iterations
    if (this.history.length > this.maxIterations) {
      return {
        shouldAbort: true,
        reason: 'max_iterations',
        details: `Exceeded ${this.maxIterations} iterations without resolution`,
        stuckClauses: this.clauseTracker.getStuckClauses(),
      };
    }

    // Check repeat threshold (stuck)
    if (count >= this.repeatThreshold) {
      return {
        shouldAbort: true,
        reason: 'stuck',
        details: `Fingerprint ${fingerprint.slice(0, 8)}... repeated ${count} times`,
        stuckClauses: this.clauseTracker.getStuckClauses(),
      };
    }

    // Check oscillation (A → B → A → B pattern)
    if (this.history.length >= 4) {
      const recent = this.history.slice(-4);
      if (
        recent[0] === recent[2] &&
        recent[1] === recent[3] &&
        recent[0] && recent[1] && recent[0] !== recent[1]
      ) {
        return {
          shouldAbort: true,
          reason: 'oscillating',
          details: `Oscillating between fingerprints ${recent[0]?.slice(0, 8) ?? 'unknown'}... and ${recent[1]?.slice(0, 8) ?? 'unknown'}...`,
          stuckClauses: this.clauseTracker.getStuckClauses(),
        };
      }
    }

    // Check for clause-level stuck (individual violations that won't resolve)
    const stuckClauses = this.clauseTracker.getStuckClauses();
    if (stuckClauses.length > 0 && this.history.length >= 4) {
      return {
        shouldAbort: true,
        reason: 'clause_stuck',
        details: `Individual clauses stuck without resolution: ${stuckClauses.join(', ')}`,
        stuckClauses,
      };
    }

    return { shouldAbort: false };
  }

  /**
   * Get progress report for diagnostics
   */
  getProgressReport(): ReturnType<ClauseTracker['getProgressReport']> {
    return this.clauseTracker.getProgressReport();
  }
}

// ============================================================================
// ISLHealerV2 Class
// ============================================================================

/**
 * ISLHealerV2 - Production-grade self-healing engine
 */
export class ISLHealerV2 {
  private ast: Readonly<ISLAST>;
  private codeMap: Map<string, string>;
  private options: Required<HealOptions>;
  private registry: FixRecipeRegistry;
  private guard: WeakeningGuard;
  private framework: FrameworkAdapter;
  private proofBuilder: ProofBundleV2Builder;
  private tracker: FingerprintTracker;
  private history: IterationSnapshot[] = [];
  private projectRoot: string;

  constructor(
    ast: ISLAST,
    initialCode: Map<string, string>,
    options: Partial<HealOptions> = {},
    projectRoot: string = process.cwd()
  ) {
    // Freeze AST - healer cannot modify the spec
    this.ast = Object.freeze(ast) as Readonly<ISLAST>;
    this.codeMap = new Map(initialCode);
    this.projectRoot = projectRoot;

    // Merge options
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Initialize registry with built-in recipes + custom
    this.registry = createDefaultRegistry();
    // Add custom recipes if provided
    for (const recipe of this.options.customRecipes || []) {
      this.registry.register(recipe);
    }

    // Initialize weakening guard
    this.guard = new WeakeningGuard();

    // Initialize fingerprint tracker
    this.tracker = new FingerprintTracker(
      this.options.maxIterations,
      this.options.stopOnRepeat
    );

    // Initialize proof builder
    this.proofBuilder = new ProofBundleV2Builder(ast);
    this.proofBuilder.setMaxIterations(this.options.maxIterations);
    this.proofBuilder.addSourceFiles(Array.from(initialCode.keys()));
    this.proofBuilder.setInitialCode(initialCode);

    // Get framework adapter synchronously using the adapter map
    // Note: getFrameworkAdapter is async for auto-detection, but we use direct lookup here
    const frameworkName = this.options.framework || 'nextjs-app';
    // Import the adapters directly for sync access
    const adapters = require('./adapters/index.js');
    this.framework = adapters[
      frameworkName === 'nextjs-app' ? 'NextJSAppAdapter' :
      frameworkName === 'nextjs-pages' ? 'NextJSPagesAdapter' :
      frameworkName === 'express' ? 'ExpressAdapter' :
      frameworkName === 'fastify' ? 'FastifyAdapter' :
      'NextJSAppAdapter'
    ] as FrameworkAdapter;
  }

  /**
   * Run the healing loop until SHIP or abort condition
   */
  async heal(runGate: () => Promise<GateResult>): Promise<HealResult> {
    const startTime = Date.now();

    for (let i = 1; i <= this.options.maxIterations; i++) {
      const iterationStart = Date.now();

      // ─────────────────────────────────────────────────────────────────────
      // Step 1: Run Gate
      // ─────────────────────────────────────────────────────────────────────
      this.log(`\n┌─ Iteration ${i}/${this.options.maxIterations} ${'─'.repeat(40)}┐`);

      const gate = await runGate();

      this.log(`│ Score: ${gate.score}/100`);
      this.log(`│ Verdict: ${gate.verdict}`);
      this.log(`│ Violations: ${gate.violations.length}`);

      // ─────────────────────────────────────────────────────────────────────
      // Step 2: Check for SHIP
      // ─────────────────────────────────────────────────────────────────────
      if (gate.verdict === 'SHIP') {
        const snapshot = this.createSnapshot(i, gate, [], iterationStart);
        this.history.push(snapshot);
        this.proofBuilder.addIterationWithDiff(snapshot, this.codeMap);

        this.log(`│`);
        this.log(`│ ✓ SHIP - All intents satisfied!`);
        this.log(`└${'─'.repeat(50)}┘`);

        return this.buildResult(true, 'ship', gate, i, startTime);
      }

      // ─────────────────────────────────────────────────────────────────────
      // Step 3: Record violations for clause-level tracking
      // ─────────────────────────────────────────────────────────────────────
      this.tracker.recordViolations(gate.violations, i);

      // ─────────────────────────────────────────────────────────────────────
      // Step 4: Check for Stuck (Fingerprint + Clause-Level Tracking)
      // ─────────────────────────────────────────────────────────────────────
      const trackResult = this.tracker.record(gate.fingerprint);

      if (trackResult.shouldAbort) {
        this.log(`│`);
        this.log(`│ ✗ ${trackResult.reason?.toUpperCase()} - ${trackResult.details}`);

        // Log stuck clauses for diagnostics
        if (trackResult.stuckClauses && trackResult.stuckClauses.length > 0) {
          this.log(`│   Stuck clauses:`);
          for (const clause of trackResult.stuckClauses) {
            this.log(`│     • ${clause}`);
          }
        }

        // Log progress report
        const progressReport = this.tracker.getProgressReport();
        if (progressReport.length > 0) {
          this.log(`│   Progress report:`);
          for (const { ruleId, iterations, trend } of progressReport) {
            const symbol = trend === 'improving' ? '↗' : trend === 'stuck' ? '⚠' : '●';
            this.log(`│     ${symbol} ${ruleId}: ${iterations} iteration(s) [${trend}]`);
          }
        }

        this.log(`└${'─'.repeat(50)}┘`);

        const reason: HealReason =
          trackResult.reason === 'max_iterations' ? 'max_iterations' : 'stuck';

        const result = this.buildResult(false, reason, gate, i, startTime);
        if (trackResult.stuckClauses) {
          result.stuckClauses = trackResult.stuckClauses;
        }
        return result;
      }

      // ─────────────────────────────────────────────────────────────────────
      // Step 5: Check for Unknown Rules
      // ─────────────────────────────────────────────────────────────────────
      const unknownRules = this.registry.findUnknownRules(gate.violations);
      const knownViolations = gate.violations.filter(v => this.registry.has(v.ruleId));
      const hasOnlyUnknownRules = unknownRules.length > 0 && knownViolations.length === 0;

      // If ALL violations are unknown, abort immediately
      if (hasOnlyUnknownRules) {
        this.log(`│`);
        this.log(`│ ✗ UNKNOWN_RULE - Cannot fix any violations automatically:`);
        for (const rule of unknownRules) {
          this.log(`│   • ${rule}`);
        }
        this.log(`└${'─'.repeat(50)}┘`);

        const result = this.buildResult(false, 'unknown_rule', gate, i, startTime);
        result.unknownRules = unknownRules;
        return result;
      }

      // Log warning if some rules are unknown but we have known ones to fix
      if (unknownRules.length > 0) {
        this.log(`│`);
        this.log(`│ ⚠ Warning: ${unknownRules.length} unknown rule(s) will not be fixed:`);
        for (const rule of unknownRules) {
          this.log(`│   • ${rule}`);
        }
        this.log(`│ Continuing with ${knownViolations.length} fixable violation(s)...`);
      }

      // ─────────────────────────────────────────────────────────────────────
      // Step 6: Apply Patches
      // ─────────────────────────────────────────────────────────────────────
      this.log(`│`);
      this.log(`│ Applying fixes for ${knownViolations.length} violation(s)...`);

      const patchRecords: PatchRecord[] = [];

      for (const violation of gate.violations) {
        const recipe = this.registry.get(violation.ruleId);
        if (!recipe) continue;

        try {
          // Create patches
          const patches = recipe.createPatches(violation, {
            ast: this.ast,
            codeMap: this.codeMap,
            framework: this.framework,
            projectRoot: this.projectRoot,
            iteration: i,
            previousPatches: patchRecords,
          });

          // Validate and apply each patch
          for (const patch of patches) {
            // Check for weakening
            try {
              this.guard.validatePatch(patch);
            } catch (err) {
              if (err instanceof WeakeningError) {
                this.log(`│   ✗ REFUSED: ${err.message}`);
                return this.buildResult(
                  false,
                  'weakening_detected',
                  gate,
                  i,
                  startTime
                );
              }
              throw err;
            }

            // Apply patch
            const applied = this.applyPatch(patch);
            if (applied) {
              patchRecords.push({
                ruleId: violation.ruleId,
                recipeName: recipe.name,
                file: patch.file,
                operation: patch,
                linesChanged: applied.linesChanged,
                timestamp: new Date().toISOString(),
                validationResults: [],
              });

              this.log(`│   ✓ ${patch.description}`);
            }
          }
        } catch (err) {
          this.log(`│   ⚠ Error applying fix for ${violation.ruleId}: ${err}`);
        }
      }

      // Add intent anchors if any files were patched
      await this.addIntentAnchors();

      // ─────────────────────────────────────────────────────────────────────
      // Step 7: Record Iteration with Diff
      // ─────────────────────────────────────────────────────────────────────
      const snapshot = this.createSnapshot(i, gate, patchRecords, iterationStart);
      this.history.push(snapshot);
      this.proofBuilder.addIterationWithDiff(snapshot, this.codeMap);
      this.options.onIteration?.(snapshot);

      if (patchRecords.length === 0) {
        this.log(`│   ⚠ No patches could be applied`);
      }

      this.log(`└${'─'.repeat(50)}┘`);
    }

    // Max iterations reached without resolution
    const finalGate = await runGate();
    return this.buildResult(false, 'max_iterations', finalGate, this.options.maxIterations, startTime);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Patch Application
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Apply a single patch to the code
   */
  private applyPatch(patch: PatchOperation): { linesChanged: number } | null {
    let code = this.codeMap.get(patch.file);
    if (!code) {
      if (this.options.allowNewFiles) {
        code = '';
      } else {
        return null;
      }
    }

    const originalLines = code.split('\n').length;
    let newCode = code;

    switch (patch.type) {
      case 'insert': {
        if (patch.span) {
          // Insert at specific line
          const lines = code.split('\n');
          lines.splice(patch.span.startLine - 1, 0, patch.content);
          newCode = lines.join('\n');
        } else {
          // Append to file
          newCode = code + patch.content;
        }
        break;
      }

      case 'replace': {
        if (patch.span) {
          const lines = code.split('\n');
          const startLine = patch.span.startLine - 1;
          const endLine = patch.span.endLine - 1;
          const linesToReplace = endLine - startLine + 1;
          lines.splice(startLine, linesToReplace, patch.content);
          newCode = lines.join('\n');
        }
        break;
      }

      case 'delete': {
        if (patch.span) {
          const lines = code.split('\n');
          const startLine = patch.span.startLine - 1;
          const endLine = patch.span.endLine - 1;
          const linesToDelete = endLine - startLine + 1;
          lines.splice(startLine, linesToDelete);
          newCode = lines.join('\n');
        }
        break;
      }

      case 'wrap': {
        if (patch.span && patch.wrapPrefix && patch.wrapSuffix) {
          const lines = code.split('\n');
          const startLine = patch.span.startLine - 1;
          const endLine = patch.span.endLine - 1;
          const wrappedContent = [
            patch.wrapPrefix,
            ...lines.slice(startLine, endLine + 1),
            patch.wrapSuffix,
          ].join('\n');
          lines.splice(startLine, endLine - startLine + 1, wrappedContent);
          newCode = lines.join('\n');
        }
        break;
      }
    }

    if (newCode !== code) {
      this.codeMap.set(patch.file, newCode);
      return { linesChanged: Math.abs(newCode.split('\n').length - originalLines) };
    }

    return null;
  }

  /**
   * Add __isl_intents export to route files
   */
  private async addIntentAnchors(): Promise<void> {
    const intents = this.ast.behaviors.flatMap((b) => b.intents.map((i) => i.tag));
    if (intents.length === 0) return;

    for (const [file, code] of this.codeMap) {
      const isRouteFile =
        file.includes('route.ts') ||
        file.includes('route.js') ||
        (file.includes('/routes/') && !file.includes('.test.'));

      if (isRouteFile && !code.includes('__isl_intents')) {
        const anchor = this.framework.getIntentAnchorsExport(intents);
        this.codeMap.set(file, code + anchor);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Result Building
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create iteration snapshot
   */
  private createSnapshot(
    iteration: number,
    gate: GateResult,
    patches: PatchRecord[],
    startTime: number
  ): IterationSnapshot {
    return {
      iteration,
      gateResult: {
        verdict: gate.verdict,
        score: gate.score,
        violationCount: gate.violations.length,
        fingerprint: gate.fingerprint,
      },
      violations: gate.violations,
      patchesAttempted: patches,
      patchesApplied: patches.filter((p) => p.linesChanged > 0),
      codeStateHash: this.computeCodeHash(),
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build final result
   */
  private buildResult(
    ok: boolean,
    reason: HealReason,
    gate: GateResult,
    iterations: number,
    startTime: number
  ): HealResult {
    // Finalize proof builder
    this.proofBuilder.setGateResult(
      gate.verdict,
      gate.score,
      gate.violations,
      gate.fingerprint
    );
    this.proofBuilder.setHealReason(reason);

    // Generate clause evidence
    const evidence = generateClauseEvidence(this.ast, this.codeMap);
    this.proofBuilder.addAllClauseEvidence(evidence);

    const proof = this.proofBuilder.build();

    const result: HealResult = {
      ok,
      reason,
      gate: {
        format: 'json',
        verdict: gate.verdict,
        score: gate.score,
        violations: gate.violations,
        fingerprint: gate.fingerprint,
        metadata: {
          tool: 'isl-healer',
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      },
      iterations,
      history: this.history,
      finalCode: this.codeMap,
      proof,
      durationMs: Date.now() - startTime,
    };

    this.options.onComplete?.(result);
    return result;
  }

  /**
   * Compute hash of current code state
   */
  private computeCodeHash(): string {
    const content = Array.from(this.codeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, code]) => `${file}:${code}`)
      .join('\n');
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Log message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.options.verbose) {
      console.log(message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public Getters
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get current code state
   */
  getCodeMap(): Map<string, string> {
    return new Map(this.codeMap);
  }

  /**
   * Get iteration history
   */
  getHistory(): readonly IterationSnapshot[] {
    return this.history;
  }

  /**
   * Get the frozen AST
   */
  getAST(): Readonly<ISLAST> {
    return this.ast;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a healer instance
 */
export function createHealer(
  ast: ISLAST,
  code: Map<string, string>,
  options?: Partial<HealOptions>
): ISLHealerV2 {
  return new ISLHealerV2(ast, code, options);
}

/**
 * Heal until ship - main entry point
 *
 * @param ast - Frozen ISL AST
 * @param code - Initial code map
 * @param runGate - Function to run the gate and return results
 * @param options - Healing options
 * @returns HealResult with proof bundle
 */
export async function healUntilShip(
  ast: ISLAST,
  code: Map<string, string>,
  runGate: () => Promise<GateResult>,
  options?: Partial<HealOptions>
): Promise<HealResult> {
  const healer = new ISLHealerV2(ast, code, options);
  return healer.heal(runGate);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a mock gate result for testing
 */
export function createMockGateResult(
  verdict: 'SHIP' | 'NO_SHIP',
  violations: Violation[],
  score?: number
): GateResult {
  const calculatedScore = score ?? (100 - violations.length * 10);
  const fingerprint = crypto
    .createHash('sha256')
    .update(violations.map((v) => v.ruleId).join(','))
    .digest('hex')
    .slice(0, 16);

  return {
    format: 'json',
    verdict,
    score: calculatedScore,
    violations,
    fingerprint,
    metadata: {
      tool: 'mock',
      durationMs: 0,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create a violation for testing
 */
export function createViolation(
  ruleId: string,
  file: string,
  message: string,
  line: number = 1
): Violation {
  return {
    ruleId,
    file,
    span: {
      startLine: line,
      startColumn: 1,
      endLine: line,
      endColumn: 1,
    },
    message,
    severity: 'high',
    evidence: {},
  };
}
