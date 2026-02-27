/**
 * Runtime Probe Tests
 *
 * Tests for truthpack loading, env checking, claim building,
 * report generation, and the route prober.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  loadTruthpack,
  filterRoutes,
  deduplicateRoutes,
  getSafeRoutes,
  getAuthRoutes,
  getPublicRoutes,
} from '../src/probe/truthpack-loader.js';

import {
  checkEnvVars,
  checkSingleEnvVar,
  summarizeEnvResults,
} from '../src/probe/env-checker.js';

import {
  buildAllClaims,
  buildRouteClaims,
  buildEnvClaims,
  scoreClaims,
} from '../src/probe/claim-builder.js';

import {
  buildReport,
  buildProofArtifact,
  formatHumanSummary,
  formatCliSummary,
} from '../src/probe/report-generator.js';

import type {
  TruthpackRoute,
  TruthpackEnvVar,
  RouteProbeResult,
  EnvCheckResult,
  RuntimeClaim,
} from '../src/probe/types.js';
import { computeHash, generateId } from '../src/probe/types.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeRoute(overrides: Partial<TruthpackRoute> = {}): TruthpackRoute {
  return {
    path: '/api/users',
    method: 'GET',
    handler: 'getUsers',
    file: 'src/routes/users.ts',
    line: 10,
    parameters: [],
    middleware: [],
    ...overrides,
  };
}

function makeEnvVar(overrides: Partial<TruthpackEnvVar> = {}): TruthpackEnvVar {
  return {
    name: 'DATABASE_URL',
    file: 'src/config.ts',
    line: 5,
    hasDefault: false,
    defaultValue: '',
    required: true,
    sensitive: false,
    ...overrides,
  };
}

function makeRouteResult(overrides: Partial<RouteProbeResult> = {}): RouteProbeResult {
  return {
    route: makeRoute(),
    status: 'pass',
    httpStatus: 200,
    responseTimeMs: 50,
    contentType: 'application/json',
    bodySnippet: '{"users":[]}',
    fakeSuccessDetected: false,
    fakeSuccessSignals: [],
    ...overrides,
  };
}

function makeEnvResult(overrides: Partial<EnvCheckResult> = {}): EnvCheckResult {
  return {
    variable: makeEnvVar(),
    status: 'pass',
    exists: true,
    hasValue: true,
    isPlaceholder: false,
    ...overrides,
  };
}

// ── Truthpack Loader Tests ─────────────────────────────────────────────────

describe('truthpack-loader', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-test-'));
  });

  it('loads a valid truthpack directory', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'routes.json'),
      JSON.stringify({ routes: [makeRoute()] }),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'env.json'),
      JSON.stringify({ variables: [makeEnvVar()] }),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'auth.json'),
      JSON.stringify({ rules: [] }),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'meta.json'),
      JSON.stringify({
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        hash: 'abc',
        scannerVersions: {},
        summary: { routes: 1, envVars: 1, authRules: 0, contracts: 0 },
      }),
    );

    const result = loadTruthpack(tmpDir);

    expect(result.success).toBe(true);
    expect(result.truthpack).toBeDefined();
    expect(result.truthpack!.routes).toHaveLength(1);
    expect(result.truthpack!.env).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('fails for non-existent directory', () => {
    const result = loadTruthpack('/nonexistent/path');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('reports errors for missing files', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-empty-'));
    const result = loadTruthpack(emptyDir);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('filterRoutes filters by prefix', () => {
    const routes = [
      makeRoute({ path: '/api/users' }),
      makeRoute({ path: '/api/admin' }),
      makeRoute({ path: '/health' }),
    ];

    const filtered = filterRoutes(routes, ['/api']);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.path.startsWith('/api'))).toBe(true);
  });

  it('filterRoutes returns all when no prefixes', () => {
    const routes = [makeRoute({ path: '/a' }), makeRoute({ path: '/b' })];
    expect(filterRoutes(routes, [])).toHaveLength(2);
  });

  it('deduplicateRoutes removes duplicates', () => {
    const routes = [
      makeRoute({ path: '/api/users', method: 'GET' }),
      makeRoute({ path: '/api/users', method: 'GET' }),
      makeRoute({ path: '/api/users', method: 'POST' }),
    ];

    const deduped = deduplicateRoutes(routes);
    expect(deduped).toHaveLength(2);
  });

  it('getSafeRoutes filters to GET/HEAD/OPTIONS', () => {
    const routes = [
      makeRoute({ method: 'GET' }),
      makeRoute({ method: 'POST' }),
      makeRoute({ method: 'HEAD' }),
      makeRoute({ method: 'DELETE' }),
      makeRoute({ method: 'OPTIONS' }),
    ];

    const safe = getSafeRoutes(routes);
    expect(safe).toHaveLength(3);
  });

  it('getAuthRoutes and getPublicRoutes partition correctly', () => {
    const routes = [
      makeRoute({ auth: { required: true } }),
      makeRoute({ auth: { required: false } }),
      makeRoute({}), // no auth field
    ];

    expect(getAuthRoutes(routes)).toHaveLength(1);
    expect(getPublicRoutes(routes)).toHaveLength(2);
  });
});

// ── Env Checker Tests ──────────────────────────────────────────────────────

describe('env-checker', () => {
  it('detects present env vars', () => {
    const vars = [makeEnvVar({ name: 'FOO' })];
    const results = checkEnvVars(vars, { env: { FOO: 'bar' } });

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe('pass');
    expect(results[0]!.exists).toBe(true);
    expect(results[0]!.hasValue).toBe(true);
  });

  it('detects missing required env vars', () => {
    const vars = [makeEnvVar({ name: 'MISSING', required: true })];
    const results = checkEnvVars(vars, { env: {} });

    expect(results[0]!.status).toBe('fail');
    expect(results[0]!.exists).toBe(false);
  });

  it('warns for missing optional env vars', () => {
    const vars = [makeEnvVar({ name: 'OPTIONAL', required: false })];
    const results = checkEnvVars(vars, { env: {} });

    expect(results[0]!.status).toBe('warn');
  });

  it('detects placeholder values', () => {
    const vars = [makeEnvVar({ name: 'KEY' })];
    const results = checkEnvVars(vars, { env: { KEY: 'changeme' } });

    expect(results[0]!.isPlaceholder).toBe(true);
    expect(results[0]!.status).toBe('warn');
  });

  it('detects common placeholder patterns', () => {
    const placeholders = [
      'your_api_key',
      'CHANGEME',
      'replace_me',
      'xxx',
      'TODO',
      'PLACEHOLDER',
      'sk_test_abc123',
      '<YOUR_KEY>',
      '[INSERT_HERE]',
    ];

    for (const value of placeholders) {
      const result = checkSingleEnvVar(
        makeEnvVar({ name: 'TEST' }),
        { TEST: value },
      );
      expect(result.isPlaceholder).toBe(true);
    }
  });

  it('skips sensitive vars when configured', () => {
    const vars = [makeEnvVar({ name: 'SECRET', sensitive: true })];
    const results = checkEnvVars(vars, {
      env: {},
      skipSensitive: true,
    });

    expect(results[0]!.status).toBe('skip');
  });

  it('summarizeEnvResults computes correct stats', () => {
    const results: EnvCheckResult[] = [
      makeEnvResult({ status: 'pass' }),
      makeEnvResult({ status: 'fail' }),
      makeEnvResult({ status: 'skip' }),
      makeEnvResult({ status: 'warn', isPlaceholder: true }),
    ];

    const summary = summarizeEnvResults(results);
    expect(summary.total).toBe(4);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.placeholders).toBe(1);
  });
});

// ── Claim Builder Tests ────────────────────────────────────────────────────

describe('claim-builder', () => {
  it('builds route claims from probe results', () => {
    const routeResults = [
      makeRouteResult({ status: 'pass', httpStatus: 200 }),
      makeRouteResult({
        status: 'fail',
        httpStatus: 404,
        route: makeRoute({ path: '/api/missing' }),
      }),
    ];

    const claims = buildRouteClaims(routeResults);
    expect(claims.length).toBeGreaterThanOrEqual(2);
    expect(claims.some((c) => c.type === 'route_responds')).toBe(true);
  });

  it('generates no_fake_success claim when detected', () => {
    const routeResults = [
      makeRouteResult({
        fakeSuccessDetected: true,
        fakeSuccessSignals: ['empty_json_body'],
      }),
    ];

    const claims = buildRouteClaims(routeResults);
    const fakeClaim = claims.find((c) => c.type === 'no_fake_success');
    expect(fakeClaim).toBeDefined();
    expect(fakeClaim!.status).toBe('fail');
  });

  it('generates auth enforcement claim for auth routes', () => {
    const routeResults = [
      makeRouteResult({
        route: makeRoute({ auth: { required: true } }),
        httpStatus: 401,
      }),
    ];

    const claims = buildRouteClaims(routeResults);
    const authClaim = claims.find((c) => c.type === 'route_auth_enforced');
    expect(authClaim).toBeDefined();
    expect(authClaim!.status).toBe('pass');
  });

  it('builds env claims from check results', () => {
    const envResults = [
      makeEnvResult({ status: 'pass' }),
      makeEnvResult({ status: 'fail', exists: false }),
    ];

    const claims = buildEnvClaims(envResults);
    expect(claims.length).toBeGreaterThanOrEqual(2);
    expect(claims.some((c) => c.type === 'env_var_present')).toBe(true);
  });

  it('skips claims for skipped results', () => {
    const routeResults = [makeRouteResult({ status: 'skip' })];
    const envResults = [makeEnvResult({ status: 'skip' })];

    const routeClaims = buildRouteClaims(routeResults);
    const envClaims = buildEnvClaims(envResults);

    expect(routeClaims).toHaveLength(0);
    expect(envClaims).toHaveLength(0);
  });

  it('buildAllClaims combines route, env, and side-effect claims', () => {
    const claims = buildAllClaims(
      [makeRouteResult()],
      [makeEnvResult()],
      [],
    );

    expect(claims.length).toBeGreaterThanOrEqual(2);
  });

  it('scoreClaims returns 0 for empty claims', () => {
    expect(scoreClaims([])).toBe(0);
  });

  it('scoreClaims returns high score for all-pass claims', () => {
    const claims: RuntimeClaim[] = [
      {
        id: 'c1',
        type: 'route_responds',
        target: 'GET /api/users',
        status: 'pass',
        confidence: 0.95,
        evidence: { source: 'test' },
        timestamp: new Date().toISOString(),
      },
      {
        id: 'c2',
        type: 'env_var_present',
        target: 'DATABASE_URL',
        status: 'pass',
        confidence: 1.0,
        evidence: { source: 'test' },
        timestamp: new Date().toISOString(),
      },
    ];

    const score = scoreClaims(claims);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('scoreClaims returns low score for all-fail claims', () => {
    const claims: RuntimeClaim[] = [
      {
        id: 'c1',
        type: 'route_responds',
        target: 'GET /api/users',
        status: 'fail',
        confidence: 1.0,
        evidence: { source: 'test' },
        timestamp: new Date().toISOString(),
      },
    ];

    expect(scoreClaims(claims)).toBe(0);
  });
});

// ── Report Generator Tests ─────────────────────────────────────────────────

describe('report-generator', () => {
  const baseInput = {
    baseUrl: 'http://localhost:3000',
    truthpackHash: 'abc123hash',
    routeResults: [makeRouteResult()],
    envResults: [makeEnvResult()],
    sideEffectResults: [],
    claims: [
      {
        id: 'c1',
        type: 'route_responds' as const,
        target: 'GET /api/users',
        status: 'pass' as const,
        confidence: 0.95,
        evidence: { source: 'test' },
        timestamp: new Date().toISOString(),
      },
    ],
    durationMs: 150,
  };

  it('buildReport produces a valid report structure', () => {
    const report = buildReport(baseInput);

    expect(report.version).toBe('1.0.0');
    expect(report.reportId).toBeTruthy();
    expect(report.verdict).toBeDefined();
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.baseUrl).toBe('http://localhost:3000');
    expect(report.integrityHash).toBeTruthy();
    expect(report.summary.routes.total).toBe(1);
    expect(report.summary.envVars.total).toBe(1);
    expect(report.summary.totalClaims).toBe(1);
  });

  it('buildReport computes integrity hash', () => {
    const report = buildReport(baseInput);
    expect(report.integrityHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('buildProofArtifact creates a valid artifact', () => {
    const report = buildReport(baseInput);
    const artifact = buildProofArtifact(report);

    expect(artifact.type).toBe('runtime-probe');
    expect(artifact.version).toBe('1.0.0');
    expect(artifact.reportId).toBe(report.reportId);
    expect(artifact.verdict).toBe(report.verdict);
    expect(artifact.integrityHash).toBe(report.integrityHash);
  });

  it('formatHumanSummary produces markdown', () => {
    const report = buildReport(baseInput);
    const summary = formatHumanSummary(report);

    expect(summary).toContain('# Runtime Probe Report');
    expect(summary).toContain('**Verdict:**');
    expect(summary).toContain('## Routes');
    expect(summary).toContain('## Environment Variables');
    expect(summary).toContain('## Claims');
  });

  it('formatCliSummary produces compact output', () => {
    const report = buildReport(baseInput);
    const cli = formatCliSummary(report);

    expect(cli).toContain('Runtime Probe:');
    expect(cli).toContain('Routes:');
    expect(cli).toContain('Env:');
  });

  it('report verdict is PROVEN for all-pass high-score', () => {
    const report = buildReport(baseInput);
    // With one passing claim at 0.95 confidence, score should be high enough
    expect(report.score).toBeGreaterThanOrEqual(85);
    expect(report.verdict).toBe('PROVEN');
  });

  it('report verdict is FAILED when all claims fail', () => {
    const failInput = {
      ...baseInput,
      routeResults: [makeRouteResult({ status: 'fail', httpStatus: 500 })],
      envResults: [makeEnvResult({ status: 'fail', exists: false })],
      claims: [
        {
          id: 'c1',
          type: 'route_responds' as const,
          target: 'GET /api/users',
          status: 'fail' as const,
          confidence: 1.0,
          evidence: { source: 'test' },
          timestamp: new Date().toISOString(),
        },
        {
          id: 'c2',
          type: 'env_var_present' as const,
          target: 'DB_URL',
          status: 'fail' as const,
          confidence: 1.0,
          evidence: { source: 'test' },
          timestamp: new Date().toISOString(),
        },
        {
          id: 'c3',
          type: 'no_fake_success' as const,
          target: 'GET /api',
          status: 'fail' as const,
          confidence: 1.0,
          evidence: { source: 'test' },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const report = buildReport(failInput);
    expect(report.verdict).toBe('FAILED');
    expect(report.score).toBe(0);
  });
});

// ── Types Utility Tests ────────────────────────────────────────────────────

describe('types utilities', () => {
  it('computeHash produces consistent SHA-256', () => {
    const h1 = computeHash('hello');
    const h2 = computeHash('hello');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generateId produces unique IDs with prefix', () => {
    const id1 = generateId('test');
    const id2 = generateId('test');
    expect(id1).toMatch(/^test_/);
    expect(id1).not.toBe(id2);
  });
});
