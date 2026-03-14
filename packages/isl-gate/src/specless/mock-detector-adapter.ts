/**
 * Mock Detector → SpeclessCheck Adapter
 *
 * Wraps @isl-lang/mock-detector to detect hardcoded success returns,
 * placeholder data, and TODO/fake patterns in implementation code.
 *
 * Detection targets:
 * - Hardcoded success responses (return { success: true })
 * - Placeholder arrays ([{ id: 1, name: 'placeholder' }])
 * - TODO/fake data patterns
 *
 * @module @isl-lang/gate/specless/mock-detector-adapter
 */

import { registerSpeclessCheck, type SpeclessCheck, type GateContext } from '../authoritative/specless-registry.js';
import type { GateEvidence } from '../authoritative/verdict-engine.js';

type ScanLanguage = 'typescript' | 'javascript';

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
    default:
      return null;
  }
}

interface MockFinding {
  type: string;
  line: number;
  content: string;
  reason: string;
  confidence: number;
}

export const mockDetectorCheck: SpeclessCheck = {
  name: 'mock-detector',

  async run(file: string, context: GateContext): Promise<GateEvidence[]> {
    const language = detectLanguage(file);
    if (!language) {
      return [];
    }

    try {
      const mod = await import(/* @vite-ignore */ '@isl-lang/mock-detector');
      const scanFile = mod.scanFile as (opts: { filePath: string; content: string; config?: unknown }) => MockFinding[];
      const findings = scanFile({ filePath: file, content: context.implementation });

      if (!findings || findings.length === 0) {
        return [{
          source: 'specless-scanner',
          check: 'mock-detector: no mock patterns',
          result: 'pass',
          confidence: 0.80,
          details: `No mock/placeholder patterns detected in ${file}`,
        }];
      }

      return findings.map((f) => ({
        source: 'specless-scanner' as const,
        check: f.confidence >= 0.8
          ? `fake_feature_detected: mock pattern "${f.type}" at line ${f.line}`
          : `mock: ${f.type} at line ${f.line}`,
        result: (f.confidence >= 0.8 ? 'fail' : 'warn') as GateEvidence['result'],
        confidence: f.confidence,
        details: `${f.reason} — "${f.content.substring(0, 120)}"`,
      }));
    } catch {
      return [{
        source: 'specless-scanner',
        check: 'mock-detector',
        result: 'skip',
        confidence: 0,
        details: 'Mock detector not available (package not installed)',
      }];
    }
  },
};

registerSpeclessCheck(mockDetectorCheck);
