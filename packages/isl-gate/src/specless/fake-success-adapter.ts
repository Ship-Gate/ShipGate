/**
 * Fake Success UI Detector — Inlined SpeclessCheck
 *
 * Detects fake-success anti-patterns directly without an external package:
 *   - try/catch blocks that emit success toasts or set success state in the catch
 *   - .catch() callbacks that return a success-shaped object
 *   - Error handlers that hard-code { success: true } / { status: 'ok' }
 *   - Fire-and-forget async calls with no error propagation
 *
 * Fail-closed: if the file is scannable and cannot be read, returns a failure.
 *
 * @module @isl-lang/gate/specless/fake-success-adapter
 */

import { readFileSync } from 'fs';
import {
  registerSpeclessCheck,
  type SpeclessCheck,
  type GateContext,
} from '../authoritative/specless-registry.js';
import type { GateEvidence } from '../authoritative/verdict-engine.js';

function isUIFile(file: string): boolean {
  const ext = file.split('.').pop()?.toLowerCase();
  return ['ts', 'tsx', 'js', 'jsx'].includes(ext ?? '');
}

interface InlineFinding {
  type: string;
  line: number;
  description: string;
  confidence: number;
}

const CATCH_SUCCESS_PATTERNS: Array<{ re: RegExp; type: string; desc: string; confidence: number }> = [
  {
    re: /catch\s*\([^)]*\)\s*\{[^}]*(?:toast|notify|alert|setSuccess|showSuccess|onSuccess|dispatch.*SUCCESS)[^}]*\}/gs,
    type: 'catch_emits_success',
    desc: 'catch block emits a success notification — error is swallowed and user sees false success',
    confidence: 0.90,
  },
  {
    re: /catch\s*\([^)]*\)\s*\{[^}]*return\s*\{[^}]*success\s*:\s*true[^}]*\}/gs,
    type: 'catch_returns_success_object',
    desc: 'catch block returns { success: true } — caller will treat the error as success',
    confidence: 0.95,
  },
  {
    re: /\.catch\s*\(\s*(?:\(\s*\w*\s*\)\s*=>|\function[^)]*\))\s*\{?[^}]*(?:resolve\s*\(\s*\{[^}]*success\s*:\s*true|return\s*\{[^}]*success\s*:\s*true)[^}]*\}?\s*\)/gs,
    type: 'promise_catch_resolves_success',
    desc: '.catch() resolves the promise with a success value — errors are hidden from callers',
    confidence: 0.92,
  },
  {
    re: /catch\s*\([^)]*\)\s*\{[^}]*(?:status\s*=\s*['"](?:success|ok|200)['"]|setState\s*\(\s*\{[^}]*(?:loading\s*:\s*false|error\s*:\s*null|success\s*:\s*true))[^}]*\}/gs,
    type: 'catch_sets_success_state',
    desc: 'catch block sets success/ok UI state — user sees success even when the operation failed',
    confidence: 0.88,
  },
  {
    re: /catch\s*\([^)]*\)\s*\{\s*(?:\/\/[^\n]*)?\s*\}/g,
    type: 'empty_catch_block',
    desc: 'empty catch block — errors are silently swallowed',
    confidence: 0.75,
  },
  {
    re: /catch\s*\([^)]*\)\s*\{[^}]*console\.(?:log|warn|info)\b[^}]*\}/gs,
    type: 'catch_console_only',
    desc: 'catch block only logs to console — no error propagation or user feedback',
    confidence: 0.65,
  },
];

function detectFakeSuccessInline(content: string): InlineFinding[] {
  const findings: InlineFinding[] = [];
  const lines = content.split('\n');

  for (const { re, type, desc, confidence } of CATCH_SUCCESS_PATTERNS) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const lineNum = content.slice(0, match.index).split('\n').length;
      const snippet = lines[lineNum - 1]?.trim() ?? '';
      if (snippet.startsWith('//') || snippet.startsWith('*')) continue;
      findings.push({ type, line: lineNum, description: `${desc} (line ${lineNum})`, confidence });
    }
  }

  return findings;
}

export const fakeSuccessCheck: SpeclessCheck = {
  name: 'fake-success-ui-detector',

  async run(file: string, context: GateContext): Promise<GateEvidence[]> {
    if (!isUIFile(file)) {
      return [];
    }

    let content: string;
    try {
      content = context.implementation?.length
        ? context.implementation
        : readFileSync(file, 'utf-8');
    } catch {
      return [{
        source: 'specless-scanner',
        check: 'fake-success-ui-detector',
        result: 'fail',
        confidence: 0.5,
        details: `Could not read file for fake-success analysis: ${file}`,
      }];
    }

    const findings = detectFakeSuccessInline(content);

    if (findings.length === 0) {
      return [{
        source: 'specless-scanner',
        check: 'fake-success-ui: no fake success patterns',
        result: 'pass',
        confidence: 0.80,
        details: `No fake success UI patterns detected in ${file}`,
      }];
    }

    return findings.map((f) => ({
      source: 'specless-scanner' as const,
      check: `fake_feature_detected: ${f.type} at line ${f.line}`,
      result: 'fail' as const,
      confidence: f.confidence,
      details: f.description,
    }));
  },
};

registerSpeclessCheck(fakeSuccessCheck);
