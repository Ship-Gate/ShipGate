/**
 * Tier 3 Verification Integration
 * 
 * Integrates property-based testing and mutation testing into the verification pipeline.
 * Supports tiered execution: Tier 1 (static), Tier 2 (runtime), Tier 3 (adversarial).
 */

import { PropertyTestProver, PropertyTestResult, PropertyTestThoroughness } from './provers/property-test-prover';
import { MutationTestProver, MutationTestResult, MutationTestThoroughness } from './provers/mutation-test-prover';
import type { Domain } from '@isl-lang/parser';
import type { PipelineResult, PipelineVerdict } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface Tier3Config {
  /** Enable property-based testing */
  propertyTests?: {
    enabled: boolean;
    thoroughness: PropertyTestThoroughness;
    seed?: number;
  };
  
  /** Enable mutation testing */
  mutationTests?: {
    enabled: boolean;
    thoroughness: MutationTestThoroughness;
    files: string[];
    testCommand: string;
  };

  /** Verbose output */
  verbose?: boolean;
}

export interface Tier3Result {
  propertyTests?: PropertyTestResult;
  mutationTests?: MutationTestResult;
  summary: {
    tier3Verdict: 'PROVEN' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
    tier3Score: number;
    propertyTestScore: number;
    mutationTestScore: number;
  };
  durationMs: number;
}

export interface TieredVerificationResult {
  tier: 1 | 2 | 3;
  tier1?: PipelineResult;
  tier2?: PipelineResult;
  tier3?: Tier3Result;
  overallVerdict: PipelineVerdict;
  overallScore: number;
  durationMs: number;
}

// ============================================================================
// TIER 3 RUNNER
// ============================================================================

export class Tier3Runner {
  private config: Tier3Config;

  constructor(config: Tier3Config) {
    this.config = config;
  }

  /**
   * Run Tier 3 verification (property-based and mutation testing)
   */
  async run(
    domain: Domain,
    implementation: Record<string, any>,
    sourceFiles: string[]
  ): Promise<Tier3Result> {
    const startTime = Date.now();
    
    let propertyTests: PropertyTestResult | undefined;
    let mutationTests: MutationTestResult | undefined;

    // Run property-based tests
    if (this.config.propertyTests?.enabled) {
      const prover = new PropertyTestProver({
        thoroughness: this.config.propertyTests.thoroughness,
        seed: this.config.propertyTests.seed,
        verbose: this.config.verbose,
      });

      if (this.config.verbose) {
        console.log('\n🔍 Running property-based tests...');
      }

      propertyTests = await prover.run(domain, implementation);

      if (this.config.verbose) {
        console.log(PropertyTestProver.formatResult(propertyTests));
      }
    }

    // Run mutation tests
    if (this.config.mutationTests?.enabled && sourceFiles.length > 0) {
      const prover = new MutationTestProver({
        thoroughness: this.config.mutationTests.thoroughness,
        files: this.config.mutationTests.files.length > 0 
          ? this.config.mutationTests.files 
          : sourceFiles,
        testCommand: this.config.mutationTests.testCommand,
        verbose: this.config.verbose,
      });

      if (this.config.verbose) {
        console.log('\n🧬 Running mutation tests...');
      }

      mutationTests = await prover.run();

      if (this.config.verbose) {
        console.log(MutationTestProver.formatResult(mutationTests));
      }
    }

    const durationMs = Date.now() - startTime;

    return this.calculateTier3Result(propertyTests, mutationTests, durationMs);
  }

  /**
   * Calculate Tier 3 verdict and score
   */
  private calculateTier3Result(
    propertyTests: PropertyTestResult | undefined,
    mutationTests: MutationTestResult | undefined,
    durationMs: number
  ): Tier3Result {
    if (!propertyTests && !mutationTests) {
      return {
        summary: {
          tier3Verdict: 'SKIPPED',
          tier3Score: 0,
          propertyTestScore: 0,
          mutationTestScore: 0,
        },
        durationMs,
      };
    }

    const propertyScore = propertyTests?.score ?? 100;
    const mutationScore = mutationTests?.score ?? 100;
    
    // Tier 3 score is weighted: 50% property tests, 50% mutation tests
    const tier3Score = Math.round((propertyScore + mutationScore) / 2);

    // Determine verdict
    let tier3Verdict: 'PROVEN' | 'PARTIAL' | 'FAILED';
    
    const propertyProof = propertyTests?.proof ?? 'PROVEN';
    const mutationProof = mutationTests?.proof ?? 'PROVEN';

    if (propertyProof === 'PROVEN' && mutationProof === 'PROVEN') {
      tier3Verdict = 'PROVEN';
    } else if (propertyProof === 'FAILED' || mutationProof === 'FAILED') {
      tier3Verdict = 'FAILED';
    } else {
      tier3Verdict = 'PARTIAL';
    }

    return {
      propertyTests,
      mutationTests,
      summary: {
        tier3Verdict,
        tier3Score,
        propertyTestScore: propertyScore,
        mutationTestScore: mutationScore,
      },
      durationMs,
    };
  }
}

// ============================================================================
// TIERED VERIFICATION ORCHESTRATOR
// ============================================================================

