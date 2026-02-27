/**
 * Claim Builder
 *
 * Converts runtime probe results (routes, env vars, side effects)
 * into structured claims that feed the verdict scorer.
 */

import type {
  RuntimeClaim,
  ClaimType,
  ClaimEvidence,
  ProbeStatus,
  RouteProbeResult,
  EnvCheckResult,
  SideEffectResult,
} from './types.js';
import { generateId } from './types.js';

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Build all claims from a complete probe run.
 */
export function buildAllClaims(
  routeResults: RouteProbeResult[],
  envResults: EnvCheckResult[],
  sideEffectResults: SideEffectResult[],
): RuntimeClaim[] {
  const claims: RuntimeClaim[] = [];

  claims.push(...buildRouteClaims(routeResults));
  claims.push(...buildEnvClaims(envResults));
  claims.push(...buildSideEffectClaims(sideEffectResults));

  return claims;
}

/**
 * Build claims from route probe results.
 */
export function buildRouteClaims(results: RouteProbeResult[]): RuntimeClaim[] {
  const claims: RuntimeClaim[] = [];

  for (const result of results) {
    if (result.status === 'skip') continue;

    // Claim: route exists and responds
    claims.push(
      makeClaim({
        type: 'route_responds',
        target: `${result.route.method} ${result.route.path}`,
        status: result.status,
        confidence: computeRouteConfidence(result),
        evidence: {
          source: 'runtime-probe',
          file: result.route.file,
          line: result.route.line,
          httpStatus: result.httpStatus,
          responseTimeMs: result.responseTimeMs,
          snippet: result.bodySnippet?.slice(0, 200),
        },
      }),
    );

    // Claim: auth enforcement (if route requires auth)
    if (result.route.auth?.required) {
      const authEnforced =
        result.httpStatus === 401 || result.httpStatus === 403;
      claims.push(
        makeClaim({
          type: 'route_auth_enforced',
          target: `${result.route.method} ${result.route.path}`,
          status: authEnforced ? 'pass' : 'warn',
          confidence: authEnforced ? 0.95 : 0.5,
          evidence: {
            source: 'runtime-probe',
            file: result.route.file,
            line: result.route.line,
            httpStatus: result.httpStatus,
            details: { authRequired: true, authEnforced },
          },
        }),
      );
    }

    // Claim: no fake success
    if (result.fakeSuccessDetected) {
      claims.push(
        makeClaim({
          type: 'no_fake_success',
          target: `${result.route.method} ${result.route.path}`,
          status: 'fail',
          confidence: 0.8,
          evidence: {
            source: 'runtime-probe',
            file: result.route.file,
            line: result.route.line,
            httpStatus: result.httpStatus,
            details: { signals: result.fakeSuccessSignals },
          },
        }),
      );
    }

    // Claim: middleware active (if route has middleware declared)
    if (result.route.middleware.length > 0 && result.status === 'pass') {
      claims.push(
        makeClaim({
          type: 'middleware_active',
          target: `${result.route.method} ${result.route.path}`,
          status: 'pass',
          confidence: 0.7,
          evidence: {
            source: 'runtime-probe',
            file: result.route.file,
            line: result.route.line,
            details: { middleware: result.route.middleware },
          },
        }),
      );
    }
  }

  return claims;
}

/**
 * Build claims from environment variable check results.
 */
export function buildEnvClaims(results: EnvCheckResult[]): RuntimeClaim[] {
  const claims: RuntimeClaim[] = [];

  for (const result of results) {
    if (result.status === 'skip') continue;

    // Claim: env var is present
    claims.push(
      makeClaim({
        type: 'env_var_present',
        target: result.variable.name,
        status: result.exists ? (result.hasValue ? 'pass' : 'warn') : 'fail',
        confidence: result.exists ? 1.0 : 1.0,
        evidence: {
          source: 'runtime-env-check',
          file: result.variable.file,
          line: result.variable.line,
          details: {
            required: result.variable.required,
            hasDefault: result.variable.hasDefault,
          },
        },
      }),
    );

    // Claim: env var is not a placeholder
    if (result.exists && result.hasValue) {
      claims.push(
        makeClaim({
          type: 'env_var_not_placeholder',
          target: result.variable.name,
          status: result.isPlaceholder ? 'fail' : 'pass',
          confidence: result.isPlaceholder ? 0.85 : 0.9,
          evidence: {
            source: 'runtime-env-check',
            file: result.variable.file,
            line: result.variable.line,
            details: { isPlaceholder: result.isPlaceholder },
          },
        }),
      );
    }
  }

  return claims;
}

/**
 * Build claims from side effect verification results.
 */
export function buildSideEffectClaims(
  results: SideEffectResult[],
): RuntimeClaim[] {
  return results.map((result) =>
    makeClaim({
      type: 'side_effect_verified',
      target: result.name,
      status: result.status,
      confidence: result.status === 'pass' ? 0.9 : 0.6,
      evidence: {
        source: 'runtime-side-effect-check',
        snippet: result.description,
        details: result.details,
      },
    }),
  );
}

// ── Scoring ────────────────────────────────────────────────────────────────

/**
 * Compute an overall score from claims.
 * Returns a value 0..100.
 */
export function scoreClaims(claims: RuntimeClaim[]): number {
  if (claims.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const claim of claims) {
    const weight = claimWeight(claim.type);
    const value = claim.status === 'pass' ? 1.0
      : claim.status === 'warn' ? 0.5
      : claim.status === 'skip' ? 0.0
      : 0.0; // fail

    weightedSum += value * weight * claim.confidence;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
}

// ── Internal helpers ───────────────────────────────────────────────────────

interface MakeClaimInput {
  type: ClaimType;
  target: string;
  status: ProbeStatus;
  confidence: number;
  evidence: ClaimEvidence;
}

function makeClaim(input: MakeClaimInput): RuntimeClaim {
  return {
    id: generateId('claim'),
    type: input.type,
    target: input.target,
    status: input.status,
    confidence: input.confidence,
    evidence: input.evidence,
    timestamp: new Date().toISOString(),
  };
}

function computeRouteConfidence(result: RouteProbeResult): number {
  if (result.status === 'fail') return 1.0;
  if (result.fakeSuccessDetected) return 0.6;
  if (result.httpStatus && result.httpStatus >= 200 && result.httpStatus < 300) return 0.95;
  if (result.httpStatus === 401 || result.httpStatus === 403) return 0.85;
  return 0.7;
}

function claimWeight(type: ClaimType): number {
  switch (type) {
    case 'route_responds': return 1.0;
    case 'route_exists': return 1.0;
    case 'route_auth_enforced': return 1.2;
    case 'env_var_present': return 0.8;
    case 'env_var_not_placeholder': return 0.6;
    case 'no_fake_success': return 1.5;
    case 'side_effect_verified': return 1.0;
    case 'middleware_active': return 0.7;
    default: return 1.0;
  }
}
