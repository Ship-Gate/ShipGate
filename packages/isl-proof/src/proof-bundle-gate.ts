/**
 * Proof Bundle Gate Schema
 *
 * Versioned, deterministic proof bundle for gate runs.
 * Designed for PR attachment and audit.
 *
 * Schema:
 *   - schemaVersion: "1.0.0"
 *   - toolVersion: ShipGate CLI version
 *   - timestamp: ISO 8601
 *   - configDigest: SHA-256 of config (truthpack, policy, etc.)
 *   - results[]: category, checkId, severity, status, evidenceRefs
 *
 * Determinism: results are stable-sorted so diffs are meaningful.
 * Signing: optional Ed25519 via SHIPGATE_SIGNING_KEY.
 *
 * @module @isl-lang/proof
 */

import * as crypto from 'crypto';
import { canonicalJsonCompact, canonicalJsonStringify } from './canonical-json.js';

// ============================================================================
// Schema
// ============================================================================

export const PROOF_BUNDLE_GATE_SCHEMA_VERSION = '1.0.0';

export type ProofBundleGateResultStatus = 'pass' | 'fail' | 'skip' | 'unknown';

export type ProofBundleGateSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ProofBundleGateResult {
  /** Category (e.g. auth, pii, payments, rate-limit) */
  category: string;
  /** Unique check identifier (e.g. auth/bypass-detected) */
  checkId: string;
  /** Severity level */
  severity: ProofBundleGateSeverity;
  /** Check outcome */
  status: ProofBundleGateResultStatus;
  /** References to evidence (file paths, line numbers, trace IDs) */
  evidenceRefs?: string[];
}

export interface ProofBundleGate {
  /** Schema version — always "1.0.0" for gate bundles */
  schemaVersion: typeof PROOF_BUNDLE_GATE_SCHEMA_VERSION;
  /** ShipGate tool version */
  toolVersion: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** SHA-256 hex of config (truthpack hash, policy hash, etc.) */
  configDigest: string;
  /** Gate results — stable-sorted for deterministic output */
  results: ProofBundleGateResult[];
  /** Aggregate verdict */
  verdict: 'SHIP' | 'NO_SHIP';
  /** Trust score 0–100 */
  score: number;
  /** Optional SHA-256 of canonical content (excluded from hash input) */
  bundleHash?: string;
}

// ============================================================================
// Stable sort key for results
// ============================================================================

const RESULT_SORT_KEYS: (keyof ProofBundleGateResult)[] = [
  'category',
  'checkId',
  'severity',
  'status',
];

function resultSortKey(r: ProofBundleGateResult): string {
  const parts = RESULT_SORT_KEYS.map((k) => {
    const v = r[k];
    if (Array.isArray(v)) return v.join('\0');
    return String(v ?? '');
  });
  return parts.join('\0');
}

/** Stable-sort results for deterministic output */
export function stableSortResults(results: ProofBundleGateResult[]): ProofBundleGateResult[] {
  return [...results].sort((a, b) => {
    const ka = resultSortKey(a);
    const kb = resultSortKey(b);
    return ka.localeCompare(kb, 'en');
  });
}

// ============================================================================
// Build & serialize
// ============================================================================

export interface CreateProofBundleGateInput {
  toolVersion: string;
  timestamp: string;
  configDigest: string;
  results: ProofBundleGateResult[];
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
}

/** Map gate clause status to proof bundle status */
export function mapClauseStatusToResultStatus(
  s: string
): ProofBundleGateResultStatus {
  switch (s) {
    case 'passed':
      return 'pass';
    case 'failed':
      return 'fail';
    case 'skipped':
      return 'skip';
    default:
      return 'unknown';
  }
}

/** Map severity string to ProofBundleGateSeverity */
export function mapSeverity(s: string): ProofBundleGateSeverity {
  const t = s.toLowerCase();
  if (t === 'critical') return 'critical';
  if (t === 'high') return 'high';
  if (t === 'medium') return 'medium';
  if (t === 'low') return 'low';
  return 'info';
}

/**
 * Create a proof bundle gate from inputs.
 * Results are stable-sorted for deterministic output.
 */
export function createProofBundleGate(input: CreateProofBundleGateInput): Omit<ProofBundleGate, 'bundleHash'> {
  const sorted = stableSortResults(input.results);
  return {
    schemaVersion: PROOF_BUNDLE_GATE_SCHEMA_VERSION,
    toolVersion: input.toolVersion,
    timestamp: input.timestamp,
    configDigest: input.configDigest,
    results: sorted,
    verdict: input.verdict,
    score: input.score,
  };
}

