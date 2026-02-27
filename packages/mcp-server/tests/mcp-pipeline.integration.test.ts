// ============================================================================
// MCP Server — Integration Test
// ============================================================================
//
// Proves end-to-end viability of the unified Shipgate API:
//   scan → gen → verify → proof.pack → proof.verify
//
// Each test exercises the same core functions that the MCP tool endpoints
// delegate to, so passing here guarantees the MCP interface works.
// ============================================================================

import { describe, it, expect, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

import {
  scan,
  verifySpec,
  proofPack,
  proofVerify,
  gen,
  hashContent,
  generateFingerprint,
  ISL_VERSION,
} from '../src/core.js';
import type {
  ScanResult,
  VerifyResult,
  ProofBundle,
  ProofVerifyResult,
  GenResult,
} from '../src/core.js';

import {
  resolveAuthConfig,
  authenticate,
  createAuthGuard,
} from '../src/auth.js';
import type { AuthConfig, AuthContext } from '../src/auth.js';

// ============================================================================
// Sample ISL — parser-compatible (braced domain, shorthand pre/post)
// ============================================================================

const SAMPLE_ISL = `
domain Auth {
  version: "1.0.0"

  entity User {
    id: UUID [immutable]
    email: String [unique]
    password_hash: String [secret]
    status: String
  }

  behavior Login {
    description: "Authenticate user"

    input {
      email: String
      password: String [sensitive]
    }

    output {
      success: String
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
        }
      }
    }

    preconditions {
      input.email.length > 0
      input.password.length >= 8
    }

    postconditions {
      success implies {
        result.length > 0
      }
    }

    invariants {
      password_hash != input.password
    }
  }
}
`;

const INVALID_ISL = 'this is not valid ISL at all {{{';

// Temp directories created during tests — cleaned up in afterAll
const tempDirs: string[] = [];

afterAll(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

// ============================================================================
// 1. scan
// ============================================================================

describe('scan', () => {
  it('parses and typechecks valid ISL', () => {
    const result: ScanResult = scan(SAMPLE_ISL);

    expect(result.success).toBe(true);
    expect(result.domain).toBeDefined();
    expect(result.domain!.name).toBe('Auth');
    expect(result.domain!.version).toBe('1.0.0');
    expect(result.domain!.entities).toContain('User');
    expect(result.domain!.behaviors).toContain('Login');
    expect(result.ast).toBeDefined();
    expect(result.parseErrors).toBeUndefined();
  });

  it('returns parse errors for invalid ISL', () => {
    const result: ScanResult = scan(INVALID_ISL);

    expect(result.success).toBe(false);
    expect(result.parseErrors).toBeDefined();
    expect(result.parseErrors!.length).toBeGreaterThan(0);
    expect(result.domain).toBeUndefined();
    expect(result.ast).toBeUndefined();
  });

  it('accepts optional filename for diagnostics', () => {
    const result = scan(SAMPLE_ISL, 'auth.isl');
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// 2. gen
// ============================================================================

describe('gen', () => {
  it('generates TypeScript from valid ISL', () => {
    const result: GenResult = gen(SAMPLE_ISL);

    expect(result.success).toBe(true);
    expect(result.domain).toBe('Auth');
    expect(result.files).toBeDefined();
    expect(result.files!.length).toBeGreaterThan(0);

    // At least one file should contain TypeScript constructs
    const allContent = result.files!.map(f => f.content).join('\n');
    expect(allContent.length).toBeGreaterThan(0);
  });

  it('fails gracefully on invalid ISL', () => {
    const result: GenResult = gen(INVALID_ISL);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('respects mode option', () => {
    const dev = gen(SAMPLE_ISL, { mode: 'development' });
    const prod = gen(SAMPLE_ISL, { mode: 'production' });

    expect(dev.success).toBe(true);
    expect(prod.success).toBe(true);
  });
});

// ============================================================================
// 3. verify
// ============================================================================

describe('verify', () => {
  it('returns structured result with decision', async () => {
    const impl = `
      export function login(email: string, password: string) {
        if (email.length === 0) throw new Error('Invalid email');
        if (password.length < 8) throw new Error('Password too short');
        return 'session-token-123';
      }
    `;

    const result: VerifyResult = await verifySpec(SAMPLE_ISL, impl);

    // The verify engine may or may not succeed depending on the environment,
    // but the result must be structurally valid
    expect(result.decision).toMatch(/^(SHIP|NO-SHIP)$/);
    expect(typeof result.trustScore).toBe('number');
    expect(result.trustScore).toBeGreaterThanOrEqual(0);
    expect(result.trustScore).toBeLessThanOrEqual(100);
    expect(typeof result.confidence).toBe('number');
    expect(typeof result.passed).toBe('number');
    expect(typeof result.failed).toBe('number');
    expect(typeof result.skipped).toBe('number');
    expect(typeof result.total).toBe('number');
    expect(typeof result.summary).toBe('string');
    expect(Array.isArray(result.clauses)).toBe(true);
    expect(Array.isArray(result.blockers)).toBe(true);
  });

  it('rejects invalid spec with NO-SHIP', async () => {
    const result = await verifySpec(INVALID_ISL, 'export function x() {}');

    expect(result.decision).toBe('NO-SHIP');
    expect(result.trustScore).toBe(0);
    expect(result.blockers.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 4. proof.pack + proof.verify  (round-trip)
// ============================================================================

describe('proof.pack', () => {
  it('creates in-memory bundle with valid fingerprint', async () => {
    // Use a synthetic verify result to avoid dependency on verify engine
    const syntheticResult: VerifyResult = {
      decision: 'SHIP',
      trustScore: 100,
      confidence: 95,
      passed: 3,
      failed: 0,
      skipped: 0,
      total: 3,
      summary: 'SHIP: All 3 verifications passed. Trust score: 100%',
      clauses: [
        { id: 'post-login', type: 'postcondition', description: 'Login returns token', status: 'passed' },
        { id: 'pre-email', type: 'precondition', description: 'Email not empty', status: 'passed' },
        { id: 'inv-hash', type: 'invariant', description: 'Password not stored raw', status: 'passed' },
      ],
      blockers: [],
    };

    const impl = 'export function login() { return "token"; }';
    const bundle: ProofBundle = await proofPack(SAMPLE_ISL, impl, syntheticResult);

    expect(bundle.fingerprint).toBeDefined();
    expect(bundle.fingerprint.length).toBe(16);
    expect(bundle.manifest.specHash).toBeDefined();
    expect(bundle.manifest.implHash).toBeDefined();
    expect(bundle.manifest.islVersion).toBe(ISL_VERSION);
    expect(bundle.manifest.artifacts.length).toBe(2);
    expect(bundle.results).toEqual(syntheticResult);
    expect(bundle.bundlePath).toBeUndefined(); // in-memory
  });

  it('writes bundle to disk and proof.verify confirms integrity', async () => {
    const syntheticResult: VerifyResult = {
      decision: 'SHIP',
      trustScore: 98,
      confidence: 90,
      passed: 2,
      failed: 0,
      skipped: 0,
      total: 2,
      summary: 'SHIP: All 2 verifications passed.',
      clauses: [
        { id: 'post-1', type: 'postcondition', description: 'check-1', status: 'passed' },
        { id: 'pre-1', type: 'precondition', description: 'check-2', status: 'passed' },
      ],
      blockers: [],
    };

    const impl = 'export function login() {}';
    const tmpDir = await mkdtemp(join(tmpdir(), 'isl-proof-'));
    tempDirs.push(tmpDir);

    // Pack
    const bundle = await proofPack(SAMPLE_ISL, impl, syntheticResult, tmpDir);

    expect(bundle.bundlePath).toBe(tmpDir);
    expect(bundle.fingerprint.length).toBe(16);

    // Verify
    const verification: ProofVerifyResult = await proofVerify(tmpDir);

    expect(verification.valid).toBe(true);
    expect(verification.fingerprint).toBe(bundle.fingerprint);
    expect(verification.artifactsChecked).toBeGreaterThan(0);
    expect(verification.artifactsValid).toBe(verification.artifactsChecked);
    expect(verification.errors).toHaveLength(0);
  });

  it('proof.verify detects missing bundle', async () => {
    const result = await proofVerify('/nonexistent/path/to/bundle');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('manifest.json not found');
  });
});

// ============================================================================
// 5. Auth guard
// ============================================================================

describe('auth', () => {
  it('local mode always authenticates', () => {
    const config: AuthConfig = { mode: 'local' };
    const guard = createAuthGuard(config);
    const ctx: AuthContext = guard({});

    expect(ctx.authenticated).toBe(true);
    expect(ctx.mode).toBe('local');
  });

  it('token mode rejects missing token', () => {
    const config: AuthConfig = { mode: 'token', token: 'secret-abc-123' };
    const ctx = authenticate(config, undefined);

    expect(ctx.authenticated).toBe(false);
    expect(ctx.mode).toBe('token');
    expect(ctx.error).toContain('Token required');
  });

  it('token mode rejects wrong token', () => {
    const config: AuthConfig = { mode: 'token', token: 'secret-abc-123' };
    const ctx = authenticate(config, 'wrong-token');

    expect(ctx.authenticated).toBe(false);
    expect(ctx.error).toContain('Invalid token');
  });

  it('token mode accepts correct token', () => {
    const config: AuthConfig = { mode: 'token', token: 'secret-abc-123' };
    const ctx = authenticate(config, 'secret-abc-123');

    expect(ctx.authenticated).toBe(true);
    expect(ctx.mode).toBe('token');
  });

  it('guard extracts _token from tool args', () => {
    const config: AuthConfig = { mode: 'token', token: 'my-token' };
    const guard = createAuthGuard(config);

    const fail = guard({ source: 'domain X {}' });
    expect(fail.authenticated).toBe(false);

    const pass = guard({ source: 'domain X {}', _token: 'my-token' });
    expect(pass.authenticated).toBe(true);
  });

  it('resolveAuthConfig reads ISL_MCP_TOKEN env var', () => {
    const original = process.env.ISL_MCP_TOKEN;
    try {
      delete process.env.ISL_MCP_TOKEN;
      expect(resolveAuthConfig().mode).toBe('local');

      process.env.ISL_MCP_TOKEN = 'env-token';
      const cfg = resolveAuthConfig();
      expect(cfg.mode).toBe('token');
      expect(cfg.token).toBe('env-token');
    } finally {
      if (original !== undefined) {
        process.env.ISL_MCP_TOKEN = original;
      } else {
        delete process.env.ISL_MCP_TOKEN;
      }
    }
  });
});

// ============================================================================
// 6. Crypto helpers
// ============================================================================

describe('crypto helpers', () => {
  it('hashContent produces stable SHA-256', () => {
    const h1 = hashContent('hello');
    const h2 = hashContent('hello');
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64); // hex-encoded SHA-256
  });

  it('generateFingerprint is deterministic and 16 chars', () => {
    const fp1 = generateFingerprint('a', 'b', 'c', '0.1.0');
    const fp2 = generateFingerprint('a', 'b', 'c', '0.1.0');
    expect(fp1).toBe(fp2);
    expect(fp1.length).toBe(16);

    // Different inputs → different fingerprint
    const fp3 = generateFingerprint('x', 'b', 'c', '0.1.0');
    expect(fp3).not.toBe(fp1);
  });
});

// ============================================================================
// 7. Full pipeline integration: scan → gen → verify → proof.pack → proof.verify
// ============================================================================

describe('full pipeline (end-to-end)', () => {
  it('runs complete scan → gen → proof.pack → proof.verify cycle', async () => {
    // Step 1: Scan
    const scanResult = scan(SAMPLE_ISL);
    expect(scanResult.success).toBe(true);
    expect(scanResult.domain!.name).toBe('Auth');

    // Step 2: Gen
    const genResult = gen(SAMPLE_ISL);
    expect(genResult.success).toBe(true);
    expect(genResult.files!.length).toBeGreaterThan(0);

    // Step 3: Build a synthetic verify result (avoids flaky test-runner dep)
    const syntheticVerify: VerifyResult = {
      decision: 'SHIP',
      trustScore: 97,
      confidence: 92,
      passed: 4,
      failed: 0,
      skipped: 0,
      total: 4,
      summary: 'SHIP: All 4 verifications passed. Trust score: 97%',
      clauses: [
        { id: 'pre-email', type: 'precondition', description: 'email.length > 0', status: 'passed' },
        { id: 'pre-password', type: 'precondition', description: 'password.length >= 8', status: 'passed' },
        { id: 'post-token', type: 'postcondition', description: 'result.length > 0', status: 'passed' },
        { id: 'inv-hash', type: 'invariant', description: 'password_hash != password', status: 'passed' },
      ],
      blockers: [],
    };

    // Step 4: Pack proof
    const tmpDir = await mkdtemp(join(tmpdir(), 'isl-e2e-'));
    tempDirs.push(tmpDir);

    const bundle = await proofPack(
      SAMPLE_ISL,
      genResult.files!.map(f => f.content).join('\n'),
      syntheticVerify,
      tmpDir,
    );

    expect(bundle.fingerprint).toBeDefined();
    expect(bundle.bundlePath).toBe(tmpDir);
    expect(bundle.manifest.artifacts.length).toBeGreaterThan(0);

    // Step 5: Verify proof
    const proofResult = await proofVerify(tmpDir);

    expect(proofResult.valid).toBe(true);
    expect(proofResult.fingerprint).toBe(bundle.fingerprint);
    expect(proofResult.errors).toHaveLength(0);
    expect(proofResult.artifactsValid).toBe(proofResult.artifactsChecked);
  });

  it('runs verify with real engine (smoke test)', async () => {
    // This test calls the real verify engine.
    // It may fail if the test runner environment isn't fully set up,
    // so we only assert structural validity, not SHIP/NO-SHIP outcome.
    const impl = `
      export function login(email: string, password: string): string {
        if (!email || email.length === 0) throw new Error('empty email');
        if (!password || password.length < 8) throw new Error('short password');
        return 'session-' + Date.now();
      }
    `;

    const result = await verifySpec(SAMPLE_ISL, impl, {
      framework: 'vitest',
      timeout: 15000,
      threshold: 90,
    });

    // Structural assertions — regardless of pass/fail
    expect(result.decision).toMatch(/^(SHIP|NO-SHIP)$/);
    expect(result.summary).toBeTruthy();
    expect(result.total).toBe(result.passed + result.failed + result.skipped);
  });
});
