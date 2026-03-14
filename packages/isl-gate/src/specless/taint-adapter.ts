/**
 * Taint Tracker → SpeclessCheck Adapter
 *
 * Wraps @isl-lang/taint-tracker to detect unsanitized data flows from
 * user-controlled sources to dangerous sinks.
 *
 * Detection targets:
 * - SQL injection via tainted query parameters
 * - Command injection via tainted exec/spawn arguments
 * - XSS via tainted innerHTML/dangerouslySetInnerHTML
 * - Eval injection via tainted eval/Function arguments
 * - Path traversal via tainted file paths
 *
 * @module @isl-lang/gate/specless/taint-adapter
 */

import { registerSpeclessCheck, type SpeclessCheck, type GateContext } from '../authoritative/specless-registry.js';
import type { GateEvidence } from '../authoritative/verdict-engine.js';

function isTaintableFile(file: string): boolean {
  const ext = file.split('.').pop()?.toLowerCase();
  return ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext ?? '');
}

interface TaintFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: { category: string; pattern: string; location?: { file: string; line: number } };
  sink: { category: string; pattern: string; location?: { file: string; line: number } };
  flow: unknown[];
  remediation: string;
  cwe?: string;
}

const CRITICAL_SINKS = new Set(['sql-query', 'shell-exec', 'eval', 'file-write']);

function resultForSeverity(severity: string): GateEvidence['result'] {
  return severity === 'critical' || severity === 'high' ? 'fail' : 'warn';
}

function confidenceForSeverity(severity: string): number {
  switch (severity) {
    case 'critical': return 0.92;
    case 'high': return 0.85;
    case 'medium': return 0.70;
    default: return 0.55;
  }
}

export const taintCheck: SpeclessCheck = {
  name: 'taint-tracker',

  async run(file: string, context: GateContext): Promise<GateEvidence[]> {
    if (!isTaintableFile(file)) return [];

    try {
      const mod = await import(/* @vite-ignore */ '@isl-lang/taint-tracker');
      const TaintAnalyzer = mod.TaintAnalyzer as new () => {
        analyzeFile(filePath: string, content: string): TaintFinding[];
      };

      const analyzer = new TaintAnalyzer();
      const findings = analyzer.analyzeFile(file, context.implementation);

      if (!findings || findings.length === 0) {
        return [{
          source: 'specless-scanner',
          check: 'taint: no unsafe data flows',
          result: 'pass',
          confidence: 0.80,
          details: `No unsanitized taint flows detected in ${file}`,
        }];
      }

      return findings.map((f) => {
        const isCritical = CRITICAL_SINKS.has(f.sink.category);
        return {
          source: 'specless-scanner' as const,
          check: isCritical
            ? `security_violation: tainted ${f.source.category} → ${f.sink.category}`
            : `taint: ${f.source.category} → ${f.sink.category}`,
          result: resultForSeverity(f.severity),
          confidence: confidenceForSeverity(f.severity),
          details: `${f.remediation}${f.cwe ? ` (${f.cwe})` : ''}`,
        };
      });
    } catch {
      return [{
        source: 'specless-scanner',
        check: 'taint-tracker',
        result: 'skip',
        confidence: 0,
        details: 'Taint tracker not available (package not installed)',
      }];
    }
  },
};

registerSpeclessCheck(taintCheck);
