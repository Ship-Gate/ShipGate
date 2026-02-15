/**
 * Proof Bundle v1 — Deterministic, Hashable, Verifiable Bundles
 * 
 * Spec summary
 * ────────────
 * A **ProofBundleV1** is a self-contained JSON document that captures:
 *   • verdicts  – gate / build / test / verify outcomes
 *   • claims    – clause-level satisfaction assertions
 *   • traces    – references to execution trace files
 *   • evidence  – postcondition / invariant evaluation results
 * 
 * Hashing rules (canonical JSON):
 *   1. Object keys sorted lexicographically at every depth level
 *   2. Line endings normalized to LF (\n)
 *   3. NaN / Infinity → null; undefined → omitted
 *   4. Compact JSON (no whitespace) feeds into SHA-256
 *   5. The `bundleHash` and `signature` fields are excluded before hashing
 * 
 * Determinism guarantee:
 *   createBundle(inputs) called twice with identical inputs
 *   ⇒ identical `bundleHash` values.
 * 
 * Tamper detection:
 *   verifyBundle(bundle) re-derives the hash and compares it to the stored
 *   `bundleHash`. Any modification to any artifact causes verification to fail.
 * 
 * @module @isl-lang/proof
 */

import * as crypto from 'crypto';
import { canonicalJsonCompact, canonicalJsonStringify } from './canonical-json.js';

// ============================================================================
// ProofBundle v1 Schema
// ============================================================================

/** Verdict for a single claim / clause */
export type ClaimStatus = 'proven' | 'not_proven' | 'violated' | 'unknown';

/** Top-level bundle verdict */
export type BundleVerdict = 'PROVEN' | 'INCOMPLETE_PROOF' | 'VIOLATED' | 'UNPROVEN';

/**
 * A single claim: an assertion about a clause in the spec
 */
export interface BundleClaim {
  /** Unique clause identifier (e.g. "login:postcondition:1") */
  clauseId: string;
  /** Clause type */
  clauseType: 'precondition' | 'postcondition' | 'invariant' | 'intent';
  /** Parent behavior (if applicable) */
  behavior?: string;
  /** Claim status */
  status: ClaimStatus;
  /** Human-readable reason */
  reason?: string;
  /** Trace IDs used as evidence */
  traceIds?: string[];
  /** Source location */
  source?: {
    file: string;
    line: number;
    column?: number;
  };
}

/**
 * Verdict artifact — outcome of a verification phase
 */
export interface BundleVerdictArtifact {
  /** Phase name (gate, build, test, verify) */
  phase: string;
  /** Phase verdict */
  verdict: string;
  /** Numeric score (0-100, if applicable) */
  score?: number;
  /** Detail fields (phase-specific) */
  details: Record<string, unknown>;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Trace reference — pointer to an execution trace file
 */
export interface BundleTraceRef {
  /** Unique trace ID */
  traceId: string;
  /** Behavior exercised */
  behavior: string;
  /** Originating test name */
  testName: string;
  /** Relative path to trace file inside the bundle directory */
  tracePath: string;
  /** Number of events in the trace */
  eventCount: number;
}

/**
 * Evidence artifact — evaluation of postconditions / invariants
 */
export interface BundleEvidence {
  /** Clause ID this evidence pertains to */
  clauseId: string;
  /** Evidence type */
  evidenceType: 'test' | 'trace' | 'static_analysis' | 'smt' | 'manual';
  /** Whether the clause was satisfied */
  satisfied: boolean;
  /** Confidence 0–1 */
  confidence: number;
  /** Evidence-specific payload */
  payload?: Record<string, unknown>;
}

/**
 * ProofBundle v1 — the top-level document
 */
export interface ProofBundleV1 {
  /** Schema version — always "1.0.0" for v1 bundles */
  schemaVersion: '1.0.0';

  /** Deterministic SHA-256 hash of the canonical bundle (hex, 64 chars) */
  bundleHash: string;

  /** Spec metadata */
  spec: {
    /** Domain name */
    domain: string;
    /** Spec version */
    version: string;
    /** SHA-256 of spec file content */
    specHash: string;
    /** Relative path to spec file */
    specPath?: string;
  };

  /** Verdicts from each verification phase */
  verdicts: BundleVerdictArtifact[];

  /** Clause-level claims */
  claims: BundleClaim[];

  /** Trace references */
  traces: BundleTraceRef[];

  /** Evidence artifacts */
  evidence: BundleEvidence[];

  /** Aggregate verdict */
  verdict: BundleVerdict;

  /** Human-readable verdict reason */
  verdictReason: string;

  /** ISO 8601 timestamp (caller-supplied for determinism) */
  createdAt: string;

  /** HMAC-SHA256 signature (excluded from hash computation) */
  signature?: string;