/**
 * Compute SHA-256 hash of the bundle's hashable content.
 * Excludes bundleHash and any signature field.
 */
export function proofBundleGateHash(bundle: Omit<ProofBundleGate, 'bundleHash'>): string {
  const canonical = canonicalJsonCompact(bundle);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Create bundle with hash computed.
 */
export function createProofBundleGateWithHash(bundle: Omit<ProofBundleGate, 'bundleHash'>): ProofBundleGate {
  const hash = proofBundleGateHash(bundle);
  return { ...bundle, bundleHash: hash };
}

/**
 * Serialize to canonical JSON (deterministic, sorted keys).
 */
export function serializeProofBundleGate(bundle: ProofBundleGate): string {
  return canonicalJsonStringify(bundle);
}

/**
 * Format proof bundle as Markdown for PR comments / audit.
 */
export function formatProofBundleGateMarkdown(bundle: ProofBundleGate): string {
  const lines: string[] = [];
  lines.push('# ShipGate Proof Bundle');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Schema | ${bundle.schemaVersion} |`);
  lines.push(`| Tool | ${bundle.toolVersion} |`);
  lines.push(`| Timestamp | ${bundle.timestamp} |`);
  lines.push(`| Verdict | **${bundle.verdict}** |`);
  lines.push(`| Score | ${bundle.score}/100 |`);
  lines.push(`| Config Digest | \`${bundle.configDigest.slice(0, 16)}...\` |`);
  if (bundle.bundleHash) {
    lines.push(`| Bundle Hash | \`${bundle.bundleHash.slice(0, 16)}...\` |`);
  }
  lines.push('');
  lines.push('## Results');
  lines.push('');
  lines.push('| Category | Check | Severity | Status |');
  lines.push('|----------|-------|----------|--------|');
  for (const r of bundle.results) {
    const refs = r.evidenceRefs?.length ? ` (${r.evidenceRefs.length} refs)` : '';
    lines.push(`| ${r.category} | ${r.checkId} | ${r.severity} | ${r.status}${refs} |`);
  }
  lines.push('');
  return lines.join('\n');
}

// ============================================================================
// Ed25519 signing
// ============================================================================

export interface ProofBundleGateSignature {
  algorithm: 'ed25519';
  signature: string; // base64
  publicKey?: string; // base64, for verification
}

/**
 * Sign bundle content with Ed25519 private key.
 * Key format: PEM (PKCS#8 or SEC1) or base64 raw (32 bytes).
 */
export function signProofBundleGateEd25519(
  bundleContent: string,
  privateKey: string
): ProofBundleGateSignature {
  const data = Buffer.from(bundleContent, 'utf8');

  let keyObject: crypto.KeyObject;
  if (privateKey.includes('-----BEGIN')) {
    keyObject = crypto.createPrivateKey(privateKey);
  } else {
    const der = Buffer.from(privateKey, 'base64');
    keyObject = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  }

  const sig = crypto.sign(null, data, keyObject);
  return {
    algorithm: 'ed25519',
    signature: sig.toString('base64'),
  };
}

/**
 * Write proof bundle to file, optionally sign with SHIPGATE_SIGNING_KEY.
 * Signature is written to <outputPath>.sig when key is set.
 */
export async function writeProofBundleGate(
  outputPath: string,
  bundle: ProofBundleGate,
  options?: { signingKey?: string }
): Promise<{ signed: boolean; signaturePath?: string }> {
  const { writeFile, mkdir } = await import('fs/promises');
  const { dirname } = await import('path');
  const content = serializeProofBundleGate(bundle);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, 'utf-8');

  const key = options?.signingKey ?? process.env.SHIPGATE_SIGNING_KEY;
  if (key) {
    const sig = signProofBundleGateEd25519(content, key);
    const sigPath = outputPath + '.sig';
    await writeFile(sigPath, JSON.stringify(sig, null, 2), 'utf-8');
    return { signed: true, signaturePath: sigPath };
  }
  return { signed: false };
}

/**
 * Verify Ed25519 signature of bundle content.
 */
export function verifyProofBundleGateEd25519(
  bundleContent: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const dataBuf = Buffer.from(bundleContent, 'utf8');
    const sigBuf = Buffer.from(signature, 'base64');
    const publicKeyBuf = Buffer.from(publicKey, 'base64');

    // @ts-expect-error - Node.js supports raw format for ed25519 but TypeScript types don't
    const keyObject = crypto.createPublicKey({
      key: publicKeyBuf,
      format: 'raw',
      type: 'ed25519',
    });

    return crypto.verify(null, dataBuf, keyObject, sigBuf);
  } catch {
    return false;
  }
}
