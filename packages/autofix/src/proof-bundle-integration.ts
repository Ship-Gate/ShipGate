/**
 * Proof Bundle Integration
 * 
 * Integrates applied patches metadata into proof bundle artifacts.
 */

import type { ShipgateFixSuggestion } from './shipgate-fixes.js';
import type { ApplyPatchesResult } from './patch-engine.js';

/**
 * Metadata for applied patches in proof bundle
 */
export interface AppliedPatchesMetadata {
  /** Timestamp when patches were applied */
  appliedAt: string;
  /** Total number of patches applied */
  totalApplied: number;
  /** Total number of patches failed */
  totalFailed: number;
  /** Files modified */
  filesModified: string[];
  /** Patches applied */
  patches: Array<{
    rule: string;
    why: string;
    file: string;
    line: number;
    confidence: number;
  }>;
  /** Unified diff of all changes */
  diff?: string;
}

/**
 * Create applied patches metadata from fix suggestions and apply result
 */
export function createPatchesMetadata(
  suggestions: ShipgateFixSuggestion[],
  applyResult: ApplyPatchesResult
): AppliedPatchesMetadata {
  return {
    appliedAt: new Date().toISOString(),
    totalApplied: applyResult.applied.length,
    totalFailed: applyResult.failed.length,
    filesModified: applyResult.filesModified,
    patches: suggestions
      .filter(s => applyResult.applied.some(p => p === s.patch))
      .map(s => ({
        rule: s.rule,
        why: s.why,
        file: s.patch.file,
        line: s.patch.line,
        confidence: s.confidence,
      })),
    diff: applyResult.diff || undefined,
  };
}

/**
 * Add patches metadata to proof bundle artifacts
 */
export function addPatchesToProofBundle(
  bundle: {
    artifacts?: Record<string, unknown>;
  },
  metadata: AppliedPatchesMetadata
): void {
  if (!bundle.artifacts) {
    bundle.artifacts = {};
  }

  bundle.artifacts['appliedPatches'] = metadata;
}
