/**
 * ISL Proof Bundle Writer
 * 
 * Collects artifacts into a structured proof bundle folder.
 * 
 * Bundle structure:
 *   proof-bundle/
 *   ├── manifest.json           # Main manifest with all metadata
 *   ├── spec.isl                # Copy of the ISL spec
 *   ├── results/
 *   │   ├── gate.json           # Full gate results
 *   │   ├── build.json          # Build/typecheck results
 *   │   └── tests.json          # Test results
 *   ├── iterations/
 *   │   ├── 1/
 *   │   │   ├── violations.json
 *   │   │   ├── patches.json
 *   │   │   └── diff.patch
 *   │   └── 2/
 *   │       └── ...
 *   └── reports/
 *       ├── summary.html        # Human-readable summary
 *       └── sarif.json          # SARIF for GitHub Security
 * 
 * @module @isl-lang/proof
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  ProofBundleManifest,
  ManifestGateResult,
  BuildResult,
  TestResult,
  IterationRecord,
  PatchRecord,
  DomainTestDeclaration,
  RulepackVersion,
  VerificationEvaluationResult,
  PostconditionVerificationResult,
  ChaosTestResult,
  // V2 types
  ImportGraph,
  ImportResolution,
  StdlibVersion,
  VerifyResults,
  TraceRef,
  TestsSummary,
} from './manifest.js';
import {
  calculateVerdictV2,
  calculateBundleId,
  calculateSpecHash,
  signManifest,
} from './manifest.js';

// ============================================================================
// Types
// ============================================================================

export interface WriterOptions {
  /** Output directory for the proof bundle */
  outputDir: string;
  /** Project root directory */
  projectRoot: string;
  /** Sign the bundle with this secret */
  signSecret?: string;
  /** Key ID for signature */
  signKeyId?: string;
  /** ISL Studio version */
  islStudioVersion?: string;
}

export interface SpecInput {
  domain: string;
  version: string;
  content: string;
  path?: string;
}

export interface GateInput {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  fingerprint: string;
  blockers: number;
  warnings: number;
  violations: Array<{
    ruleId: string;
    file: string;
    line?: number;
    message: string;
    tier: 'hard_block' | 'soft_block' | 'warn';
  }>;
  policyBundleVersion: string;
  rulepackVersions: RulepackVersion[];
  timestamp: string;
}

export interface IterationInput {
  iteration: number;
  fingerprint: string;
  violations: Array<{
    ruleId: string;
    file: string;
    line?: number;
    message: string;
    tier: 'hard_block' | 'soft_block' | 'warn';
  }>;
  patches: PatchRecord[];
  /** Diff content (unified diff format) */
  diff?: string;
  durationMs: number;
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
}

export interface WriteResult {
  bundleId: string;
  bundlePath: string;
  manifestPath: string;
  verdict: ProofBundleManifest['verdict'];
  verdictReason: string;
}

/**
 * Trace summary for proof bundle
 */
export interface TraceSummary {
  /** Trace ID */
  id: string;
  /** Test name */
  name: string;
  /** Domain name */
  domain: string;
  /** Behavior name */
  behavior?: string;
  /** Whether test passed */
  passed: boolean;
  /** Duration in ms */
  durationMs: number;
  /** Event count */
  eventCount: number;
  /** Check results */
  checks: {
    total: number;
    passed: number;
    failed: number;
  };
  /** Full trace events (if includeFullTrace) */
  events?: unknown[];
}

// ============================================================================
// Proof Bundle Writer
// ============================================================================

export class ProofBundleWriter {
  private options: WriterOptions;
  private spec: SpecInput | null = null;
  private gateResult: ManifestGateResult | null = null;
  private buildResult: BuildResult | null = null;
  private testResult: TestResult | null = null;
  private testDeclaration: DomainTestDeclaration | null = null;
  private verificationEvaluation: VerificationEvaluationResult | null = null;
  private postconditionVerification: PostconditionVerificationResult | null = null;
  private chaosResult: ChaosTestResult | null = null;
  private iterations: IterationRecord[] = [];
  private iterationDiffs: Map<number, string> = new Map();
  private projectContext: ProofBundleManifest['project'] = { root: '' };
  private traces: TraceSummary[] = [];
  private junitXml: string | null = null;
  
