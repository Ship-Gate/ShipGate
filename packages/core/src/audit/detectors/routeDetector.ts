/**
 * Route Detector
 *
 * Detects API routes and endpoints in the workspace.
 * Supports multiple frameworks: Express, Fastify, Next.js, Hono, etc.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { DetectedImplementation, DetectedPattern } from '../auditTypes.js';

/**
 * Framework-specific route patterns
 */
const ROUTE_PATTERNS = {
  // Express/Fastify style: app.get('/path', handler)
  express: [
    /(?:app|router|server)\s*\.\s*(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  ],
  // Next.js App Router: export async function GET(req)
  nextAppRouter: [
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/gi,
  ],
  // Next.js Pages API: export default function handler
  nextPagesApi: [
    /export\s+default\s+(?:async\s+)?function\s+(\w+)/gi,
  ],
  // Hono: app.get('/path', (c) => {})
  hono: [
    /(?:app|hono)\s*\.\s*(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  ],
  // Fastify with schema: fastify.route({ method, url })
  fastifyRoute: [
    /\.route\s*\(\s*\{[^}]*method:\s*['"`](\w+)['"`][^}]*url:\s*['"`]([^'"`]+)['"`]/gi,
  ],
  // NestJS decorators: @Get('/path')
  nestjs: [
    /@(Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*['"`]?([^'"`)\s]*)['"`]?\s*\)/gi,
  ],
  // Python FastAPI/Flask: @app.get('/path')
  python: [
    /@(?:app|router|blueprint)\s*\.\s*(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  ],
};

/**
 * File patterns that typically contain routes
 */
const ROUTE_FILE_PATTERNS = [
  /route/i,
  /api/i,
  /controller/i,
  /handler/i,
  /endpoint/i,
];

/**
 * Detect routes in a single file
 */
export async function detectRoutesInFile(
  workspacePath: string,
  filePath: string
): Promise<DetectedImplementation[]> {
  const implementations: DetectedImplementation[] = [];
  const fullPath = path.join(workspacePath, filePath);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Detect framework and use appropriate patterns
    const frameworkPatterns = detectFrameworkPatterns(content, filePath);

    for (const [framework, patterns] of Object.entries(frameworkPatterns)) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(content)) !== null) {
          const line = getLineNumber(content, match.index);
          const method = match[1]?.toUpperCase() || 'UNKNOWN';
          const routePath = match[2] || extractRouteFromFilePath(filePath);

          // Skip if already detected at this line
          if (implementations.some(i => i.filePath === filePath && i.line === line)) {
            continue;
          }

          const impl: DetectedImplementation = {
            id: `route-${filePath}-${line}`,
            name: `${method} ${routePath}`,
            type: 'route',
            filePath,
            line,
            httpMethod: method,
            routePath,
            patterns: detectPatternsInContext(content, line, lines),
            confidence: calculateConfidence(framework, match),
          };

          implementations.push(impl);
        }
      }
    }

    // Also detect route handlers without explicit HTTP method
    const handlerMatches = detectGenericHandlers(content, filePath);
    implementations.push(...handlerMatches);

  } catch {
    // File not readable
  }

  return implementations;
}

/**
 * Detect which framework patterns to use based on file content
 */
function detectFrameworkPatterns(content: string, filePath: string): Record<string, RegExp[]> {
  const patterns: Record<string, RegExp[]> = {};

  // Check for Next.js App Router
  if (filePath.includes('/app/') && /route\.(ts|js)$/.test(filePath)) {
    patterns.nextAppRouter = ROUTE_PATTERNS.nextAppRouter;
  }

  // Check for Next.js Pages API
  if (filePath.includes('/pages/api/')) {
    patterns.nextPagesApi = ROUTE_PATTERNS.nextPagesApi;
  }

  // Check for Express/Fastify
  if (/(?:express|fastify|koa|hono)/.test(content) || /\.(get|post|put|delete)\s*\(/.test(content)) {
    patterns.express = ROUTE_PATTERNS.express;
    patterns.hono = ROUTE_PATTERNS.hono;
  }

  // Check for NestJS
  if (/@(?:Controller|Get|Post|Put|Delete)/.test(content)) {
    patterns.nestjs = ROUTE_PATTERNS.nestjs;
  }

  // Check for Python
  if (filePath.endsWith('.py')) {
    patterns.python = ROUTE_PATTERNS.python;
  }

  // Check for Fastify route config
  if (/\.route\s*\(/.test(content)) {
    patterns.fastifyRoute = ROUTE_PATTERNS.fastifyRoute;
  }

  return patterns;
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Extract route path from file path (for file-based routing)
 */
function extractRouteFromFilePath(filePath: string): string {
  // Next.js App Router
  const appRouterMatch = filePath.match(/\/app(.*)\/route\.(ts|js)$/);
  if (appRouterMatch) {
    return appRouterMatch[1] || '/';
  }

  // Next.js Pages API
  const pagesApiMatch = filePath.match(/\/pages\/api(.*)$/);
  if (pagesApiMatch) {
    return `/api${pagesApiMatch[1]?.replace(/\.(ts|js)x?$/, '') || ''}`;
  }

  return '/unknown';
}

/**
 * Detect patterns in the context around a route
 */
function detectPatternsInContext(
  content: string,
  routeLine: number,
  lines: string[]
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const contextStart = Math.max(0, routeLine - 1);
  const contextEnd = Math.min(lines.length, routeLine + 50);
  const contextLines = lines.slice(contextStart, contextEnd);
  const contextContent = contextLines.join('\n');

  // Auth checks
  if (/(?:isAuthenticated|requireAuth|auth\s*\(|session|currentUser|getUser)/i.test(contextContent)) {
    patterns.push({
      type: 'auth-check',
      description: 'Authentication check detected',
      line: routeLine,
    });
  }

  // Validation
  if (/(?:validate|schema|zod|yup|joi|z\.object|\.parse\()/i.test(contextContent)) {
    patterns.push({
      type: 'validation',
      description: 'Input validation detected',
      line: routeLine,
    });
  }

  // Error handling
  if (/(?:try\s*\{|catch\s*\(|\.catch\s*\(|throw\s+new)/i.test(contextContent)) {
    patterns.push({
      type: 'error-handling',
      description: 'Error handling detected',
      line: routeLine,
    });
  }

  // Database operations
  if (/(?:prisma|db\.|\.findMany|\.findUnique|\.create\(|\.update\(|\.delete\(|SELECT|INSERT|UPDATE)/i.test(contextContent)) {
    patterns.push({
      type: 'database',
      description: 'Database operation detected',
      line: routeLine,
    });
  }

  // External calls
  if (/(?:fetch\s*\(|axios\.|http\.|\.request\()/i.test(contextContent)) {
    patterns.push({
      type: 'external-call',
      description: 'External API call detected',
      line: routeLine,
    });
  }

  return patterns;
}

/**
 * Detect generic handler functions
 */
function detectGenericHandlers(content: string, filePath: string): DetectedImplementation[] {
  const implementations: DetectedImplementation[] = [];
  const lines = content.split('\n');

  // Look for handler-like function exports
  const handlerPattern = /export\s+(?:async\s+)?function\s+(\w*handler\w*)\s*\(/gi;
  let match: RegExpExecArray | null;

  while ((match = handlerPattern.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    const functionName = match[1];

    implementations.push({
      id: `handler-${filePath}-${line}`,
      name: functionName || 'handler',
      type: 'handler',
      filePath,
      line,
      functionName,
      patterns: detectPatternsInContext(content, line, lines),
      confidence: 0.6,
    });
  }

  return implementations;
}

/**
 * Calculate confidence based on framework and match quality
 */
function calculateConfidence(framework: string, match: RegExpExecArray): number {
  let confidence = 0.7;

  // Explicit HTTP method adds confidence
  if (match[1] && /^(GET|POST|PUT|PATCH|DELETE)$/i.test(match[1])) {
    confidence += 0.1;
  }

  // Explicit route path adds confidence
  if (match[2] && match[2].startsWith('/')) {
    confidence += 0.1;
  }

  // Known frameworks add confidence
  if (['nextAppRouter', 'nestjs', 'fastifyRoute'].includes(framework)) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Check if a file is likely to contain routes
 */
export function isLikelyRouteFile(filePath: string): boolean {
  return ROUTE_FILE_PATTERNS.some(pattern => pattern.test(filePath));
}
