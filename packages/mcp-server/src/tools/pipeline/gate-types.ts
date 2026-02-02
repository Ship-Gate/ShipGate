// ============================================================================
// ISL MCP Server - Gate Tool Types (SHIP/NO-SHIP)
// ============================================================================

import { createHash } from 'crypto';

/**
 * Gate decision: SHIP or NO-SHIP
 */
export type GateDecision = 'SHIP' | 'NO-SHIP';

/**
 * Evidence artifact in the proof bundle
 */
export interface EvidenceArtifact {
  /** Artifact type */
  type: 'spec' | 'test' | 'log' | 'report' | 'coverage';
  /** Relative path */
  path: string;
  /** SHA-256 hash of content */
  hash: string;
  /** Size in bytes */
  sizeBytes: number;
}

/**
 * Clause-by-clause verification result
 */
export interface ClauseResult {
  /** Clause identifier */
  id: string;
  /** Clause type */
  type: 'precondition' | 'postcondition' | 'invariant' | 'scenario';
  /** Human-readable description */
  description: string;
  /** Pass/fail status */
  status: 'passed' | 'failed' | 'skipped';
  /** Error message if failed */
  error?: string;
  /** Execution time in ms */
  durationMs?: number;
}

/**
 * Manifest for the evidence bundle (deterministic fingerprint)
 */
export interface EvidenceManifest {
  /** Deterministic fingerprint of the entire evidence bundle */
  fingerprint: string;
  /** ISL version used */
  islVersion: string;
  /** Spec file hash */
  specHash: string;
  /** Implementation hash */
  implHash: string;
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Input hashes for reproducibility */
  inputs: {
    spec: string;
    implementation: string;
    config?: string;
  };
  /** Artifact list */
  artifacts: EvidenceArtifact[];
}

/**
 * Verification results in JSON format
 */
export interface EvidenceResults {
  /** Gate decision */
  decision: GateDecision;
  /** Trust score (0-100) */
  trustScore: number;
  /** Confidence (0-100) */
  confidence: number;
  /** Clause-by-clause results */
  clauses: ClauseResult[];
  /** Summary counts */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  /** Category breakdown */
  categories: {
    preconditions: { passed: number; failed: number; total: number };
    postconditions: { passed: number; failed: number; total: number };
    invariants: { passed: number; failed: number; total: number };
    scenarios: { passed: number; failed: number; total: number };
  };
  /** Blocking issues that caused NO-SHIP */
  blockers: Array<{
    clause: string;
    reason: string;
    severity: 'critical' | 'high' | 'medium';
  }>;
}

/**
 * Input for isl_gate tool
 */
export interface GateInput {
  /** ISL spec source or path */
  spec: string;
  /** Implementation source or path */
  implementation: string;
  /** Workspace path for output */
  workspacePath?: string;
  /** Minimum trust score to SHIP (default: 95) */
  threshold?: number;
  /** Whether to write evidence bundle to disk (default: true) */
  writeBundle?: boolean;
  /** Custom config for verification */
  config?: {
    /** Test framework */
    framework?: 'vitest' | 'jest';
    /** Timeout per test in ms */
    timeout?: number;
    /** Allow skipped tests */
    allowSkipped?: boolean;
  };
}

/**
 * Result for isl_gate tool
 */
export interface GateResult {
  /** The gate decision */
  decision: GateDecision;
  /** Exit code (0 = SHIP, 1 = NO-SHIP) */
  exitCode: 0 | 1;
  /** Trust score */
  trustScore: number;
  /** Confidence level */
  confidence: number;
  /** Human-readable summary */
  summary: string;
  /** Path to evidence bundle (if written) */
  bundlePath?: string;
  /** Evidence manifest (fingerprint for verification) */
  manifest?: EvidenceManifest;
  /** Detailed results */
  results?: EvidenceResults;
  /** Error if gate couldn't run */
  error?: string;
  /** Suggestion for fixing issues */
  suggestion?: string;
}

/**
 * Schema for MCP tool registration
 */
export const GATE_TOOL_SCHEMA = {
  name: 'isl_gate',
  description: `SHIP/NO-SHIP gate for AI-generated code. Verifies implementation against ISL spec and returns a deterministic decision with evidence bundle.

Returns:
- decision: "SHIP" or "NO-SHIP"
- exitCode: 0 (SHIP) or 1 (NO-SHIP) - use in CI
- trustScore: 0-100 overall score
- evidence bundle: manifest.json, results.json, report.html, artifacts/

Use this as the final check before merging AI-generated code.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      spec: {
        type: 'string' as const,
        description: 'ISL specification source code or file path',
      },
      implementation: {
        type: 'string' as const,
        description: 'Implementation source code or file path',
      },
      workspacePath: {
        type: 'string' as const,
        description: 'Workspace root for evidence bundle output (default: current directory)',
      },
      threshold: {
        type: 'number' as const,
        description: 'Minimum trust score to SHIP (default: 95)',
      },
      writeBundle: {
        type: 'boolean' as const,
        description: 'Write evidence bundle to disk (default: true)',
      },
      config: {
        type: 'object' as const,
        description: 'Optional verification configuration',
        properties: {
          framework: {
            type: 'string' as const,
            enum: ['vitest', 'jest'],
            description: 'Test framework',
          },
          timeout: {
            type: 'number' as const,
            description: 'Timeout per test in ms',
          },
          allowSkipped: {
            type: 'boolean' as const,
            description: 'Allow skipped tests to pass gate',
          },
        },
      },
    },
    required: ['spec', 'implementation'],
  },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate SHA-256 hash of content
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Generate deterministic fingerprint from manifest data
 */
export function generateFingerprint(
  specHash: string,
  implHash: string,
  resultsHash: string,
  islVersion: string
): string {
  const data = `${specHash}:${implHash}:${resultsHash}:${islVersion}`;
  return createHash('sha256').update(data, 'utf-8').digest('hex').slice(0, 16);
}
