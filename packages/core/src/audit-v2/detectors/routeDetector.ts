/**
 * Route Detector V2
 *
 * Enhanced detection of API routes and handlers with support for
 * Next.js (App Router & Pages), Express, Fastify, Hono, and NestJS.
 */

import type {
  DetectorResult,
  DetectedCandidate,
  RiskFlag,
  FrameworkHint,
  AuditOptionsV2,
} from '../types.js';

/**
 * Route patterns for various frameworks
 */
const ROUTE_PATTERNS = {
  // Next.js App Router: export async function GET(req)
  nextjsAppRouter: {
    pattern: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/g,
    framework: 'nextjs-app' as FrameworkHint,
    confidence: 0.95,
  },
  // Next.js Pages API: export default function handler
  nextjsPagesApi: {
    pattern: /export\s+default\s+(?:async\s+)?function\s*(\w*)\s*\(/g,
    framework: 'nextjs-pages' as FrameworkHint,
    confidence: 0.8,
  },
  // Express/Fastify: app.get('/path', handler)
  express: {
    pattern: /(?:app|router|server)\s*\.\s*(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    framework: 'express' as FrameworkHint,
    confidence: 0.9,
  },
  // Hono: app.get('/path', (c) => {})
  hono: {
    pattern: /(?:app|hono)\s*\.\s*(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    framework: 'hono' as FrameworkHint,
    confidence: 0.9,
  },
  // Fastify with route config
  fastifyRoute: {
    pattern: /\.route\s*\(\s*\{[^}]*method:\s*['"`](\w+)['"`][^}]*url:\s*['"`]([^'"`]+)['"`]/gi,
    framework: 'fastify' as FrameworkHint,
    confidence: 0.9,
  },
  // NestJS decorators
  nestjs: {
    pattern: /@(Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*['"`]?([^'"`)\s]*)['"`]?\s*\)/gi,
    framework: 'nestjs' as FrameworkHint,
    confidence: 0.95,
  },
};

/**
 * Detect routes in file content
 */
export function detectRoutes(
  content: string,
  filePath: string,
  options: AuditOptionsV2
): DetectorResult {
  const candidates: DetectedCandidate[] = [];
  const riskFlags: RiskFlag[] = [];
  const frameworkHints: Set<FrameworkHint> = new Set();
  const lines = content.split('\n');

  // Detect framework based on file path and content
  const detectedFramework = detectFramework(content, filePath);
  if (detectedFramework !== 'unknown') {
    frameworkHints.add(detectedFramework);
  }

  // Check each pattern type
  for (const [patternName, patternConfig] of Object.entries(ROUTE_PATTERNS)) {
    const { pattern, framework, confidence } = patternConfig;
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);
      const httpMethod = match[1]?.toUpperCase() || 'ANY';
      const routePath = match[2] || extractRouteFromFilePath(filePath);

      // Skip if confidence below threshold
      if (confidence < (options.minConfidence ?? 0.4)) continue;

      // Avoid duplicates
      if (candidates.some(c => c.filePath === filePath && c.line === line)) {
        continue;
      }

      frameworkHints.add(framework);

      const candidate: DetectedCandidate = {
        id: `route-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}-${line}`,
        category: 'route',
        name: `${httpMethod} ${routePath}`,
        filePath,
        line,
        endLine: findEndLine(lines, line - 1),
        snippet: options.includeSnippets
          ? extractSnippet(lines, line - 1, options.maxSnippetLines ?? 10)
          : undefined,
        confidence,
        httpMethod,
        routePath,
        framework,
        metadata: {
          patternType: patternName,
        },
      };

      candidates.push(candidate);

      // Check for risk flags
      const contextContent = extractContext(lines, line - 1, 50);
      const routeRisks = detectRouteRisks(
        contextContent,
        candidate,
        filePath,
        line
      );
      riskFlags.push(...routeRisks);
    }
  }

  return {
    candidates,
    riskFlags,
    frameworkHints: Array.from(frameworkHints),
  };
}

/**
 * Detect framework from content and file path
 */
function detectFramework(content: string, filePath: string): FrameworkHint {
  // Next.js App Router
  if (
    filePath.includes('/app/') &&
    /route\.(ts|js)$/.test(filePath) &&
    /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE)/i.test(content)
  ) {
    return 'nextjs-app';
  }

  // Next.js Pages API
  if (filePath.includes('/pages/api/')) {
    return 'nextjs-pages';
  }

  // Hono
  if (/import.*['"`]hono['"`]|from\s+['"`]hono['"`]/i.test(content)) {
    return 'hono';
  }

  // Fastify
  if (/import.*['"`]fastify['"`]|from\s+['"`]fastify['"`]/i.test(content)) {
    return 'fastify';
  }

  // Express
  if (/import.*['"`]express['"`]|from\s+['"`]express['"`]|require\s*\(\s*['"`]express['"`]\)/i.test(content)) {
    return 'express';
  }

  // NestJS
  if (/@Controller|@Get|@Post|@Module/i.test(content)) {
    return 'nestjs';
  }

  // Koa
  if (/import.*['"`]koa['"`]|from\s+['"`]koa['"`]/i.test(content)) {
    return 'koa';
  }

  return 'unknown';
}

/**
 * Extract route from file path (file-based routing)
 */
function extractRouteFromFilePath(filePath: string): string {
  // Next.js App Router
  const appRouterMatch = filePath.match(/\/app(.*)\/route\.(ts|js)x?$/);
  if (appRouterMatch) {
    return appRouterMatch[1]?.replace(/\/\[([^\]]+)\]/g, '/:$1') || '/';
  }

  // Next.js Pages API
  const pagesApiMatch = filePath.match(/\/pages\/api(.*)$/);
  if (pagesApiMatch) {
    const route = pagesApiMatch[1]
      ?.replace(/\.(ts|js)x?$/, '')
      .replace(/\/\[([^\]]+)\]/g, '/:$1')
      .replace(/\/index$/, '');
    return `/api${route || ''}` || '/api';
  }

  return '/unknown';
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Find end line of a function/block
 */
function findEndLine(lines: string[], startLineIndex: number): number {
  let braceCount = 0;
  let foundStart = false;

  for (let i = startLineIndex; i < Math.min(lines.length, startLineIndex + 100); i++) {
    const line = lines[i] || '';
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundStart = true;
      } else if (char === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          return i + 1;
        }
      }
    }
  }

  return Math.min(startLineIndex + 50, lines.length);
}

/**
 * Extract code snippet
 */
function extractSnippet(
  lines: string[],
  startLineIndex: number,
  maxLines: number
): string {
  const endIndex = Math.min(startLineIndex + maxLines, lines.length);
  return lines.slice(startLineIndex, endIndex).join('\n');
}

/**
 * Extract context around a line
 */
function extractContext(
  lines: string[],
  lineIndex: number,
  contextSize: number
): string {
  const start = Math.max(0, lineIndex);
  const end = Math.min(lines.length, lineIndex + contextSize);
  return lines.slice(start, end).join('\n');
}

/**
 * Detect risk flags for a route
 */
function detectRouteRisks(
  contextContent: string,
  candidate: DetectedCandidate,
  filePath: string,
  line: number
): RiskFlag[] {
  const risks: RiskFlag[] = [];

  // Check for missing auth
  const hasAuth =
    /(?:isAuthenticated|requireAuth|auth\s*\(|session|currentUser|getUser|clerk|nextauth|@UseGuards)/i.test(
      contextContent
    );

  if (!hasAuth) {
    risks.push({
      id: `risk-no-auth-${candidate.id}`,
      category: 'route-without-auth',
      severity: 'warning',
      description: `Route ${candidate.name} has no visible authentication check`,
      filePath,
      line,
      suggestion: 'Add authentication middleware or guard to protect this endpoint',
      relatedCandidates: [candidate.id],
    });
  }

  // Check for missing validation
  const hasValidation =
    /(?:validate|schema|zod|yup|joi|z\.object|\.parse\(|class-validator|@Body|@Query|@Param)/i.test(
      contextContent
    );

  if (!hasValidation) {
    risks.push({
      id: `risk-no-validation-${candidate.id}`,
      category: 'route-without-validation',
      severity: 'info',
      description: `Route ${candidate.name} has no visible input validation`,
      filePath,
      line,
      suggestion: 'Consider adding input validation using zod, yup, or similar',
      relatedCandidates: [candidate.id],
    });
  }

  return risks;
}

/**
 * Check if a file is likely to contain routes
 */
export function isRouteFile(filePath: string): boolean {
  const routePatterns = [
    /route\.(ts|js)x?$/,
    /\/api\//,
    /controller\.(ts|js)$/,
    /\.controller\.(ts|js)$/,
    /router\.(ts|js)$/,
    /routes?\.(ts|js)$/,
    /endpoint/i,
  ];

  return routePatterns.some(p => p.test(filePath));
}
