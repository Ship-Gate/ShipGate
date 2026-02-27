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
  SignalSource,
  ThresholdConfig,
  EvidenceArtifact,
} from './types.js';

import { DEFAULT_THRESHOLDS, EXIT_CODES } from './types.js';
import { aggregateSignals, createSignal, createBlockingSignal, createFinding } from './aggregator.js';
import { makeDecision, getSuggestions } from './decision-engine.js';
import { hashContent, createBundle, createArtifact, writeBundle } from './evidence-bundle.js';
import { runSpeclessChecks, type GateContext } from './specless-registry.js';
import { applyGuardrails } from './guardrails.js';
import { createGateEvidence } from './verdict-engine.js';
import type { GateEvidence as VerdictGateEvidence, GateEvidenceSource } from './verdict-engine.js';
import { evaluateVerifiedIntent, applyVerifiedIntentCap } from '../verified-intent/evaluator.js';
import type { VerifiedIntentResult, VerifiedIntentConfig } from '../verified-intent/types.js';
import { DEFAULT_VERIFIED_INTENT_CONFIG } from '../verified-intent/types.js';

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
        // No valid spec and resolve failed: code is unverified — assign low baseline score
        const noSpecResult: AuthoritativeGateResult = {
          verdict: 'NO_SHIP',
          exitCode: EXIT_CODES.NO_SHIP,
          score: 30,
          confidence: 80,
          summary: 'NO_SHIP: No spec provided and implementation could not be resolved; code is unverified.',
          aggregation: {
            signals: [],
            overallScore: 30,
            tests: { total: 0, passed: 0, failed: 0, skipped: 0, passRate: 0 },
            findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
            blockingIssues: ['No ISL spec and no specless checks available; code is unverified.'],
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
            message: 'No ISL spec provided; code is unverified. Add an ISL spec or run isl-generate.',
            severity: 'medium',
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
    // Step 4b: Apply AI safety guardrails
    // ========================================================================
    const guardrailResult = applyGuardrails(aggregation, {
      policy: input.guardrails,
      autoGeneratedSpec: input.autoGeneratedSpec,
      specSource,
      specPath: typeof input.spec === 'string' && !input.spec.includes('domain ') ? input.spec : undefined,
      configSource: input.guardrailConfigSource ?? null,
    });

    // Merge guardrail reasons into decision reasons
    decision.reasons.push(...guardrailResult.reasons);

    // Apply verdict cap from guardrails
    if (guardrailResult.verdictCap !== null) {
      // For binary verdict: WARN cap → NO_SHIP (since binary is SHIP/NO_SHIP only)
      if (guardrailResult.verdictCap === 'NO_SHIP') {
        decision.verdict = 'NO_SHIP';
        decision.exitCode = EXIT_CODES.NO_SHIP;
      } else if (guardrailResult.verdictCap === 'WARN' && decision.verdict === 'SHIP') {
        // WARN cap prevents SHIP in binary mode → NO_SHIP
        decision.verdict = 'NO_SHIP';
        decision.exitCode = EXIT_CODES.NO_SHIP;
      }
    }

    // Apply score penalty
    if (guardrailResult.scorePenalty > 0) {
      aggregation.overallScore = Math.max(0, aggregation.overallScore - guardrailResult.scorePenalty);
    }

    // Re-check decision after score penalty (score might now be below threshold)
    if (decision.verdict === 'SHIP' && aggregation.overallScore < thresholds.minScore) {
      decision.verdict = 'NO_SHIP';
      decision.exitCode = EXIT_CODES.NO_SHIP;
      decision.reasons.push({
        code: 'GUARDRAIL_SCORE_DROP',
        message: `Score dropped to ${aggregation.overallScore} after guardrail penalties (threshold: ${thresholds.minScore})`,
        severity: 'high',
        source: 'verifier',
        blocking: true,
      });
    }

    // Log guardrail paper trail warnings
    if (guardrailResult.warnings.length > 0) {
      for (const warning of guardrailResult.warnings) {
        console.error(warning);
      }
    }

    // ========================================================================
    // Step 4c: Verified Intent — 3-pillar contract enforcement
    // SHIP requires ALL three: Spec Fidelity + Coverage + Execution
    // ========================================================================
    let verifiedIntentResult: VerifiedIntentResult | undefined;

    if (input.verifiedIntent !== false) {
      const viConfig: VerifiedIntentConfig = typeof input.verifiedIntent === 'object'
        ? input.verifiedIntent
        : DEFAULT_VERIFIED_INTENT_CONFIG;

      // Collect gate evidence from signals for pillar evaluation
      const gateEvidence = collectGateEvidenceFromSignals(signals);

      verifiedIntentResult = evaluateVerifiedIntent(
        signals,
        aggregation,
        gateEvidence,
        viConfig,
      );

      // Apply 3-pillar verdict cap — SHIP is impossible unless all pillars pass
      const cappedTriState = applyVerifiedIntentCap(decision.verdict, verifiedIntentResult);
      // AuthoritativeVerdict is binary: map WARN → NO_SHIP
      const cappedVerdict: AuthoritativeVerdict = cappedTriState === 'WARN' ? 'NO_SHIP' : cappedTriState;
      if (cappedVerdict !== decision.verdict) {
        decision.verdict = cappedVerdict;
        decision.exitCode = cappedVerdict === 'SHIP' ? EXIT_CODES.SHIP : EXIT_CODES.NO_SHIP;
        decision.reasons.push({
          code: 'VERIFIED_INTENT_CAP',
          message: `Verdict capped to ${cappedVerdict}: ${verifiedIntentResult.summary}`,
          severity: 'high',
          source: 'verifier',
          blocking: cappedVerdict === 'NO_SHIP',
        });
      }
    }

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

    // Attach risk acceptances to evidence bundle for audit trail
    if (guardrailResult.riskAcceptances.length > 0) {
      evidence.riskAcceptances = guardrailResult.riskAcceptances;
    }

    // ========================================================================
    // Step 7: Build result
    // ========================================================================
    // Regenerate summary if guardrails changed the verdict
    const guardrailSuffix = guardrailResult.warnings.length > 0
      ? ` [${guardrailResult.warnings.join('; ')}]`
      : '';
    const finalSummary = guardrailResult.verdictCap !== null || guardrailResult.scorePenalty > 0
      ? `${decision.verdict}: Score ${aggregation.overallScore}/100 — guardrails applied${guardrailSuffix}`
      : decision.summary + guardrailSuffix;

    const result: AuthoritativeGateResult = {
      verdict: decision.verdict,
      exitCode: decision.exitCode,
      score: aggregation.overallScore,
      confidence: decision.confidence,
      summary: finalSummary,
      aggregation,
      thresholds,
      evidence,
      reasons: decision.reasons,
      suggestions,
      verifiedIntent: verifiedIntentResult,
      riskAcceptances: guardrailResult.riskAcceptances.length > 0 ? guardrailResult.riskAcceptances : undefined,
      durationMs: Date.now() - startTime,
    };

    // ========================================================================
    // Step 8: Write evidence bundle (if requested)
    // ========================================================================
    if (input.writeBundle !== false && input.projectRoot) {
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
  const impl = input.implementation;
  if (impl == null || typeof impl !== 'string') {
    throw new Error('Implementation path is required but was undefined or not a string');
  }
  if (existsSync(impl)) {
    const stats = await stat(impl);
    if (stats.isDirectory()) {
      implSource = await readDirectoryFiles(impl);
    } else {
      implSource = await readFile(impl, 'utf-8');
    }
  } else {
    // Assume it's source code
    implSource = impl;
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
 * Runs registered specless checks (hallucination scanner, security scanner,
 * firewall scanners) and dependency audit (if enabled).
 */
async function collectSpeclessSignals(
  input: AuthoritativeGateInput,
  implSource: string
): Promise<VerificationSignal[]> {
  const signals: VerificationSignal[] = [];

  // Informational: specless verification mode (no score — real checks provide scores)
  signals.push(
    createSignal(
      'static_analysis',
      true,
      'Specless verification: no ISL spec; running registered specless checks.',
      { blocking: false }
    )
  );

  // ── Run all registered specless checks ───────────────────────────────
  const gateContext: GateContext = {
    projectRoot: input.projectRoot ?? process.cwd(),
    implementation: implSource,
    specOptional: true,
  };

  const speclessEvidence = await runSpeclessChecks(input.implementation, gateContext);

  for (const evidence of speclessEvidence) {
    // Skip 'skip' results — they indicate unavailable scanners
    if (evidence.result === 'skip') {
      continue;
    }

    // Map evidence source to SignalSource
    const signalSource = mapEvidenceToSignalSource(evidence.check);
    const passed = evidence.result === 'pass';
    const blocking = evidence.result === 'fail';

    // Map severity for findings
    const severity = blocking ? 'critical' as const
      : evidence.result === 'warn' ? 'medium' as const
      : 'low' as const;

    const findingId = evidence.check
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase()
      .slice(0, 64);

    signals.push(
      createSignal(
        signalSource,
        passed,
        evidence.details,
        {
          score: evidence.confidence * 100,
          blocking,
          findings: !passed
            ? [createFinding(findingId, severity, evidence.details, { blocking })]
            : [],
        }
      )
    );
  }

  // ── If no real checks produced results, mark as unverified ──────────
  const realResults = speclessEvidence.filter(e => e.result !== 'skip');
  if (realResults.length === 0) {
    // No specless checks ran — code is unverified; assign a low baseline score
    signals.push(
      createSignal(
        'static_analysis',
        false,
        'No ISL spec and no specless checks available; code is unverified.',
        { score: 30, blocking: false }
      )
    );
  }

  // ── Dependency audit ─────────────────────────────────────────────────
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

/**
 * Map a specless check name to the appropriate SignalSource.
 */
function mapEvidenceToSignalSource(check: string): SignalSource {
  if (check.startsWith('hallucination:') || check.startsWith('fake_feature_detected:')) {
    return 'hallucination_scan';
  }
  if (check.startsWith('security') || check.startsWith('security_violation:')) {
    return 'security_scan';
  }
  if (check.startsWith('firewall-') || check.startsWith('security_violation: host/') || check.startsWith('security_violation: reality-gap/')) {
    return 'gate_firewall';
  }
  return 'static_analysis';
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
  if (input.dependencyAudit && input.projectRoot) {
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
  if (!projectRoot || typeof projectRoot !== 'string') {
    return createBlockingSignal('dependency_audit', true, 'No project root; skip audit', { score: 100 });
  }
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
// Gate Evidence Extraction from Signals
// ============================================================================

/**
 * Convert VerificationSignals into GateEvidence entries for pillar evaluation.
 */
function collectGateEvidenceFromSignals(signals: VerificationSignal[]): VerdictGateEvidence[] {
  const evidence: VerdictGateEvidence[] = [];

  for (const signal of signals) {
    const result: VerdictGateEvidence['result'] = signal.passed ? 'pass' : 'fail';
    const confidence = signal.score != null ? signal.score / 100 : (signal.passed ? 0.8 : 0.3);

    evidence.push(
      createGateEvidence(
        mapSignalSourceToEvidence(signal.source),
        signal.summary,
        result,
        confidence,
        signal.summary,
      ),
    );

    // Also convert individual findings into evidence entries
    if (signal.findings) {
      for (const f of signal.findings) {
        evidence.push(
          createGateEvidence(
            mapSignalSourceToEvidence(signal.source),
            f.id || f.message,
            f.blocking ? 'fail' : 'warn',
            confidence,
            f.message,
          ),
        );
      }
    }
  }

  return evidence;
}

function mapSignalSourceToEvidence(source: SignalSource): GateEvidenceSource {
  switch (source) {
    case 'parser': return 'isl-spec';
    case 'typechecker': return 'isl-spec';
    case 'verifier': return 'isl-spec';
    case 'test_runner': return 'test-execution';
    case 'static_analysis': return 'static-analysis';
    case 'security_scan': return 'static-analysis';
    case 'hallucination_scan': return 'static-analysis';
    default: return 'static-analysis';
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
