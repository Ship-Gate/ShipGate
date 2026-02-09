// ============================================================================
// Host & Reality-Gap Scanner Diagnostics
// Maps firewall (ShipGate + ISL Studio) verdicts to LSP diagnostics.
// Severity, codes, and messages match CLI output; suppressions/allowlists
// are applied inside the firewall.
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Diagnostic, Range } from 'vscode-languageserver';
import { DiagnosticSeverity } from 'vscode-languageserver';
import type { PolicyViolation } from '@isl-lang/firewall';
import type { IntegratedGateResult } from '@isl-lang/firewall';
import { createIntegratedFirewall } from '@isl-lang/firewall';

// ============================================================================
// Constants – match CLI severity/tier
// ============================================================================

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SOURCE_HOST = 'shipgate-host';
const SOURCE_REALITY_GAP = 'shipgate-reality-gap';

// ============================================================================
// Severity mapping: CLI tier/severity → LSP DiagnosticSeverity
// ============================================================================

function tierToLSPSeverity(tier: 'hard_block' | 'soft_block' | 'warn'): DiagnosticSeverity {
  switch (tier) {
    case 'hard_block':
      return DiagnosticSeverity.Error;
    case 'soft_block':
      return DiagnosticSeverity.Warning;
    case 'warn':
      return DiagnosticSeverity.Information;
    default:
      return DiagnosticSeverity.Warning;
  }
}

function severityToLSP(severity: 'critical' | 'high' | 'medium' | 'low'): DiagnosticSeverity {
  switch (severity) {
    case 'critical':
    case 'high':
      return DiagnosticSeverity.Error;
    case 'medium':
      return DiagnosticSeverity.Warning;
    case 'low':
      return DiagnosticSeverity.Information;
    default:
      return DiagnosticSeverity.Warning;
  }
}

// ============================================================================
// Range helpers
// ============================================================================

/** Claim location is 1-based line/column; LSP is 0-based. */
function claimLocationToRange(claim: { location: { line: number; column: number; length: number } }): Range {
  const { line, column, length } = claim.location;
  return {
    start: { line: line - 1, character: Math.max(0, column - 1) },
    end: { line: line - 1, character: Math.max(0, column - 1 + length) },
  };
}

/** Line-only violation (e.g. ISL Studio): claimId is "line-<num>". */
function lineOnlyRange(document: TextDocument, claimId: string): Range {
  const match = /^line-(\d+)$/.exec(claimId);
  const line = match ? parseInt(match[1], 10) : 1;
  const lineIndex = Math.max(0, line - 1);
  const text = document.getText().split('\n')[lineIndex];
  const endChar = text !== undefined ? text.length : 0;
  return {
    start: { line: lineIndex, character: 0 },
    end: { line: lineIndex, character: endChar },
  };
}

// ============================================================================
// Scanner diagnostics provider
// ============================================================================

export interface ScannerDiagnosticsOptions {
  projectRoot: string;
  enabled: boolean;
  /** Host scanner (truthpack/reality state) – ghost-route, ghost-env, etc. */
  hostScanner: boolean;
  /** Reality-Gap scanner (code vs truthpack) – same engine, exposed as separate source for filtering */
  realityGapScanner: boolean;
}

const DEFAULT_OPTIONS: ScannerDiagnosticsOptions = {
  projectRoot: process.cwd(),
  enabled: true,
  hostScanner: true,
  realityGapScanner: true,
};

export class ScannerDiagnosticsProvider {
  private options: ScannerDiagnosticsOptions;
  private firewallInstance: ReturnType<typeof createIntegratedFirewall>;

  constructor(options: Partial<ScannerDiagnosticsOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.firewallInstance = createIntegratedFirewall({
      projectRoot: this.options.projectRoot,
      mode: 'observe',
    });
  }

  configure(options: Partial<ScannerDiagnosticsOptions>): void {
    this.options = { ...this.options, ...options };
    this.firewallInstance = createIntegratedFirewall({
      projectRoot: this.options.projectRoot,
      mode: 'observe',
    });
  }

  /** Whether this document should be scanned (file type). */
  isSupported(document: TextDocument): boolean {
    const path = uriToFilePath(document.uri);
    const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')) : '';
    return SUPPORTED_EXTENSIONS.has(ext.toLowerCase());
  }

  /**
   * Run Host + Reality-Gap scanners and return LSP diagnostics.
   * Suppressions and safelists are applied inside the firewall.
   */
  async provideDiagnostics(document: TextDocument): Promise<Diagnostic[]> {
    if (!this.options.enabled || !this.isSupported(document)) {
      return [];
    }

    const filePath = uriToFilePath(document.uri);
    const projectRoot = this.options.projectRoot || filePath.split(/[/\\]/).slice(0, -1).join('/');

    this.firewallInstance.setMode('observe');
    const result: IntegratedGateResult = await this.firewallInstance.evaluate({
      filePath,
      content: document.getText(),
    });

    return this.mapResultToDiagnostics(document, result);
  }

  /**
   * Map firewall verdicts to LSP diagnostics.
   * Severity, code, and message match CLI output.
   */
  private mapResultToDiagnostics(document: TextDocument, result: IntegratedGateResult): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const claimById = new Map(result.claims.map(c => [c.id, c]));

    for (const v of result.violations) {
      const range = this.rangeForViolation(document, v, claimById);
      const severity = v.severity
        ? severityToLSP(v.severity)
        : tierToLSPSeverity(v.tier);

      const source = isHostViolation(v.policyId) ? SOURCE_HOST : SOURCE_REALITY_GAP;

      diagnostics.push({
        range,
        message: v.message,
        severity,
        code: v.policyId,
        source,
        data: {
          suggestion: v.suggestion,
          tier: v.tier,
          quickFixes: v.quickFixes,
        },
      });
    }

    return diagnostics;
  }

  private rangeForViolation(
    document: TextDocument,
    v: PolicyViolation,
    claimById: Map<string, { location: { line: number; column: number; length: number } }>
  ): Range {
    const claim = claimById.get(v.claimId);
    if (claim?.location) {
      return claimLocationToRange(claim);
    }
    return lineOnlyRange(document, v.claimId);
  }
}

/** Ghost-* rules come from truthpack validation = Host scanner; everything else = Reality-Gap (ISL Studio). */
function isHostViolation(policyId: string): boolean {
  return (
    policyId === 'ghost-route' ||
    policyId === 'ghost-env' ||
    policyId === 'ghost-import' ||
    policyId === 'ghost-file'
  );
}

function uriToFilePath(uri: string): string {
  if (uri.startsWith('file://')) {
    return uri.slice(7).replace(/%2f/gi, '/').replace(/%5c/gi, '\\');
  }
  return uri;
}

export { SOURCE_HOST, SOURCE_REALITY_GAP };
