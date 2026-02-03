/**
 * Gate Ingester - Parse JSON and SARIF gate results
 *
 * @module @isl-lang/healer
 */

import type {
  GateResult,
  GateResultJSON,
  SarifReport,
  SarifResult,
  Violation,
  Severity,
  Span,
} from './types';

// ============================================================================
// SARIF Severity Mapping
// ============================================================================

const SARIF_SEVERITY_MAP: Record<string, Severity> = {
  error: 'high',
  warning: 'medium',
  note: 'low',
  none: 'low',
};

// ============================================================================
// Gate Ingester Class
// ============================================================================

export class GateIngester {
  /**
   * Parse gate result from JSON or SARIF
   */
  parse(input: string | object): GateResult {
    const data = typeof input === 'string' ? JSON.parse(input) : input;

    // Detect format
    if (this.isSarif(data)) {
      return this.parseSarif(data as SarifReport);
    } else {
      return this.parseJSON(data as GateResultJSON);
    }
  }

  /**
   * Check if input is SARIF format
   */
  private isSarif(data: any): boolean {
    return data.version === '2.1.0' && Array.isArray(data.runs);
  }

  /**
   * Parse native JSON gate result
   */
  private parseJSON(data: GateResultJSON): GateResult {
    return {
      format: 'json',
      verdict: data.verdict,
      score: data.score,
      violations: data.violations.map(v => this.normalizeViolation(v)),
      fingerprint: data.fingerprint,
      metadata: {
        tool: 'isl-gate',
        durationMs: data.durationMs,
        timestamp: data.timestamp,
        policyPacks: data.policyPacks,
      },
    };
  }

  /**
   * Parse SARIF report to gate result
   */
  private parseSarif(report: SarifReport): GateResult {
    const violations: Violation[] = [];
    let toolName = 'unknown';
    let toolVersion: string | undefined;

    for (const run of report.runs) {
      toolName = run.tool.driver.name;
      toolVersion = run.tool.driver.version;

      for (const result of run.results) {
        violations.push(this.sarifResultToViolation(result, run));
      }
    }

    // Calculate score from violations
    const score = this.calculateScore(violations);

    return {
      format: 'sarif',
      verdict: score >= 80 ? 'SHIP' : 'NO_SHIP',
      score,
      violations,
      fingerprint: this.computeFingerprint(violations),
      metadata: {
        tool: toolName,
        version: toolVersion,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Convert SARIF result to Violation
   */
  private sarifResultToViolation(result: SarifResult, _run: unknown): Violation {
    const location = result.locations?.[0]?.physicalLocation;
    const region = location?.region;

    const span: Span = {
      startLine: region?.startLine ?? 1,
      startColumn: region?.startColumn ?? 1,
      endLine: region?.endLine ?? region?.startLine ?? 1,
      endColumn: region?.endColumn ?? 1,
    };

    return {
      ruleId: result.ruleId,
      file: location?.artifactLocation?.uri ?? 'unknown',
      span,
      message: result.message.text,
      severity: SARIF_SEVERITY_MAP[result.level] ?? 'medium',
      evidence: {
        snippet: region?.snippet?.text,
      },
      suggestion: result.fixes?.[0]?.description?.text,
    };
  }

  /**
   * Normalize a violation to standard format
   */
  private normalizeViolation(v: any): Violation {
    return {
      ruleId: v.ruleId,
      file: v.file,
      span: v.span ?? {
        startLine: v.line ?? 1,
        startColumn: v.column ?? 1,
        endLine: v.line ?? 1,
        endColumn: v.column ?? 1,
      },
      message: v.message,
      severity: v.severity,
      evidence: v.evidence ?? {},
      suggestion: v.suggestion,
    };
  }

  /**
   * Calculate score from violations
   */
  private calculateScore(violations: Violation[]): number {
    let score = 100;

    for (const v of violations) {
      switch (v.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Compute deterministic fingerprint
   */
  private computeFingerprint(violations: Violation[]): string {
    const sorted = [...violations]
      .sort((a, b) => `${a.ruleId}:${a.file}`.localeCompare(`${b.ruleId}:${b.file}`));

    const crypto = require('crypto');
    const str = JSON.stringify(sorted.map(v => ({ r: v.ruleId, f: v.file })));
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
  }
}