export class TieredVerificationOrchestrator {
  /**
   * Run verification up to specified tier
   */
  static async runTiered(
    tier: 1 | 2 | 3,
    domain: Domain,
    config: {
      tier1Config?: any;
      tier2Config?: any;
      tier3Config?: Tier3Config;
    }
  ): Promise<TieredVerificationResult> {
    const startTime = Date.now();
    
    let tier1Result: PipelineResult | undefined;
    let tier2Result: PipelineResult | undefined;
    let tier3Result: Tier3Result | undefined;

    // Tier 1: Static Analysis (always runs)
    // This would integrate with existing pipeline
    if (tier >= 1) {
      // Placeholder - would run actual Tier 1 static analysis
      tier1Result = await this.runTier1(domain, config.tier1Config);
    }

    // Tier 2: Runtime Verification (requires app startup)
    if (tier >= 2 && tier1Result) {
      // Placeholder - would run actual Tier 2 runtime verification
      tier2Result = await this.runTier2(domain, config.tier2Config);
    }

    // Tier 3: Adversarial Testing (property-based + mutation)
    if (tier >= 3 && tier2Result && config.tier3Config) {
      const runner = new Tier3Runner(config.tier3Config);
      
      // Extract implementation from tier 2 results (placeholder)
      const implementation = {};
      const sourceFiles: string[] = [];
      
      tier3Result = await runner.run(domain, implementation, sourceFiles);
    }

    const durationMs = Date.now() - startTime;

    return this.calculateOverallResult(tier, tier1Result, tier2Result, tier3Result, durationMs);
  }

  private static async runTier1(domain: Domain, config: any): Promise<PipelineResult> {
    // Placeholder - integrate with existing static analysis pipeline
    throw new Error('Tier 1 integration pending');
  }

  private static async runTier2(domain: Domain, config: any): Promise<PipelineResult> {
    // Placeholder - integrate with existing runtime verification pipeline
    throw new Error('Tier 2 integration pending');
  }

  /**
   * Calculate overall verdict from all tiers
   */
  private static calculateOverallResult(
    tier: 1 | 2 | 3,
    tier1: PipelineResult | undefined,
    tier2: PipelineResult | undefined,
    tier3: Tier3Result | undefined,
    durationMs: number
  ): TieredVerificationResult {
    // Calculate overall score (weighted by tier)
    let overallScore = 0;
    let weights = 0;

    if (tier1) {
      overallScore += tier1.score * 0.3; // Tier 1: 30%
      weights += 0.3;
    }

    if (tier2) {
      overallScore += tier2.score * 0.3; // Tier 2: 30%
      weights += 0.3;
    }

    if (tier3) {
      overallScore += tier3.summary.tier3Score * 0.4; // Tier 3: 40%
      weights += 0.4;
    }

    if (weights > 0) {
      overallScore = Math.round(overallScore / weights);
    }

    // Determine overall verdict
    let overallVerdict: PipelineVerdict = 'PROVEN';

    if (tier1?.verdict === 'FAILED' || tier2?.verdict === 'FAILED' || tier3?.summary.tier3Verdict === 'FAILED') {
      overallVerdict = 'FAILED';
    } else if (tier1?.verdict === 'INCOMPLETE_PROOF' || tier2?.verdict === 'INCOMPLETE_PROOF' || tier3?.summary.tier3Verdict === 'PARTIAL') {
      overallVerdict = 'INCOMPLETE_PROOF';
    }

    return {
      tier,
      tier1,
      tier2,
      tier3,
      overallVerdict,
      overallScore,
      durationMs,
    };
  }

  /**
   * Format tiered result for console output
   */
  static formatResult(result: TieredVerificationResult): string {
    const lines: string[] = [];
    
    lines.push('ISL Verify — Proof Bundle Report');
    lines.push('━'.repeat(80));
    
    // Tier 1
    if (result.tier1) {
      lines.push('━━━ Tier 1: Static Analysis ━━━');
      lines.push(`${this.getStatusIcon(result.tier1.verdict)} ${result.tier1.verdict}`);
      lines.push(`Score: ${result.tier1.score}/100`);
      lines.push('');
    }

    // Tier 2
    if (result.tier2) {
      lines.push('━━━ Tier 2: Runtime Verification ━━━');
      lines.push(`${this.getStatusIcon(result.tier2.verdict)} ${result.tier2.verdict}`);
      lines.push(`Score: ${result.tier2.score}/100`);
      lines.push('');
    }

    // Tier 3
    if (result.tier3 && result.tier3.summary.tier3Verdict !== 'SKIPPED') {
      lines.push('━━━ Tier 3: Adversarial Testing ━━━');
      
      if (result.tier3.propertyTests) {
        lines.push(`✅ Property Tests: ${result.tier3.propertyTests.summary.invariantsHeld}/${result.tier3.propertyTests.summary.totalInvariants} invariants held`);
      }
      
      if (result.tier3.mutationTests) {
        lines.push(`⚠️ Mutation Testing: ${result.tier3.mutationTests.summary.mutationScore}% mutation score (${result.tier3.mutationTests.summary.securityMutationScore}% security)`);
      }
      
      lines.push('');
    }

    // Overall
    lines.push('━'.repeat(80));
    lines.push(`Trust Score: ${result.overallScore}/100 — ${this.getStatusIcon(result.overallVerdict)} ${result.overallVerdict}`);
    lines.push('');
    lines.push('Residual Risks:');
    lines.push('• Business logic correctness: not statically verifiable');
    lines.push('• Load/performance behavior: not tested');
    lines.push('• Third-party dependency runtime: not verified');
    
    return lines.join('\n');
  }

  private static getStatusIcon(verdict: string): string {
    switch (verdict) {
      case 'PROVEN': return '✅';
      case 'INCOMPLETE_PROOF': return '⚠️';
      case 'PARTIAL': return '⚠️';
      case 'FAILED': return '❌';
      default: return '●';
    }
  }
}
