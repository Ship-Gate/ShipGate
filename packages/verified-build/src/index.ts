/**
 * @isl-lang/verified-build
 * 
 * Single-package SDK for code verification.
 * 
 * @example
 * ```typescript
 * import { verifyBuild, type BuildResult } from '@isl-lang/verified-build';
 * 
 * // Verify generated code before applying
 * const result = await verifyBuild({
 *   files: [
 *     { path: 'src/api/users.ts', content: generatedCode }
 *   ],
 *   projectRoot: '/path/to/project',
 * });
 * 
 * if (result.verdict === 'SHIP') {
 *   // Safe to apply changes
 *   await applyChanges(result.files);
 * } else {
 *   // Block and show reasons
 *   console.log('Blocked:', result.reasons);
 * }
 * ```
 * 
 * @module @isl-lang/verified-build
 */

import {
  runGate,
  quickCheck,
  runAuthoritativeGate,
  EXIT_CODES,
  type GateResult,
  type Finding,
  type AuthoritativeGateResult,
  type AuthoritativeVerdict,
  type VerdictReason,
  type CombinedVerdictResult,
  type VerdictSource,
} from '@isl-lang/gate';
import { 
  writeEvidenceBundle, 
  verifyEvidenceBundle,
  type EvidenceSignature,
} from '@isl-lang/evidence';
import { createAgentFirewall, type FirewallResult } from '@isl-lang/firewall';
import { readFile, mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { 
  createRegistry,
  loadBuiltinPacks, 
  type PolicyPack,
  type PolicyPackRegistry,
  type RuleContext,
  type RuleViolation,
} from '@isl-lang/policy-packs';

// ============================================================================
// Types
// ============================================================================

/**
 * A file to verify
 */
export interface FileToVerify {
  /** File path (relative to project root) */
  path: string;
  /** File content */
  content: string;
  /** Optional: previous content for diff-aware checks */
  previousContent?: string;
}

/**
 * Build verification options
 */
export interface VerifyOptions {
  /** Files to verify */
  files: FileToVerify[];
  /** Project root directory */
  projectRoot: string;
  /** Project name (for evidence) */
  projectName?: string;
  /** Policy packs to enable (default: all) */
  policyPacks?: string[];
  /** Strict mode - exit 1 on NO_SHIP */
  strict?: boolean;
  /** Write evidence bundle */
  writeEvidence?: boolean;
  /** Evidence output directory */
  evidenceDir?: string;
  /** Firewall mode */
  firewallMode?: 'observe' | 'enforce' | 'lockdown';
}

/**
 * Verification result
 */
export interface BuildResult {
  /** Overall verdict */
  verdict: 'SHIP' | 'NO_SHIP';
  /** Score 0-100 */
  score: number;
  /** Reasons for the verdict */
  reasons: BuildReason[];
  /** Policy violations found */
  violations: RuleViolation[];
  /** Firewall results per file */
  firewallResults: Map<string, FirewallResult>;
  /** Evidence path (if written) */
  evidencePath?: string;
  /** Evidence signature (if written) */
  signature?: EvidenceSignature;
  /** Duration in ms */
  durationMs: number;
  /** Deterministic fingerprint */
  fingerprint: string;
  /** Human-readable summary */
  summary: string;
}

/**
 * A reason for the verdict
 */
export interface BuildReason {
  /** Reason code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** Affected files */
  files: string[];
  /** How to fix */
  fix?: string;
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Verify a build before applying changes
 * 
 * This is the main entry point for integrators.
 */
export async function verifyBuild(options: VerifyOptions): Promise<BuildResult> {
  const startTime = Date.now();
  
  // Initialize fresh registry for each verification
  const localRegistry = createRegistry();
  await loadBuiltinPacks(localRegistry);
  const enabledPacks = options.policyPacks ?? ['auth', 'payments', 'pii', 'rate-limit'];
  
  // Configure packs
  const packConfig: Record<string, { enabled: boolean }> = {};
  for (const packId of ['auth', 'payments', 'pii', 'rate-limit']) {
    packConfig[packId] = { enabled: enabledPacks.includes(packId) };
  }
  
  const rules = localRegistry.getEnabledRules(packConfig);
  
  // Create firewall
  const firewall = createAgentFirewall({
    mode: options.firewallMode ?? 'observe',
    projectRoot: options.projectRoot,
  });
  
  // Analyze each file
  const allViolations: RuleViolation[] = [];
  const firewallResults = new Map<string, FirewallResult>();
  const findings: Finding[] = [];
  
  for (const file of options.files) {
    // Run firewall
    const fwResult = await firewall.evaluate({
      content: file.content,
      filePath: file.path,
    });
    firewallResults.set(file.path, fwResult);
    
    // Run policy rules
    const context: RuleContext = {
      claims: [],
      evidence: [],
      filePath: file.path,
      content: file.content,
      truthpack: {},
    };
    
    for (const rule of rules) {
      try {
        const violation = rule.evaluate(context);
        if (violation) {
          allViolations.push(violation);
          findings.push({
            id: `${rule.id}-${file.path}`,
            type: rule.category,
            severity: mapSeverity(violation.severity),
            message: violation.message,
            file: file.path,
          });
        }
      } catch {
        // Skip rule errors
      }
    }
    
    // Add firewall violations as findings
    for (const v of fwResult.violations) {
      findings.push({
        id: `fw-${v.policyId}-${file.path}`,
        type: 'firewall',
        severity: v.tier === 'hard_block' ? 'critical' : v.tier === 'soft_block' ? 'high' : 'medium',
        message: v.message,
        file: file.path,
      });
    }
  }
  
  // Run gate
  const gateResult = await runGate({
    findings,
    filesConsidered: options.files.length,
    filesScanned: options.files.length,
  }, {
    projectRoot: options.projectRoot,
    deterministic: true,
  });
  
  // Build reasons from gate + violations
  const reasons: BuildReason[] = gateResult.reasons.map(r => ({
    code: r.code,
    message: r.message,
    severity: (r.severity ?? 'medium') as BuildReason['severity'],
    files: r.files,
    fix: getFixForCode(r.code),
  }));
  
  // Write evidence if requested
  let evidencePath: string | undefined;
  let signature: EvidenceSignature | undefined;
  
  if (options.writeEvidence) {
    const evidenceDir = options.evidenceDir ?? `${options.projectRoot}/.islstudio/evidence`;
    evidencePath = await writeEvidenceBundle(gateResult, findings, {
      outputDir: evidenceDir,
      projectRoot: options.projectRoot,
      projectName: options.projectName,
      deterministic: true,
      includeHtmlReport: true,
    });
    
    // Get signature
    const verification = await verifyEvidenceBundle(evidencePath);
    signature = verification.signature;
  }
  
  const durationMs = Date.now() - startTime;
  
  return {
    verdict: gateResult.verdict,
    score: gateResult.score,
    reasons,
    violations: allViolations,
    firewallResults,
    evidencePath,
    signature,
    durationMs,
    fingerprint: gateResult.fingerprint,
    summary: generateSummary(gateResult, allViolations, options.files.length),
  };
}

/**
 * Quick check - returns SHIP/NO_SHIP without evidence
 */
export async function quickVerify(options: VerifyOptions): Promise<{
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  blockerCount: number;
}> {
  const result = await verifyBuild({
    ...options,
    writeEvidence: false,
  });
  
  return {
    verdict: result.verdict,
    score: result.score,
    blockerCount: result.violations.filter(v => v.tier === 'hard_block').length,
  };
}

/**
 * Check a single file
 */
export async function checkFile(
  filePath: string,
  content: string,
  projectRoot: string
): Promise<{ allowed: boolean; violations: RuleViolation[] }> {
  const result = await verifyBuild({
    files: [{ path: filePath, content }],
    projectRoot,
    writeEvidence: false,
  });
  
  return {
    allowed: result.verdict === 'SHIP',
    violations: result.violations,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function mapSeverity(severity: string): Finding['severity'] {
  switch (severity) {
    case 'error': return 'critical';
    case 'warning': return 'high';
    case 'info': return 'medium';
    default: return 'low';
  }
}

function getFixForCode(code: string): string | undefined {
  const fixes: Record<string, string> = {
    'auth/bypass-detected': 'Remove auth bypass patterns. Use proper authentication middleware.',
    'auth/hardcoded-credentials': 'Move secrets to environment variables.',
    'pii/logged-sensitive-data': 'Use structured logging with PII redaction.',
    'rate-limit/auth-endpoint': 'Add rate limiting: rateLimit({ windowMs: 60000, max: 5 })',
    'GHOST_ROUTE': 'Register the route in your truthpack: .shipgate/truthpack/routes.json',
    'GHOST_ENV': 'Add environment variable to .env.example',
  };
  return fixes[code];
}

function generateSummary(
  result: GateResult,
  violations: RuleViolation[],
  fileCount: number
): string {
  const emoji = result.verdict === 'SHIP' ? '✅' : '🛑';
  const blockers = violations.filter(v => v.tier === 'hard_block').length;
  const warnings = violations.filter(v => v.tier === 'soft_block' || v.tier === 'warn').length;
  
  if (result.verdict === 'SHIP') {
    return `${emoji} SHIP - All ${fileCount} files pass verification (score: ${result.score}/100)`;
  }
  
  return `${emoji} NO_SHIP - ${blockers} blockers, ${warnings} warnings across ${fileCount} files (score: ${result.score}/100)`;
}

// ============================================================================
// Unified gate (spec + firewall) - single entry point for "all AI code"
// ============================================================================

/**
 * Input for the unified gate (runs spec gate when spec exists + firewall on files).
 */
export interface UnifiedGateInput {
  /** Project root directory */
  projectRoot: string;
  /** ISL spec path or source (optional; when omitted, only firewall runs) */
  spec?: string;
  /** Implementation path (directory or file) for spec gate when spec is provided */
  implementation: string;
  /** File paths to run firewall on (default: discovered from implementation or all changed) */
  filesToCheck?: string[];
  /** Git info for evidence */
  git?: { sha?: string; branch?: string };
  /** CI info for evidence */
  ci?: { runId?: string; provider?: string };
  /** Write evidence bundle (default: true when spec run) */
  writeBundle?: boolean;
  /** Evidence output path */
  evidencePath?: string;
  /** When true, run dependency audit in spec gate (pnpm audit); critical vulns = NO_SHIP */
  dependencyAudit?: boolean;
}

/**
 * Run the unified gate: spec gate (when spec exists) + firewall on files.
 * Returns a single SHIP/NO_SHIP; NO_SHIP if either path fails.
 * Use this in CI to ensure all AI code is checked.
 */
export async function runUnifiedGate(input: UnifiedGateInput): Promise<CombinedVerdictResult> {
  const sources: VerdictSource[] = [];
  const reasons: VerdictReason[] = [];
  let score = 100;
  let specResult: AuthoritativeGateResult | undefined;
  let firewallResult: { verdict: AuthoritativeVerdict; score: number; reasons: VerdictReason[]; filesChecked: number } | undefined;

  const hasValidSpec = input.spec && (
    input.spec.includes('domain ') && input.spec.includes('version ')
  ) || (typeof input.spec === 'string' && existsSync(input.spec));

  // 1. Run authoritative (spec) gate when spec exists
  if (hasValidSpec && input.spec) {
    try {
      specResult = await runAuthoritativeGate({
        projectRoot: input.projectRoot,
        spec: input.spec,
        implementation: input.implementation,
        writeBundle: input.writeBundle ?? true,
        evidencePath: input.evidencePath ?? './evidence',
        git: input.git,
        ci: input.ci,
        dependencyAudit: input.dependencyAudit,
      });
      sources.push('gate_spec');
      reasons.push(...specResult.reasons);
      if (specResult.verdict === 'NO_SHIP') {
        score = Math.min(score, specResult.score);
      } else {
        score = Math.min(score, specResult.score);
      }
    } catch (err) {
      sources.push('gate_spec');
      reasons.push({
        code: 'SPEC_GATE_ERROR',
        message: err instanceof Error ? err.message : 'Spec gate failed',
        severity: 'critical',
        source: 'verifier',
        blocking: true,
      });
      score = 0;
    }
  }

  // 2. Resolve files to check (firewall)
  let filesToCheck = input.filesToCheck;
  if (!filesToCheck?.length) {
    const implFull = resolve(input.projectRoot, input.implementation);
    if (existsSync(implFull)) {
      const { stat } = await import('fs/promises');
      const { readdir } = await import('fs/promises');
      const s = await stat(implFull);
      if (s.isFile() && /\.(ts|js|tsx|jsx)$/.test(implFull)) {
        filesToCheck = [implFull];
      } else if (s.isDirectory()) {
        const entries = await readdir(implFull, { recursive: true });
        const extRe = /\.(ts|js|tsx|jsx)$/;
        filesToCheck = (Array.isArray(entries) ? entries : [])
          .filter((p: string) => typeof p === 'string' && extRe.test(p))
          .map((p: string) => resolve(implFull, p))
          .filter((p: string) => !p.includes('node_modules') && !p.includes('dist'))
          .slice(0, 500);
      }
    }
  }

  // 3. Run firewall (verified-build) on those files
  if (filesToCheck.length > 0) {
    const fileContents = await Promise.all(
      filesToCheck.map(async (p) => {
        try {
          const absPath = p.startsWith('/') || /^[A-Za-z]:/.test(p) ? p : resolve(input.projectRoot, p);
          const content = await readFile(absPath, 'utf-8');
          const relPath = absPath.replace(input.projectRoot, '').replace(/^[/\\]/, '');
          return { path: relPath, content };
        } catch {
          return null;
        }
      })
    );
    const toVerify = fileContents.filter((f): f is { path: string; content: string } => f !== null);
    if (toVerify.length > 0) {
      const buildResult = await verifyBuild({
        files: toVerify.map((f) => ({ path: f.path, content: f.content })),
        projectRoot: input.projectRoot,
        writeEvidence: false,
        firewallMode: 'enforce',
      });
      const fwReasons: VerdictReason[] = buildResult.reasons.map((r) => ({
        code: r.code,
        message: r.message,
        severity: (r.severity === 'low' ? 'medium' : r.severity) as VerdictReason['severity'],
        source: 'gate_firewall' as const,
        blocking: r.severity === 'critical' || r.severity === 'high',
      }));
      firewallResult = {
        verdict: buildResult.verdict as AuthoritativeVerdict,
        score: buildResult.score,
        reasons: fwReasons,
        filesChecked: toVerify.length,
      };
      sources.push('gate_firewall');
      reasons.push(...fwReasons);
      score = Math.min(score, buildResult.score);
    }
  }

  const verdict: AuthoritativeVerdict =
    specResult?.verdict === 'NO_SHIP' || firewallResult?.verdict === 'NO_SHIP' ? 'NO_SHIP' : 'SHIP';
  const finalScore = sources.length === 0 ? 100 : score;

  const evidencePathOut = specResult ? (input.evidencePath ?? './evidence') : undefined;
  const result: CombinedVerdictResult = {
    verdict,
    exitCode: verdict === 'SHIP' ? EXIT_CODES.SHIP : EXIT_CODES.NO_SHIP,
    sources,
    score: finalScore,
    reasons,
    evidencePath: evidencePathOut,
    specResult,
    firewallResult,
  };

  // Persist single combined evidence bundle for audits (one place to look)
  if (input.writeBundle !== false && (specResult || firewallResult)) {
    const evidenceDir = resolve(input.projectRoot, input.evidencePath ?? './evidence');
    try {
      await mkdir(evidenceDir, { recursive: true });
      const manifestPath = join(evidenceDir, 'unified-manifest.json');
      const manifest = {
        schemaVersion: '1.0',
        verdict: result.verdict,
        exitCode: result.exitCode,
        sources: result.sources,
        score: result.score,
        reasons: result.reasons.map((r) => ({ code: r.code, message: r.message, severity: r.severity, blocking: r.blocking })),
        evidencePath: evidencePathOut,
        specFingerprint: specResult?.evidence?.fingerprint,
        firewallFilesChecked: firewallResult?.filesChecked,
        timestamp: new Date().toISOString(),
        git: input.git,
        ci: input.ci,
      };
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    } catch {
      // Non-fatal: do not fail the gate if evidence write fails
    }
  }

  return result;
}

// ============================================================================
// Exports
// ============================================================================

export type { GateResult, Finding } from '@isl-lang/gate';
export type { CombinedVerdictResult, VerdictSource, VerdictReason } from '@isl-lang/gate';
export type { FirewallResult } from '@isl-lang/firewall';
export type { PolicyPack, RuleViolation } from '@isl-lang/policy-packs';
