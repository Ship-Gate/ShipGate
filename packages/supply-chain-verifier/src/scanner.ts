import { readFileSync } from 'node:fs';
import { OSVClient, type OSVVulnerability, type PackageQuery } from './osv-client.js';
import { findLockfile, verifyLockfileIntegrity, type IntegrityResult } from './integrity-checker.js';
import { parseLockfile } from './lockfile-parser.js';
import { checkForTyposquatting, type TyposquatFinding } from './typosquat-detector.js';
import { basename } from 'node:path';

export interface ScanSummary {
  totalPackages: number;
  vulnerablePackages: number;
  criticalVulns: number;
  highVulns: number;
}

export interface SupplyChainResult {
  vulnerabilities: OSVVulnerability[];
  typosquatFindings: TyposquatFinding[];
  integrityResult: IntegrityResult;
  summary: ScanSummary;
}

export interface SupplyChainScannerOptions {
  checkOSV?: boolean;
  checkTyposquat?: boolean;
  checkIntegrity?: boolean;
}

const EMPTY_INTEGRITY: IntegrityResult = { valid: true, mismatches: [], warnings: [] };

function classifySeverity(vuln: OSVVulnerability): 'critical' | 'high' | 'medium' | 'low' | 'unknown' {
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

  // GHSA IDs with no CVSS typically indicate at least medium
  if (vuln.id.startsWith('GHSA-')) return 'medium';
  return 'unknown';
}

export class SupplyChainScanner {
  private readonly opts: Required<SupplyChainScannerOptions>;
  private readonly osvClient: OSVClient;

  constructor(options?: SupplyChainScannerOptions) {
    this.opts = {
      checkOSV: options?.checkOSV ?? true,
      checkTyposquat: options?.checkTyposquat ?? true,
      checkIntegrity: options?.checkIntegrity ?? true,
    };
    this.osvClient = new OSVClient();
  }

  async scan(projectRoot: string): Promise<SupplyChainResult> {
    const lockfilePath = findLockfile(projectRoot);

    let integrityResult: IntegrityResult;
    if (this.opts.checkIntegrity && lockfilePath) {
      integrityResult = verifyLockfileIntegrity(lockfilePath);
    } else if (this.opts.checkIntegrity && !lockfilePath) {
      integrityResult = {
        valid: false,
        mismatches: ['No lockfile found in project root'],
        warnings: [],
      };
    } else {
      integrityResult = EMPTY_INTEGRITY;
    }

    let packageNames: string[] = [];
    let packageQueries: PackageQuery[] = [];

    if (lockfilePath) {
      const content = readFileSync(lockfilePath, 'utf-8');
      const entries = parseLockfile(basename(lockfilePath), content);
      packageNames = entries.map((e) => e.name);
      packageQueries = entries.map((e) => ({
        name: e.name,
        version: e.version,
        ecosystem: 'npm' as const,
      }));
    }

    let vulnerabilities: OSVVulnerability[] = [];
    if (this.opts.checkOSV && packageQueries.length > 0) {
      try {
        vulnerabilities = await this.osvClient.queryBatch(packageQueries);
      } catch {
        // OSV API failures should not block the scan
      }
    }

    let typosquatFindings: TyposquatFinding[] = [];
    if (this.opts.checkTyposquat && packageNames.length > 0) {
      typosquatFindings = checkForTyposquatting(packageNames);
    }

    const vulnerablePackageNames = new Set<string>();
    for (const vuln of vulnerabilities) {
      for (const affected of vuln.affected) {
        vulnerablePackageNames.add(affected.package.name);
      }
    }

    let criticalVulns = 0;
    let highVulns = 0;
    for (const vuln of vulnerabilities) {
      const severity = classifySeverity(vuln);
      if (severity === 'critical') criticalVulns++;
      else if (severity === 'high') highVulns++;
    }

    return {
      vulnerabilities,
      typosquatFindings,
      integrityResult,
      summary: {
        totalPackages: packageNames.length,
        vulnerablePackages: vulnerablePackageNames.size,
        criticalVulns,
        highVulns,
      },
    };
  }
}
