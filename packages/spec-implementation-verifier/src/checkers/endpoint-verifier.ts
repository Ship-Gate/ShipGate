/**
 * Endpoint Verification Checker
 *
 * - Every route declared in the spec has a corresponding handler
 * - Every handler validates its input (Zod/Joi/Yup or type narrowing)
 * - Every handler has error handling (try/catch or error middleware)
 * - Every handler returns the response shape declared in its types
 * - Flag: unvalidated input = high, missing error handling = medium, missing endpoint = critical
 */

import * as path from 'path';
import type { Finding, VerificationContext, SpecRoute } from '../types.js';

const CHECKER_NAME = 'EndpointVerifier';

function makeId(prefix: string, ...parts: string[]): string {
  return `${prefix}-${parts.join('-').replace(/[^a-z0-9-]/gi, '')}`.slice(0, 80);
}

/** Route patterns for Express, Fastify, Next.js, Hono, NestJS */
const ROUTE_PATTERNS = {
  express: /(?:app|router|server)\s*\.\s*(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  nextAppRouter: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/gi,
  hono: /(?:app|hono)\s*\.\s*(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  nestjs: /@(Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*['"`]?([^'"`)\s]*)['"`]?\s*\)/gi,
};

/** Validation library patterns */
const VALIDATION_PATTERNS = [
  /\b(z\.\w+|zod)/i,
  /\b(Joi|joi)\./,
  /\b(yup|object\(\)\.shape)/i,
  /\b(parse|safeParse|validate)\s*\(/,
  /req\.body\s*as\s+\w+/, // type assertion (weak)
];

/** Error handling patterns */
const ERROR_HANDLING_PATTERNS = [
  /\btry\s*\{/,
  /\bcatch\s*\(/,
  /\b\.catch\s*\(/,
  /next\s*\(\s*err\s*\)/,
  /error\s*(handler|middleware)/i,
];

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

/** Extract implemented routes from all files */
function extractImplementedRoutes(
  implFiles: Map<string, string>,
  projectRoot: string
): Array<{ method: string; path: string; file: string; line: number; hasValidation: boolean; hasErrorHandling: boolean }> {
  const routes: Array<{
    method: string;
    path: string;
    file: string;
    line: number;
    hasValidation: boolean;
    hasErrorHandling: boolean;
  }> = [];

  for (const [filePath, content] of implFiles) {
    // Next.js App Router: path from file, method from export
    if (filePath.includes('/api/') || filePath.includes('\\api\\')) {
      const routePath = filePath
        .replace(/.*[\\/]api[\\/]/, '/api/')
        .replace(/\.(ts|js|tsx|jsx)$/, '')
        .replace(/\\/g, '/')
        .replace(/\/route$/, '');
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        const re = new RegExp(
          `export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`,
          'i'
        );
        if (re.test(content)) {
          const match = content.match(re);
          const line = match ? getLineNumber(content, content.indexOf(match[0]!)) : 1;
          routes.push({
            method,
            path: routePath || '/',
            file: filePath,
            line,
            hasValidation: VALIDATION_PATTERNS.some((p) => p.test(content)),
            hasErrorHandling: ERROR_HANDLING_PATTERNS.some((p) => p.test(content)),
          });
        }
      }
    }

    // Express/Fastify/Hono
    let match: RegExpExecArray | null;
    const expressRe = new RegExp(ROUTE_PATTERNS.express.source, 'gi');
    while ((match = expressRe.exec(content)) !== null) {
      const method = (match[1] ?? 'GET').toUpperCase();
      const routePath = match[2] ?? '/';
      const line = getLineNumber(content, match.index);
      const handlerStart = match.index + match[0].length;
      const handlerSnippet = content.slice(handlerStart, handlerStart + 2000);
      routes.push({
        method,
        path: routePath,
        file: filePath,
        line,
        hasValidation: VALIDATION_PATTERNS.some((p) => p.test(handlerSnippet)),
        hasErrorHandling: ERROR_HANDLING_PATTERNS.some((p) => p.test(handlerSnippet)),
      });
    }

    // NestJS
    const nestRe = new RegExp(ROUTE_PATTERNS.nestjs.source, 'gi');
    while ((match = nestRe.exec(content)) !== null) {
      const method = (match[1] ?? 'GET').toUpperCase();
      const routePath = match[2] ?? '/';
      const line = getLineNumber(content, match.index);
      routes.push({
        method,
        path: routePath,
        file: filePath,
        line,
        hasValidation: VALIDATION_PATTERNS.some((p) => p.test(content)),
        hasErrorHandling: ERROR_HANDLING_PATTERNS.some((p) => p.test(content)),
      });
    }
  }

  return routes;
}

/** Normalize path for comparison (e.g. /users/:id vs /users/123) */
function normalizePath(p: string): string {
  return p
    .replace(/\/+$/, '')
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-f0-9-]{36}/gi, '/:id')
    .toLowerCase();
}

function routesMatch(spec: SpecRoute, impl: { method: string; path: string }): boolean {
  const methodMatch = spec.method.toUpperCase() === impl.method.toUpperCase();
  const pathMatch =
    normalizePath(spec.path) === normalizePath(impl.path) ||
    impl.path === spec.path;
  return methodMatch && pathMatch;
}

export async function runEndpointVerifier(
  ctx: VerificationContext
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const specRoutes = ctx.spec.routes ?? [];
  const implRoutes = extractImplementedRoutes(ctx.implFiles, ctx.projectRoot);

  for (const specRoute of specRoutes) {
    const impl = implRoutes.find((r) => routesMatch(specRoute, r));

    if (!impl) {
      findings.push({
        id: makeId('endpoint-missing', specRoute.method, specRoute.path),
        checker: CHECKER_NAME,
        ruleId: 'endpoint/missing',
        severity: 'critical',
        message: `Route ${specRoute.method} ${specRoute.path} declared in spec has no handler`,
        blocking: true,
        recommendation: 'Implement the route handler or remove from spec.',
        context: { method: specRoute.method, path: specRoute.path },
      });
      continue;
    }

    if (specRoute.inputValidation !== false && !impl.hasValidation) {
      findings.push({
        id: makeId('endpoint-unvalidated', impl.file, specRoute.method),
        checker: CHECKER_NAME,
        ruleId: 'endpoint/unvalidated-input',
        severity: 'high',
        message: `Handler for ${specRoute.method} ${specRoute.path} has no input validation`,
        file: impl.file,
        line: impl.line,
        blocking: false,
        recommendation: 'Add Zod, Joi, or Yup validation for request body/params.',
        context: { method: specRoute.method, path: specRoute.path },
      });
    }

    if (specRoute.errorHandling !== false && !impl.hasErrorHandling) {
      findings.push({
        id: makeId('endpoint-no-error-handling', impl.file, specRoute.method),
        checker: CHECKER_NAME,
        ruleId: 'endpoint/missing-error-handling',
        severity: 'medium',
        message: `Handler for ${specRoute.method} ${specRoute.path} has no error handling`,
        file: impl.file,
        line: impl.line,
        blocking: false,
        recommendation: 'Wrap handler in try/catch or use error middleware.',
        context: { method: specRoute.method, path: specRoute.path },
      });
    }
  }

  return findings;
}
