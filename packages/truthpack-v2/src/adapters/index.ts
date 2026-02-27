/**
 * Truthpack Adapters
 *
 * Framework-specific adapters for extracting routes, env vars, etc.
 * Each adapter returns facts with confidence scores.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { TruthpackRoute, TruthpackEnvVar } from '../schema.js';

export interface AdapterContext {
  repoRoot: string;
  filePath: string;
  content: string;
}

export interface AdapterResult {
  routes: TruthpackRoute[];
  envVars: TruthpackEnvVar[];
}

export interface TruthpackAdapter {
  /** Adapter name */
  name: string;
  /** Check if this adapter can handle the file */
  canHandle(context: AdapterContext): boolean;
  /** Extract facts from the file */
  extract(context: AdapterContext): Promise<AdapterResult>;
}

// ── Fastify Adapter ──────────────────────────────────────────────────────────

interface PluginRegistration {
  /** Plugin identifier (import path or variable name) */
  pluginId: string;
  /** Prefix applied to routes in this plugin */
  prefix: string;
  /** Line number where register() is called */
  line: number;
  /** Parent plugin if nested */
  parent?: PluginRegistration;
}

export class FastifyAdapter implements TruthpackAdapter {
  name = 'fastify';
  private pluginGraph: Map<string, PluginRegistration[]> = new Map();