  // V2 fields
  private importGraph: ImportGraph | null = null;
  private stdlibVersions: StdlibVersion[] = [];
  private verifyResults: VerifyResults | null = null;
  private traceRefs: TraceRef[] = [];
  private testsSummary: TestsSummary | null = null;

  constructor(options: WriterOptions) {
    this.options = options;
    this.projectContext.root = options.projectRoot;
  }

  /**
   * Set the ISL spec
   */
  setSpec(spec: SpecInput): this {
    this.spec = spec;
    return this;
  }

  /**
   * Set the gate result
   */
  setGateResult(input: GateInput): this {
    this.gateResult = {
      verdict: input.verdict,
      score: input.score,
      fingerprint: input.fingerprint,
      blockers: input.blockers,
      warnings: input.warnings,
      violations: input.violations,
      policyBundleVersion: input.policyBundleVersion,
      rulepackVersions: input.rulepackVersions,
      timestamp: input.timestamp,
    };
    return this;
  }

  /**
   * Set the build result
   */
  setBuildResult(result: BuildResult): this {
    this.buildResult = result;
    return this;
  }

  /**
   * Set the test result
   */
  setTestResult(result: TestResult): this {
    this.testResult = result;
    return this;
  }

  /**
   * Declare that no tests are required for this domain
   */
  setNoTestsRequired(reason?: string): this {
    this.testDeclaration = {
      noTestsRequired: true,
      reason,
    };
    return this;
  }

  /**
   * Set verification evaluation result
   */
  setVerificationEvaluation(result: VerificationEvaluationResult): this {
    this.verificationEvaluation = result;
    return this;
  }

  /**
   * Set postcondition/invariant verification results
   */
  setPostconditionVerification(result: PostconditionVerificationResult): this {
    this.postconditionVerification = result;
    return this;
  }

  /**
   * Set chaos test results
   */
  setChaosResult(result: ChaosTestResult): this {
    this.chaosResult = result;
    return this;
  }

  // ============================================================================
  // V2 Setters - Import Graph, Stdlib Versions, Verify Results, Trace Refs
  // ============================================================================

  /**
   * Set the import graph (required for PROVEN if spec has imports)
   */
  setImportGraph(imports: ImportResolution[]): this {
    const allResolved = imports.every(i => i.resolved);
    const unresolvedCount = imports.filter(i => !i.resolved).length;
    
    // Calculate graph hash
    const graphContent = imports
      .map(i => `${i.importPath}:${i.resolvedPath}:${i.resolved}`)
      .sort()
      .join('\n');
    const graphHash = calculateSpecHash(graphContent);
    
    this.importGraph = {
      imports,
      graphHash,
      allResolved,
      unresolvedCount,
    };
    return this;
  }

  /**
   * Set stdlib versions (required for PROVEN if spec uses stdlib imports)
   */
  setStdlibVersions(versions: StdlibVersion[]): this {
    this.stdlibVersions = versions;
    return this;
  }

  /**
   * Set verification results (fail-closed: unknown => INCOMPLETE_PROOF)
   */
  setVerifyResults(results: VerifyResults): this {
    this.verifyResults = results;
    return this;
  }

  /**
   * Add trace references for verification evidence
   */
  addTraceRef(ref: TraceRef): this {
    this.traceRefs.push(ref);
    return this;
  }

  /**
   * Set multiple trace references
   */
  setTraceRefs(refs: TraceRef[]): this {
    this.traceRefs = refs;
    return this;
  }

  /**
   * Set enhanced tests summary
   */
  setTestsSummary(summary: TestsSummary): this {
    this.testsSummary = summary;
    return this;
  }

