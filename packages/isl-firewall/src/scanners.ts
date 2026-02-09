/**
 * Host and Reality-Gap Scanner Entrypoints
 *
 * Exposes standalone scanner functions for CLI and programmatic use.
 * - Host: ShipGate truthpack validation (routes, env, imports, files)
 * - Reality-Gap: ISL Studio policy packs (auth, pii, payments, rate-limit, intent)
 *
 * @module @isl-lang/firewall/scanners
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { createAgentFirewall } from './agent-firewall.js';
import { createIntegratedFirewall } from './isl-studio-integration.js';
import type { FirewallResult } from './types.js';

export interface ScannerViolation {
  rule: string;
  message: string;
  line?: number;
  severity: string;
  tier: 'hard_block' | 'soft_block' | 'warn';
  suggestion?: string;
}

export interface HostScanResult {
  scanner: 'host';
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  filesChecked: number;
  violations: number;
  hardBlocks: number;
  softBlocks: number;
  warnings: number;
  results: Array<{
    file: string;
    verdict: 'SHIP' | 'NO_SHIP';
    violations: ScannerViolation[];
  }>;
}

export interface RealityGapScanResult {
  scanner: 'reality-gap';
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  filesChecked: number;
  violations: number;
  hardBlocks: number;
  softBlocks: number;
  warnings: number;
  results: Array<{
    file: string;
    verdict: 'SHIP' | 'NO_SHIP';
    violations: ScannerViolation[];
  }>;
}

export type ScanResult = HostScanResult | RealityGapScanResult;

export interface ScannerOptions {
  projectRoot?: string;
  truthpackPath?: string;
  config?: string;
}

/**
 * Run Host scanner: validates code against truthpack (routes, env, imports, files).
 * Detects ghost routes, ghost env vars, ghost imports, ghost file references.
 */
export async function runHostScan(
  files: string[],
  options: ScannerOptions = {}
): Promise<HostScanResult> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const firewall = createAgentFirewall({
    projectRoot,
    truthpackPath: options.truthpackPath ?? '.shipgate/truthpack',
    mode: 'enforce',
  });

  const results: Array<{ file: string; verdict: 'SHIP' | 'NO_SHIP'; violations: ScannerViolation[] }> = [];
  let totalViolations = 0;
  let totalHardBlocks = 0;
  let totalSoftBlocks = 0;
  let totalWarnings = 0;

  for (const file of files) {
    if (!existsSync(file)) continue;

    const content = readFileSync(file, 'utf-8');
    const result = await firewall.evaluate({ filePath: file, content });

    const violations: ScannerViolation[] = result.violations.map((v) => ({
      rule: v.policyId,
      message: v.message,
      severity: v.severity ?? 'medium',
      tier: v.tier,
      suggestion: v.suggestion,
    }));

    const hardBlocks = violations.filter((v) => v.tier === 'hard_block').length;
    const softBlocks = violations.filter((v) => v.tier === 'soft_block').length;
    const warnings = violations.filter((v) => v.tier === 'warn').length;

    totalViolations += violations.length;
    totalHardBlocks += hardBlocks;
    totalSoftBlocks += softBlocks;
    totalWarnings += warnings;

    results.push({
      file,
      verdict: result.allowed ? 'SHIP' : 'NO_SHIP',
      violations,
    });
  }

  const score = Math.max(
    0,
    100 - totalHardBlocks * 25 - totalSoftBlocks * 10 - totalWarnings * 2
  );
  const verdict = totalHardBlocks > 0 ? 'NO_SHIP' : 'SHIP';

  return {
    scanner: 'host',
    verdict,
    score,
    filesChecked: results.length,
    violations: totalViolations,
    hardBlocks: totalHardBlocks,
    softBlocks: totalSoftBlocks,
    warnings: totalWarnings,
    results,
  };
}

/**
 * Run Reality-Gap scanner: ISL Studio policy packs (auth, pii, payments, rate-limit, intent).
 * Detects gaps between implementation and security/intent standards.
 */
export async function runRealityGapScan(
  files: string[],
  options: ScannerOptions = {}
): Promise<RealityGapScanResult> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const firewall = createIntegratedFirewall({
    projectRoot,
    truthpackPath: options.truthpackPath ?? '.shipgate/truthpack',
  });

  const results: Array<{ file: string; verdict: 'SHIP' | 'NO_SHIP'; violations: ScannerViolation[] }> = [];
  let totalViolations = 0;
  let totalHardBlocks = 0;
  let totalSoftBlocks = 0;
  let totalWarnings = 0;

  for (const file of files) {
    if (!existsSync(file)) continue;

    const content = readFileSync(file, 'utf-8');
    const result = await firewall.evaluateRealityGapOnly({ filePath: file, content });

    const violations: ScannerViolation[] = result.violations.map((v) => ({
      rule: v.ruleId,
      message: v.message,
      line: v.line,
      severity: v.tier === 'hard_block' ? 'critical' : v.tier === 'soft_block' ? 'medium' : 'low',
      tier: v.tier,
      suggestion: v.suggestion,
    }));

    const hardBlocks = violations.filter((v) => v.tier === 'hard_block').length;
    const softBlocks = violations.filter((v) => v.tier === 'soft_block').length;
    const warnings = violations.filter((v) => v.tier === 'warn').length;

    totalViolations += violations.length;
    totalHardBlocks += hardBlocks;
    totalSoftBlocks += softBlocks;
    totalWarnings += warnings;

    results.push({
      file,
      verdict: result.verdict,
      violations,
    });
  }

  const score = Math.max(
    0,
    100 - totalHardBlocks * 25 - totalSoftBlocks * 10 - totalWarnings * 2
  );
  const verdict = totalHardBlocks > 0 ? 'NO_SHIP' : 'SHIP';

  return {
    scanner: 'reality-gap',
    verdict,
    score,
    filesChecked: results.length,
    violations: totalViolations,
    hardBlocks: totalHardBlocks,
    softBlocks: totalSoftBlocks,
    warnings: totalWarnings,
    results,
  };
}
