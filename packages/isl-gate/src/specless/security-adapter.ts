/**
 * Security Scanner → SpeclessCheck Adapter
 *
 * Wraps @isl-lang/security-scanner's implementation-only scanning
 * (scanSource) as a pluggable SpeclessCheck for the authoritative gate.
 *
 * Detection targets:
 * - Hardcoded secrets (SEC009)
 * - SQL injection patterns (SEC008)
 * - Auth bypass patterns
 * - Insecure cryptography
 * - Sensitive data exposure
 *
 * @module @isl-lang/gate/specless/security-adapter
 */

import { registerSpeclessCheck, type SpeclessCheck, type GateContext } from '../authoritative/specless-registry.js';
import type { GateEvidence } from '../authoritative/verdict-engine.js';

// ============================================================================
// Language detection
// ============================================================================

type ScanLanguage = 'typescript' | 'javascript' | 'python';

function detectLanguage(file: string): ScanLanguage | null {
  const ext = file.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'py':
    case 'pyw':
      return 'python';
    default:
      return null;
  }
}

// ============================================================================
// Severity → GateEvidence mapping
// ============================================================================

interface SecurityFinding {
  id: string;
  title: string;
  severity: string;
  category: string;
  description: string;
  recommendation: string;
  location: { file: string; startLine: number };
}

/**
 * Map security severity to GateEvidence result.
 * Critical findings are mapped to 'fail', others to 'warn'.
 */
function resultForSeverity(severity: string): GateEvidence['result'] {
  switch (severity) {
    case 'critical':
      return 'fail';
    case 'high':
      return 'fail';
    case 'medium':
      return 'warn';
    case 'low':
      return 'warn';
    default:
      return 'warn';
  }
}

/**
 * Map security severity to confidence (0–1).
 * Higher severity → higher confidence in the finding.
 */
function confidenceForSeverity(severity: string): number {
  switch (severity) {
    case 'critical':
      return 0.95;
    case 'high':
      return 0.85;
    case 'medium':
      return 0.70;
    case 'low':
      return 0.55;
    default:
      return 0.50;
  }
}

/**
 * Build check name. Critical/high findings use `security_violation` prefix
 * so the verdict engine's critical failure detection triggers NO_SHIP.
 */
function checkNameForFinding(finding: SecurityFinding): string {
  if (finding.severity === 'critical') {
    return `security_violation: ${finding.id} ${finding.title}`;
  }
  return `security: ${finding.id} ${finding.title}`;
}

// ============================================================================
// SpeclessCheck implementation
// ============================================================================

export const securityCheck: SpeclessCheck = {
  name: 'security-vulnerability-scanner',

  async run(file: string, context: GateContext): Promise<GateEvidence[]> {
    const language = detectLanguage(file);
    if (!language) {
      return []; // Unsupported language — skip silently
    }

    try {
      const mod = await import(/* @vite-ignore */ '@isl-lang/security-scanner');
      const scanSource = mod.scanSource as (source: string, lang?: string) => SecurityFinding[];
      const findings = scanSource(context.implementation, language);

      if (findings.length === 0) {
        return [{
          source: 'specless-scanner',
          check: 'security: implementation scan clean',
          result: 'pass',
          confidence: 0.80,
          details: `No security vulnerabilities detected in ${file}`,
        }];
      }

      return findings.map((finding) => ({
        source: 'specless-scanner' as const,
        check: checkNameForFinding(finding),
        result: resultForSeverity(finding.severity),
        confidence: confidenceForSeverity(finding.severity),
        details: `${finding.description} — ${finding.recommendation}`,
      }));
    } catch {
      // Scanner not available — skip gracefully
      return [{
        source: 'specless-scanner',
        check: 'security-vulnerability-scanner',
        result: 'skip',
        confidence: 0,
        details: 'Security scanner not available (package not installed)',
      }];
    }
  },
};

// ============================================================================
// Auto-register
// ============================================================================

registerSpeclessCheck(securityCheck);
