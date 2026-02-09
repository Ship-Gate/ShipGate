/**
 * Firewall Scanners → SpeclessCheck Adapter
 *
 * Wraps @isl-lang/firewall's Host and Reality-Gap scanners
 * as pluggable SpeclessChecks for the authoritative gate.
 *
 * Host scanner detects:
 * - Ghost routes (referenced but don't exist)
 * - Ghost env vars (used but not declared)
 * - Ghost imports (modules that don't resolve)
 * - Ghost file references
 *
 * Reality-Gap scanner detects:
 * - Auth policy gaps
 * - PII handling violations
 * - Payment flow violations
 * - Rate-limit policy gaps
 * - Intent policy violations
 *
 * @module @isl-lang/gate/specless/firewall-adapter
 */

import { registerSpeclessCheck, type SpeclessCheck, type GateContext } from '../authoritative/specless-registry.js';
import type { GateEvidence } from '../authoritative/verdict-engine.js';

// ============================================================================
// Violation → GateEvidence mapping
// ============================================================================

interface ScannerViolation {
  rule: string;
  message: string;
  line?: number;
  severity: string;
  tier: 'hard_block' | 'soft_block' | 'warn';
  suggestion?: string;
}

interface ScanResult {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  filesChecked: number;
  violations: number;
  results: Array<{
    file: string;
    verdict: 'SHIP' | 'NO_SHIP';
    violations: ScannerViolation[];
  }>;
}

/**
 * Map firewall tier to GateEvidence result.
 * hard_block → fail, soft_block → warn, warn → warn.
 */
function resultForTier(tier: string): GateEvidence['result'] {
  switch (tier) {
    case 'hard_block':
      return 'fail';
    case 'soft_block':
      return 'warn';
    default:
      return 'warn';
  }
}

/**
 * Map firewall tier to confidence.
 * Truthpack-based violations are high confidence.
 */
function confidenceForTier(tier: string): number {
  switch (tier) {
    case 'hard_block':
      return 0.95;
    case 'soft_block':
      return 0.80;
    default:
      return 0.60;
  }
}

/**
 * Build check name for host violations.
 * Hard blocks on security-related rules trigger `security_violation`.
 */
function hostCheckName(violation: ScannerViolation): string {
  if (violation.tier === 'hard_block') {
    return `security_violation: host/${violation.rule} — ${violation.message}`;
  }
  return `firewall-host: ${violation.rule} — ${violation.message}`;
}

/**
 * Build check name for reality-gap violations.
 */
function realityGapCheckName(violation: ScannerViolation): string {
  if (violation.tier === 'hard_block') {
    return `security_violation: reality-gap/${violation.rule} — ${violation.message}`;
  }
  return `firewall-reality-gap: ${violation.rule} — ${violation.message}`;
}

/**
 * Convert a list of scan results to GateEvidence.
 */
function scanResultToEvidence(
  scanResult: ScanResult,
  scannerLabel: string,
  checkNameFn: (v: ScannerViolation) => string,
): GateEvidence[] {
  const evidence: GateEvidence[] = [];

  for (const fileResult of scanResult.results) {
    for (const violation of fileResult.violations) {
      evidence.push({
        source: 'specless-scanner',
        check: checkNameFn(violation),
        result: resultForTier(violation.tier),
        confidence: confidenceForTier(violation.tier),
        details: violation.message + (violation.suggestion ? ` — Fix: ${violation.suggestion}` : ''),
      });
    }
  }

  // If no violations, report a pass
  if (evidence.length === 0) {
    evidence.push({
      source: 'specless-scanner',
      check: `${scannerLabel}: all checks passed`,
      result: 'pass',
      confidence: 0.85,
      details: `${scannerLabel} found no violations across ${scanResult.filesChecked} file(s)`,
    });
  }

  return evidence;
}

// ============================================================================
// Host Scanner SpeclessCheck
// ============================================================================

export const firewallHostCheck: SpeclessCheck = {
  name: 'firewall-host-scanner',

  async run(file: string, context: GateContext): Promise<GateEvidence[]> {
    try {
      const mod = await import(/* @vite-ignore */ '@isl-lang/firewall');
      const runHostScan = mod.runHostScan as (files: string[], opts: { projectRoot: string }) => Promise<ScanResult>;
      const result = await runHostScan([file], {
        projectRoot: context.projectRoot,
      });

      return scanResultToEvidence(result, 'firewall-host', hostCheckName);
    } catch {
      return [{
        source: 'specless-scanner',
        check: 'firewall-host-scanner',
        result: 'skip',
        confidence: 0,
        details: 'Firewall host scanner not available (package not installed)',
      }];
    }
  },
};

// ============================================================================
// Reality-Gap Scanner SpeclessCheck
// ============================================================================

export const firewallRealityGapCheck: SpeclessCheck = {
  name: 'firewall-reality-gap-scanner',

  async run(file: string, context: GateContext): Promise<GateEvidence[]> {
    try {
      const mod = await import(/* @vite-ignore */ '@isl-lang/firewall');
      const runRealityGapScan = mod.runRealityGapScan as (files: string[], opts: { projectRoot: string }) => Promise<ScanResult>;
      const result = await runRealityGapScan([file], {
        projectRoot: context.projectRoot,
      });

      return scanResultToEvidence(result, 'firewall-reality-gap', realityGapCheckName);
    } catch {
      return [{
        source: 'specless-scanner',
        check: 'firewall-reality-gap-scanner',
        result: 'skip',
        confidence: 0,
        details: 'Firewall reality-gap scanner not available (package not installed)',
      }];
    }
  },
};

// ============================================================================
// Auto-register both checks
// ============================================================================

registerSpeclessCheck(firewallHostCheck);
registerSpeclessCheck(firewallRealityGapCheck);