  /**
   * Add an iteration record
   */
  addIteration(input: IterationInput): this {
    this.iterations.push({
      iteration: input.iteration,
      fingerprint: input.fingerprint,
      violationCount: input.violations.length,
      violations: input.violations,
      patches: input.patches,
      diffPath: input.diff ? `iterations/${input.iteration}/diff.patch` : undefined,
      durationMs: input.durationMs,
      verdict: input.verdict,
      score: input.score,
      timestamp: new Date().toISOString(),
    });
    
    // Store diff content for later writing
    if (input.diff) {
      this.iterationDiffs.set(input.iteration, input.diff);
    }
    
    return this;
  }

  /**
   * Set project context (repository, branch, commit, etc.)
   */
  setProjectContext(context: Partial<ProofBundleManifest['project']>): this {
    this.projectContext = {
      ...this.projectContext,
      ...context,
    };
    return this;
  }

  /**
   * Add traces from test execution
   */
  addTraces(traces: TraceSummary[]): this {
    this.traces.push(...traces);
    return this;
  }

  /**
   * Set JUnit XML content
   */
  setJunitXml(xml: string): this {
    this.junitXml = xml;
    return this;
  }

  /**
   * Write the proof bundle to disk
   */
  async write(): Promise<WriteResult> {
    // Validate required inputs
    if (!this.spec) {
      throw new Error('Spec is required');
    }
    if (!this.gateResult) {
      throw new Error('Gate result is required');
    }
    if (!this.buildResult) {
      // Create default build result (skipped)
      this.buildResult = {
        tool: 'unknown',
        toolVersion: 'unknown',
        status: 'skipped',
        errorCount: 0,
        warningCount: 0,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }
    if (!this.testResult) {
      // Create default test result (no tests)
      this.testResult = {
        framework: 'unknown',
        frameworkVersion: 'unknown',
        status: 'no_tests',
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    // Create bundle directory
    const bundleDir = path.join(
      this.options.outputDir,
      `proof-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`
    );
    await fs.mkdir(bundleDir, { recursive: true });

    // Create subdirectories
    await fs.mkdir(path.join(bundleDir, 'results'), { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'reports'), { recursive: true });

    // Calculate verdict using v2 fail-closed rules
    const verdictResult = calculateVerdictV2({
      gateResult: this.gateResult,
      buildResult: this.buildResult,
      testResult: this.testResult,
      testDeclaration: this.testDeclaration || undefined,
      verifyResults: this.verifyResults || undefined,
      importGraph: this.importGraph || undefined,
      stdlibVersions: this.stdlibVersions.length > 0 ? this.stdlibVersions : undefined,
    });

    // Build manifest with v2 fields
    const manifestBase: Omit<ProofBundleManifest, 'bundleId' | 'signature'> = {
      schemaVersion: '2.0.0',
      generatedAt: new Date().toISOString(),
      spec: {
        domain: this.spec.domain,
        version: this.spec.version,
        specHash: calculateSpecHash(this.spec.content),
        specPath: this.spec.path,
      },
      policyVersion: {
        bundleVersion: this.gateResult.policyBundleVersion,
        islStudioVersion: this.options.islStudioVersion || '0.1.0',
        packs: this.gateResult.rulepackVersions,
      },
      // V2 fields
      importGraphHash: this.importGraph?.graphHash,
      importGraph: this.importGraph || undefined,
      stdlibVersions: this.stdlibVersions.length > 0 ? this.stdlibVersions : undefined,
      verifyResults: this.verifyResults || undefined,
      traceRefs: this.traceRefs.length > 0 ? this.traceRefs : undefined,
      testsSummary: this.testsSummary || undefined,
      // Original fields
      gateResult: this.gateResult,
      buildResult: this.buildResult,
      testResult: this.testResult,
      testDeclaration: this.testDeclaration || undefined,
      verificationEvaluation: this.verificationEvaluation || undefined,
      postconditionVerification: this.postconditionVerification || undefined,
      chaosResult: this.chaosResult || undefined,
      iterations: this.iterations,
      verdict: verdictResult.verdict,
      verdictReason: verdictResult.reason,
      files: [],
      project: this.projectContext,
    };

    // Calculate bundle ID
    const bundleId = calculateBundleId(manifestBase);

    let manifest: ProofBundleManifest = {
      ...manifestBase,
      bundleId,
    };

    // Write artifacts and collect file list
    const files: string[] = ['manifest.json'];

    // Write spec
    await fs.writeFile(path.join(bundleDir, 'spec.isl'), this.spec.content);
    files.push('spec.isl');

    // Write gate results
    await fs.writeFile(
      path.join(bundleDir, 'results', 'gate.json'),
      JSON.stringify(this.gateResult, null, 2)
    );
    files.push('results/gate.json');

    // Write build results
    await fs.writeFile(
      path.join(bundleDir, 'results', 'build.json'),
      JSON.stringify(this.buildResult, null, 2)
    );
    files.push('results/build.json');

    // Write test results
    await fs.writeFile(
      path.join(bundleDir, 'results', 'tests.json'),
      JSON.stringify(this.testResult, null, 2)
    );
    files.push('results/tests.json');

    // Write JUnit XML if available
    if (this.junitXml) {
      await fs.writeFile(
        path.join(bundleDir, 'results', 'junit.xml'),
        this.junitXml
      );
      files.push('results/junit.xml');
    }

    // Write traces if available
    if (this.traces.length > 0) {
      await fs.mkdir(path.join(bundleDir, 'traces'), { recursive: true });
      
      const traceIndex: Array<{ id: string; name: string; passed: boolean; file: string }> = [];
      
      for (const trace of this.traces) {
        const traceFile = `traces/${trace.id}.json`;
        await fs.writeFile(
          path.join(bundleDir, traceFile),
          JSON.stringify(trace, null, 2)
        );
        files.push(traceFile);
        traceIndex.push({
          id: trace.id,
          name: trace.name,
          passed: trace.passed,
          file: traceFile,
        });
      }

      // Write trace index
      await fs.writeFile(
        path.join(bundleDir, 'traces', 'index.json'),
        JSON.stringify(traceIndex, null, 2)
      );
      files.push('traces/index.json');
    }

    // Write verification evaluation results if available
    if (this.verificationEvaluation) {
      await fs.writeFile(
        path.join(bundleDir, 'results', 'verification.json'),
        JSON.stringify(this.verificationEvaluation, null, 2)
      );
      files.push('results/verification.json');
    }

    // Write chaos test results if available
    if (this.chaosResult) {
      await fs.writeFile(
        path.join(bundleDir, 'results', 'chaos.json'),
        JSON.stringify(this.chaosResult, null, 2)
      );
      files.push('results/chaos.json');
    }

    // ========================================================================
    // V2 Files - Import Graph, Stdlib Versions, Verify Results
    // ========================================================================

    // Write import graph if available
    if (this.importGraph) {
      await fs.writeFile(
        path.join(bundleDir, 'results', 'import-graph.json'),
        JSON.stringify(this.importGraph, null, 2)
      );
      files.push('results/import-graph.json');
    }

    // Write stdlib versions if available
    if (this.stdlibVersions.length > 0) {
      await fs.writeFile(
        path.join(bundleDir, 'results', 'stdlib-versions.json'),
        JSON.stringify(this.stdlibVersions, null, 2)
      );
      files.push('results/stdlib-versions.json');
    }

    // Write verify results if available
    if (this.verifyResults) {
      await fs.writeFile(
        path.join(bundleDir, 'results', 'verify-results.json'),
        JSON.stringify(this.verifyResults, null, 2)
      );
      files.push('results/verify-results.json');
    }

    // Write trace refs if available
    if (this.traceRefs.length > 0) {
      await fs.writeFile(
        path.join(bundleDir, 'results', 'trace-refs.json'),
        JSON.stringify(this.traceRefs, null, 2)
      );
      files.push('results/trace-refs.json');
    }

    // Write tests summary if available
    if (this.testsSummary) {
      await fs.writeFile(
        path.join(bundleDir, 'results', 'tests-summary.json'),
        JSON.stringify(this.testsSummary, null, 2)
      );
      files.push('results/tests-summary.json');
    }

    // Write iterations
    if (this.iterations.length > 0) {
      await fs.mkdir(path.join(bundleDir, 'iterations'), { recursive: true });
      
      for (const iter of this.iterations) {
        const iterDir = path.join(bundleDir, 'iterations', String(iter.iteration));
        await fs.mkdir(iterDir, { recursive: true });

        await fs.writeFile(
          path.join(iterDir, 'violations.json'),
          JSON.stringify(iter.violations, null, 2)
        );
        files.push(`iterations/${iter.iteration}/violations.json`);

        await fs.writeFile(
          path.join(iterDir, 'patches.json'),
          JSON.stringify(iter.patches, null, 2)
        );
        files.push(`iterations/${iter.iteration}/patches.json`);

        // Write diff if available
        if (iter.diffPath) {
          const diffContent = this.iterationDiffs.get(iter.iteration);
          if (diffContent) {
            await fs.writeFile(
              path.join(iterDir, 'diff.patch'),
              diffContent
            );
            files.push(iter.diffPath);
          }
        }
      }
    }

    // Write summary report
    const summaryHtml = this.generateSummaryHtml(manifest);
    await fs.writeFile(path.join(bundleDir, 'reports', 'summary.html'), summaryHtml);
    files.push('reports/summary.html');

    // Update manifest with file list
    manifest.files = files;

    // Sign if secret provided
    if (this.options.signSecret) {
      manifest = signManifest(manifest, this.options.signSecret, this.options.signKeyId);
    }

    // Write manifest
    const manifestPath = path.join(bundleDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    return {
      bundleId: manifest.bundleId,
      bundlePath: bundleDir,
      manifestPath,
      verdict: manifest.verdict,
      verdictReason: manifest.verdictReason,
    };
  }

  /**
   * Generate HTML summary report
   */
  private generateSummaryHtml(manifest: ProofBundleManifest): string {
    const verdictColor = {
      PROVEN: '#22c55e',
      INCOMPLETE_PROOF: '#f59e0b',
      VIOLATED: '#ef4444',
      UNPROVEN: '#6b7280',
    }[manifest.verdict];

    const verdictIcon = {
      PROVEN: '✓',
      INCOMPLETE_PROOF: '⚠',
      VIOLATED: '✗',
      UNPROVEN: '?',
    }[manifest.verdict];

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proof Bundle - ${manifest.spec.domain}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      line-height: 1.5;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    h2 { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; color: #94a3b8; }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #334155;
    }
    .verdict {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-weight: 600;
      font-size: 1.25rem;
      background: ${verdictColor}20;
      color: ${verdictColor};
    }
    .card {
      background: #1e293b;
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; }
    .stat { text-align: center; }
    .stat-value { font-size: 2rem; font-weight: 700; color: #f8fafc; }
    .stat-label { font-size: 0.875rem; color: #64748b; }
    .pass { color: #22c55e; }
    .fail { color: #ef4444; }
    .warn { color: #f59e0b; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #334155; }
    th { color: #94a3b8; font-weight: 500; }
    code { 
      background: #334155; 
      padding: 0.125rem 0.375rem; 
      border-radius: 0.25rem; 
      font-size: 0.875rem;
    }
    .meta { font-size: 0.875rem; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>Proof Bundle: ${manifest.spec.domain}</h1>
        <p class="meta">
          Bundle ID: <code>${manifest.bundleId}</code><br>
          Generated: ${manifest.generatedAt}
        </p>
      </div>
      <div class="verdict">
        ${verdictIcon} ${manifest.verdict}
      </div>
    </div>

    <p style="margin-bottom: 2rem; padding: 1rem; background: #334155; border-radius: 0.5rem;">
      ${manifest.verdictReason}
    </p>

    <h2>Summary</h2>
    <div class="grid">
      <div class="card stat">
        <div class="stat-value ${manifest.gateResult.verdict === 'SHIP' ? 'pass' : 'fail'}">
          ${manifest.gateResult.verdict}
        </div>
        <div class="stat-label">Gate Verdict</div>
      </div>
      <div class="card stat">
        <div class="stat-value">${manifest.gateResult.score}</div>
        <div class="stat-label">Gate Score</div>
      </div>
      <div class="card stat">
        <div class="stat-value ${manifest.buildResult.status === 'pass' ? 'pass' : manifest.buildResult.status === 'fail' ? 'fail' : ''}">
          ${manifest.buildResult.status.toUpperCase()}
        </div>
        <div class="stat-label">Build Status</div>
      </div>
      <div class="card stat">
        <div class="stat-value ${manifest.testResult.status === 'pass' ? 'pass' : manifest.testResult.status === 'fail' ? 'fail' : 'warn'}">
          ${manifest.testResult.passedTests}/${manifest.testResult.totalTests}
        </div>
        <div class="stat-label">Tests Passed</div>
      </div>
    </div>

    <h2>Gate Details</h2>
    <div class="card">
      <p>
        Policy Bundle: <code>${manifest.policyVersion.bundleVersion}</code><br>
        ISL Studio: <code>${manifest.policyVersion.islStudioVersion}</code>
      </p>
      ${manifest.gateResult.violations.length > 0 ? `
      <table>
        <thead>
          <tr><th>Rule</th><th>File</th><th>Message</th><th>Tier</th></tr>
        </thead>
        <tbody>
          ${manifest.gateResult.violations.slice(0, 10).map(v => `
          <tr>
            <td><code>${v.ruleId}</code></td>
            <td>${v.file}${v.line ? `:${v.line}` : ''}</td>
            <td>${v.message}</td>
            <td class="${v.tier === 'hard_block' ? 'fail' : v.tier === 'soft_block' ? 'warn' : ''}">${v.tier}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ${manifest.gateResult.violations.length > 10 ? `<p class="meta" style="margin-top: 0.5rem;">... and ${manifest.gateResult.violations.length - 10} more</p>` : ''}
      ` : '<p>No violations</p>'}
    </div>

    ${manifest.iterations.length > 0 ? `
    <h2>Healing Iterations</h2>
    <div class="card">
      <table>
        <thead>
          <tr><th>#</th><th>Violations</th><th>Patches</th><th>Score</th><th>Verdict</th><th>Duration</th></tr>
        </thead>
        <tbody>
          ${manifest.iterations.map(iter => `
          <tr>
            <td>${iter.iteration}</td>
            <td>${iter.violationCount}</td>
            <td>${iter.patches.length}</td>
            <td>${iter.score}</td>
            <td class="${iter.verdict === 'SHIP' ? 'pass' : 'fail'}">${iter.verdict}</td>
            <td>${iter.durationMs}ms</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <h2>Spec Info</h2>
    <div class="card">
      <p>
        Domain: <strong>${manifest.spec.domain}</strong><br>
        Version: ${manifest.spec.version}<br>
        Hash: <code>${manifest.spec.specHash.slice(0, 16)}...</code>
      </p>
    </div>

    ${manifest.signature ? `
    <h2>Signature</h2>
    <div class="card">
      <p>
        Algorithm: <code>${manifest.signature.algorithm}</code><br>
        Signature: <code>${manifest.signature.value.slice(0, 32)}...</code>
        ${manifest.signature.keyId ? `<br>Key ID: <code>${manifest.signature.keyId}</code>` : ''}
      </p>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Create a new proof bundle writer
 */
export function createProofBundleWriter(options: WriterOptions): ProofBundleWriter {
  return new ProofBundleWriter(options);
}
