/**
 * Runtime Probe Types
 *
 * Shared types for Playwright-based runtime verification that checks
 * "does it actually exist and work" for routes, env vars, and side effects.
 */

import * as crypto from 'crypto';

// ── Truthpack Input Types ──────────────────────────────────────────────────

export interface TruthpackRoute {
  path: string;
  method: string;
  handler: string;
  file: string;
  line: number;
  parameters: string[];
  middleware: string[];
  auth?: { required: boolean };
}

export interface TruthpackEnvVar {
  name: string;
  file: string;
  line: number;
  hasDefault: boolean;
  defaultValue: string;
  required: boolean;
  sensitive: boolean;
}

export interface TruthpackAuthRule {
  name: string;
  type: 'middleware' | 'role';
  file: string;
  line: number;
}

export interface TruthpackMeta {
  version: string;
  generatedAt: string;
  hash: string;
  scannerVersions: Record<string, string>;
  summary: {
    routes: number;
    envVars: number;
    authRules: number;
    contracts: number;
  };
}

export interface Truthpack {
  routes: TruthpackRoute[];
  env: TruthpackEnvVar[];
  auth: TruthpackAuthRule[];
  meta: TruthpackMeta;
}

// ── Probe Result Types ─────────────────────────────────────────────────────

export type ProbeStatus = 'pass' | 'fail' | 'skip' | 'warn';

export interface RouteProbeResult {
  route: TruthpackRoute;
  status: ProbeStatus;
  httpStatus?: number;
  responseTimeMs?: number;
  contentType?: string;
  bodySnippet?: string;
  fakeSuccessDetected: boolean;
  fakeSuccessSignals: string[];
  error?: string;
}

export interface EnvCheckResult {
  variable: TruthpackEnvVar;
  status: ProbeStatus;
  exists: boolean;
  hasValue: boolean;
  isPlaceholder: boolean;
  error?: string;
}

export interface SideEffectResult {
  name: string;
  description: string;
  status: ProbeStatus;
  details?: Record<string, unknown>;
  error?: string;
}

// ── Claim Types (for verdict scorer) ───────────────────────────────────────

export type ClaimType =
  | 'route_exists'
  | 'route_responds'
  | 'route_auth_enforced'
  | 'env_var_present'
  | 'env_var_not_placeholder'
  | 'no_fake_success'
  | 'side_effect_verified'
  | 'middleware_active';

export interface RuntimeClaim {
  id: string;
  type: ClaimType;
  target: string;
  status: ProbeStatus;
  confidence: number;
  evidence: ClaimEvidence;
  timestamp: string;
}

export interface ClaimEvidence {
  source: string;
  file?: string;
  line?: number;
  snippet?: string;
  httpStatus?: number;
  responseTimeMs?: number;
  details?: Record<string, unknown>;
}

// ── Report Types ───────────────────────────────────────────────────────────

export type RuntimeVerdict = 'PROVEN' | 'INCOMPLETE' | 'FAILED';

export interface RuntimeProbeReport {
  version: '1.0.0';
  reportId: string;
  generatedAt: string;
  verdict: RuntimeVerdict;
  score: number;
  baseUrl: string;
  truthpackHash: string;

  summary: {
    routes: { total: number; probed: number; passed: number; failed: number; skipped: number };
    envVars: { total: number; checked: number; passed: number; failed: number; skipped: number };
    sideEffects: { total: number; checked: number; passed: number; failed: number };
    fakeSuccessDetections: number;
    totalClaims: number;
    durationMs: number;
  };

  routeResults: RouteProbeResult[];
  envResults: EnvCheckResult[];
  sideEffectResults: SideEffectResult[];
  claims: RuntimeClaim[];

  integrityHash: string;
}

// ── Proof Bundle Integration ───────────────────────────────────────────────

export interface RuntimeProofArtifact {
  type: 'runtime-probe';
  version: '1.0.0';
  reportId: string;
  verdict: RuntimeVerdict;
  score: number;
  claimCount: number;
  passedClaims: number;
  failedClaims: number;
  generatedAt: string;
  integrityHash: string;
}

// ── Configuration ──────────────────────────────────────────────────────────

export interface RuntimeProbeConfig {
  /** Base URL of the running application. */
  baseUrl: string;
  /** Path to .guardrail/truthpack directory. */
  truthpackDir: string;
  /** Output directory for report and artifacts. */
  outputDir: string;
  /** Timeout per route probe in ms (default: 10000). */
  timeoutMs?: number;
  /** Only probe routes matching these path prefixes. */
  routeFilter?: string[];
  /** Skip routes requiring auth (default: false). */
  skipAuthRoutes?: boolean;
  /** Enable Playwright browser probing for UI routes (default: false). */
  browserProbe?: boolean;
  /** Verbose logging. */
  verbose?: boolean;
  /** Number of concurrent probes (default: 4). */
  concurrency?: number;
  /** Additional headers to send with every request. */
  headers?: Record<string, string>;
  /** Bearer token for authenticated routes. */
  authToken?: string;
}

// ── Utility ────────────────────────────────────────────────────────────────

export function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
