/**
 * Auth Drift Detector — Inlined SpeclessCheck
 *
 * Detects auth mismatches directly without an external package:
 *   - Route handlers that access DB / write data but have no auth token check
 *   - Admin routes without role/permission guards
 *   - Auth endpoints missing rate-limiting headers
 *   - Middleware ordering issues (auth called after sensitive logic)
 *
 * Fail-closed: if a route file cannot be parsed, returns a fail result.
 *
 * @module @isl-lang/gate/specless/auth-drift-adapter
 */

import { readFileSync } from 'fs';
import {
  registerSpeclessCheck,
  type SpeclessCheck,
  type GateContext,
} from '../authoritative/specless-registry.js';
import type { GateEvidence } from '../authoritative/verdict-engine.js';

function isRouteFile(file: string): boolean {
  const ext = file.split('.').pop()?.toLowerCase();
  if (!['ts', 'tsx', 'js', 'jsx'].includes(ext ?? '')) return false;
  const lower = file.toLowerCase();
  return (
    lower.includes('route') ||
    lower.includes('controller') ||
    lower.includes('handler') ||
    lower.includes('/api/') ||
    lower.includes('middleware')
  );
}

interface AuthDriftFinding {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  message: string;
  confidence: number;
}

const AUTH_PATTERNS = {
  hasAuthToken: /(?:verifyToken|requireAuth|authenticate|isAuthenticated|authMiddleware|jwtVerify|getServerSession|auth\(\)|checkAuth|validateToken|session\.user|req\.user\b|headers\[['"]authorization['"]\])/i,
  hasRoleCheck: /(?:requireRole|hasPermission|can\s*\(|checkRole|RBAC|isAdmin|role\s*===|permissions\.includes|authorize\s*\()/i,
  hasRateLimit: /(?:rateLimit|rateLimiter|throttle|limiter\.)/i,
  isAdminRoute: /\/admin\//i,
  isMutationHandler: /(?:export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)|router\.(?:post|put|patch|delete)|app\.(?:post|put|patch|delete))/i,
  accessesDB: /(?:prisma\.|db\.|query\s*\(|\.create\s*\(|\.update\s*\(|\.delete\s*\(|\.insert\s*\(|\.findMany\s*\(|\.findFirst\s*\(|executeQuery|runQuery)/i,
  isAuthEndpoint: /\/(?:login|logout|signin|signup|register|forgot-password|reset-password|verify-email|oauth)/i,
  hasNoSkipComment: /\/\/\s*(?:public|no-auth|skip-auth|unauthenticated)/i,
};

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function detectAuthDriftInline(content: string, file: string): AuthDriftFinding[] {
  const findings: AuthDriftFinding[] = [];
  const lines = content.split('\n');

  const hasAuth = AUTH_PATTERNS.hasAuthToken.test(content);
  const hasRole = AUTH_PATTERNS.hasRoleCheck.test(content);
  const hasRateLimit = AUTH_PATTERNS.hasRateLimit.test(content);
  const isMutation = AUTH_PATTERNS.isMutationHandler.test(content);
  const accessesDB = AUTH_PATTERNS.accessesDB.test(content);
  const isAdminRoute = AUTH_PATTERNS.isAdminRoute.test(file);
  const isAuthEndpoint = AUTH_PATTERNS.isAuthEndpoint.test(file);
  const isExplicitlyPublic = AUTH_PATTERNS.hasNoSkipComment.test(content);

  if (isExplicitlyPublic) return [];

  if (isMutation && accessesDB && !hasAuth) {
    const idx = content.search(AUTH_PATTERNS.isMutationHandler);
    findings.push({
      type: 'mutation_without_auth',
      severity: 'critical',
      line: idx >= 0 ? getLineNumber(content, idx) : 1,
      message: `Mutation handler in ${file} writes to DB without any auth check`,
      confidence: 0.88,
    });
  }

  if (isAdminRoute && !hasRole) {
    findings.push({
      type: 'admin_route_no_rbac',
      severity: 'critical',
      line: 1,
      message: `Admin route ${file} has no role/permission guard`,
      confidence: 0.85,
    });
  }

  if (isAuthEndpoint && !hasRateLimit) {
    findings.push({
      type: 'auth_endpoint_no_rate_limit',
      severity: 'high',
      line: 1,
      message: `Auth endpoint ${file} has no rate limiting — vulnerable to brute force`,
      confidence: 0.80,
    });
  }

  if (!isMutation && !isAdminRoute && accessesDB && !hasAuth) {
    const idx = content.search(AUTH_PATTERNS.accessesDB);
    findings.push({
      type: 'read_without_auth',
      severity: 'high',
      line: idx >= 0 ? getLineNumber(content, idx) : 1,
      message: `Handler in ${file} reads from DB without verifying caller identity`,
      confidence: 0.72,
    });
  }

  const authIdx = hasAuth ? content.search(AUTH_PATTERNS.hasAuthToken) : -1;
  const dbIdx = accessesDB ? content.search(AUTH_PATTERNS.accessesDB) : -1;
  if (authIdx > 0 && dbIdx > 0 && authIdx > dbIdx) {
    findings.push({
      type: 'auth_after_db_access',
      severity: 'high',
      line: getLineNumber(content, dbIdx),
      message: `DB is accessed before auth check in ${file} — middleware ordering issue`,
      confidence: 0.82,
    });
  }

  return findings;
}

function severityToResult(severity: string): GateEvidence['result'] {
  return severity === 'critical' || severity === 'high' ? 'fail' : 'warn';
}

function severityToConfidence(severity: string): number {
  switch (severity) {
    case 'critical': return 0.95;
    case 'high': return 0.85;
    case 'medium': return 0.70;
    default: return 0.55;
  }
}

export const authDriftCheck: SpeclessCheck = {
  name: 'auth-drift-detector',

  async run(file: string, context: GateContext): Promise<GateEvidence[]> {
    if (!isRouteFile(file)) return [];

    let content: string;
    try {
      content = context.implementation?.length
        ? context.implementation
        : readFileSync(file, 'utf-8');
    } catch {
      return [{
        source: 'specless-scanner',
        check: 'auth-drift-detector',
        result: 'fail',
        confidence: 0.5,
        details: `Could not read file for auth-drift analysis: ${file}`,
      }];
    }

    const findings = detectAuthDriftInline(content, file);

    if (findings.length === 0) {
      return [{
        source: 'specless-scanner',
        check: 'auth-drift: no mismatches',
        result: 'pass',
        confidence: 0.80,
        details: `No auth drift detected in ${file}`,
      }];
    }

    return findings.map((f) => ({
      source: 'specless-scanner' as const,
      check: f.severity === 'critical' || f.severity === 'high'
        ? `security_violation: auth drift — ${f.type}`
        : `auth-drift: ${f.type}`,
      result: severityToResult(f.severity),
      confidence: severityToConfidence(f.severity),
      details: f.message,
    }));
  },
};

registerSpeclessCheck(authDriftCheck);
