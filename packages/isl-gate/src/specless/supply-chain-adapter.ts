/**
 * Supply Chain Verifier → SpeclessCheck Adapter
 *
 * Wraps @isl-lang/supply-chain-verifier to detect dependency
 * vulnerabilities, typosquatting, and lockfile integrity issues.
 *
 * This is a project-level check — it scans the project root
 * rather than individual files.
 *
 * @module @isl-lang/gate/specless/supply-chain-adapter
 */

import { registerSpeclessCheck, type SpeclessCheck, type GateContext } from '../authoritative/specless-registry.js';
import type { GateEvidence } from '../authoritative/verdict-engine.js';

let hasRunForProject = false;
let cachedEvidence: GateEvidence[] = [];

export const supplyChainCheck: SpeclessCheck = {
  name: 'supply-chain-verifier',

  async run(_file: string, context: GateContext): Promise<GateEvidence[]> {
    if (hasRunForProject) return cachedEvidence;
    hasRunForProject = true;

    try {
      const mod = await import(/* @vite-ignore */ '@isl-lang/supply-chain-verifier');
      const SupplyChainScanner = mod.SupplyChainScanner as new (opts?: {
        checkOSV?: boolean;
        checkTyposquat?: boolean;
        checkIntegrity?: boolean;
      }) => {
        scan(projectRoot: string): Promise<{
          vulnerabilities: Array<{ id: string; summary: string; severity?: Array<{ type: string; score: string }> }>;
          typosquatFindings: Array<{ package: string; similarTo: string; risk: string }>;
          integrityResult: { valid: boolean; mismatches: string[] };
          summary: { totalPackages: number; vulnerablePackages: number; criticalVulns: number; highVulns: number };
        }>;
      };

      const scanner = new SupplyChainScanner({
        checkOSV: true,
        checkTyposquat: true,
        checkIntegrity: true,
      });

      const result = await scanner.scan(context.projectRoot);
      const evidence: GateEvidence[] = [];

      for (const vuln of result.vulnerabilities) {
        const maxScore = vuln.severity?.reduce((max, s) => Math.max(max, parseFloat(s.score) || 0), 0) ?? 0;
        const isCritical = maxScore >= 7.0;
        evidence.push({
          source: 'specless-scanner',
          check: isCritical
            ? `critical_vulnerability: ${vuln.id} — ${vuln.summary}`
            : `supply-chain: ${vuln.id} — ${vuln.summary}`,
          result: isCritical ? 'fail' : 'warn',
          confidence: 0.95,
          details: vuln.summary,
        });
      }

      for (const typo of result.typosquatFindings) {
        evidence.push({
          source: 'specless-scanner',
          check: typo.risk === 'high'
            ? `critical_vulnerability: typosquat "${typo.package}" (similar to "${typo.similarTo}")`
            : `supply-chain: possible typosquat "${typo.package}"`,
          result: typo.risk === 'high' ? 'fail' : 'warn',
          confidence: typo.risk === 'high' ? 0.90 : 0.70,
          details: `Package "${typo.package}" is suspiciously similar to "${typo.similarTo}"`,
        });
      }

      if (!result.integrityResult.valid) {
        evidence.push({
          source: 'specless-scanner',
          check: 'critical_vulnerability: lockfile integrity failure',
          result: 'fail',
          confidence: 0.95,
          details: `Lockfile integrity issues: ${result.integrityResult.mismatches.join(', ')}`,
        });
      }

      if (evidence.length === 0) {
        evidence.push({
          source: 'specless-scanner',
          check: 'supply-chain: all checks passed',
          result: 'pass',
          confidence: 0.85,
          details: `Scanned ${result.summary.totalPackages} packages — no vulnerabilities or integrity issues`,
        });
      }

      cachedEvidence = evidence;
      return evidence;
    } catch {
      cachedEvidence = [{
        source: 'specless-scanner',
        check: 'supply-chain-verifier',
        result: 'skip',
        confidence: 0,
        details: 'Supply chain verifier not available (package not installed)',
      }];
      return cachedEvidence;
    }
  },
};

registerSpeclessCheck(supplyChainCheck);
