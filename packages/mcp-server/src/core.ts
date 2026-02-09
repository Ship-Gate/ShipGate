// ============================================================================
// ISL MCP Server — Core Operations
// ============================================================================
//
// Single source of truth for all Shipgate capabilities.
// Every MCP tool endpoint delegates here — no duplicated logic.
//
// Operations:
//   scan         — parse + typecheck
//   verifySpec   — verify implementation against spec
//   proofPack    — create deterministic evidence bundle
//   proofVerify  — verify evidence bundle integrity
//   gen          — generate TypeScript from ISL spec
// ============================================================================

import { parse, type Domain } from '@isl-lang/parser';
import { check } from '@isl-lang/typechecker';
import { generate as generateRuntime } from '@isl-lang/codegen-runtime';
import { verify as islVerify } from '@isl-lang/isl-verify';
import { createHash } from 'crypto';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

// ============================================================================
// Constants
// ============================================================================

export const ISL_VERSION = '0.1.0';

// ============================================================================
// Types
// ============================================================================

export interface DiagnosticItem {
  message: string;
  line: number;
  column?: number;
}

export interface DomainInfo {
  name: string;
  version: string;
  entities: string[];
  behaviors: string[];
}

export interface ScanResult {
  success: boolean;
  domain?: DomainInfo;
  /** Raw AST — available for downstream operations (verify, gen). */
  ast?: Domain;
  parseErrors?: DiagnosticItem[];
  typeErrors?: DiagnosticItem[];
  warnings?: DiagnosticItem[];
}

export interface ClauseItem {
  id: string;
  type: 'precondition' | 'postcondition' | 'invariant' | 'scenario';
  description: string;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
  durationMs?: number;
}

