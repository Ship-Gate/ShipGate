/**
 * Race Detector → SpeclessCheck Adapter
 *
 * Wraps @isl-lang/race-detector to detect concurrency and race condition
 * vulnerabilities in TypeScript/JavaScript code.
 *
 * Detection targets:
 * - Shared mutable state across async/request contexts
 * - Time-of-check-to-time-of-use (TOCTOU) patterns
 * - Database read-modify-save without transactions
 * - Unguarded Promise.all with shared state
 * - Event handler and timer races
 *
 * @module @isl-lang/race-detector/adapter
 */

import { RaceDetector } from './detector.js';
import type { RaceFinding, Severity } from './types.js';

interface GateEvidence {
  source: string;
  check: string;
  result: 'pass' | 'fail' | 'warn' | 'skip';
  confidence: number;
  details: string;
}

interface GateContext {
  projectRoot: string;
  implementation: string;
}

interface SpeclessCheck {
  name: string;
  run(file: string, context: GateContext): Promise<GateEvidence[]>;
}

function isAnalyzableFile(file: string): boolean {
  const ext = file.split('.').pop()?.toLowerCase();
  return ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext ?? '');
}

function resultForSeverity(severity: Severity): GateEvidence['result'] {
  return severity === 'critical' || severity === 'high' ? 'fail' : 'warn';
}

function confidenceForSeverity(severity: Severity): number {
  switch (severity) {
    case 'critical': return 0.92;
    case 'high': return 0.85;
    case 'medium': return 0.70;
    default: return 0.55;
  }
}

function checkLabelForFinding(finding: RaceFinding): string {
  const prefix = finding.severity === 'critical' ? 'security_violation' : 'race-condition';
  return `${prefix}: ${finding.type} — ${finding.description.slice(0, 80)}`;
}

export const raceDetectorCheck: SpeclessCheck = {
  name: 'race-detector',

  async run(file: string, context: GateContext): Promise<GateEvidence[]> {
    if (!isAnalyzableFile(file)) return [];

    try {
      const detector = new RaceDetector();
      const findings = detector.detectSource(context.implementation, file);

      if (!findings || findings.length === 0) {
        return [{
          source: 'specless-scanner',
          check: 'race-condition: no concurrency issues detected',
          result: 'pass',
          confidence: 0.80,
          details: `No race conditions or concurrency vulnerabilities detected in ${file}`,
        }];
      }

      return findings.map((f) => ({
        source: 'specless-scanner' as const,
        check: checkLabelForFinding(f),
        result: resultForSeverity(f.severity),
        confidence: confidenceForSeverity(f.severity),
        details: `[${f.type}] ${f.description} | Remediation: ${f.remediation}`,
      }));
    } catch {
      return [{
        source: 'specless-scanner',
        check: 'race-detector',
        result: 'skip',
        confidence: 0,
        details: 'Race detector encountered an error during analysis',
      }];
    }
  },
};

export function createRaceDetectorAdapter(): SpeclessCheck {
  return raceDetectorCheck;
}
