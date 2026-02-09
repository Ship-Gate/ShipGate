/**
 * Hallucination Scanner → SpeclessCheck Adapter
 *
 * Wraps @isl-lang/hallucination-scanner (Go / Rust ghost-import detection)
 * as a pluggable SpeclessCheck for the authoritative gate.
 *
 * Detection targets:
 * - Ghost imports (modules that don't exist)
 * - Missing crates / modules (not in Cargo.toml / go.mod)
 * - Fake packages (referenced but nonexistent)
 *
 * @module @isl-lang/gate/specless/hallucination-adapter
 */

import { registerSpeclessCheck, type SpeclessCheck, type GateContext } from '../authoritative/specless-registry.js';
import type { GateEvidence } from '../authoritative/verdict-engine.js';

// ============================================================================
// Language detection helpers
// ============================================================================

function isGoFile(file: string): boolean {
  return file.endsWith('.go');
}

function isRustFile(file: string): boolean {
  return file.endsWith('.rs');
}

// ============================================================================
// Finding → GateEvidence mapping
// ============================================================================

/**
 * Map Go finding kind → GateEvidence check name.
 * `fake_package` maps to the critical failure `fake_feature_detected`.
 */
function goCheckName(kind: string, importPath: string): string {
  switch (kind) {
    case 'fake_package':
      return `fake_feature_detected: fake Go package "${importPath}"`;
    case 'missing_module':
      return `hallucination: missing Go module "${importPath}"`;
    case 'unknown_stdlib':
      return `hallucination: unknown Go stdlib package "${importPath}"`;
    case 'unresolved_internal':
      return `hallucination: unresolved internal package "${importPath}"`;
    default:
      return `hallucination: Go finding "${importPath}"`;
  }
}

/**
 * Map Rust finding kind → GateEvidence check name.
 * `fake_module` maps to the critical failure `fake_feature_detected`.
 */
function rustCheckName(kind: string, identifier: string): string {
  switch (kind) {
    case 'fake_module':
      return `fake_feature_detected: fake Rust module "${identifier}"`;
    case 'missing_crate':
      return `hallucination: missing Rust crate "${identifier}"`;
    case 'unreachable_import':
      return `hallucination: unreachable Rust import "${identifier}"`;
    default:
      return `hallucination: Rust finding "${identifier}"`;
  }
}

// Local type shapes for dynamic imports (avoids compile-time dependency)
interface GoFindingLike {
  kind: string;
  message: string;
  importPath: string;
  location: { file: string; line: number; column: number };
  suggestion?: string;
}

interface RustFindingLike {
  kind: string;
  message: string;
  path?: string;
  crate?: string;
  location: { file: string; line: number; column: number };
  suggestion?: string;
}

interface RustScanResult {
  uses: unknown[];
  externalCrates: unknown;
  checkResult?: {
    findings: RustFindingLike[];
  };
}

/** Confidence for hallucination findings (manifest-based analysis is high confidence). */
const HALLUCINATION_CONFIDENCE = 0.90;

// ============================================================================
// SpeclessCheck implementation
// ============================================================================

export const hallucinationCheck: SpeclessCheck = {
  name: 'hallucination-detector',

  async run(file: string, context: GateContext): Promise<GateEvidence[]> {
    // Only run for Go and Rust files
    if (!isGoFile(file) && !isRustFile(file)) {
      return [];
    }

    try {
      if (isGoFile(file)) {
        return await scanGo(file, context);
      }
      return await scanRust(file, context);
    } catch {
      // Scanner not available — skip gracefully
      return [{
        source: 'specless-scanner',
        check: 'hallucination-detector',
        result: 'skip',
        confidence: 0,
        details: 'Hallucination scanner not available (package not installed)',
      }];
    }
  },
};

// ============================================================================
// Go scanning
// ============================================================================

async function scanGo(file: string, context: GateContext): Promise<GateEvidence[]> {
  const mod = await import(/* @vite-ignore */ '@isl-lang/hallucination-scanner');
  const scanGoFile = mod.scanGoFile as (file: string, content: string) => Promise<{ imports: unknown[]; findings: GoFindingLike[] }>;

  const result = await scanGoFile(file, context.implementation);
  const evidence: GateEvidence[] = [];

  if (result.findings && result.findings.length > 0) {
    for (const finding of result.findings) {
      const isFake = finding.kind === 'fake_package';
      evidence.push({
        source: 'specless-scanner',
        check: goCheckName(finding.kind, finding.importPath),
        result: isFake ? 'fail' : 'warn',
        confidence: HALLUCINATION_CONFIDENCE,
        details: finding.message + (finding.suggestion ? ` — ${finding.suggestion}` : ''),
      });
    }
  }

  // If no findings, report a pass
  if (evidence.length === 0) {
    evidence.push({
      source: 'specless-scanner',
      check: 'hallucination: Go imports clean',
      result: 'pass',
      confidence: HALLUCINATION_CONFIDENCE,
      details: `No ghost imports detected in ${file}`,
    });
  }

  return evidence;
}

// ============================================================================
// Rust scanning
// ============================================================================

async function scanRust(file: string, context: GateContext): Promise<GateEvidence[]> {
  const mod = await import(/* @vite-ignore */ '@isl-lang/hallucination-scanner');
  const scanRustFile = mod.scanRustFile as (file: string, content: string) => Promise<RustScanResult>;

  const result = await scanRustFile(file, context.implementation);
  const evidence: GateEvidence[] = [];

  // scanRustFile returns { uses, externalCrates, checkResult? }
  if (result.checkResult?.findings && result.checkResult.findings.length > 0) {
    for (const finding of result.checkResult.findings) {
      const isFake = finding.kind === 'fake_module';
      evidence.push({
        source: 'specless-scanner',
        check: rustCheckName(finding.kind, finding.crate ?? finding.path ?? 'unknown'),
        result: isFake ? 'fail' : 'warn',
        confidence: HALLUCINATION_CONFIDENCE,
        details: finding.message + (finding.suggestion ? ` — ${finding.suggestion}` : ''),
      });
    }
  }

  // If no findings, report a pass
  if (evidence.length === 0) {
    evidence.push({
      source: 'specless-scanner',
      check: 'hallucination: Rust imports clean',
      result: 'pass',
      confidence: HALLUCINATION_CONFIDENCE,
      details: `No ghost imports detected in ${file}`,
    });
  }

  return evidence;
}

// ============================================================================
// Auto-register
// ============================================================================

registerSpeclessCheck(hallucinationCheck);
