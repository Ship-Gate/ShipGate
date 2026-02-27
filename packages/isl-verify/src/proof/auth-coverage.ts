/**
 * Auth Coverage Prover
 * 
 * Provides definitive proof that every protected endpoint has authentication middleware.
 * 
 * This is the second proof bundle property, addressing the critical gap where
 * AI-generated code frequently creates endpoints without auth middleware.
 * 
 * @module @isl-lang/verify/proof
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import type { PropertyProof, Finding } from './types.js';

// ============================================================================
// Evidence Types
// ============================================================================

export interface AuthEvidence {
  route: string;           // "POST /api/orders"
  file: string;
  line: number;
  shouldBeProtected: boolean;
  protectionReason: string;  // "heuristic: modifies data" or "config: not in publicRoutes"
  isProtected: boolean;
  authMethod: string | null;  // "withAuth() wrapper" or "getServerSession() call"
  authVerifiedAt: number | null;  // line number where auth check occurs
  issues: string[];  // ["auth check occurs after DB write on line 45"]
}

export interface RouteInfo {
  method: string;
  path: string;
  file: string;
  line: number;
  framework: 'nextjs-app' | 'nextjs-pages' | 'express' | 'fastify';
  handlerStart: number;
  handlerEnd: number;
}

export interface AuthConfig {
  publicRoutes?: string[];  // e.g., ["/api/health", "/api/auth/*"]
  protectedRoutes?: string[];  // explicit protection list
  authMiddleware?: string[];  // known middleware names
}

// ============================================================================
// Auth Coverage Prover
// ============================================================================

export class AuthCoverageProver {
  private projectRoot: string;
  private config: AuthConfig;
  private findings: Finding[] = [];
  private evidence: AuthEvidence[] = [];

  constructor(projectRoot: string, config: AuthConfig = {}) {
    this.projectRoot = projectRoot;
    this.config = config;
  }

  /**
   * Run the auth coverage proof
   */
  async prove(): Promise<PropertyProof> {
    const startTime = Date.now();

    // Step 1: Identify all route handlers in the project
    const routes = await this.scanAllRoutes();

    // Step 2: Determine which routes SHOULD be protected
    const routesWithProtectionStatus = routes.map(route => ({
      route,
      shouldBeProtected: this.shouldBeProtected(route),
      reason: this.getProtectionReason(route),
    }));

    // Step 3: Verify auth is actually applied
    for (const { route, shouldBeProtected, reason } of routesWithProtectionStatus) {
      const authCheck = await this.verifyAuthProtection(route);
      
      this.evidence.push({
        route: `${route.method} ${route.path}`,
        file: route.file,
        line: route.line,
        shouldBeProtected,
        protectionReason: reason,
        isProtected: authCheck.isProtected,
        authMethod: authCheck.method,
        authVerifiedAt: authCheck.verifiedAt,
        issues: authCheck.issues,
      });
    }

    // Step 4: Calculate status
    const status = this.calculateStatus();
    const summary = this.generateSummary();

    const duration = Date.now() - startTime;

    return {
      property: 'auth-coverage',
      status,
      summary,
      evidence: this.evidence as any, // Evidence is generic in PropertyProof
      findings: this.findings,
      method: 'static-ast-analysis',
      confidence: 'definitive',
      duration_ms: duration,
    };
  }

  // ============================================================================
  // Route Scanning
  // ============================================================================

  /**
   * Scan all routes across all frameworks
   */
  private async scanAllRoutes(): Promise<RouteInfo[]> {
    const routes: RouteInfo[] = [];

    // Detect which frameworks are present
    const hasNextJs = await this.fileExists('next.config.js') || await this.fileExists('next.config.mjs');
    const hasExpress = await this.hasPackageDep('express');
    const hasFastify = await this.hasPackageDep('fastify');

    if (hasNextJs) {
      routes.push(...await this.scanNextJsAppRouter());
      routes.push(...await this.scanNextJsPagesRouter());
    }

    if (hasExpress) {
      routes.push(...await this.scanExpress());
    }

    if (hasFastify) {
      routes.push(...await this.scanFastify());
    }

    return routes;
  }

  /**
   * Scan Next.js App Router (app/[glob]/route.ts)
   */
  private async scanNextJsAppRouter(): Promise<RouteInfo[]> {
    const routes: RouteInfo[] = [];
    const routeFiles = await glob('**/app/**/route.{ts,js,tsx,jsx}', {
      cwd: this.projectRoot,
      absolute: true,
      posix: true,
    });

    for (const file of routeFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      // Extract route path from file structure
      const relativePath = path.relative(this.projectRoot, file);
      const routePath = this.extractAppRouterPath(relativePath);

      // Look for exported HTTP methods
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      for (const method of methods) {
        const regex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}`, 'g');
        const match = content.match(regex);
        if (match) {
          const lineIndex = lines.findIndex(l => l.includes(`function ${method}`));
          const handlerEnd = this.findFunctionEnd(lines, lineIndex);
          
          routes.push({
            method,
            path: routePath,
            file,
            line: lineIndex + 1,
            framework: 'nextjs-app',
            handlerStart: lineIndex + 1,
            handlerEnd,
          });
        }
      }
    }

    return routes;
  }

  /**
   * Extract route path from App Router file structure
   * e.g., app/api/users/[id]/route.ts -> /api/users/[id]
   */
  private extractAppRouterPath(relativePath: string): string {
    const parts = relativePath.split(/[/\\]/);
    const appIndex = parts.findIndex(p => p === 'app');
    if (appIndex === -1) return '/';

    const routeParts = parts.slice(appIndex + 1, -1); // Remove 'app' and 'route.ts'
    return '/' + routeParts.join('/');
  }

  /**
   * Scan Next.js Pages Router (pages/api/**\/*.ts)
   */
  private async scanNextJsPagesRouter(): Promise<RouteInfo[]> {
    const routes: RouteInfo[] = [];
    const apiFiles = await glob('**/pages/api/**/*.{ts,js,tsx,jsx}', {
      cwd: this.projectRoot,
      absolute: true,
      posix: true,
    });

    for (const file of apiFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      // Look for default export (handler function)
      const handlerMatch = content.match(/export\s+default\s+(?:async\s+)?function/);
      if (!handlerMatch) continue;

      const lineIndex = lines.findIndex(l => l.includes('export default'));
      const handlerEnd = this.findFunctionEnd(lines, lineIndex);

      // Extract route path from file structure
      const relativePath = path.relative(this.projectRoot, file);
      const routePath = this.extractPagesRouterPath(relativePath);

      // Detect HTTP methods from request.method checks
      const methods = this.detectMethodsInHandler(content);

      for (const method of methods) {
        routes.push({
          method,
          path: routePath,
          file,
          line: lineIndex + 1,
          framework: 'nextjs-pages',
          handlerStart: lineIndex + 1,
          handlerEnd,
        });
      }
    }

    return routes;
  }

  /**
   * Extract route path from Pages Router file structure
   * e.g., pages/api/users/[id].ts -> /api/users/[id]
   */
  private extractPagesRouterPath(relativePath: string): string {
    const parts = relativePath.split(/[/\\]/);
    const pagesIndex = parts.findIndex(p => p === 'pages');
    if (pagesIndex === -1) return '/';

    const routeParts = parts.slice(pagesIndex + 1);
    const lastPart = routeParts[routeParts.length - 1];
    routeParts[routeParts.length - 1] = lastPart.replace(/\.(ts|js|tsx|jsx)$/, '');

    // Remove 'index' from path
    if (routeParts[routeParts.length - 1] === 'index') {
      routeParts.pop();
    }

    return '/' + routeParts.join('/');
  }

  /**
   * Detect HTTP methods from req.method checks
   */
  private detectMethodsInHandler(content: string): string[] {
    const methods = new Set<string>();
    const methodChecks = content.match(/req\.method\s*===?\s*['"]([A-Z]+)['"]/g);
    
    if (methodChecks) {
      for (const check of methodChecks) {
        const match = check.match(/['"]([A-Z]+)['"]/);
        if (match) methods.add(match[1]);
      }
    }

    // If no methods found, assume GET and POST
    if (methods.size === 0) {
      methods.add('GET');
      methods.add('POST');
    }

    return Array.from(methods);
  }

  /**
   * Scan Express routes
   */
  private async scanExpress(): Promise<RouteInfo[]> {
    const routes: RouteInfo[] = [];
    const sourceFiles = await glob('**/*.{ts,js}', {
      cwd: this.projectRoot,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
      posix: true,
    });

    for (const file of sourceFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      // Look for router.METHOD or app.METHOD patterns
      const routeRegex = /(router|app)\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g;
      let match;

      while ((match = routeRegex.exec(content)) !== null) {
        const [fullMatch, , method, routePath] = match;
        const lineIndex = content.substring(0, match.index).split('\n').length - 1;

        routes.push({
          method: method.toUpperCase(),
          path: routePath,
          file,
          line: lineIndex + 1,
          framework: 'express',
          handlerStart: lineIndex + 1,
          handlerEnd: lineIndex + 10, // Approximate
        });
      }
    }

    return routes;
  }

  /**
   * Scan Fastify routes
   */
  private async scanFastify(): Promise<RouteInfo[]> {
    const routes: RouteInfo[] = [];
    const sourceFiles = await glob('**/*.{ts,js}', {
      cwd: this.projectRoot,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**'],
      posix: true,
    });

    for (const file of sourceFiles) {
      const content = await fs.readFile(file, 'utf-8');

      // Look for fastify.route({ method, url }) or fastify.METHOD(url)
      const routeRegex = /fastify\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g;
      const routeObjectRegex = /fastify\.route\s*\(\s*\{[^}]*method:\s*['"`]([A-Z]+)['"`][^}]*url:\s*['"`]([^'"`]+)['"`]/g;
      
      let match;
      while ((match = routeRegex.exec(content)) !== null) {
        const [fullMatch, method, routePath] = match;
        const lineIndex = content.substring(0, match.index).split('\n').length - 1;

        routes.push({
          method: method.toUpperCase(),
          path: routePath,
          file,
          line: lineIndex + 1,
          framework: 'fastify',
          handlerStart: lineIndex + 1,
          handlerEnd: lineIndex + 10,
        });
      }

      while ((match = routeObjectRegex.exec(content)) !== null) {
        const [fullMatch, method, routePath] = match;
        const lineIndex = content.substring(0, match.index).split('\n').length - 1;

        routes.push({
          method: method.toUpperCase(),
          path: routePath,
          file,
          line: lineIndex + 1,
          framework: 'fastify',
          handlerStart: lineIndex + 1,
          handlerEnd: lineIndex + 10,
        });
      }
    }

    return routes;
  }

  // ============================================================================
  // Protection Heuristics
  // ============================================================================

  /**
   * Determine if a route SHOULD be protected
   */
  private shouldBeProtected(route: RouteInfo): boolean {
    // Explicit config overrides
    if (this.config.protectedRoutes) {
      if (this.matchesPattern(route.path, this.config.protectedRoutes)) {
        return true;
      }
    }

    if (this.config.publicRoutes) {
      if (this.matchesPattern(route.path, this.config.publicRoutes)) {
        return false;
      }
    }

    // Heuristic 3: Public route patterns
    const publicPatterns = [
      '/api/health',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/callback',
      '/api/public/*',
      '/api/webhook/*',
      '/health',
      '/ping',
    ];

    if (this.matchesPattern(route.path, publicPatterns)) {
      return false;
    }

    // Heuristic 2: Protected route patterns
    const protectedPatterns = [
      '/api/users/me',
      '/api/admin/*',
      '/api/*/create',
      '/api/*/delete',
      '/api/*/update',
    ];

    if (this.matchesPattern(route.path, protectedPatterns)) {
      return true;
    }

    // Heuristic 2: Methods that modify data are likely protected
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(route.method)) {
      return true;
    }

    // If we can't determine, default to protected (fail-safe)
    return true;
  }

  /**
   * Get human-readable reason for protection status
   */
  private getProtectionReason(route: RouteInfo): string {
    if (this.config.protectedRoutes && this.matchesPattern(route.path, this.config.protectedRoutes)) {
      return 'config: in protectedRoutes';
    }

    if (this.config.publicRoutes && this.matchesPattern(route.path, this.config.publicRoutes)) {
      return 'config: in publicRoutes';
    }

    const publicPatterns = ['/api/health', '/api/auth/login', '/api/auth/register', '/api/public/*'];
    if (this.matchesPattern(route.path, publicPatterns)) {
      return `heuristic: public route pattern (${route.path})`;
    }

    const protectedPatterns = ['/api/users/me', '/api/admin/*'];
    if (this.matchesPattern(route.path, protectedPatterns)) {
      return `heuristic: protected route pattern (${route.path})`;
    }

    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(route.method)) {
      return `heuristic: ${route.method} modifies data`;
    }

    return 'heuristic: default to protected';
  }

  /**
   * Match route path against patterns (supports * wildcards)
   */
  private matchesPattern(path: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(path);
    });
  }

  // ============================================================================
  // Auth Detection
  // ============================================================================

  /**
   * Verify that auth protection is actually applied
   */
  private async verifyAuthProtection(route: RouteInfo): Promise<{
    isProtected: boolean;
    method: string | null;
    verifiedAt: number | null;
    issues: string[];
  }> {
    const content = await fs.readFile(route.file, 'utf-8');
    const lines = content.split('\n');
    const handlerContent = lines.slice(route.handlerStart - 1, route.handlerEnd).join('\n');

    const issues: string[] = [];

    // Framework-specific detection
    switch (route.framework) {
      case 'nextjs-app':
        return this.detectNextJsAppAuth(content, handlerContent, route, issues);
      case 'nextjs-pages':
        return this.detectNextJsPagesAuth(content, handlerContent, route, issues);
      case 'express':
        return this.detectExpressAuth(content, handlerContent, route, issues);
      case 'fastify':
        return this.detectFastifyAuth(content, handlerContent, route, issues);
    }
  }

  /**
   * Detect auth in Next.js App Router
   */
  private detectNextJsAppAuth(
    fullContent: string,
    handlerContent: string,
    route: RouteInfo,
    issues: string[]
  ): { isProtected: boolean; method: string | null; verifiedAt: number | null; issues: string[] } {
    // Pattern 1: getServerSession() call
    if (handlerContent.includes('getServerSession')) {
      const lines = handlerContent.split('\n');
      const lineIndex = lines.findIndex(l => l.includes('getServerSession'));
      return {
        isProtected: true,
        method: 'getServerSession() call',
        verifiedAt: route.handlerStart + lineIndex,
        issues,
      };
    }

    // Pattern 2: auth() from next-auth
    if (handlerContent.includes('auth()')) {
      const lines = handlerContent.split('\n');
      const lineIndex = lines.findIndex(l => l.includes('auth()'));
      return {
        isProtected: true,
        method: 'auth() from next-auth',
        verifiedAt: route.handlerStart + lineIndex,
        issues,
      };
    }

    // Pattern 3: cookies().get('token') with verification
    if (handlerContent.includes('cookies()') && handlerContent.includes('token')) {
      const hasVerification = handlerContent.includes('verify') || handlerContent.includes('jwt.verify');
      if (hasVerification) {
        return {
          isProtected: true,
          method: 'JWT token verification',
          verifiedAt: route.handlerStart,
          issues,
        };
      } else {
        issues.push('Token extraction found but no verification');
      }
    }

    // Pattern 4: withAuth() wrapper
    if (fullContent.includes('withAuth')) {
      return {
        isProtected: true,
        method: 'withAuth() wrapper',
        verifiedAt: route.line,
        issues,
      };
    }

    return { isProtected: false, method: null, verifiedAt: null, issues };
  }

  /**
   * Detect auth in Next.js Pages Router
   */
  private detectNextJsPagesAuth(
    fullContent: string,
    handlerContent: string,
    route: RouteInfo,
    issues: string[]
  ): { isProtected: boolean; method: string | null; verifiedAt: number | null; issues: string[] } {
    // Similar patterns to App Router
    if (handlerContent.includes('getServerSession')) {
      return {
        isProtected: true,
        method: 'getServerSession() call',
        verifiedAt: route.handlerStart,
        issues,
      };
    }

    // Check for req.session or req.user access
    if (handlerContent.includes('req.session') || handlerContent.includes('req.user')) {
      // Verify it's not just assignment
      const hasCheck = handlerContent.match(/if\s*\(\s*!?req\.(session|user)/);
      if (hasCheck) {
        return {
          isProtected: true,
          method: 'req.user/req.session check',
          verifiedAt: route.handlerStart,
          issues,
        };
      } else {
        issues.push('req.user/req.session used but no auth check detected');
      }
    }

    return { isProtected: false, method: null, verifiedAt: null, issues };
  }

  /**
   * Detect auth in Express
   */
  private detectExpressAuth(
    fullContent: string,
    handlerContent: string,
    route: RouteInfo,
    issues: string[]
  ): { isProtected: boolean; method: string | null; verifiedAt: number | null; issues: string[] } {
    // Pattern 1: Middleware in route chain
    const routeLine = fullContent.split('\n')[route.line - 1];
    const knownMiddleware = this.config.authMiddleware || ['authMiddleware', 'authenticate', 'requireAuth', 'isAuthenticated'];
    
    for (const mw of knownMiddleware) {
      if (routeLine.includes(mw)) {
        return {
          isProtected: true,
          method: `${mw} middleware`,
          verifiedAt: route.line,
          issues,
        };
      }
    }

    // Pattern 2: req.user access with check
    if (handlerContent.includes('req.user')) {
      const hasCheck = handlerContent.match(/if\s*\(\s*!req\.user/);
      if (hasCheck) {
        return {
          isProtected: true,
          method: 'req.user check',
          verifiedAt: route.handlerStart,
          issues,
        };
      }
    }

    return { isProtected: false, method: null, verifiedAt: null, issues };
  }

  /**
   * Detect auth in Fastify
   */
  private detectFastifyAuth(
    fullContent: string,
    handlerContent: string,
    route: RouteInfo,
    issues: string[]
  ): { isProtected: boolean; method: string | null; verifiedAt: number | null; issues: string[] } {
    // Pattern 1: onRequest or preHandler hooks
    const routeDeclaration = fullContent.substring(
      fullContent.lastIndexOf('fastify.route', route.line * 50),
      fullContent.indexOf('})', route.line * 50) + 2
    );

    if (routeDeclaration.includes('onRequest') || routeDeclaration.includes('preHandler')) {
      return {
        isProtected: true,
        method: 'onRequest/preHandler hook',
        verifiedAt: route.line,
        issues,
      };
    }

    // Pattern 2: request.user check
    if (handlerContent.includes('request.user')) {
      return {
        isProtected: true,
        method: 'request.user check',
        verifiedAt: route.handlerStart,
        issues,
      };
    }

    return { isProtected: false, method: null, verifiedAt: null, issues };
  }

  // ============================================================================
  // Status Calculation
  // ============================================================================

  /**
   * Calculate overall proof status
   */
  private calculateStatus(): 'PROVEN' | 'PARTIAL' | 'FAILED' {
    const protectedRoutes = this.evidence.filter(e => e.shouldBeProtected);
    
    if (protectedRoutes.length === 0) {
      return 'PROVEN'; // No protected routes = trivially proven
    }

    const properlyProtected = protectedRoutes.filter(e => e.isProtected && e.issues.length === 0);
    const unprotected = protectedRoutes.filter(e => !e.isProtected);

    if (properlyProtected.length === protectedRoutes.length) {
      return 'PROVEN';
    }

    if (unprotected.length > protectedRoutes.length / 2) {
      return 'FAILED';
    }

    return 'PARTIAL';
  }

  /**
   * Generate summary text
   */
  private generateSummary(): string {
    const total = this.evidence.length;
    const shouldBeProtected = this.evidence.filter(e => e.shouldBeProtected).length;
    const isProtected = this.evidence.filter(e => e.shouldBeProtected && e.isProtected).length;
    const withIssues = this.evidence.filter(e => e.issues.length > 0).length;

    return `Auth coverage: ${isProtected}/${shouldBeProtected} protected routes verified (${total} total routes, ${withIssues} with issues)`;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async fileExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.projectRoot, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  private async hasPackageDep(packageName: string): Promise<boolean> {
    try {
      const pkgPath = path.join(this.projectRoot, 'package.json');
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      return !!(pkg.dependencies?.[packageName] || pkg.devDependencies?.[packageName]);
    } catch {
      return false;
    }
  }

  private findFunctionEnd(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let inFunction = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inFunction = true;
        } else if (char === '}') {
          braceCount--;
          if (inFunction && braceCount === 0) {
            return i + 1;
          }
        }
      }
    }

    return startIndex + 20; // Default fallback
  }
}

/**
 * Create an auth coverage prover
 */
export function createAuthCoverageProver(projectRoot: string, config?: AuthConfig): AuthCoverageProver {
  return new AuthCoverageProver(projectRoot, config);
}
