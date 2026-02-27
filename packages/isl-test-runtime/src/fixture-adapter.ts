/**
 * Fixture Adapter
 * 
 * Adapters for connecting fixture stores to different test frameworks
 * and verification engines.
 */

import type { Trace, FixtureStore, TestSummary, TestResult } from './login-harness.js';

// ============================================================================
// Types
// ============================================================================

export interface FixtureSnapshot {
  users: Array<{
    id: string;
    email: string;
    status: string;
    failed_attempts: number;
  }>;
  sessions: number;
  auditLog: Array<{
    action: string;
    timestamp: string;
  }>;
}

export interface VerificationResult {
  specFile: string;
  domain: string;
  version: string;
  verdict: 'VERIFIED' | 'VIOLATED' | 'PARTIAL';
  testsPassed: number;
  testsFailed: number;
  traces: Trace[];
  evidence: VerificationEvidence[];
}

export interface VerificationEvidence {
  testName: string;
  scenario: string;
  passed: boolean;
  checks: CheckEvidence[];
}

export interface CheckEvidence {
  expression: string;
  category: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
}

export interface ProofBundle {
  bundleId: string;
  specFile: string;
  specHash: string;
  verdict: 'PROVEN' | 'VIOLATED' | 'INCOMPLETE_PROOF' | 'UNPROVEN';
  testSummary: {
    total: number;
    passed: number;
    failed: number;
  };
  traces: Trace[];
  generatedAt: string;
}

// ============================================================================
// Fixture Store Adapter
// ============================================================================

export class FixtureStoreAdapter {
  private fixtures: Map<string, FixtureSnapshot> = new Map();
  private traces: Trace[] = [];

  /**
   * Record a fixture snapshot
   */
  recordSnapshot(testName: string, store: FixtureStore): void {
    const snapshot = store.snapshot() as unknown as FixtureSnapshot;
    this.fixtures.set(testName, {
      ...snapshot,
      auditLog: (store.getAuditLog?.() ?? []).map(a => ({
        action: a.action,
        timestamp: a.timestamp,
      })),
    });
  }

  /**
   * Get a recorded snapshot
   */
  getSnapshot(testName: string): FixtureSnapshot | undefined {
    return this.fixtures.get(testName);
  }

  /**
   * Record a trace
   */
  recordTrace(trace: Trace): void {
    this.traces.push(trace);
  }

  /**
   * Get all recorded traces
   */
  getTraces(): Trace[] {
    return [...this.traces];
  }

  /**
   * Build verification result from test summary
   */
  buildVerificationResult(
    specFile: string,
    domain: string,
    version: string,
    summary: TestSummary
  ): VerificationResult {
    const evidence: VerificationEvidence[] = summary.results.map(result => {
      const trace = result.trace;
      const checks: CheckEvidence[] = [];

      // Extract check events from trace
      for (const event of trace.events) {
        if (event.kind === 'check') {
          checks.push({
            expression: (event.inputs as { expression?: string }).expression ?? '',
            category: (event.outputs as { category?: string }).category ?? 'assertion',
            passed: (event.outputs as { passed?: boolean }).passed ?? false,
            expected: (event.inputs as { expected?: unknown }).expected,
            actual: (event.outputs as { actual?: unknown }).actual,
          });
        }
      }

      return {
        testName: result.name,
        scenario: result.scenario,
        passed: result.passed,
        checks,
      };
    });

    const verdict: VerificationResult['verdict'] = 
      summary.failed === 0 ? 'VERIFIED' :
      summary.passed > 0 ? 'PARTIAL' : 'VIOLATED';

    return {
      specFile,
      domain,
      version,
      verdict,
      testsPassed: summary.passed,
      testsFailed: summary.failed,
      traces: summary.traces,
      evidence,
    };
  }