  /** Optional SOC2 CC-series control mapping for auditor consumption */
  soc2Controls?: SOC2ControlEntry[];
}

/**
 * SOC2 control entry — maps proof bundle evidence to SOC2 Trust Services Criteria.
 * Used when proof pack is run with --include-soc2.
 */
export interface SOC2ControlEntry {
  controlId: string;
  controlName: string;
  description: string;
  status: 'pass' | 'warn' | 'fail';
  contributingChecks: Array<{
    checkId: string;
    checkName: string;
    passed: boolean;
    impact: 'positive' | 'negative';
  }>;
  evidenceRefs: Array<{
    type: string;
    ref: string;
    description?: string;
  }>;
}

// ============================================================================
// Input type for createBundle
// ============================================================================

export interface CreateBundleInput {
  spec: ProofBundleV1['spec'];
  verdicts: BundleVerdictArtifact[];
  claims: BundleClaim[];
  traces: BundleTraceRef[];
  evidence: BundleEvidence[];
  /** Caller must supply a fixed timestamp for determinism */
  createdAt: string;
  /** Optional HMAC secret to sign the bundle */
  signSecret?: string;
  /** Optional SOC2 control mapping (included when provided) */
  soc2Controls?: SOC2ControlEntry[];
}

// ============================================================================
// Core APIs
// ============================================================================

/**
 * Compute the SHA-256 hash of the bundle's hashable content.
 * 
 * The following fields are EXCLUDED from the hash:
 *   - `bundleHash`  (it's the output)
 *   - `signature`   (appended after hashing)
 * 
 * Everything else is serialized to compact canonical JSON (sorted keys,
 * LF line endings) and fed through SHA-256.
 */
export function bundleHash(bundle: ProofBundleV1): string {
  const hashable = extractHashableContent(bundle);
  const canonical = canonicalJsonCompact(hashable);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Create a proof bundle from inputs.
 * 
 * Determinism guarantee: calling with identical inputs always yields the
 * same `bundleHash`.
 */
export function createBundle(input: CreateBundleInput): ProofBundleV1 {
  // Derive verdict from claims
  const { verdict, reason } = deriveVerdict(input.claims, input.verdicts);

  // Build the bundle (without hash and signature)
  const bundle: ProofBundleV1 = {
    schemaVersion: '1.0.0',
    bundleHash: '', // placeholder
    spec: input.spec,
    verdicts: input.verdicts,
    claims: input.claims,
    traces: input.traces,
    evidence: input.evidence,
    verdict,
    verdictReason: reason,
    createdAt: input.createdAt,
    ...(input.soc2Controls && { soc2Controls: input.soc2Controls }),
  };

  // Compute deterministic hash
  bundle.bundleHash = bundleHash(bundle);

  // Optionally sign
  if (input.signSecret) {
    bundle.signature = signBundle(bundle, input.signSecret);
  }

  return bundle;
}

/**
 * Verify a proof bundle's integrity.
 * 
 * Checks:
 *   1. Schema version is supported
 *   2. bundleHash matches re-derived hash (tamper detection)
 *   3. Signature is valid (if present and secret provided)
 *   4. Verdict is consistent with claims and verdicts
 * 
 * Returns a detailed result with pass/fail for each check.
 */
export function verifyBundle(
  bundle: ProofBundleV1,
  options: { signSecret?: string } = {},
): VerifyBundleResult {
  const checks: VerifyBundleCheck[] = [];

  // 1. Schema version
  const schemaOk = bundle.schemaVersion === '1.0.0';
  checks.push({
    name: 'schema_version',
    passed: schemaOk,
    message: schemaOk
      ? 'Schema version is 1.0.0'
      : `Unsupported schema version: ${bundle.schemaVersion}`,
  });

  // 2. Hash integrity
  const expectedHash = bundleHash(bundle);
  const hashOk = bundle.bundleHash === expectedHash;
  checks.push({
    name: 'hash_integrity',
    passed: hashOk,
    message: hashOk
      ? `Hash verified: ${bundle.bundleHash.slice(0, 16)}...`
      : `Hash mismatch: expected ${expectedHash.slice(0, 16)}..., got ${bundle.bundleHash.slice(0, 16)}...`,
    expected: expectedHash,
    actual: bundle.bundleHash,
  });

  // 3. Signature (if present)
  let signatureOk: boolean | null = null;
  if (bundle.signature) {
    if (options.signSecret) {
      const expectedSig = signBundle(bundle, options.signSecret);
      signatureOk = bundle.signature === expectedSig;
      checks.push({
        name: 'signature',
        passed: signatureOk,
        message: signatureOk
          ? 'Signature verified'
          : 'Signature mismatch — bundle may have been tampered with or wrong secret',
      });
    } else {
      checks.push({
        name: 'signature',
        passed: true,
        message: 'Bundle is signed but no secret provided — skipping signature check',
      });
    }
  }

  // 4. Verdict consistency
  const { verdict: expectedVerdict } = deriveVerdict(bundle.claims, bundle.verdicts);
  const verdictOk = bundle.verdict === expectedVerdict;
  checks.push({
    name: 'verdict_consistency',
    passed: verdictOk,
    message: verdictOk
      ? `Verdict consistent: ${bundle.verdict}`
      : `Verdict mismatch: stored ${bundle.verdict}, derived ${expectedVerdict}`,
  });

  const allPassed = checks.every(c => c.passed);

  return {
    valid: allPassed,
    bundleHash: bundle.bundleHash,
    verdict: bundle.verdict,
    signatureValid: signatureOk,
    checks,
    summary: {
      totalChecks: checks.length,
      passedChecks: checks.filter(c => c.passed).length,
      failedChecks: checks.filter(c => !c.passed).length,
    },
  };
}

/**
 * Serialize a bundle to canonical JSON (pretty-printed, suitable for writing to disk).
 */
export function serializeBundle(bundle: ProofBundleV1): string {
  return canonicalJsonStringify(bundle);
}

/**
 * Parse and validate a bundle from a JSON string.
 */
export function parseBundle(json: string): ProofBundleV1 {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid proof bundle: not a JSON object');
  }
  if (parsed.schemaVersion !== '1.0.0') {
    throw new Error(`Unsupported proof bundle schema version: ${parsed.schemaVersion}`);
  }
  if (typeof parsed.bundleHash !== 'string') {
    throw new Error('Invalid proof bundle: missing bundleHash');
  }
  return parsed as ProofBundleV1;
}

// ============================================================================
// Result types
// ============================================================================

export interface VerifyBundleCheck {
  name: string;
  passed: boolean;
  message: string;
  expected?: string;
  actual?: string;
}

export interface VerifyBundleResult {
  /** Overall pass/fail */
  valid: boolean;
  /** Bundle hash */
  bundleHash: string;
  /** Stored verdict */
  verdict: BundleVerdict;
  /** Signature validity (null if no signature) */
  signatureValid: boolean | null;
  /** Individual checks */
  checks: VerifyBundleCheck[];
  /** Summary */
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Extract the hashable portion of a bundle.
 * Excludes `bundleHash` and `signature`.
 */
function extractHashableContent(bundle: ProofBundleV1): Record<string, unknown> {
  const { bundleHash: _h, signature: _s, ...rest } = bundle;
  return rest as Record<string, unknown>;
}

/**
 * Derive the aggregate verdict from claims and phase verdicts.
 */
function deriveVerdict(
  claims: BundleClaim[],
  verdicts: BundleVerdictArtifact[],
): { verdict: BundleVerdict; reason: string } {
  // Check for violated claims
  const violated = claims.filter(c => c.status === 'violated');
  if (violated.length > 0) {
    return {
      verdict: 'VIOLATED',
      reason: `${violated.length} claim(s) violated: ${violated.map(c => c.clauseId).join(', ')}`,
    };
  }

  // Check phase verdicts for failures
  const gateVerdict = verdicts.find(v => v.phase === 'gate');
  if (gateVerdict && gateVerdict.verdict === 'NO_SHIP') {
    return {
      verdict: 'VIOLATED',
      reason: `Gate verdict: NO_SHIP`,
    };
  }

  const buildVerdict = verdicts.find(v => v.phase === 'build');
  if (buildVerdict && buildVerdict.verdict === 'fail') {
    return {
      verdict: 'VIOLATED',
      reason: `Build failed`,
    };
  }

  const testVerdict = verdicts.find(v => v.phase === 'test');
  if (testVerdict && testVerdict.verdict === 'fail') {
    return {
      verdict: 'VIOLATED',
      reason: `Tests failed`,
    };
  }

  // Check for unknown / not_proven claims → INCOMPLETE_PROOF
  const unknown = claims.filter(c => c.status === 'unknown');
  const notProven = claims.filter(c => c.status === 'not_proven');
  if (unknown.length > 0 || notProven.length > 0) {
    const parts: string[] = [];
    if (unknown.length > 0) parts.push(`${unknown.length} unknown`);
    if (notProven.length > 0) parts.push(`${notProven.length} not proven`);
    return {
      verdict: 'INCOMPLETE_PROOF',
      reason: `Incomplete: ${parts.join(', ')}`,
    };
  }

  // Check test count — no tests means incomplete
  if (testVerdict) {
    const totalTests = (testVerdict.details as Record<string, unknown>).totalTests;
    if (typeof totalTests === 'number' && totalTests === 0) {
      return {
        verdict: 'INCOMPLETE_PROOF',
        reason: 'No tests found — proof is incomplete',
      };
    }
  }

  // All claims proven, all phases passed
  if (claims.length === 0) {
    return {
      verdict: 'UNPROVEN',
      reason: 'No claims in bundle',
    };
  }

  const proven = claims.filter(c => c.status === 'proven');
  return {
    verdict: 'PROVEN',
    reason: `All ${proven.length} claim(s) proven, all phases passed`,
  };
}

/**
 * Sign a bundle with HMAC-SHA256.
 * The signature covers the bundleHash (which covers all content).
 */
function signBundle(bundle: ProofBundleV1, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(bundle.bundleHash)
    .digest('hex');
}
