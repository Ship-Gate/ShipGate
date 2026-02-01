/**
 * ISL Verify
 * 
 * Verification engine for ISL implementations.
 */

export * from './runner/index.js';
export * from './reporter/index.js';

import type { DomainDeclaration } from '@isl-lang/isl-core';
import { runTests, type TestResult, type RunnerOptions } from './runner/index.js';
import { 
  calculateTrustScore, 
  formatTrustReport, 
  type TrustScore, 
  type TrustCalculatorOptions 
} from './reporter/index.js';

export interface VerificationResult {
  testResult: TestResult;
  trustScore: TrustScore;
  report: string;
}

export interface VerifyOptions {
  runner?: RunnerOptions;
  trustCalculator?: TrustCalculatorOptions;
}

/**
 * Verify an implementation against an ISL domain
 */
export async function verify(
  domain: DomainDeclaration,
  implementationCode: string,
  options?: VerifyOptions
): Promise<VerificationResult> {
  // Run tests
  const testResult = await runTests(domain, implementationCode, options?.runner);

  // Calculate trust score
  const trustScore = calculateTrustScore(testResult, options?.trustCalculator);

  // Generate report
  const report = formatTrustReport(trustScore);

  return {
    testResult,
    trustScore,
    report,
  };
}