  /**
   * Build proof bundle from verification result
   */
  buildProofBundle(
    verificationResult: VerificationResult,
    specHash: string
  ): ProofBundle {
    const bundleId = generateBundleId(
      verificationResult.specFile,
      specHash,
      verificationResult.testsPassed,
      verificationResult.testsFailed
    );

    let verdict: ProofBundle['verdict'];
    if (verificationResult.verdict === 'VERIFIED' && verificationResult.testsPassed > 0) {
      verdict = 'PROVEN';
    } else if (verificationResult.verdict === 'VIOLATED') {
      verdict = 'VIOLATED';
    } else if (verificationResult.testsPassed === 0) {
      verdict = 'INCOMPLETE_PROOF';
    } else {
      verdict = 'UNPROVEN';
    }

    return {
      bundleId,
      specFile: verificationResult.specFile,
      specHash,
      verdict,
      testSummary: {
        total: verificationResult.testsPassed + verificationResult.testsFailed,
        passed: verificationResult.testsPassed,
        failed: verificationResult.testsFailed,
      },
      traces: verificationResult.traces,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Clear all recorded data
   */
  clear(): void {
    this.fixtures.clear();
    this.traces = [];
  }
}

// ============================================================================
// Vitest Adapter
// ============================================================================

export interface VitestAdapterConfig {
  outputDir?: string;
  captureTraces?: boolean;
}

export class VitestAdapter {
  private adapter: FixtureStoreAdapter;
  public readonly config: VitestAdapterConfig;

  constructor(config: VitestAdapterConfig = {}) {
    this.adapter = new FixtureStoreAdapter();
    this.config = {
      outputDir: config.outputDir ?? '.isl-traces',
      captureTraces: config.captureTraces ?? true,
    };
  }

  /**
   * Get the underlying adapter
   */
  getAdapter(): FixtureStoreAdapter {
    return this.adapter;
  }

  /**
   * Create a test context for Vitest
   */
  createTestContext(): {
    recordSnapshot: (testName: string, store: FixtureStore) => void;
    recordTrace: (trace: Trace) => void;
    getTraces: () => Trace[];
  } {
    return {
      recordSnapshot: (testName, store) => this.adapter.recordSnapshot(testName, store),
      recordTrace: (trace) => this.adapter.recordTrace(trace),
      getTraces: () => this.adapter.getTraces(),
    };
  }

  /**
   * Generate verification report
   */
  generateReport(
    specFile: string,
    domain: string,
    version: string,
    summary: TestSummary
  ): { verificationResult: VerificationResult; proofBundle: ProofBundle } {
    const verificationResult = this.adapter.buildVerificationResult(
      specFile,
      domain,
      version,
      summary
    );

    const specHash = hashSpec(`${domain}:${version}:${specFile}`);
    const proofBundle = this.adapter.buildProofBundle(verificationResult, specHash);

    return { verificationResult, proofBundle };
  }
}

// ============================================================================
// Integration with isl verify
// ============================================================================

export interface ISLVerifyInput {
  specFile: string;
  testResults: TestResult[];
  traces: Trace[];
}

export interface ISLVerifyOutput {
  passed: boolean;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  proofBundle: ProofBundle;
  summary: string;
}

/**
 * Format results for isl verify command
 */
export function formatForISLVerify(
  specFile: string,
  domain: string,
  version: string,
  summary: TestSummary
): ISLVerifyOutput {
  const adapter = new FixtureStoreAdapter();
  const verificationResult = adapter.buildVerificationResult(
    specFile,
    domain,
    version,
    summary
  );

  const specHash = hashSpec(`${domain}:${version}:${specFile}`);
  const proofBundle = adapter.buildProofBundle(verificationResult, specHash);

  return {
    passed: summary.failed === 0 && summary.total > 0,
    testsRun: summary.total,
    testsPassed: summary.passed,
    testsFailed: summary.failed,
    proofBundle,
    summary: `${summary.passed} passed, ${summary.failed} failed`,
  };
}

/**
 * Assert tests count > 0 (no scaffold-only)
 */
export function assertTestsExecuted(summary: TestSummary): void {
  if (summary.total === 0) {
    throw new Error('No tests executed - scaffold-only is not allowed');
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateBundleId(
  specFile: string,
  specHash: string,
  passed: number,
  failed: number
): string {
  const input = `${specFile}:${specHash}:${passed}:${failed}:${Date.now()}`;
  return simpleHash(input).slice(0, 16);
}

function hashSpec(input: string): string {
  return simpleHash(input).slice(0, 16);
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a fixture store adapter
 */
export function createFixtureStoreAdapter(): FixtureStoreAdapter {
  return new FixtureStoreAdapter();
}

/**
 * Create a Vitest adapter
 */
export function createVitestAdapter(config?: VitestAdapterConfig): VitestAdapter {
  return new VitestAdapter(config);
}
