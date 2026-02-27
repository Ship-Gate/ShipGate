/**
 * Auth Bypass Check
 *
 * For every route marked `must: authenticated` in ISL, verify the route file
 * imports and calls auth middleware. Report any protected route missing auth.
 */

import type { SecurityCheckResult, SecurityFinding } from '../types.js';

export const CHECK_ID = 'auth-bypass';

interface ScanInput {
  islSource: string;
  implFiles: Array<{ path: string; content: string }>;
  /** Map behavior/route name to expected route file path */
  routeMapping?: Map<string, string>;
}

/** Extract behaviors/routes that require authentication from ISL */
function extractProtectedRoutes(islSource: string): string[] {
  const protectedRoutes: string[] = [];
  const lines = islSource.split('\n');

  // Pattern: must: authenticated or auth: authenticated
  const authPatterns = [
    /must:\s*authenticated/i,
    /auth:\s*authenticated/i,
    /requires:\s*authenticated/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const pattern of authPatterns) {
      if (pattern.test(line)) {
        // Try to find behavior/route name - look for POST "/path" or GET "/path" or behavior name
        const routeMatch = line.match(
          /(?:POST|GET|PUT|PATCH|DELETE)\s+["'`]([^"'`]+)["'`]|(\w+)\s*\{/
        );
        if (routeMatch) {
          const route = routeMatch[1] ?? routeMatch[2];
          if (route) protectedRoutes.push(route);
        }
        // Also check previous lines for behavior name
        for (let j = Math.max(0, i - 5); j < i; j++) {
          const prevLine = lines[j]!;
          const behaviorMatch = prevLine.match(
            /^\s*(?:POST|GET|PUT|PATCH|DELETE)\s+["'`]([^"'`]+)["'`]|^\s*(\w+)\s+["'`]/
          );
          if (behaviorMatch) {
            const r = behaviorMatch[1] ?? behaviorMatch[2];
            if (r && !protectedRoutes.includes(r)) protectedRoutes.push(r);
          }
        }
      }
    }
  }

  // Extract behavior names with actors { must: authenticated }
  const actorBlockMatch = islSource.match(
    /(\w+)\s*\{[^}]*must:\s*authenticated[^}]*\}/gi
  );
  if (actorBlockMatch) {
    for (const m of actorBlockMatch) {
      const nameMatch = m.match(/(\w+)\s*\{/);
      if (nameMatch) protectedRoutes.push(nameMatch[1]!);
    }
  }

  // Extract route paths from intents: POST "/users" -> CreateUser { auth: authenticated }
  const intentMatch = islSource.matchAll(
    /(?:POST|GET|PUT|PATCH|DELETE)\s+["'`]([^"'`]+)["'`]\s*->\s*\w+\s*\{[^}]*auth:\s*authenticated/gi
  );
  for (const m of intentMatch) {
    if (m[1] && !protectedRoutes.includes(m[1])) {
      protectedRoutes.push(m[1]);
    }
  }

  return [...new Set(protectedRoutes)];
}

/** Auth middleware patterns */
const AUTH_PATTERNS = [
  /requireAuth|require_auth|requireAuthMiddleware/,
  /isAuthenticated|is_authenticated/,
  /authMiddleware|auth\.middleware/,
  /verifyToken|verify_token|verifyJwt/,
  /withAuth|with_auth/,
  /protectRoute|protect_route/,
  /authenticate\(|auth\(/,
  /middleware.*auth|auth.*middleware/,
];

function fileHasAuthMiddleware(content: string): boolean {
  return AUTH_PATTERNS.some((p) => p.test(content));
}

function fileImportsAuth(content: string): boolean {
  return (
    /import.*auth|from.*auth|require\(.*auth/.test(content) ||
    /import.*middleware|from.*middleware/.test(content)
  );
}

/**
 * Heuristic: match route paths to files.
 * e.g. /api/users -> api/users/route.ts, app/api/users/route.ts, src/routes/users.ts
 */
function findRouteFiles(
  routePath: string,
  implFiles: Array<{ path: string }>
): string[] {
  const normalized = routePath.replace(/^\//, '').replace(/\//g, '-');
  const pathParts = routePath.replace(/^\//, '').split('/');

  return implFiles
    .filter((f) => {
      const path = f.path.replace(/\\/g, '/');
      return (
        path.includes(pathParts[0] ?? '') ||
        path.includes(normalized) ||
        path.includes(routePath.replace(/\//g, '/'))
      );
    })
    .map((f) => f.path);
}

export function runAuthBypassCheck(input: ScanInput): SecurityCheckResult {
  const findings: SecurityFinding[] = [];
  const protectedRoutes = extractProtectedRoutes(input.islSource);

  if (protectedRoutes.length === 0) {
    return {
      check: CHECK_ID,
      severity: 'low',
      passed: true,
      findings: [],
    };
  }

  for (const route of protectedRoutes) {
    const candidateFiles = findRouteFiles(route, input.implFiles);

    if (candidateFiles.length === 0) {
      // No implementation file found - might be OK if route is in a different structure
      continue;
    }

    let anyHasAuth = false;
    for (const filePath of candidateFiles) {
      const file = input.implFiles.find((f) => f.path === filePath);
      if (!file) continue;

      const hasAuth = fileHasAuthMiddleware(file.content);
      const importsAuth = fileImportsAuth(file.content);

      if (hasAuth) {
        anyHasAuth = true;
        break;
      }

      if (!importsAuth && !hasAuth) {
        findings.push({
          id: 'AUTH001',
          title: `Protected route "${route}" may lack auth middleware`,
          severity: 'high',
          file: filePath,
          line: 1,
          description: `ISL specifies "must: authenticated" for ${route}, but no auth middleware detected in implementation.`,
          recommendation:
            'Import and apply auth middleware (e.g. requireAuth) to this route.',
          context: { route, protectedRoutes: protectedRoutes.length },
        });
      }
    }

    if (!anyHasAuth && candidateFiles.length > 0) {
      const firstFile = input.implFiles.find((f) =>
        candidateFiles.includes(f.path)
      );
      if (firstFile && !fileHasAuthMiddleware(firstFile.content)) {
        const existing = findings.find(
          (f) => f.context?.route === route && f.file === firstFile.path
        );
        if (!existing) {
          findings.push({
            id: 'AUTH002',
            title: `Route "${route}" requires auth but middleware not found`,
            severity: 'critical',
            file: firstFile.path,
            line: 1,
            description: `ISL requires authentication for ${route}. Verify auth middleware is applied.`,
            recommendation:
              'Add requireAuth (or equivalent) middleware to protect this route.',
            context: { route },
          });
        }
      }
    }
  }

  // Deduplicate by file+route
  const seen = new Set<string>();
  const uniqueFindings = findings.filter((f) => {
    const key = `${f.file}:${f.context?.route ?? f.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const criticalOrHigh = uniqueFindings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );

  return {
    check: CHECK_ID,
    severity: criticalOrHigh.length > 0 ? 'high' : 'medium',
    passed: criticalOrHigh.length === 0,
    findings: uniqueFindings,
  };
}
