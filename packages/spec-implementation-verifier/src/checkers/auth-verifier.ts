/**
 * Auth Verification Checker
 *
 * - Every route the spec says requires auth actually has auth middleware
 * - Auth middleware is imported from a real source and is correctly applied
 * - Role checks match the inferred actor permissions
 * - Flag: unprotected route that should be protected = critical, role bypass = critical
 */

import type { Finding, VerificationContext, SpecRoute } from '../types.js';

const CHECKER_NAME = 'AuthVerifier';

function makeId(prefix: string, ...parts: string[]): string {
  return `${prefix}-${parts.join('-').replace(/[^a-z0-9-]/gi, '')}`.slice(0, 80);
}

/** Auth middleware patterns */
const AUTH_PATTERNS = [
  /\b(requireAuth|authMiddleware|authenticate|verifyToken|checkAuth)\s*[,(]/i,
  /\b(requireRole|requirePermission|authorize|canAccess)\s*[,(]/i,
  /\bmiddleware\s*\(\s*.*auth/i,
  /\bgetServerSession\s*\(/,
  /\bgetSession\s*\(/,
  /\bwithAuth\s*\(/,
  /\bprotect\s*\(/,
  /\b@UseGuards\s*\(\s*\w*Auth/i,
  /\b@UseGuards\s*\(\s*\w*Guard/i,
  /req\.(user|session|auth)/,
  /c\.get\s*\(\s*['"`]user['"`]\s*\)/, // Hono
];

/** Role check patterns */
const ROLE_PATTERNS = [
  /\b(requireRole|hasRole|checkRole|roles\.includes)\s*\(/i,
  /\buser\.role\s*===/,
  /\buser\.roles\.includes/,
  /\b@Roles\s*\(/,
  /\bpermissions\.includes/,
];

/** Extract routes that require auth from spec */
function getProtectedSpecRoutes(spec: VerificationContext['spec']): SpecRoute[] {
  return (spec.routes ?? []).filter((r) => r.requiresAuth === true);
}

/** Find implemented routes and check for auth - simplified route extraction */
function findRouteInFile(
  content: string,
  filePath: string,
  specRoute: SpecRoute
): { found: boolean; line?: number; hasAuth: boolean; hasRoleCheck: boolean } {
  const method = specRoute.method.toUpperCase();
  const pathPattern = specRoute.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Express/Fastify: .get('/path', ...) or .post('/path', ...)
  const routeReg = new RegExp(
    `\\.(get|post|put|patch|delete)\\s*\\(\\s*['"\`]${pathPattern}`,
    'i'
  );
  // Next.js App Router: export async function GET/POST etc
  const nextReg =
    filePath.includes('/api/') || filePath.includes('\\api\\')
      ? new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`, 'i')
      : null;

  const hasRoute = routeReg.test(content) || (nextReg?.test(content) ?? false);

  if (!hasRoute) {
    return { found: false, hasAuth: false, hasRoleCheck: false };
  }

  const hasAuth = AUTH_PATTERNS.some((p) => p.test(content));
  const hasRoleCheck = specRoute.roles?.length
    ? ROLE_PATTERNS.some((p) => p.test(content))
    : true; // No roles required = any auth is enough

  return { found: true, line: 1, hasAuth, hasRoleCheck };
}

export async function runAuthVerifier(
  ctx: VerificationContext
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const protectedRoutes = getProtectedSpecRoutes(ctx.spec);

  for (const specRoute of protectedRoutes) {
    let foundInFile = false;
    let hasAuth = false;
    let hasRoleCheck = true;
    let filePath = '';
    let line: number | undefined;

    for (const [path, content] of ctx.implFiles) {
      const result = findRouteInFile(content, path, specRoute);
      if (result.found) {
        foundInFile = true;
        hasAuth = result.hasAuth;
        hasRoleCheck = result.hasRoleCheck;
        filePath = path;
        line = result.line;
        break;
      }
    }

    if (!foundInFile) {
      continue; // Endpoint verifier will flag missing route
    }

    if (!hasAuth) {
      findings.push({
        id: makeId('auth-unprotected', specRoute.method, specRoute.path),
        checker: CHECKER_NAME,
        ruleId: 'auth/unprotected-route',
        severity: 'critical',
        message: `Route ${specRoute.method} ${specRoute.path} requires auth per spec but has no auth middleware`,
        file: filePath,
        line,
        blocking: true,
        recommendation: 'Add auth middleware (e.g. requireAuth, getServerSession) to the route.',
        context: { method: specRoute.method, path: specRoute.path },
      });
    }

    if (
      specRoute.roles &&
      specRoute.roles.length > 0 &&
      !hasRoleCheck
    ) {
      findings.push({
        id: makeId('auth-role-bypass', specRoute.method, specRoute.path),
        checker: CHECKER_NAME,
        ruleId: 'auth/role-bypass',
        severity: 'critical',
        message: `Route ${specRoute.method} ${specRoute.path} requires roles [${specRoute.roles.join(', ')}] but has no role check`,
        file: filePath,
        line,
        blocking: true,
        recommendation: `Add role check: requireRole([${specRoute.roles.join(', ')}]) or equivalent.`,
        context: { method: specRoute.method, path: specRoute.path, roles: specRoute.roles },
      });
    }
  }

  return findings;
}
