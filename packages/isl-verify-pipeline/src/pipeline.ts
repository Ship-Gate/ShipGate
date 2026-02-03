/**
 * Verification Pipeline Orchestrator
 * 
 * Main entry point for the verification pipeline.
 * Orchestrates all stages: test runner, trace collector, postcondition evaluator,
 * invariant checker, SMT checker, and proof bundle generation.
 * 
 * @module @isl-lang/verify-pipeline
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { DomainDeclaration } from '@isl-lang/isl-core';
import type {
  PipelineConfig,
  PipelineResult,
  PipelineVerdict,
  PipelineStage,
  StageResult,
  StageError,
  PipelineHooks,
  ClauseEvidence,
  InvariantEvidence,
} from './types.js';
import {
  runTests,
  TestRunnerConfig,
  TestRunnerOutput,
} from './stages/test-runner.js';
import {
  collectTraces,
  writeTraces,
  TraceCollectorConfig,
  TraceCollectorOutput,
} from './stages/trace-collector.js';
import {
  evaluatePostconditions,
  PostconditionEvaluatorConfig,
  PostconditionEvaluatorOutput,
} from './stages/postcondition-evaluator.js';
import {
  checkInvariants,
  InvariantCheckerConfig,
  InvariantCheckerOutput,
} from './stages/invariant-checker.js';
import {
  checkWithSMT,
  SMTCheckerConfig,
  SMTCheckerOutput,
} from './stages/smt-checker.js';
import {
  generateCIOutput,
  formatCIOutput,
} from './output/ci-output.js';
import {
  writeToProofBundle,
  updateManifest,
} from './output/proof-bundle-integration.js';

// ============================================================================
// Pipeline Class
// ============================================================================

export class VerificationPipeline {
  private config: PipelineConfig;
  private domain: DomainDeclaration | null = null;
  private specContent: string = '';
  private hooks: PipelineHooks;
  
  constructor(config: PipelineConfig, hooks: PipelineHooks = {}) {
    this.config = config;
    this.hooks = hooks;
  }
  
  /**
   * Run the complete verification pipeline
   */
  async run(): Promise<PipelineResult> {
    const runId = generateRunId();
    const startTime = new Date();
    const errors: StageError[] = [];
    
    // Initialize result structure
    const result: PipelineResult = {
      runId,
      verdict: 'INCOMPLETE_PROOF',
      verdictReason: 'Pipeline not yet complete',
      score: 0,
      timing: {
        startedAt: startTime.toISOString(),
        completedAt: '',
        totalDurationMs: 0,
      },
      stages: {},
      evidence: {
        postconditions: [],
        invariants: [],
      },
      summary: {
        tests: { total: 0, passed: 0, failed: 0 },
        postconditions: { total: 0, proven: 0, violated: 0, notProven: 0 },
        invariants: { total: 0, proven: 0, violated: 0, notProven: 0 },
      },
      errors: [],
    };
    
    try {
      // ─── Stage 1: Setup ───
      result.stages.setup = await this.runStage('setup', async () => {
        await this.loadSpec();
        return { specLoaded: true, domain: this.domain?.name?.value };
      });
      
      if (!this.domain) {
        throw this.createError('spec_error', 'SPEC_LOAD_FAILED', 'Failed to load domain spec');
      }
      
      // ─── Stage 2: Test Runner ───
      result.stages.testRunner = await this.runStage('test_runner', async () => {
        const testConfig: TestRunnerConfig = {
          pattern: this.config.tests.pattern,
          framework: this.config.tests.framework,
          timeout: this.config.tests.timeout || this.config.timeouts?.testRunner,
          coverage: this.config.tests.coverage,
          cwd: this.getProjectRoot(),
        };
        return runTests(testConfig);
      });
      
      // Update test summary
      if (result.stages.testRunner?.output) {
        const testOutput = result.stages.testRunner.output as TestRunnerOutput;
        result.summary.tests = {
          total: testOutput.summary.totalTests,
          passed: testOutput.summary.passedTests,
          failed: testOutput.summary.failedTests,
        };
      }
      
      // ─── Stage 3: Trace Collector ───
      result.stages.traceCollector = await this.runStage('trace_collector', async () => {
        if (!this.config.traces.enabled) {
          return { traces: [], summary: { totalTraces: 0, totalEvents: 0, behaviors: [], checksPassed: 0, checksFailed: 0 } };
        }
        
        const traceConfig: TraceCollectorConfig = {
          traceDir: path.join(this.getProjectRoot(), '.verify-pipeline', 'traces'),
          maxEvents: this.config.traces.maxEvents,
          redactPii: this.config.traces.redactPii,
        };
        return collectTraces(traceConfig);
      });
      
      // ─── Stage 4: Postcondition Evaluator ───
      result.stages.postconditionEvaluator = await this.runStage('postcondition_evaluator', async () => {
        const traceOutput = result.stages.traceCollector?.output as TraceCollectorOutput | undefined;
        
        const evalConfig: PostconditionEvaluatorConfig = {
          domain: this.domain!,
          traces: traceOutput?.traces || [],
          timeoutPerClause: this.config.timeouts?.postconditionEvaluator,
          diagnostics: true,
        };
        return evaluatePostconditions(evalConfig);
      });
      
      // Update postcondition summary and evidence
      if (result.stages.postconditionEvaluator?.output) {
        const postOutput = result.stages.postconditionEvaluator.output as PostconditionEvaluatorOutput;
        result.summary.postconditions = {
          total: postOutput.summary.totalClauses,
          proven: postOutput.summary.provenClauses,
          violated: postOutput.summary.violatedClauses,
          notProven: postOutput.summary.notProvenClauses,
        };
        result.evidence.postconditions = postOutput.evidence;
      }
      
      // ─── Stage 5: Invariant Checker ───
      result.stages.invariantChecker = await this.runStage('invariant_checker', async () => {
        const traceOutput = result.stages.traceCollector?.output as TraceCollectorOutput | undefined;
        
        const invConfig: InvariantCheckerConfig = {
          domain: this.domain!,
          traces: traceOutput?.traces || [],
        };
        return checkInvariants(invConfig);
      });
      
      // Update invariant summary and evidence
      if (result.stages.invariantChecker?.output) {
        const invOutput = result.stages.invariantChecker.output as InvariantCheckerOutput;
        result.summary.invariants = {
          total: invOutput.summary.totalInvariants,
          proven: invOutput.summary.provenInvariants,
          violated: invOutput.summary.violatedInvariants,
          notProven: invOutput.summary.notProvenInvariants,
        };
        result.evidence.invariants = invOutput.evidence;
      }
      
      // ─── Stage 6: SMT Checker (Optional) ───
      if (this.config.smt?.enabled) {
        result.stages.smtChecker = await this.runStage('smt_checker', async () => {
          const notProvenClauses = [
            ...result.evidence.postconditions.filter(e => e.status === 'not_proven'),
            ...result.evidence.invariants.filter(e => e.status === 'not_proven'),
          ];
          
          const smtConfig: SMTCheckerConfig = {
            domain: this.domain!,
            clauses: notProvenClauses,
            solver: this.config.smt?.solver,
            timeout: this.config.smt?.timeout || this.config.timeouts?.smtChecker,
          };
          return checkWithSMT(smtConfig);
        });
        
        // Update summary with SMT results
        if (result.stages.smtChecker?.output) {
          const smtOutput = result.stages.smtChecker.output as SMTCheckerOutput;
          result.summary.smt = {
            total: smtOutput.summary.totalChecks,
            proven: smtOutput.summary.proven,
            refuted: smtOutput.summary.refuted,
            unknown: smtOutput.summary.unknown,
          };
        }
      }
      
      // ─── Calculate Final Verdict ───
      const { verdict, reason, score } = this.calculateVerdict(result);
      result.verdict = verdict;
      result.verdictReason = reason;
      result.score = score;
      
      // ─── Stage 7: Proof Bundle ───
      if (this.config.proofBundle?.outputDir) {
        result.stages.proofBundle = await this.runStage('proof_bundle', async () => {
          const bundleDir = path.join(
            this.config.proofBundle!.outputDir!,
            `verify-${runId}`
          );
          
          await writeToProofBundle(result, {
            bundleDir,
            domain: this.domain!.name.value,
            specVersion: this.domain!.version?.value || '0.0.0',
            specContent: this.specContent,
            includeFullTraces: this.config.proofBundle?.includeFullTraces,
          });
          
          await updateManifest(bundleDir, result);
          
          return {
            bundleId: runId,
            bundlePath: bundleDir,
          };
        });
        
        // Update result with proof bundle info
        if (result.stages.proofBundle?.output) {
          const bundleOutput = result.stages.proofBundle.output as { bundleId: string; bundlePath: string };
          result.proofBundle = {
            bundleId: bundleOutput.bundleId,
            bundlePath: bundleOutput.bundlePath,
            manifestPath: path.join(bundleOutput.bundlePath, 'manifest.json'),
          };
        }
      }
      
      // ─── Write CI Output ───
      if (this.config.ci?.enabled && this.config.ci.outputPath) {
        const ciOutput = generateCIOutput(result);
        await fs.mkdir(path.dirname(this.config.ci.outputPath), { recursive: true });
        await fs.writeFile(this.config.ci.outputPath, formatCIOutput(ciOutput));
      }
      
    } catch (error) {
      const stageError = error instanceof Error && 'category' in error
        ? error as StageError
        : this.createError('internal_error', 'PIPELINE_ERROR', error instanceof Error ? error.message : String(error));
      
      errors.push(stageError);
      result.errors = errors;
      result.verdict = 'FAILED';
      result.verdictReason = `Pipeline error: ${stageError.message}`;
    }
    
    // ─── Finalize ───
    const endTime = new Date();
    result.timing.completedAt = endTime.toISOString();
    result.timing.totalDurationMs = endTime.getTime() - startTime.getTime();
    result.errors = errors;
    
    return result;
  }
  
  // ============================================================================
  // Stage Execution
  // ============================================================================
  
  private async runStage<T>(
    stage: PipelineStage,
    fn: () => Promise<T>
  ): Promise<StageResult<T>> {
    const startTime = new Date();
    
    await this.hooks.beforeStage?.(stage);
    
    try {
      const output = await fn();
      
      const result: StageResult<T> = {
        stage,
        status: 'passed',
        startedAt: startTime.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime.getTime(),
        output,
      };
      
      await this.hooks.afterStage?.(stage, result);
      
      return result;
    } catch (error) {
      const stageError = error instanceof Error && 'category' in error
        ? error as StageError
        : this.createError('internal_error', 'STAGE_ERROR', error instanceof Error ? error.message : String(error), stage);
      
      const result: StageResult<T> = {
        stage,
        status: 'failed',
        startedAt: startTime.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime.getTime(),
        error: stageError,
      };
      
      await this.hooks.afterStage?.(stage, result);
      
      throw stageError;
    }
  }
  
  // ============================================================================
  // Spec Loading
  // ============================================================================
  
  private async loadSpec(): Promise<void> {
    if (typeof this.config.spec === 'string') {
      // Assume it's content if it contains newlines, otherwise a path
      if (this.config.spec.includes('\n') || this.config.spec.includes('domain ')) {
        this.specContent = this.config.spec;
      } else {
        this.specContent = await fs.readFile(this.config.spec, 'utf-8');
      }
    } else {
      this.specContent = this.config.spec.content;
    }
    
    // Parse the spec (simplified - in real impl would use @isl-lang/parser)
    this.domain = this.parseSpec(this.specContent);
  }
  
  private parseSpec(content: string): DomainDeclaration {
    // Simplified parser - in real implementation, use @isl-lang/parser
    const nameMatch = content.match(/domain\s+(\w+)/);
    const versionMatch = content.match(/version:\s*"([^"]+)"/);
    
    return {
      kind: 'DomainDeclaration',
      name: { kind: 'Identifier', value: nameMatch?.[1] || 'Unknown' },
      version: versionMatch ? { kind: 'StringLiteral', value: versionMatch[1] } : undefined,
      entities: [],
      behaviors: [],
      invariants: [],
      imports: [],
      exports: [],
    } as DomainDeclaration;
  }
  
  // ============================================================================
  // Verdict Calculation
  // ============================================================================
  
  private calculateVerdict(result: PipelineResult): {
    verdict: PipelineVerdict;
    reason: string;
    score: number;
  } {
    const { summary, evidence } = result;
    
    // Check for test failures
    if (summary.tests.failed > 0) {
      return {
        verdict: 'FAILED',
        reason: `${summary.tests.failed} test(s) failed`,
        score: 0,
      };
    }
    
    // Check for violations
    const totalViolations = summary.postconditions.violated + summary.invariants.violated;
    if (totalViolations > 0) {
      const score = this.calculateScore(summary);
      return {
        verdict: 'FAILED',
        reason: `${totalViolations} violation(s): ${summary.postconditions.violated} postcondition(s), ${summary.invariants.violated} invariant(s)`,
        score,
      };
    }
    
    // Check for incomplete proofs
    const totalNotProven = summary.postconditions.notProven + summary.invariants.notProven;
    if (totalNotProven > 0) {
      const score = this.calculateScore(summary);
      
      // If CI is configured to fail on incomplete, treat as failure
      if (this.config.ci?.failOnIncomplete) {
        return {
          verdict: 'FAILED',
          reason: `${totalNotProven} condition(s) could not be verified (failOnIncomplete enabled)`,
          score,
        };
      }
      
      return {
        verdict: 'INCOMPLETE_PROOF',
        reason: `${totalNotProven} condition(s) could not be verified: ${summary.postconditions.notProven} postcondition(s), ${summary.invariants.notProven} invariant(s)`,
        score,
      };
    }
    
    // All proven
    const totalClauses = summary.postconditions.total + summary.invariants.total;
    return {
      verdict: 'PROVEN',
      reason: `All ${totalClauses} condition(s) verified: ${summary.postconditions.total} postcondition(s), ${summary.invariants.total} invariant(s)`,
      score: 100,
    };
  }
  
  private calculateScore(summary: PipelineResult['summary']): number {
    const totalClauses = summary.postconditions.total + summary.invariants.total;
    if (totalClauses === 0) return 0;
    
    const proven = summary.postconditions.proven + summary.invariants.proven;
    const violated = summary.postconditions.violated + summary.invariants.violated;
    
    // Score formula:
    // - Each proven clause adds positive points
    // - Each violated clause adds negative points
    // - Not proven clauses don't add points
    const positiveScore = (proven / totalClauses) * 100;
    const penalty = (violated / totalClauses) * 50;
    
    return Math.max(0, Math.round(positiveScore - penalty));
  }
  
  // ============================================================================
  // Utilities
  // ============================================================================
  
  private getProjectRoot(): string {
    if (typeof this.config.spec === 'object' && this.config.spec.path) {
      return path.dirname(this.config.spec.path);
    }
    return process.cwd();
  }
  
  private createError(
    category: StageError['category'],
    code: string,
    message: string,
    stage: PipelineStage = 'setup'
  ): StageError {
    return {
      category,
      code,
      message,
      stage,
      recoverable: false,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Run verification pipeline with the given configuration
 */
export async function verify(
  config: PipelineConfig,
  hooks?: PipelineHooks
): Promise<PipelineResult> {
  const pipeline = new VerificationPipeline(config, hooks);
  return pipeline.run();
}

/**
 * Generate a unique run ID
 */
function generateRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `verify-${timestamp}-${random}`;
}

/**
 * Create a default configuration
 */
export function createDefaultConfig(spec: string): PipelineConfig {
  return {
    spec,
    tests: {
      timeout: 60000,
      coverage: false,
    },
    traces: {
      enabled: true,
      maxEvents: 10000,
      redactPii: true,
    },
    ci: {
      enabled: false,
      failOnIncomplete: false,
    },
  };
}