  canHandle(context: AdapterContext): boolean {
    return (
      /fastify/i.test(context.content) ||
      /\.route\s*\(/.test(context.content) ||
      /fastify\s*\.\s*(get|post|put|patch|delete)/i.test(context.content) ||
      /\.register\s*\(/.test(context.content)
    );
  }

  async extract(context: AdapterContext): Promise<AdapterResult> {
    const routes: TruthpackRoute[] = [];
    const envVars: TruthpackEnvVar[] = [];

    const lines = context.content.split('\n');
    const relativePath = path.relative(context.repoRoot, context.filePath);

    // Step 1: Build plugin registration graph
    const pluginRegistrations = this.extractPluginRegistrations(context.content, relativePath);
    
    // Step 2: Extract routes with prefix resolution
    const extractedRoutes = this.extractRoutesWithPrefixes(
      context.content,
      relativePath,
      lines,
      pluginRegistrations
    );
    routes.push(...extractedRoutes);

    // Extract env vars
    envVars.push(...extractEnvVars(context.content, relativePath));

    return { routes, envVars };
  }

  /**
   * Extract plugin registration calls and their prefixes
   */
  private extractPluginRegistrations(
    content: string,
    filePath: string
  ): PluginRegistration[] {
    const registrations: PluginRegistration[] = [];

    // Pattern 1: await fastify.register(plugin, { prefix: '/api' })
    // Pattern 2: await app.register(plugin, { prefix: '/api' })
    // Pattern 3: fastify.register(plugin, { prefix: '/api' })
    const registerPattern = /(?:await\s+)?(?:fastify|app|server)\s*\.\s*register\s*\(\s*([^,)]+)\s*(?:,\s*\{([^}]+)\})?\s*\)/gi;
    let match: RegExpExecArray | null;

    while ((match = registerPattern.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);
      const pluginId = match[1].trim();
      const optionsStr = match[2] || '';

      // Extract prefix from options
      const prefixMatch = optionsStr.match(/prefix\s*:\s*['"`]([^'"`]+)['"`]/);
      const prefix = prefixMatch ? prefixMatch[1] : '';

      registrations.push({
        pluginId,
        prefix,
        line,
      });
    }

    return registrations;
  }

  /**
   * Extract routes and resolve prefixes from plugin graph
   */
  private extractRoutesWithPrefixes(
    content: string,
    filePath: string,
    lines: string[],
    pluginRegistrations: PluginRegistration[]
  ): TruthpackRoute[] {
    const routes: TruthpackRoute[] = [];

    // Determine current prefix context (if this file is a plugin)
    const currentPrefix = this.resolveCurrentPrefix(content, pluginRegistrations);

    // Pattern 1: fastify.get('/path', handler) or app.get('/path', handler)
    const methodPattern = /(?:fastify|app|server)\s*\.\s*(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    let match: RegExpExecArray | null;
    while ((match = methodPattern.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);
      const method = match[1].toUpperCase();
      let routePath = match[2];

      // Apply prefix if in plugin context
      if (currentPrefix && !routePath.startsWith(currentPrefix)) {
        routePath = currentPrefix + (routePath.startsWith('/') ? routePath : '/' + routePath);
      }

      const schema = this.extractRouteSchema(content, match.index, lines);
      const confidence = this.calculateRouteConfidence(content, match.index, schema);

      routes.push({
        path: routePath,
        method,
        handler: extractHandlerName(content, match.index),
        file: filePath,
        line,
        parameters: extractPathParams(routePath),
        middleware: extractMiddleware(content, line, lines),
        auth: detectAuth(content, line, lines),
        confidence,
        adapter: this.name,
        metadata: schema ? { schema } : undefined,
      });
    }

    // Pattern 2: fastify.route({ method, url, schema, handler })
    const routeConfigPattern = /\.route\s*\(\s*\{([^}]+)\}/gs;
    while ((match = routeConfigPattern.exec(content)) !== null) {
      const configStr = match[1];
      const methodMatch = configStr.match(/method\s*:\s*['"`](\w+)['"`]/i);
      const urlMatch = configStr.match(/url\s*:\s*['"`]([^'"`]+)['"`]/i);

      if (methodMatch && urlMatch) {
        const line = getLineNumber(content, match.index);
        const method = methodMatch[1].toUpperCase();
        let routePath = urlMatch[1];

        // Apply prefix if in plugin context
        if (currentPrefix && !routePath.startsWith(currentPrefix)) {
          routePath = currentPrefix + (routePath.startsWith('/') ? routePath : '/' + routePath);
        }

        const schema = this.extractRouteSchemaFromConfig(configStr);
        const confidence = this.calculateRouteConfidence(content, match.index, schema);

        routes.push({
          path: routePath,
          method,
          handler: extractHandlerName(content, match.index),
          file: filePath,
          line,
          parameters: extractPathParams(routePath),
          middleware: extractMiddleware(content, line, lines),
          auth: detectAuth(content, line, lines),
          confidence,
          adapter: this.name,
          metadata: schema ? { schema } : undefined,
        });
      }
    }

    return routes;
  }

  /**
   * Resolve prefix for current file based on plugin registrations
   */
  private resolveCurrentPrefix(
    content: string,
    pluginRegistrations: PluginRegistration[]
  ): string {
    // Check if this file exports a Fastify plugin
    const isPlugin = /export\s+(?:default\s+)?(?:async\s+)?function\s+\w*\s*\(/i.test(content) ||
                     /const\s+\w+\s*=\s*(?:async\s+)?\(/i.test(content);

    if (!isPlugin) {
      return '';
    }

    // If this file is registered as a plugin elsewhere, accumulate prefixes
    // For now, return empty - prefix resolution requires cross-file analysis
    // which should be done at the builder level
    return '';
  }

  /**
   * Extract route schema from route configuration
   */
  private extractRouteSchema(
    content: string,
    routeIndex: number,
    lines: string[]
  ): Record<string, unknown> | undefined {
    // Look for schema in nearby context (before or after route definition)
    const contextStart = Math.max(0, getLineNumber(content, routeIndex) - 20);
    const contextEnd = Math.min(lines.length, getLineNumber(content, routeIndex) + 30);
    const context = lines.slice(contextStart, contextEnd).join('\n');

    // Pattern: schema: { ... }
    const schemaMatch = context.match(/schema\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
    if (schemaMatch) {
      try {
        // Try to parse schema object (simplified - real implementation would use AST)
        const schemaStr = '{' + schemaMatch[1] + '}';
        return { raw: schemaStr };
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Extract schema from route config object
   */
  private extractRouteSchemaFromConfig(configStr: string): Record<string, unknown> | undefined {
    const schemaMatch = configStr.match(/schema\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
    if (schemaMatch) {
      return { raw: schemaMatch[0] };
    }
    return undefined;
  }

  /**
   * Calculate confidence score for route detection
   */
  private calculateRouteConfidence(
    content: string,
    routeIndex: number,
    schema?: Record<string, unknown>
  ): number {
    let confidence = 0.9; // Base confidence for Fastify routes

    // Higher confidence if schema is present
    if (schema) {
      confidence = 0.95;
    }

    // Check for Fastify-specific patterns that increase confidence
    const context = content.substring(Math.max(0, routeIndex - 200), routeIndex + 200);
    if (/fastify\.(get|post|put|patch|delete|route)/i.test(context)) {
      confidence = Math.min(confidence + 0.05, 1.0);
    }

    return confidence;
  }
}

// ── Next.js App Router Adapter ───────────────────────────────────────────────

export class NextAppRouterAdapter implements TruthpackAdapter {
  name = 'nextjs-app-router';

  canHandle(context: AdapterContext): boolean {
    return (
      context.filePath.includes('/app/') &&
      /route\.(ts|tsx|js|jsx)$/.test(context.filePath) &&
      /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)/i.test(context.content)
    );
  }

  async extract(context: AdapterContext): Promise<AdapterResult> {
    const routes: TruthpackRoute[] = [];
    const envVars: TruthpackEnvVar[] = [];

    const relativePath = path.relative(context.repoRoot, context.filePath);
    const lines = context.content.split('\n');

    // Extract route path from file path with proper normalization
    const normalizedPath = this.normalizeRoutePath(context.filePath);

    // Extract HTTP method from exported function
    const methodPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/gi;
    let match: RegExpExecArray | null;
    while ((match = methodPattern.exec(context.content)) !== null) {
      const line = getLineNumber(context.content, match.index);
      const method = match[1].toUpperCase();

      // Detect handler reliability
      const handlerReliability = this.detectHandlerReliability(context.content, match.index, lines);
      const confidence = this.calculateFileRouteConfidence(normalizedPath, handlerReliability);

      routes.push({
        path: normalizedPath,
        method,
        handler: this.extractHandlerName(context.content, match.index, method),
        file: relativePath,
        line,
        parameters: this.extractNormalizedPathParams(normalizedPath),
        middleware: [],
        auth: detectAuth(context.content, line, lines),
        confidence,
        adapter: this.name,
      });
    }

    envVars.push(...extractEnvVars(context.content, relativePath));

    return { routes, envVars };
  }

  /**
   * Normalize route path from file path, handling dynamic segments correctly
   */
  private normalizeRoutePath(filePath: string): string {
    // Match: /app/api/users/route.ts or src/app/api/users/route.ts
    const normalizedPath = filePath.replace(/\\/g, '/');
    const appMatch = normalizedPath.match(/(?:^|\/)app(?:\/api)?(.*)\/route\.(ts|tsx|js|jsx)$/);
    
    if (!appMatch) {
      return '/unknown';
    }

    let route = appMatch[1] || '/';
    
    // Normalize dynamic segments:
    // [id] -> :id
    // [...slug] -> *slug (catch-all)
    // [[...slug]] -> *slug? (optional catch-all)
    
    // Handle catch-all routes first (before single params)
    route = route.replace(/\/\[\.\.\.([^\]]+)\]/g, '/*$1');
    route = route.replace(/\/\[\[\.\.\.([^\]]+)\]\]/g, '/*$1?');
    
    // Handle single dynamic segments
    route = route.replace(/\/\[([^\]]+)\]/g, '/:$1');
    
    // Ensure leading slash
    if (!route.startsWith('/')) {
      route = '/' + route;
    }
    
    // Remove trailing slash except for root
    if (route !== '/' && route.endsWith('/')) {
      route = route.slice(0, -1);
    }

    return route || '/';
  }

  /**
   * Extract path parameters from normalized route path
   */
  private extractNormalizedPathParams(routePath: string): string[] {
    const params: string[] = [];
    
    // Extract :param (single dynamic segments)
    const paramPattern = /:(\w+)/g;
    let match: RegExpExecArray | null;
    while ((match = paramPattern.exec(routePath)) !== null) {
      params.push(match[1]);
    }
    
    // Extract *param (catch-all segments)
    const catchAllPattern = /\*(\w+)/g;
    while ((match = catchAllPattern.exec(routePath)) !== null) {
      params.push(match[1]);
    }
    
    return params;
  }

  /**
   * Extract handler name from route handler function
   */
  private extractHandlerName(content: string, matchIndex: number, method: string): string {
    // Look for function name: export async function GET(req) -> GET
    const afterMatch = content.substring(matchIndex);
    const funcNameMatch = afterMatch.match(/function\s+(\w+)\s*\(/);
    if (funcNameMatch) {
      return funcNameMatch[1];
    }
    
    // Default to method name
    return method;
  }

  /**
   * Detect handler reliability (how confident we are this is a real route handler)
   */
  private detectHandlerReliability(
    content: string,
    handlerIndex: number,
    lines: string[]
  ): {
    hasRequestParam: boolean;
    hasResponseReturn: boolean;
    hasRouteExport: boolean;
    hasTypeAnnotations: boolean;
  } {
    const line = getLineNumber(content, handlerIndex);
    const contextStart = Math.max(0, line - 5);
    const contextEnd = Math.min(lines.length, line + 15);
    const context = lines.slice(contextStart, contextEnd).join('\n');

    return {
      hasRequestParam: /\(.*req\s*[:)]/i.test(context) || /\(.*request\s*[:)]/i.test(context),
      hasResponseReturn: /return\s+.*Response/i.test(context) || /Response\s*\./i.test(context),
      hasRouteExport: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/i.test(context),
      hasTypeAnnotations: /:\s*(Request|NextRequest|Response|NextResponse)/i.test(context),
    };
  }

  /**
   * Calculate confidence score for file-based route detection
   */
  private calculateFileRouteConfidence(
    routePath: string,
    reliability: ReturnType<typeof this.detectHandlerReliability>
  ): number {
    let confidence = 0.85; // Base confidence for file-based routes

    // Increase confidence based on reliability indicators
    if (reliability.hasRequestParam) confidence += 0.05;
    if (reliability.hasResponseReturn) confidence += 0.05;
    if (reliability.hasTypeAnnotations) confidence += 0.03;
    
    // Higher confidence for well-formed paths
    if (routePath !== '/unknown' && routePath.startsWith('/')) {
      confidence += 0.02;
    }

    return Math.min(confidence, 0.98);
  }
}

// ── Next.js Pages API Adapter ────────────────────────────────────────────────

export class NextPagesApiAdapter implements TruthpackAdapter {
  name = 'nextjs-pages-api';

  canHandle(context: AdapterContext): boolean {
    return (
      context.filePath.includes('/pages/api/') &&
      /export\s+default\s+(?:async\s+)?function/i.test(context.content)
    );
  }

  async extract(context: AdapterContext): Promise<AdapterResult> {
    const routes: TruthpackRoute[] = [];
    const envVars: TruthpackEnvVar[] = [];

    const relativePath = path.relative(context.repoRoot, context.filePath);
    const lines = context.content.split('\n');

    // Extract route path from file path with normalization
    const routePath = this.normalizePagesApiPath(context.filePath);

    // Pages API supports all methods via req.method
    const hasHandler = /export\s+default\s+(?:async\s+)?function/i.test(context.content);
    if (hasHandler) {
      const line = getLineNumber(context.content, context.content.indexOf('export default'));

      // Check which methods are handled
      const methods = detectHandledMethods(context.content);
      const handlerReliability = this.detectPagesApiHandlerReliability(context.content);
      
      for (const method of methods) {
        const confidence = this.calculatePagesApiConfidence(method, handlerReliability);
        
        routes.push({
          path: routePath,
          method,
          handler: 'default',
          file: relativePath,
          line,
          parameters: this.extractNormalizedPathParams(routePath),
          middleware: [],
          auth: detectAuth(context.content, line, lines),
          confidence,
          adapter: this.name,
        });
      }
    }

    envVars.push(...extractEnvVars(context.content, relativePath));

    return { routes, envVars };
  }

  /**
   * Normalize Pages API route path from file path
   */
  private normalizePagesApiPath(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const pagesMatch = normalizedPath.match(/\/pages\/api(.*)$/);
    
    if (!pagesMatch) {
      return '/api/unknown';
    }

    let route = pagesMatch[1]
      .replace(/\.(ts|tsx|js|jsx)$/, '')
      .replace(/\/index$/, '') || '';

    // Normalize dynamic segments: [id] -> :id, [...slug] -> *slug
    route = route.replace(/\/\[\.\.\.([^\]]+)\]/g, '/*$1');
    route = route.replace(/\/\[([^\]]+)\]/g, '/:$1');

    const routePath = `/api${route}`;
    return routePath || '/api';
  }

  /**
   * Extract normalized path parameters
   */
  private extractNormalizedPathParams(routePath: string): string[] {
    const params: string[] = [];
    const paramPattern = /:(\w+)/g;
    const catchAllPattern = /\*(\w+)/g;
    
    let match: RegExpExecArray | null;
    while ((match = paramPattern.exec(routePath)) !== null) {
      params.push(match[1]);
    }
    while ((match = catchAllPattern.exec(routePath)) !== null) {
      params.push(match[1]);
    }
    
    return params;
  }

  /**
   * Detect handler reliability for Pages API
   */
  private detectPagesApiHandlerReliability(content: string): {
    hasMethodCheck: boolean;
    hasRequestHandler: boolean;
    hasTypeAnnotations: boolean;
  } {
    return {
      hasMethodCheck: /req\.method|request\.method/i.test(content),
      hasRequestHandler: /\(req\s*[,)]|\(request\s*[,)]/i.test(content),
      hasTypeAnnotations: /:\s*(NextApiRequest|NextApiResponse)/i.test(content),
    };
  }

  /**
   * Calculate confidence for Pages API routes
   */
  private calculatePagesApiConfidence(
    method: string,
    reliability: ReturnType<typeof this.detectPagesApiHandlerReliability>
  ): number {
    let confidence = 0.80; // Base confidence for Pages API

    if (reliability.hasMethodCheck) confidence += 0.05;
    if (reliability.hasRequestHandler) confidence += 0.05;
    if (reliability.hasTypeAnnotations) confidence += 0.03;

    // Lower confidence if method is inferred (not explicitly checked)
    if (method === 'GET' && !reliability.hasMethodCheck) {
      confidence -= 0.05;
    }

    return Math.min(confidence, 0.95);
  }
}

// ── Generic FS Heuristics Adapter ────────────────────────────────────────────

export class GenericFSAdapter implements TruthpackAdapter {
  name = 'generic-fs';

  canHandle(): boolean {
    return true; // Fallback adapter
  }

  async extract(context: AdapterContext): Promise<AdapterResult> {
    const routes: TruthpackRoute[] = [];
    const envVars: TruthpackEnvVar[] = [];

    const relativePath = path.relative(context.repoRoot, context.filePath);

    // Generic route detection patterns
    const genericPatterns = [
      // Express-style: app.get('/path')
      /(?:app|router|server)\s*\.\s*(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      // Hono-style: app.get('/path')
      /(?:app|hono)\s*\.\s*(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    ];

    for (const pattern of genericPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(context.content)) !== null) {
        const line = getLineNumber(context.content, match.index);
        const method = match[1].toUpperCase();
        const routePath = match[2];

        routes.push({
          path: routePath,
          method,
          handler: extractHandlerName(context.content, match.index),
          file: relativePath,
          line,
          parameters: extractPathParams(routePath),
          middleware: [],
          auth: undefined,
          confidence: 0.7, // Lower confidence for generic detection
          adapter: this.name,
        });
      }
    }

    envVars.push(...extractEnvVars(context.content, relativePath));

    return { routes, envVars };
  }
}

// ── Helper Functions ───────────────────────────────────────────────────────────

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

function extractHandlerName(content: string, matchIndex: number): string {
  const afterMatch = content.substring(matchIndex);
  const handlerMatch = afterMatch.match(/,\s*(\w+)\s*[\(=]/);
  return handlerMatch ? handlerMatch[1] : 'anonymous';
}

function extractPathParams(path: string): string[] {
  const params: string[] = [];
  const paramPattern = /:(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = paramPattern.exec(path)) !== null) {
    params.push(match[1]);
  }
  return params;
}

function extractMiddleware(content: string, routeLine: number, lines: string[]): string[] {
  const middleware: string[] = [];
  const contextStart = Math.max(0, routeLine - 10);
  const contextEnd = Math.min(lines.length, routeLine + 20);
  const context = lines.slice(contextStart, contextEnd).join('\n');

  // Look for middleware patterns
  const middlewarePatterns = [
    /\.use\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /middleware\s*:\s*\[([^\]]+)\]/g,
  ];

  for (const pattern of middlewarePatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(context)) !== null) {
      const mw = match[1].split(',').map(m => m.trim().replace(/['"`]/g, ''));
      middleware.push(...mw);
    }
  }

  return middleware;
}

function detectAuth(content: string, routeLine: number, lines: string[]): { required: boolean; method?: string } | undefined {
  const contextStart = Math.max(0, routeLine - 10);
  const contextEnd = Math.min(lines.length, routeLine + 20);
  const context = lines.slice(contextStart, contextEnd).join('\n');

  const authPatterns = [
    /requireAuth|isAuthenticated|auth\s*\(|verifyToken|checkAuth/i,
    /middleware\s*:\s*\[[^\]]*auth/i,
  ];

  const hasAuth = authPatterns.some(pattern => pattern.test(context));

  if (hasAuth) {
    let method: string | undefined;
    if (/bearer|jwt|token/i.test(context)) method = 'bearer';
    else if (/session|cookie/i.test(context)) method = 'session';
    else if (/api[_-]?key/i.test(context)) method = 'api-key';

    return { required: true, method };
  }

  return undefined;
}

function detectHandledMethods(content: string): string[] {
  const methods: string[] = [];
  const methodChecks = [
    { pattern: /req\.method\s*===\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/gi, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    { pattern: /method\s*===\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/gi, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
  ];

  for (const check of methodChecks) {
    let match: RegExpExecArray | null;
    while ((match = check.pattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      if (!methods.includes(method)) {
        methods.push(method);
      }
    }
  }

  // Default to GET if no specific methods detected
  return methods.length > 0 ? methods : ['GET'];
}

function extractEnvVars(content: string, filePath: string): TruthpackEnvVar[] {
  const envVars: TruthpackEnvVar[] = [];
  const lines = content.split('\n');

  // Pattern 1: process.env.VAR_NAME
  const processEnvPattern = /process\.env\.(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = processEnvPattern.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    const name = match[1];

    // Check for default value: process.env.VAR || 'default'
    const lineContent = lines[line - 1];
    const hasDefault = /\|\|\s*['"`]/.test(lineContent);
    const defaultValueMatch = lineContent.match(/\|\|\s*['"`]([^'"`]+)['"`]/);

    envVars.push({
      name,
      file: filePath,
      line,
      hasDefault,
      defaultValue: defaultValueMatch ? defaultValueMatch[1] : undefined,
      required: !hasDefault,
      sensitive: isSensitiveVar(name),
      confidence: 0.9,
      source: 'process.env',
    });
  }

  // Pattern 2: import.meta.env.VAR_NAME (Vite/Next.js)
  const metaEnvPattern = /import\.meta\.env\.(\w+)/g;
  while ((match = metaEnvPattern.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    const name = match[1];

    envVars.push({
      name,
      file: filePath,
      line,
      hasDefault: false,
      required: true,
      sensitive: isSensitiveVar(name),
      confidence: 0.9,
      source: 'import.meta.env',
    });
  }

  return envVars;
}

function isSensitiveVar(name: string): boolean {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /key/i,
    /token/i,
    /api[_-]?key/i,
    /auth/i,
    /credential/i,
  ];
  return sensitivePatterns.some(pattern => pattern.test(name));
}

// ── Adapter Registry ───────────────────────────────────────────────────────────

export const ADAPTERS: TruthpackAdapter[] = [
  new NextAppRouterAdapter(),
  new NextPagesApiAdapter(),
  new FastifyAdapter(),
  new GenericFSAdapter(), // Fallback - must be last
];
