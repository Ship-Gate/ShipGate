/**
 * ISL Evidence - Type Definitions
 * 
 * @module @isl-lang/evidence
 */

import type { GateResult, Finding, GateReason } from '@isl-lang/gate';

/**
 * Evidence bundle manifest
 */
export interface EvidenceManifest {
  /** Evidence pack version */
  version: string;
  /** When the evidence was generated */
  generatedAt: string;
  /** Gate version that produced this */
  gateVersion: string;
  /** Input fingerprint */
  fingerprint: string;
  /** Project info */
  project: {
    root: string;
    name?: string;
  };
  /** Files in the bundle */
  files: string[];
}

/**
 * Evidence results - detailed clause-level results
 */
export interface EvidenceResults {
  /** Overall verdict */
  verdict: 'SHIP' | 'NO_SHIP';
  /** Overall score */
  score: number;
  /** Summary counts */
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    filesScanned: number;
    filesConsidered: number;
  };
  /** Detailed findings */
  findings: Finding[];
  /** Gate reasons */
  reasons: GateReason[];
  /** Duration in ms */
  durationMs: number;
}

/**
 * Evidence bundle - complete bundle structure
 */
export interface EvidenceBundle {
  /** Bundle manifest */
  manifest: EvidenceManifest;
  /** Results data */
  results: EvidenceResults;
  /** HTML report content */
  reportHtml: string;
  /** Artifacts (additional data) */
  artifacts: Record<string, unknown>;
}

/**
 * Options for generating evidence
 */
export interface EvidenceOptions {
  /** Output directory */
  outputDir: string;
  /** Project root */
  projectRoot: string;
  /** Project name */
  projectName?: string;
  /** Include HTML report */
  includeHtmlReport?: boolean;
  /** Include artifacts */
  includeArtifacts?: boolean;
  /** Deterministic mode (no timestamps) */
  deterministic?: boolean;
}
