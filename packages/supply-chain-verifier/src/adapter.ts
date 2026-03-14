import { registerSpeclessCheck, type SpeclessCheck, type GateContext } from '@isl-lang/gate/authoritative/specless-registry';
import type { GateEvidence } from '@isl-lang/gate/authoritative/verdict-engine';
import { SupplyChainScanner } from './scanner.js';
import type { OSVVulnerability } from './osv-client.js';

function classifySeverity(vuln: OSVVulnerability): string {
  for (const sev of vuln.severity) {
    const score = parseFloat(sev.score);
    if (!isNaN(score)) {
      if (score >= 9.0) return 'critical';
      if (score >= 7.0) return 'high';
      if (score >= 4.0) return 'medium';
      return 'low';
    }

    const upper = sev.score.toUpperCase();
    if (upper === 'CRITICAL') return 'critical';
    if (upper === 'HIGH') return 'high';
    if (upper === 'MEDIUM' || upper === 'MODERATE') return 'medium';
    if (upper === 'LOW') return 'low';
  }
  return 'unknown';
}

export const supplyChainCheck: SpeclessCheck = {
  name: 'supply-chain-verifier',

  async run(_file: string, context: GateContext): Promise<GateEvidence[]> {
    const evidence: GateEvidence[] = [];

    try {
      const scanner = new SupplyChainScanner({
        checkOSV: true,
        checkTyposquat: true,
        checkIntegrity: true,
      });

      const result = await scanner.scan(context.projectRoot);

      // Vulnerability findings
      if (result.vulnerabilities.length === 0) {
        evidence.push({
          source: 'specless-scanner',
          check: 'supply-chain: no known vulnerabilities',
          result: 'pass',
          confidence: 0.85,
          details: `Scanned ${result.summary.totalPackages} packages against OSV.dev — no known vulnerabilities`,
        });
      } else {
        for (const vuln of result.vulnerabilities) {
          const severity = classifySeverity(vuln);
          const isCriticalOrHigh = severity === 'critical' || severity === 'high';
          const affectedNames = vuln.affected.map((a) => a.package.name).join(', ');

          evidence.push({
            source: 'specless-scanner',
            check: isCriticalOrHigh
              ? `critical_vulnerability: ${vuln.id} in ${affectedNames}`
              : `supply-chain: ${vuln.id} (${severity}) in ${affectedNames}`,
            result: isCriticalOrHigh ? 'fail' : 'warn',
            confidence: 0.90,
            details: `${vuln.id}: ${vuln.summary} [${severity}]`,
          });
        }
      }

      // Typosquatting findings
      if (result.typosquatFindings.length === 0) {
        evidence.push({
          source: 'specless-scanner',
          check: 'supply-chain: no typosquatting detected',
          result: 'pass',
          confidence: 0.80,
          details: 'No typosquatting candidates found in dependency list',
        });
      } else {
        for (const finding of result.typosquatFindings) {
          evidence.push({
            source: 'specless-scanner',
            check: finding.risk === 'high'
              ? `critical_vulnerability: possible typosquat "${finding.package}" (similar to "${finding.similarTo}")`
              : `supply-chain: typosquat candidate "${finding.package}" (similar to "${finding.similarTo}")`,
            result: finding.risk === 'high' ? 'fail' : 'warn',
            confidence: finding.risk === 'high' ? 0.90 : 0.70,
            details: `"${finding.package}" is ${finding.distance} edit(s) from popular package "${finding.similarTo}" — risk: ${finding.risk}`,
          });
        }
      }

      // Integrity findings
      if (result.integrityResult.valid) {
        evidence.push({
          source: 'specless-scanner',
          check: 'supply-chain: lockfile integrity verified',
          result: 'pass',
          confidence: 0.85,
          details: 'Lockfile exists, is non-empty, and all package.json deps are present',
        });
      } else {
        for (const mismatch of result.integrityResult.mismatches) {
          evidence.push({
            source: 'specless-scanner',
            check: `critical_vulnerability: lockfile integrity failure`,
            result: 'fail',
            confidence: 0.90,
            details: mismatch,
          });
        }
      }

      for (const warning of result.integrityResult.warnings) {
        evidence.push({
          source: 'specless-scanner',
          check: 'supply-chain: lockfile integrity warning',
          result: 'warn',
          confidence: 0.70,
          details: warning,
        });
      }
    } catch {
      evidence.push({
        source: 'specless-scanner',
        check: 'supply-chain-verifier',
        result: 'skip',
        confidence: 0,
        details: 'Supply chain scanner encountered an error',
      });
    }

    return evidence;
  },
};

registerSpeclessCheck(supplyChainCheck);
