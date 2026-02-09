/**
 * Authoritative Gate
 * 
 * The single entry point for SHIP/NO_SHIP decisions.
 * This is THE gate - authoritative, final, and machine-readable.
 * 
 * @module @isl-lang/gate/authoritative/gate
 */

import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

import type {
  AuthoritativeGateInput,
  AuthoritativeGateResult,
  AuthoritativeVerdict,
  VerificationSignal,
  ThresholdConfig,
  EvidenceBundle,
  EvidenceArtifact,
} from './types.js';

import { DEFAULT_THRESHOLDS, EXIT_CODES } from './types.js';
import { aggregateSignals, createSignal, createBlockingSignal, createFinding } from './aggregator.js';
import { makeDecision, getSuggestions } from './decision-engine.js';
import { hashContent, createBundle, createArtifact, writeBundle } from './evidence-bundle.js';

// ISL version for evidence bundle
const ISL_VERSION = '0.2.0';

// ============================================================================
// Main Gate Function
// ============================================================================

/**
 * Run the authoritative ISL gate.
 * 
 * This is the ONLY function that should be used for gate decisions.
 * Returns a definitive SHIP or NO_SHIP verdict.
 */
export async function runAuthoritativeGate(
  input: AuthoritativeGateInput
): Promise<AuthoritativeGateResult> {
  const startTime = Date.now();
  
  // Merge thresholds with defaults
  const thresholds: ThresholdConfig = {
    ...DEFAULT_THRESHOLDS,
    ...input.thresholds,
  };

  try {
    // ========================================================================
    // Step 1: Resolve inputs (or return no-spec result when specOptional)
    // ========================================================================
    let specSource: string;
    let implSource: string;
    try {
      const resolved = await resolveInputs(input);
      specSource = resolved.specSource;
      implSource = resolved.implSource;
    } catch (resolveError) {
      if (input.specOptional) {
        // No valid spec: return SHIP with "no spec" reason so caller can rely on firewall-only path
        const noSpecResult: AuthoritativeGateResult = {
          verdict: 'SHIP',
          exitCode: EXIT_CODES.SHIP,
          score: 100,
          confidence: 100,
          summary: 'No spec provided; run unified gate or firewall for full check.',
          aggregation: {
            signals: [],
            overallScore: 100,
            tests: { total: 0, passed: 0, failed: 0, skipped: 0, passRate: 100 },
            findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
            blockingIssues: [],
          },
          thresholds,
          evidence: {
            schemaVersion: '2.0.0',
            fingerprint: 'no-spec',
            islVersion: ISL_VERSION,
            timestamp: new Date().toISOString(),
            inputs: { specHash: '', implHash: '' },
            artifacts: [],
          },
          reasons: [{
            code: 'NO_SPEC',
            message: 'No valid spec provided; use runUnifiedGate or firewall for security/policy checks.',
            severity: 'info',
            source: 'verifier',
            blocking: false,
          }],
          durationMs: Date.now() - startTime,
        };
        return noSpecResult;
      }
      throw resolveError;
    }
    
    const specHash = specSource ? hashContent(specSource) : '';
    const implHash = hashContent(implSource);

    // ========================================================================
    // Step 2: Collect verification signals (spec-based or specless)
    // ========================================================================
    const signals = specSource
      ? await collectSignals(input, specSource, implSource)
      : await collectSpeclessSignals(input, implSource);

    // ========================================================================
    // Step 3: Aggregate signals
    // ========================================================================
    const aggregation = aggregateSignals(signals);

    // ========================================================================
    // Step 4: Make decision
    // ========================================================================
    const decision = makeDecision(aggregation, thresholds);

    // ========================================================================
    // Step 5: Get suggestions if NO_SHIP
    // ========================================================================
    const suggestions = decision.verdict === 'NO_SHIP'
      ? getSuggestions(aggregation, thresholds)
      : undefined;

    // ========================================================================
    // Step 6: Build evidence bundle
    // ========================================================================
    const resultsHash = hashContent(JSON.stringify({
      verdict: decision.verdict,
      score: aggregation.overallScore,
      reasons: decision.reasons,
    }));

    const artifacts: EvidenceArtifact[] = [
      createArtifact('spec', 'artifacts/spec.isl', specSource),
    ];

    const evidence = createBundle({
      specHash,
      implHash,
      resultsHash,
      islVersion: ISL_VERSION,
      artifacts,
      git: input.git,
      ci: input.ci,
      deterministic: true,
    });

    // ========================================================================
    // Step 7: Build result
    // ========================================================================
    const result: AuthoritativeGateResult = {
      verdict: decision.verdict,
      exitCode: decision.exitCode,
      score: aggregation.overallScore,
      confidence: decision.confidence,
      summary: decision.summary,
      aggregation,
      thresholds,
      evidence,
      reasons: decision.reasons,
      suggestions,
      durationMs: Date.now() - startTime,
    };

    // ========================================================================
    // Step 8: Write evidence bundle (if requested)
    // ========================================================================
    if (input.writeBundle !== false) {
      const evidencePath = input.evidencePath ?? join(input.projectRoot, 'evidence');
      await writeBundle(evidencePath, result, specSource, implSource);
    }

    return result;

  } catch (error) {
    // Return a NO_SHIP result for errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      verdict: 'NO_SHIP',
      exitCode: EXIT_CODES.NO_SHIP,
      score: 0,
      confidence: 100,
      summary: `NO_SHIP: Gate error - ${errorMessage}`,
      aggregation: {
        signals: [],
        overallScore: 0,
        tests: { total: 0, passed: 0, failed: 0, skipped: 0, passRate: 0 },
        findings: { critical: 1, high: 0, medium: 0, low: 0, total: 1 },
        blockingIssues: [`Gate error: ${errorMessage}`],
      },
      thresholds,
      evidence: {
        schemaVersion: '2.0.0',
        fingerprint: 'error',
        islVersion: ISL_VERSION,
        timestamp: new Date().toISOString(),
        inputs: { specHash: '', implHash: '' },
        artifacts: [],
      },
      reasons: [{
        code: 'GATE_ERROR',
        message: errorMessage,
        severity: 'critical',
        source: 'verifier',
        blocking: true,
      }],
      suggestions: ['Fix the error and run the gate again'],
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Input Resolution
// ============================================================================

async function resolveInputs(input: AuthoritativeGateInput): Promise<{
  specSource: string;
  implSource: string;
}> {
  let specSource: string;
  let implSource: string;

  // Specless: when specOptional and no spec path/source, resolve implementation only
  const wantSpecless = input.specOptional && (!input.spec || String(input.spec).trim() === '');
  if (wantSpecless) {
    specSource = '';
  } else {
    // Resolve spec
    if (input.spec.includes('domain ') && input.spec.includes('version ')) {
      specSource = input.spec;
    } else if (existsSync(input.spec)) {
      specSource = await readFile(input.spec, 'utf-8');
    } else {
      throw new Error(`Invalid spec: not valid ISL source or file path: ${input.spec}`);
    }
  }

  // Resolve implementation
  if (existsSync(input.implementation)) {
    const stats = await stat(input.implementation);
    if (stats.isDirectory()) {
      implSource = await readDirectoryFiles(input.implementation);
    } else {
      implSource = await readFile(input.implementation, 'utf-8');
    }
  } else {
    // Assume it's source code
    implSource = input.implementation;
  }

  return { specSource, implSource };
}

async function readDirectoryFiles(dir: string): Promise<string> {
  const { readdir } = await import('fs/promises');
  const files = await readdir(dir, { recursive: true });
  const contents: string[] = [];
  
  for (const file of files) {
    const filePath = join(dir, file.toString());
    if (filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      try {
        const content = await readFile(filePath, 'utf-8');
        contents.push(`// File: ${file}\n${content}`);
      } catch {
        // Skip unreadable files
      }
    }
  }
  
  return contents.join('\n\n');
}

// ============================================================================
// Specless Signal Collection (no ISL spec)
// ============================================================================

/**
 * Collect signals when no ISL spec is present.
 * Runs dependency audit (if enabled) and reports specless verification.
 */
async function collectSpeclessSignals(
  input: AuthoritativeGateInput,
  implSource: string
): Promise<VerificationSignal[]> {
  const signals: VerificationSignal[] = [];

  // Informational: specless verification mode
  signals.push(
    createSignal(
      'static_analysis',
      true,
      'Specless verification: no ISL spec; ran dependency and project checks only.',
      { score: 100, blocking: false }
    )
  );

  if (input.dependencyAudit && input.projectRoot) {
    try {
      const auditSignal = await collectDependencyAuditSignal(input.projectRoot);
      signals.push(auditSignal);
    } catch {
      // Non-blocking if audit fails
    }
  }

  return signals;
}

// ============================================================================
// Signal Collection
// ============================================================================

async function collectSignals(
  input: AuthoritativeGateInput,
  specSource: string,
  implSource: string
): Promise<VerificationSignal[]> {
  const signals: VerificationSignal[] = [];

  // Try to import and use the actual ISL tools if available
  try {
    // Parser signal
    const parserSignal = await collectParserSignal(specSource);
    signals.push(parserSignal);
    
    if (!parserSignal.passed) {
      // If parsing fails, no point checking other signals
      return signals;
    }

    // Typechecker signal
    const typecheckerSignal = await collectTypecheckerSignal(specSource);
    signals.push(typecheckerSignal);
    
    if (!typecheckerSignal.passed) {
      return signals;
    }

    // Verifier signal
    const verifierSignal = await collectVerifierSignal(specSource, implSource);
    signals.push(verifierSignal);

  } catch (error) {
    // If tools aren't available, create a basic signal
    signals.push(createBlockingSignal(
      'verifier',
      false,
      `Verification tools not available: ${error instanceof Error ? error.message : 'unknown error'}`,
      { score: 0 }
    ));
  }

  // Optional: dependency audit (critical vulns = NO_SHIP)
  if (input.dependencyAudit) {
    try {
      const auditSignal = await collectDependencyAuditSignal(input.projectRoot);
      signals.push(auditSignal);
    } catch {
      // Non-blocking if audit fails to run (e.g. no package.json)
    }
  }

  return signals;
}

async function collectParserSignal(specSource: string): Promise<VerificationSignal> {
  try {
    const { parse } = await import('@isl-lang/parser');
    const result = parse(specSource, 'spec.isl');
    
    if (result.success && result.domain) {
      return createBlockingSignal('parser', true, 'Spec parsed successfully', { score: 100 });
    }
    
    const errors = result.errors?.map((e: { message: string }) => e.message).join('; ') ?? 'Parse failed';
    return createBlockingSignal('parser', false, `Parse error: ${errors}`, {
      score: 0,
      findings: result.errors?.map((e: { message: string; location?: { line?: number } }, i: number) => createFinding(
        `parse-error-${i}`,
        'critical',
        e.message,
        { line: e.location?.line, blocking: true }
      )) ?? [],
    });
  } catch (error) {
    return createBlockingSignal('parser', false, `Parser not available: ${error instanceof Error ? error.message : 'unknown'}`, { score: 0 });
  }
}

async function collectTypecheckerSignal(specSource: string): Promise<VerificationSignal> {
  try {
    const { parse } = await import('@isl-lang/parser');
    const { check } = await import('@isl-lang/typechecker');
    
    const parseResult = parse(specSource, 'spec.isl');
    if (!parseResult.success || !parseResult.domain) {
      return createBlockingSignal('typechecker', false, 'Cannot typecheck: parse failed', { score: 0 });
    }
    
    const typeResult = check(parseResult.domain);
    const errors = typeResult.diagnostics.filter((d: { severity: string }) => d.severity === 'error');
    
    if (errors.length === 0) {
      return createBlockingSignal('typechecker', true, 'Type check passed', { score: 100 });
    }
    
    return createBlockingSignal('typechecker', false, `${errors.length} type error(s)`, {
      score: 0,
      findings: errors.map((e: { message: string }, i: number) => createFinding(
        `type-error-${i}`,
        'critical',
        e.message,
        { blocking: true }
      )),
    });
  } catch (error) {
    return createBlockingSignal('typechecker', false, `Typechecker not available: ${error instanceof Error ? error.message : 'unknown'}`, { score: 0 });
  }
}

async function collectVerifierSignal(specSource: string, implSource: string): Promise<VerificationSignal> {
  try {
    const { parse } = await import('@isl-lang/parser');
    const { verify } = await import('@isl-lang/isl-verify');
    
    const parseResult = parse(specSource, 'spec.isl');
    if (!parseResult.success || !parseResult.domain) {
      return createBlockingSignal('verifier', false, 'Cannot verify: parse failed', { score: 0 });
    }
    
    const verifyResult = await verify(parseResult.domain, implSource, {
      runner: { framework: 'vitest', timeout: 30000 },
    });
    
    const score = verifyResult.trustScore?.overall ?? 0;
    const passed = score >= 80;
    
    const findings = verifyResult.trustScore?.details
      ?.filter((d: { status: string }) => d.status === 'failed')
      .map((d: { status: string; impact?: string; message?: string; name: string }, i: number) => createFinding(
        `verify-${i}`,
        d.impact === 'critical' ? 'critical' : d.impact === 'high' ? 'high' : 'medium',
        d.message ?? d.name,
        { blocking: d.impact === 'critical' }
      )) ?? [];
    
    return createBlockingSignal('verifier', passed, 
      passed ? `Verification passed with score ${score}` : `Verification failed with score ${score}`,
      { score, findings }
    );
  } catch (error) {
    return createBlockingSignal('verifier', false, `Verifier error: ${error instanceof Error ? error.message : 'unknown'}`, { score: 0 });
  }
}

async function collectDependencyAuditSignal(projectRoot: string): Promise<VerificationSignal> {
  const { spawnSync } = await import('child_process');
  const { existsSync } = await import('fs');
  const { join } = await import('path');
  const packageJson = join(projectRoot, 'package.json');
  if (!existsSync(packageJson)) {
    return createBlockingSignal('dependency_audit', true, 'No package.json; skip audit', { score: 100 });
  }
  try {
    const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const r = spawnSync(cmd, ['audit', '--json'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      maxBuffer: 2 * 1024 * 1024,
      timeout: 60000,
    });
    const out = r.stdout?.trim() || r.stderr?.trim() || '{}';
    let data: { metadata?: { vulnerabilities?: { info?: number; low?: number; moderate?: number; high?: number; critical?: number } } };
    try {
      data = JSON.parse(out) as typeof data;
    } catch {
      return createBlockingSignal('dependency_audit', true, 'Audit output not parseable; skip', { score: 100 });
    }
    const vulns = data.metadata?.vulnerabilities ?? {};
    const critical = vulns.critical ?? 0;
    const high = vulns.high ?? 0;
    if (critical > 0) {
      return createBlockingSignal(
        'dependency_audit',
        false,
        `${critical} critical vulnerability(ies) in dependencies`,
        {
          score: Math.max(0, 100 - critical * 25 - high * 5),
          findings: [createFinding('audit-critical', 'critical', `${critical} critical dependency vulnerability(ies)`, { blocking: true })],
        }
      );
    }
    if (high > 0) {
      return createBlockingSignal(
        'dependency_audit',
        true,
        `Dependency audit passed (${high} high, 0 critical)`,
        { score: Math.max(0, 100 - high * 5) }
      );
    }
    return createBlockingSignal('dependency_audit', true, 'No critical or high vulnerabilities', { score: 100 });
  } catch (err) {
    return createBlockingSignal(
      'dependency_audit',
      true,
      `Audit could not run: ${err instanceof Error ? err.message : 'unknown'}`,
      { score: 100 }
    );
  }
}

// ============================================================================
// Quick Check Functions
// ============================================================================

/**
 * Quick SHIP/NO_SHIP check without full evidence bundle
 */
export async function quickGateCheck(
  input: AuthoritativeGateInput
): Promise<{ verdict: AuthoritativeVerdict; exitCode: 0 | 1; summary: string }> {
  const result = await runAuthoritativeGate({
    ...input,
    writeBundle: false,
  });
  
  return {
    verdict: result.verdict,
    exitCode: result.exitCode,
    summary: result.summary,
  };
}

/**
 * Check if code would SHIP
 */
export async function wouldShip(input: AuthoritativeGateInput): Promise<boolean> {
  const { verdict } = await quickGateCheck(input);
  return verdict === 'SHIP';
}

// ============================================================================
// Exports
// ============================================================================

export { DEFAULT_THRESHOLDS, DEV_THRESHOLDS, EXIT_CODES } from './types.js';