export interface BlockerItem {
  clause: string;
  reason: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface VerifyResult {
  decision: 'SHIP' | 'NO-SHIP';
  trustScore: number;
  confidence: number;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  summary: string;
  clauses: ClauseItem[];
  blockers: BlockerItem[];
}

export interface VerifyOptions {
  framework?: 'vitest' | 'jest';
  timeout?: number;
  threshold?: number;
  allowSkipped?: boolean;
}

export interface ProofArtifact {
  type: string;
  path: string;
  hash: string;
  sizeBytes: number;
}

export interface ProofManifest {
  fingerprint: string;
  islVersion: string;
  specHash: string;
  implHash: string;
  timestamp: string;
  artifacts: ProofArtifact[];
}

export interface ProofBundle {
  fingerprint: string;
  manifest: ProofManifest;
  results: VerifyResult;
  bundlePath?: string;
}

export interface ProofVerifyResult {
  valid: boolean;
  fingerprint: string;
  errors: string[];
  artifactsChecked: number;
  artifactsValid: number;
}

export interface GenOptions {
  mode?: 'development' | 'production' | 'test';
}

export interface GenResult {
  success: boolean;
  domain?: string;
  files?: Array<{ path: string; type: string; content: string }>;
  error?: string;
}

// ============================================================================
// Helpers (exported for reuse by legacy handlers)
// ============================================================================

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function generateFingerprint(
  specHash: string,
  implHash: string,
  resultsHash: string,
  islVersion: string,
): string {
  const data = `${specHash}:${implHash}:${resultsHash}:${islVersion}`;
  return createHash('sha256').update(data, 'utf-8').digest('hex').slice(0, 16);
}

// ============================================================================
// scan — Parse + typecheck an ISL source
// ============================================================================

export function scan(source: string, filename?: string): ScanResult {
  const parseResult = parse(source, filename);

  if (parseResult.errors.length > 0 || !parseResult.domain) {
    return {
      success: false,
      parseErrors: parseResult.errors.map(e => ({
        message: e.message,
        line: e.location.line,
        column: e.location.column,
      })),
    };
  }

  const domain = parseResult.domain;
  const typeResult = check(domain);
  const typeErrors = typeResult.diagnostics.filter(d => d.severity === 'error');
  const warnings = typeResult.diagnostics.filter(d => d.severity === 'warning');

  return {
    success: typeErrors.length === 0,
    domain: {
      name: domain.name.name,
      version: domain.version.value,
      entities: domain.entities.map(e => e.name.name),
      behaviors: domain.behaviors.map(b => b.name.name),
    },
    ast: domain,
    typeErrors: typeErrors.length > 0
      ? typeErrors.map(e => ({
          message: e.message,
          line: e.location.line,
          column: e.location.column,
        }))
      : undefined,
    warnings: warnings.length > 0
      ? warnings.map(w => ({
          message: w.message,
          line: w.location.line,
        }))
      : undefined,
  };
}

// ============================================================================
// verifySpec — Verify implementation against ISL spec
// ============================================================================

export async function verifySpec(
  specSource: string,
  implSource: string,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  // Step 1: Scan
  const scanResult = scan(specSource, 'spec.isl');

  if (!scanResult.success || !scanResult.ast) {
    const errors = [
      ...(scanResult.parseErrors ?? []),
      ...(scanResult.typeErrors ?? []),
    ]
      .map(e => e.message)
      .join('; ');

    return {
      decision: 'NO-SHIP',
      trustScore: 0,
      confidence: 100,
      passed: 0,
      failed: 1,
      skipped: 0,
      total: 1,
      summary: `NO-SHIP: Spec validation failed — ${errors}`,
      clauses: [],
      blockers: [
        { clause: 'spec-validation', reason: errors, severity: 'critical' },
      ],
    };
  }

  // Step 2: Run verification engine
  const {
    framework = 'vitest',
    timeout = 30000,
    threshold = 95,
    allowSkipped = false,
  } = options;

  let raw;
  try {
    raw = await islVerify(scanResult.ast, implSource, {
      runner: { framework, timeout },
    });
  } catch (e) {
    return {
      decision: 'NO-SHIP',
      trustScore: 0,
      confidence: 50,
      passed: 0,
      failed: 1,
      skipped: 0,
      total: 1,
      summary: `NO-SHIP: Verification engine error — ${e instanceof Error ? e.message : 'unknown'}`,
      clauses: [],
      blockers: [
        {
          clause: 'verification-engine',
          reason: e instanceof Error ? e.message : 'unknown',
          severity: 'critical',
        },
      ],
    };
  }

  // Step 3: Map clause results
  const clauses: ClauseItem[] = raw.trustScore.details.map(
    (detail: { category: string; name: string; status: string; message?: string; durationMs?: number }) => ({
      id: `${detail.category}-${detail.name}`
        .replace(/\s+/g, '-')
        .toLowerCase(),
      type: mapCategory(detail.category),
      description: detail.name,
      status: detail.status as ClauseItem['status'],
      error: detail.message,
      durationMs: (detail as { durationMs?: number }).durationMs,
    }),
  );

  const blockers: BlockerItem[] = raw.trustScore.details
    .filter((d: { status: string }) => d.status === 'failed')
    .map((d: { name: string; message?: string; impact?: string }) => ({
      clause: d.name,
      reason: d.message ?? 'Verification failed',
      severity: (
        d.impact === 'critical'
          ? 'critical'
          : d.impact === 'high'
            ? 'high'
            : 'medium'
      ) as BlockerItem['severity'],
    }));

  const { passed, failed, skipped } = raw.testResult;
  const total = passed + failed + skipped;
  const trustScore = raw.trustScore.overall;
  const confidence = raw.trustScore.confidence;

  // Step 4: Decision
  let decision: 'SHIP' | 'NO-SHIP';
  let summary: string;

  if (failed > 0) {
    decision = 'NO-SHIP';
    summary = `NO-SHIP: ${failed} verification${failed > 1 ? 's' : ''} failed. Trust score: ${trustScore}%`;
  } else if (trustScore < threshold) {
    decision = 'NO-SHIP';
    summary = `NO-SHIP: Trust score ${trustScore}% below threshold ${threshold}%`;
  } else if (skipped > 0 && !allowSkipped) {
    decision = 'NO-SHIP';
    summary = `NO-SHIP: ${skipped} verification${skipped > 1 ? 's' : ''} skipped.`;
  } else {
    decision = 'SHIP';
    summary = `SHIP: All ${passed} verifications passed. Trust score: ${trustScore}%`;
  }

  return {
    decision,
    trustScore,
    confidence,
    passed,
    failed,
    skipped,
    total,
    summary,
    clauses,
    blockers,
  };
}

// ============================================================================
// proofPack — Create deterministic evidence bundle
// ============================================================================

export async function proofPack(
  specSource: string,
  implSource: string,
  verifyResult: VerifyResult,
  outputDir?: string,
): Promise<ProofBundle> {
  const specHash = hashContent(specSource);
  const implHash = hashContent(implSource);
  const resultsJson = JSON.stringify(verifyResult, null, 2);
  const resultsHash = hashContent(resultsJson);
  const fingerprint = generateFingerprint(
    specHash,
    implHash,
    resultsHash,
    ISL_VERSION,
  );

  const artifacts: ProofArtifact[] = [];
  let bundlePath: string | undefined;

  if (outputDir) {
    const evidenceDir = resolve(outputDir);
    const artifactsDir = join(evidenceDir, 'artifacts');
    await mkdir(evidenceDir, { recursive: true });
    await mkdir(artifactsDir, { recursive: true });

    // Write spec
    const specPath = join(artifactsDir, 'spec.isl');
    await writeFile(specPath, specSource, 'utf-8');
    artifacts.push({
      type: 'spec',
      path: 'artifacts/spec.isl',
      hash: specHash,
      sizeBytes: Buffer.byteLength(specSource, 'utf-8'),
    });

    // Write results.json
    const resultsPath = join(evidenceDir, 'results.json');
    await writeFile(resultsPath, resultsJson, 'utf-8');
    artifacts.push({
      type: 'report',
      path: 'results.json',
      hash: resultsHash,
      sizeBytes: Buffer.byteLength(resultsJson, 'utf-8'),
    });

    // Write manifest.json
    const manifest: ProofManifest = {
      fingerprint,
      islVersion: ISL_VERSION,
      specHash,
      implHash,
      timestamp: new Date().toISOString(),
      artifacts,
    };
    const manifestPath = join(evidenceDir, 'manifest.json');
    await writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );

    bundlePath = evidenceDir;
    return { fingerprint, manifest, results: verifyResult, bundlePath };
  }

