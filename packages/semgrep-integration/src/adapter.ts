/**
 * Semgrep → ShipGate Gate Adapter
 *
 * Converts SemgrepFindings into GateEvidence format compatible with
 * @isl-lang/gate's verdict engine and specless-registry.
 *
 * Types are defined locally to avoid a hard dependency on @isl-lang/gate —
 * they're structurally compatible with the authoritative definitions in
 * packages/isl-gate/src/authoritative/verdict-engine.ts
 *
 * @module @isl-lang/semgrep-integration/adapter
 */

import { SemgrepRunner } from './runner.js';
import type { SemgrepFinding, SemgrepConfig } from './types.js';

// ──────────────────────────────────────────────────────────────────────
// Gate-compatible types (structural match with @isl-lang/gate)
// ──────────────────────────────────────────────────────────────────────

type GateEvidenceSource =
  | 'isl-spec'
  | 'static-analysis'
  | 'runtime-eval'
  | 'test-execution'
  | 'specless-scanner';

type GateEvidenceResult = 'pass' | 'fail' | 'warn' | 'skip';

export interface GateEvidence {
  source: GateEvidenceSource;
  check: string;
  result: GateEvidenceResult;
  confidence: number;
  details: string;
}

export interface GateContext {
  projectRoot: string;
  implementation: string;
  specOptional: boolean;
}

export interface SpeclessCheck {
  name: string;
  run(file: string, context: GateContext): Promise<GateEvidence[]>;
}

// ──────────────────────────────────────────────────────────────────────
// Severity → Gate Result mapping
// ──────────────────────────────────────────────────────────────────────

const SEVERITY_TO_RESULT: Record<SemgrepFinding['severity'], GateEvidenceResult> = {
  ERROR: 'fail',
  WARNING: 'warn',
  INFO: 'pass',
};

const SEVERITY_TO_CONFIDENCE: Record<SemgrepFinding['severity'], number> = {
  ERROR: 0.90,
  WARNING: 0.70,
  INFO: 0.50,
};

// ──────────────────────────────────────────────────────────────────────
// Conversion helpers
// ──────────────────────────────────────────────────────────────────────

export function findingToEvidence(finding: SemgrepFinding): GateEvidence {
  const location = `${finding.path}:${finding.start.line}:${finding.start.col}`;
  const metaConfidence = finding.metadata?.confidence as string | undefined;

  let confidence = SEVERITY_TO_CONFIDENCE[finding.severity];
  if (metaConfidence === 'HIGH') confidence = 0.95;
  else if (metaConfidence === 'LOW') confidence = 0.40;

  return {
    source: 'static-analysis',
    check: `semgrep/${finding.check_id} at ${location}`,
    result: SEVERITY_TO_RESULT[finding.severity],
    confidence,
    details: finding.message.trim(),
  };
}

export function findingsToEvidence(findings: SemgrepFinding[]): GateEvidence[] {
  if (findings.length === 0) {
    return [{
      source: 'static-analysis',
      check: 'semgrep: no findings',
      result: 'pass',
      confidence: 0.80,
      details: 'Semgrep scan completed with no findings',
    }];
  }

  return findings.map(findingToEvidence);
}

// ──────────────────────────────────────────────────────────────────────
// SpeclessCheck implementation
// ──────────────────────────────────────────────────────────────────────

export function createSemgrepCheck(config?: SemgrepConfig): SpeclessCheck {
  const runner = new SemgrepRunner(config);

  return {
    name: 'semgrep-integration',

    async run(file: string, context: GateContext): Promise<GateEvidence[]> {
      const result = await runner.scan(context.projectRoot, [file]);

      if (result.errors.length > 0 && result.findings.length === 0) {
        const isMissing = result.errors.some(e => e.includes('not installed'));
        if (isMissing) {
          return [{
            source: 'static-analysis',
            check: 'semgrep-integration',
            result: 'skip',
            confidence: 0,
            details: 'Semgrep CLI is not installed — skipping static analysis',
          }];
        }

        return [{
          source: 'static-analysis',
          check: 'semgrep-integration',
          result: 'warn',
          confidence: 0.30,
          details: `Semgrep errors: ${result.errors.join('; ')}`,
        }];
      }

      return findingsToEvidence(result.findings);
    },
  };
}
