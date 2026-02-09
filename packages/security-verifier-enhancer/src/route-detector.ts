/**
 * Route Auth Enforcement Detector
 * Detects authentication and authorization enforcement in route implementations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ObservedAuthPolicy } from './types.js';

/**
 * Auth middleware patterns
 */
const AUTH_MIDDLEWARE_PATTERNS = [
  // Express/Fastify/Hono
  /(?:requireAuth|isAuthenticated|auth|authenticate|withAuth|protectRoute)\s*\(/gi,
  // Next.js
  /(?:getServerSession|auth\(\)|getSession|requireAuth)/gi,
  // NestJS
  /@UseGuards\s*\([^)]*AuthGuard/gi,
  /@UseGuards\s*\([^)]*JwtAuthGuard/gi,
  // Generic
  /(?:middleware|guard)\s*\([^)]*auth/gi,
];

/**
 * Role check patterns
 */
const ROLE_CHECK_PATTERNS = [
  /(?:hasRole|checkRole|requireRole|authorize|@Roles)\s*\([^)]*['"`]([^'"`]+)['"`]/gi,
  /\.role\s*(?:==|===|in|includes)\s*['"`]?(\w+)['"`]?/gi,
  /role\s*:\s*['"`]?(\w+)['"`]?/gi,
];

/**
 * Permission check patterns
 */
const PERMISSION_CHECK_PATTERNS = [
  /(?:hasPermission|checkPermission|requirePermission|can|@Permissions)\s*\([^)]*['"`]([^'"`]+)['"`]/gi,
  /permission\s*:\s*['"`]?([^'"`]+)['"`]?/gi,
];

/**
 * Route patterns (from routeDetector.ts)
 */
const ROUTE_PATTERNS = {
  nextjsAppRouter: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/g,
  express: /(?:app|router|server)\s*\.\s*(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  hono: /(?:app|hono)\s*\.\s*(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  nestjs: /@(Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*['"`]?([^'"`)\s]*)['"`]?\s*\)/gi,
};

/**
 * Extract observed auth policies from route files
 */
export async function extractObservedAuthPolicies(
  filePath: string,
  content: string
): Promise<ObservedAuthPolicy[]> {
  const policies: ObservedAuthPolicy[] = [];
  const lines = content.split('\n');

  // Detect routes
  const routes = detectRoutes(content, filePath);
  
  for (const route of routes) {
    const { method, path: routePath, line } = route;
    
    // Extract context around route definition
    const contextStart = Math.max(0, line - 20);
    const contextEnd = Math.min(lines.length, line + 50);
    const context = lines.slice(contextStart, contextEnd).join('\n');
    
    // Detect auth enforcement
    const authPatterns: string[] = [];
    let enforcementType: ObservedAuthPolicy['enforcementType'] = 'none';
    let confidence = 0.5;
    
    // Check for middleware patterns
    for (const pattern of AUTH_MIDDLEWARE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(context)) {
        authPatterns.push(pattern.source);
        enforcementType = 'middleware';
        confidence = Math.max(confidence, 0.8);
      }
    }
    
    // Check for guard patterns (NestJS)
    if (/@UseGuards/.test(context)) {
      authPatterns.push('@UseGuards');
      enforcementType = 'guard';
      confidence = Math.max(confidence, 0.85);
    }
    
    // Check for decorator patterns
    if (/@(?:Auth|RequireAuth|Protected)/.test(context)) {
      authPatterns.push('@Auth decorator');
      enforcementType = 'decorator';
      confidence = Math.max(confidence, 0.8);
    }
    
    // Check for manual auth checks
    if (/(?:req\.user|ctx\.user|session\.user|currentUser|getUser)/.test(context)) {
      authPatterns.push('manual user check');
      if (enforcementType === 'none') {
        enforcementType = 'manual-check';
        confidence = Math.max(confidence, 0.7);
      }
    }
    
    // Extract roles
    const detectedRoles: string[] = [];
    for (const pattern of ROLE_CHECK_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(context)) !== null) {
        const role = match[1];
        if (role && !detectedRoles.includes(role)) {
          detectedRoles.push(role);
        }
      }
    }
    
    // Extract permissions
    const detectedPermissions: string[] = [];
    for (const pattern of PERMISSION_CHECK_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(context)) !== null) {
        const permission = match[1];
        if (permission && !detectedPermissions.includes(permission)) {
          detectedPermissions.push(permission);
        }
      }
    }
    
    // Determine if auth is required
    const hasAuth = authPatterns.length > 0 || detectedRoles.length > 0 || detectedPermissions.length > 0;
    
    policies.push({
      routePath,
      httpMethod: method,
      filePath,
      line,
      enforcementType: hasAuth ? enforcementType : 'none',
      detectedRoles: detectedRoles.length > 0 ? detectedRoles : undefined,
      detectedPermissions: detectedPermissions.length > 0 ? detectedPermissions : undefined,
      authPatterns,
      confidence: hasAuth ? confidence : 0.3, // Low confidence for no auth
      snippet: extractSnippet(lines, line - 1, 15),
    });
  }

  return policies;
}

/**
 * Detect routes in content
 */
function detectRoutes(content: string, filePath: string): Array<{ method: string; path: string; line: number }> {
  const routes: Array<{ method: string; path: string; line: number }> = [];
  
  // Next.js App Router
  let match: RegExpExecArray | null;
  const nextjsPattern = ROUTE_PATTERNS.nextjsAppRouter;
  nextjsPattern.lastIndex = 0;
  while ((match = nextjsPattern.exec(content)) !== null) {
    const method = match[1]?.toUpperCase() || 'GET';
    const line = getLineNumber(content, match.index);
    const path = extractRouteFromFilePath(filePath);
    routes.push({ method, path, line });
  }
  
  // Express/Fastify/Hono
  const expressPattern = ROUTE_PATTERNS.express;
  expressPattern.lastIndex = 0;
  while ((match = expressPattern.exec(content)) !== null) {
    const method = match[1]?.toUpperCase() || 'GET';
    const path = match[2] || '/unknown';
    const line = getLineNumber(content, match.index);
    routes.push({ method, path, line });
  }
  
  // NestJS
  const nestjsPattern = ROUTE_PATTERNS.nestjs;
  nestjsPattern.lastIndex = 0;
  while ((match = nestjsPattern.exec(content)) !== null) {
    const method = match[1]?.toUpperCase() || 'GET';
    const path = match[2] || '/';
    const line = getLineNumber(content, match.index);
    routes.push({ method, path, line });
  }
  
  return routes;
}

/**
 * Extract route from file path (Next.js App Router)
 */
function extractRouteFromFilePath(filePath: string): string {
  // Next.js App Router: /app/api/users/route.ts -> /api/users
  const appRouterMatch = filePath.match(/\/app(.*)\/route\.(ts|js)x?$/);
  if (appRouterMatch) {
    return appRouterMatch[1]?.replace(/\/\[([^\]]+)\]/g, '/:$1') || '/';
  }
  
  // Next.js Pages API: /pages/api/users.ts -> /api/users
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
 * Extract code snippet
 */
function extractSnippet(lines: string[], startLineIndex: number, maxLines: number): string {
  const endIndex = Math.min(startLineIndex + maxLines, lines.length);
  return lines.slice(startLineIndex, endIndex).join('\n');
}

/**
 * Extract observed auth policies from all route files
 */
export async function extractAllObservedAuthPolicies(
  workspaceRoot: string,
  routeFiles?: string[],
  config?: { ignoreDirs?: string[]; includeExtensions?: string[] }
): Promise<ObservedAuthPolicy[]> {
  const allPolicies: ObservedAuthPolicy[] = [];
  
  if (routeFiles && routeFiles.length > 0) {
    // Use provided route files
    for (const filePath of routeFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const policies = await extractObservedAuthPolicies(filePath, content);
        allPolicies.push(...policies);
      } catch (error) {
        // Skip files that can't be read
        console.warn(`Could not read route file: ${filePath}`, error);
      }
    }
  } else {
    // Find all route files
    const routeFilesFound = await findRouteFiles(workspaceRoot, config);
    for (const filePath of routeFilesFound) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const policies = await extractObservedAuthPolicies(filePath, content);
        allPolicies.push(...policies);
      } catch (error) {
        // Skip files that can't be read
        console.warn(`Could not read route file: ${filePath}`, error);
      }
    }
  }
  
  return allPolicies;
}

/**
 * Find route files in workspace
 */
async function findRouteFiles(
  root: string,
  config?: { ignoreDirs?: string[]; includeExtensions?: string[] }
): Promise<string[]> {
  const files: string[] = [];
  const ignoreDirs = config?.ignoreDirs || ['node_modules', '.git', 'dist', 'build', '.next'];
  const extensions = config?.includeExtensions || ['.ts', '.tsx', '.js', '.jsx'];
  
  async function walkDir(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!ignoreDirs.includes(entry.name)) {
            await walkDir(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            // Check if it's likely a route file
            if (isRouteFile(fullPath)) {
              files.push(fullPath);
            }
          }
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }
  
  await walkDir(root);
  return files;
}

/**
 * Check if file is likely a route file
 */
function isRouteFile(filePath: string): boolean {
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