  // In-memory bundle (no disk writes)
  const manifest: ProofManifest = {
    fingerprint,
    islVersion: ISL_VERSION,
    specHash,
    implHash,
    timestamp: new Date().toISOString(),
    artifacts: [
      {
        type: 'spec',
        path: 'artifacts/spec.isl',
        hash: specHash,
        sizeBytes: Buffer.byteLength(specSource, 'utf-8'),
      },
      {
        type: 'report',
        path: 'results.json',
        hash: resultsHash,
        sizeBytes: Buffer.byteLength(resultsJson, 'utf-8'),
      },
    ],
  };

  return { fingerprint, manifest, results: verifyResult };
}

// ============================================================================
// proofVerify — Verify evidence bundle integrity
// ============================================================================

export async function proofVerify(
  bundlePath: string,
): Promise<ProofVerifyResult> {
  const evidenceDir = resolve(bundlePath);
  const manifestPath = join(evidenceDir, 'manifest.json');

  if (!existsSync(manifestPath)) {
    return {
      valid: false,
      fingerprint: '',
      errors: ['manifest.json not found'],
      artifactsChecked: 0,
      artifactsValid: 0,
    };
  }

  let manifest: ProofManifest;
  try {
    const raw = await readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(raw);
  } catch (e) {
    return {
      valid: false,
      fingerprint: '',
      errors: [
        `Failed to read manifest: ${e instanceof Error ? e.message : String(e)}`,
      ],
      artifactsChecked: 0,
      artifactsValid: 0,
    };
  }

  const errors: string[] = [];
  let artifactsValid = 0;

  // Check each artifact hash
  for (const artifact of manifest.artifacts) {
    const artifactPath = join(evidenceDir, artifact.path);
    if (!existsSync(artifactPath)) {
      errors.push(`Missing artifact: ${artifact.path}`);
      continue;
    }

    const content = await readFile(artifactPath, 'utf-8');
    const actualHash = hashContent(content);

    if (actualHash !== artifact.hash) {
      errors.push(
        `Hash mismatch for ${artifact.path}: expected ${artifact.hash.slice(0, 8)}…, got ${actualHash.slice(0, 8)}…`,
      );
    } else {
      artifactsValid++;
    }
  }

  // Re-derive fingerprint and verify
  const resultsPath = join(evidenceDir, 'results.json');
  if (existsSync(resultsPath)) {
    const resultsContent = await readFile(resultsPath, 'utf-8');
    const resultsHash = hashContent(resultsContent);
    const expectedFp = generateFingerprint(
      manifest.specHash,
      manifest.implHash,
      resultsHash,
      manifest.islVersion,
    );
    if (expectedFp !== manifest.fingerprint) {
      errors.push(
        `Fingerprint mismatch: expected ${expectedFp}, got ${manifest.fingerprint}`,
      );
    }
  } else {
    errors.push('results.json not found — cannot verify fingerprint');
  }

  return {
    valid: errors.length === 0,
    fingerprint: manifest.fingerprint,
    errors,
    artifactsChecked: manifest.artifacts.length,
    artifactsValid,
  };
}

// ============================================================================
// gen — Generate TypeScript from ISL spec
// ============================================================================

export function gen(source: string, options: GenOptions = {}): GenResult {
  const scanResult = scan(source);

  if (!scanResult.success || !scanResult.ast) {
    return {
      success: false,
      error: `Scan failed: ${[
        ...(scanResult.parseErrors ?? []),
        ...(scanResult.typeErrors ?? []),
      ]
        .map(e => e.message)
        .join('; ')}`,
    };
  }

  try {
    const files = generateRuntime(scanResult.ast, {
      mode: options.mode ?? 'development',
      includeComments: true,
      includeHelpers: true,
    });

    return {
      success: true,
      domain: scanResult.domain!.name,
      files: files.map(f => ({ path: f.path, type: f.type, content: f.content })),
    };
  } catch (e) {
    return {
      success: false,
      domain: scanResult.domain!.name,
      error: `Codegen failed: ${e instanceof Error ? e.message : 'unknown'}`,
    };
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

function mapCategory(category: string): ClauseItem['type'] {
  switch (category) {
    case 'preconditions':
      return 'precondition';
    case 'postconditions':
      return 'postcondition';
    case 'invariants':
      return 'invariant';
    default:
      return 'scenario';
  }
}
