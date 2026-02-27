/**
 * Verification Engine
 *
 * Checks whether code actually implements what the inferred spec says it should.
 * Catches: hallucinated imports, dead endpoints, broken auth, mismatched types, untested paths.
 *
 * Each checker returns Finding[] with severity and blocking flags.
 *
 * @module @isl-lang/spec-implementation-verifier
 */

import type {
  Finding,
  VerificationContext,
  InferredSpec,
  VerifierChecker,
} from './types.js';
import { runImportVerifier } from './checkers/import-verifier.js';
import { runTypeConsistencyVerifier } from './checkers/type-consistency-verifier.js';
import { runEndpointVerifier } from './checkers/endpoint-verifier.js';
import { runAuthVerifier } from './checkers/auth-verifier.js';
import { runDeadCodeVerifier } from './checkers/dead-code-verifier.js';
import { runBehavioralVerifier } from './checkers/behavioral-verifier.js';

// ============================================================================
// Verification Engine
// ============================================================================

export interface VerificationEngineOptions {
  /** Which checkers to run (default: all) */
  checkers?: Array<
    | 'import'
    | 'type'
    | 'endpoint'
    | 'auth'
    | 'dead-code'
    | 'behavioral'
  >;
  /** Skip checkers that require full project context */
  skipHeavyChecks?: boolean;
}

export interface VerificationResult {
  /** All findings from all checkers */
  findings: Finding[];
  /** Summary by severity */
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  /** Whether any blocking findings exist */
  hasBlockingFindings: boolean;
  /** Duration in milliseconds */
  durationMs: number;
  /** Per-checker breakdown */
  byChecker: Record<string, Finding[]>;
}

const DEFAULT_CHECKERS: VerificationEngineOptions['checkers'] = [
  'import',
  'type',
  'endpoint',
  'auth',
  'dead-code',
  'behavioral',
];

export class VerificationEngine {
  private options: VerificationEngineOptions;

  constructor(options: VerificationEngineOptions = {}) {
    this.options = {
      checkers: options.checkers ?? DEFAULT_CHECKERS,
      skipHeavyChecks: options.skipHeavyChecks ?? false,
    };
  }

  /**
   * Run all enabled checkers and return aggregated findings.
   */
  async verify(ctx: VerificationContext): Promise<VerificationResult> {
    const startTime = Date.now();
    const allFindings: Finding[] = [];
    const byChecker: Record<string, Finding[]> = {};

    const checkers = this.options.checkers ?? DEFAULT_CHECKERS ?? [];

    const runner = async (
      name: string,
      run: () => Promise<Finding[]>
    ): Promise<void> => {
      const findings = await run();
      allFindings.push(...findings);
      byChecker[name] = findings;
    };

    if (checkers.includes('import')) {
      await runner('ImportVerifier', () => runImportVerifier(ctx));
    }
    if (checkers.includes('type')) {
      await runner('TypeConsistencyVerifier', () =>
        runTypeConsistencyVerifier(ctx)
      );
    }
    if (checkers.includes('endpoint')) {
      await runner('EndpointVerifier', () => runEndpointVerifier(ctx));
    }
    if (checkers.includes('auth')) {
      await runner('AuthVerifier', () => runAuthVerifier(ctx));
    }
    if (checkers.includes('dead-code') && !this.options.skipHeavyChecks) {
      await runner('DeadCodeVerifier', () => runDeadCodeVerifier(ctx));
    }
    if (checkers.includes('behavioral')) {
      await runner('BehavioralVerifier', () => runBehavioralVerifier(ctx));
    }

    const summary = this.computeSummary(allFindings);
    const hasBlockingFindings = allFindings.some((f) => f.blocking);

    return {
      findings: allFindings,
      summary,
      hasBlockingFindings,
      durationMs: Date.now() - startTime,
      byChecker,
    };
  }

  private computeSummary(findings: Finding[]): VerificationResult['summary'] {
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: findings.length,
    };
    for (const f of findings) {
      if (f.severity in summary) {
        summary[f.severity as keyof typeof summary]++;
      }
    }
    return summary;
  }
}

// ============================================================================
// Convenience function
// ============================================================================

/**
 * Run verification with default engine configuration.
 */
export async function verifyImplementation(
  ctx: VerificationContext,
  options?: VerificationEngineOptions
): Promise<VerificationResult> {
  const engine = new VerificationEngine(options);
  return engine.verify(ctx);
}
