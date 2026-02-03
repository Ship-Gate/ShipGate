/**
 * Next.js App Router Framework Adapter
 * 
 * Detects, analyzes, and patches Next.js App Router route handlers.
 * 
 * Supports:
 * - Detection of Next.js projects with App Router (src/app/api/.../route.ts)
 * - Location of exported HTTP method functions (GET, POST, PUT, PATCH, DELETE, etc.)
 * - Helper injection patterns (ensureRateLimit, ensureAudit, ensureInputValidation)
 * - Early enforcement rules (rate limiting before request.json() and business logic)
 * - Deterministic AST-based patch primitives
 * 
 * @module @isl-lang/pipeline/adapters/nextjs-app-router
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Framework Adapter Types (defined locally to avoid circular deps)
// ============================================================================

export interface FrameworkAdapter {
  name: string;
  detect(root: string): Promise<boolean>;
  getRateLimitImport(): string;
  getRateLimitCheck(): string;
  getAuditImport(): string;
  getAuditCall(action: string): string;
  getValidationImport(): string;
  getIntentAnchorsExport(intents: string[]): string;
  getErrorResponse(status: number, message: string): string;
}

export interface Patch {
  type: 'insert' | 'replace' | 'delete' | 'wrap';
  file: string;
  target?: string | RegExp;
  content: string;
  position?: 'before' | 'after' | 'replace';
  description: string;
}

export interface Violation {
  ruleId: string;
  file: string;
  message: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence?: string;
}

// ============================================================================
// Types
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface HandlerLocation {
  /** HTTP method name */
  method: HttpMethod;
  /** Line number where handler starts */
  line: number;
  /** Line number where handler ends */
  endLine: number;
  /** Character offset in file */
  offset: number;
  /** Whether handler is async */
  isAsync: boolean;
  /** Function parameters */
  params: string[];
  /** Full function signature */
  signature: string;
}

export interface RouteFile {
  /** Absolute file path */
  filePath: string;
  /** Route path extracted from file location */
  routePath: string;
  /** Detected handlers */
  handlers: HandlerLocation[];
  /** File content */
  content: string;
}

export interface InjectionPoint {
  /** Type of injection */
  type: 'import' | 'early-guard' | 'validation' | 'audit' | 'response-wrap';
  /** Line number */
  line: number;
  /** Character offset */
  offset: number;
  /** Existing code at this point (for context) */
  existingCode: string;
}

export interface EnforcementViolation {
  /** Rule that was violated */
  rule: 'rate-limit-order' | 'validation-order' | 'missing-guard';
  /** Handler method */
  method: HttpMethod;
  /** Line number of violation */
  line: number;
  /** Description */
  message: string;
  /** Suggested fix */
  suggestion: string;
}

export interface ASTNode {
  type: string;
  name?: string;
  start: number;
  end: number;
  line: number;
  endLine: number;
  children?: ASTNode[];
  params?: string[];
  isAsync?: boolean;
  body?: ASTNode;
}

// ============================================================================
// Detection
// ============================================================================

/**
 * Detect if a directory is a Next.js project with App Router
 */
export async function detect(root: string): Promise<boolean> {
  // Check 1: Look for next.config.*
  const nextConfigPatterns = [
    'next.config.js',
    'next.config.mjs', 
    'next.config.ts',
    'next.config.cjs',
  ];

  let hasNextConfig = false;
  for (const config of nextConfigPatterns) {
    try {
      await fs.access(path.join(root, config));
      hasNextConfig = true;
      break;
    } catch {
      // Config not found
    }
  }

  if (!hasNextConfig) {
    // Check package.json for next dependency
    try {
      const packageJsonPath = path.join(root, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      hasNextConfig = 'next' in deps;
    } catch {
      return false;
    }
  }

  if (!hasNextConfig) {
    return false;
  }

  // Check 2: Look for App Router pattern (app/api or src/app/api)
  const appRouterPaths = [
    'app/api',
    'src/app/api',
    'app',
    'src/app',
  ];

  for (const routerPath of appRouterPaths) {
    try {
      const stat = await fs.stat(path.join(root, routerPath));
      if (stat.isDirectory()) {
        return true;
      }
    } catch {
      // Path not found
    }
  }

  return false;
}

/**
 * Check if a file is an App Router route file
 */
export function isRouteFile(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  // Match paths like: src/app/api/users/route.ts, app/api/auth/route.ts, etc.
  return /(?:^|\/)app\/.*\/route\.(ts|js|tsx|jsx)$/.test(normalizedPath);
}

// ============================================================================
// Handler Location (Lightweight AST)
// ============================================================================

/**
 * Parse source code into a lightweight AST for handler detection
 */
export function parseHandlers(content: string): ASTNode[] {
  const nodes: ASTNode[] = [];
  const lines = content.split('\n');
  
  // Pattern for exported HTTP method functions
  const exportPattern = /^export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(([^)]*)\)/gm;
  
  let match: RegExpExecArray | null;
  while ((match = exportPattern.exec(content)) !== null) {
    const isAsync = Boolean(match[1]);
    const method = match[2] as HttpMethod;
    const params = match[3].split(',').map(p => p.trim()).filter(Boolean);
    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;
    
    // Find the end of the function by counting braces
    const endInfo = findFunctionEnd(content, startOffset + match[0].length);
    
    nodes.push({
      type: 'FunctionDeclaration',
      name: method,
      start: startOffset,
      end: endInfo.offset,
      line: startLine,
      endLine: endInfo.line,
      isAsync,
      params,
    });
  }
  
  return nodes;
}

/**
 * Find the end of a function by brace counting
 */
function findFunctionEnd(content: string, startOffset: number): { offset: number; line: number } {
  let braceCount = 0;
  let foundStart = false;
  let i = startOffset;
  
  while (i < content.length) {
    const char = content[i];
    
    if (char === '{') {
      braceCount++;
      foundStart = true;
    } else if (char === '}') {
      braceCount--;
      if (foundStart && braceCount === 0) {
        const line = content.substring(0, i + 1).split('\n').length;
        return { offset: i + 1, line };
      }
    }
    i++;
  }
  
  // Fallback: return end of file
  return { offset: content.length, line: content.split('\n').length };
}

/**
 * Locate all HTTP method handlers in a file
 */
export function locateHandlers(content: string, filePath: string): HandlerLocation[] {
  const nodes = parseHandlers(content);
  
  return nodes.map(node => ({
    method: node.name as HttpMethod,
    line: node.line,
    endLine: node.endLine,
    offset: node.start,
    isAsync: node.isAsync ?? false,
    params: node.params ?? [],
    signature: content.substring(node.start, content.indexOf('{', node.start) + 1).trim(),
  }));
}

/**
 * Extract route path from file path (file-system routing)
 */
export function extractRoutePath(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // Match: app/api/.../route.ts or src/app/api/.../route.ts (with optional leading /)
  const appRouterMatch = normalizedPath.match(/(?:^|\/)app(?:\/api)?(.*)\/route\.(ts|js|tsx|jsx)$/);
  if (appRouterMatch) {
    let route = appRouterMatch[1] || '/';
    // Convert [...param] to *param (catch-all routes) - must be done before single params
    route = route.replace(/\/\[\.\.\.([^\]]+)\]/g, '/*$1');
    // Convert [param] to :param (dynamic segments)
    route = route.replace(/\/\[([^\]]+)\]/g, '/:$1');
    return route || '/';
  }
  
  return '/unknown';
}

// ============================================================================
// Injection Patterns
// ============================================================================

/**
 * Find injection points in a handler
 */
export function findInjectionPoints(
  content: string,
  handler: HandlerLocation
): InjectionPoint[] {
  const points: InjectionPoint[] = [];
  const handlerCode = content.substring(handler.offset, content.indexOf('}', handler.offset) + 1);
  const handlerStart = handler.offset;
  
  // Find opening brace of function
  const braceOffset = content.indexOf('{', handler.offset);
  const afterBraceLine = content.substring(0, braceOffset + 1).split('\n').length;
  
  // Point 1: After function opening brace (for early guards)
  points.push({
    type: 'early-guard',
    line: afterBraceLine,
    offset: braceOffset + 1,
    existingCode: content.substring(braceOffset + 1, braceOffset + 100).split('\n')[0] || '',
  });
  
  // Find request.json() calls
  const jsonCallMatch = handlerCode.match(/await\s+\w+\.json\(\)/);
  if (jsonCallMatch) {
    const relativeOffset = handlerCode.indexOf(jsonCallMatch[0]);
    const absoluteOffset = handlerStart + relativeOffset;
    const line = content.substring(0, absoluteOffset).split('\n').length;
    
    points.push({
      type: 'validation',
      line,
      offset: absoluteOffset,
      existingCode: jsonCallMatch[0],
    });
  }
  
  // Find return statements (for audit)
  const returnMatches = [...handlerCode.matchAll(/return\s+(?:NextResponse\.json|Response\.json|new Response)/g)];
  for (const returnMatch of returnMatches) {
    if (returnMatch.index !== undefined) {
      const absoluteOffset = handlerStart + returnMatch.index;
      const line = content.substring(0, absoluteOffset).split('\n').length;
      
      points.push({
        type: 'audit',
        line,
        offset: absoluteOffset,
        existingCode: returnMatch[0],
      });
    }
  }
  
  return points;
}

// ============================================================================
// Early Enforcement Rules
// ============================================================================

/**
 * Check enforcement order violations
 * 
 * Rule: Rate limiting MUST happen:
 * 1. Before request.json() calls
 * 2. Before any business logic
 */
export function checkEnforcementOrder(
  content: string,
  handler: HandlerLocation
): EnforcementViolation[] {
  const violations: EnforcementViolation[] = [];
  const handlerEnd = findFunctionEnd(content, handler.offset + handler.signature.length);
  const handlerCode = content.substring(handler.offset, handlerEnd.offset);
  const lines = handlerCode.split('\n');
  
  // Find positions of key operations
  const rateLimitPos = findPatternPosition(handlerCode, /@intent\s+rate-limit|rateLimit|rate_limit/i);
  const jsonCallPos = findPatternPosition(handlerCode, /\.\s*json\s*\(\s*\)/);
  const businessLogicPos = findFirstBusinessLogicPosition(handlerCode);
  
  // Check: rate limit should exist
  if (rateLimitPos === -1 && (jsonCallPos !== -1 || businessLogicPos !== -1)) {
    violations.push({
      rule: 'missing-guard',
      method: handler.method,
      line: handler.line,
      message: `Handler ${handler.method} has no rate limiting`,
      suggestion: 'Add rate limiting at the start of the handler',
    });
  }
  
  // Check: rate limit before json()
  if (rateLimitPos !== -1 && jsonCallPos !== -1 && rateLimitPos > jsonCallPos) {
    const violationLine = handler.line + handlerCode.substring(0, rateLimitPos).split('\n').length - 1;
    violations.push({
      rule: 'rate-limit-order',
      method: handler.method,
      line: violationLine,
      message: `Rate limiting in ${handler.method} occurs AFTER request.json()`,
      suggestion: 'Move rate limiting before any request body parsing',
    });
  }
  
  // Check: rate limit before business logic
  if (rateLimitPos !== -1 && businessLogicPos !== -1 && rateLimitPos > businessLogicPos) {
    const violationLine = handler.line + handlerCode.substring(0, rateLimitPos).split('\n').length - 1;
    violations.push({
      rule: 'rate-limit-order',
      method: handler.method,
      line: violationLine,
      message: `Rate limiting in ${handler.method} occurs AFTER business logic starts`,
      suggestion: 'Move rate limiting to the very start of the handler',
    });
  }
  
  return violations;
}

function findPatternPosition(code: string, pattern: RegExp): number {
  const match = code.match(pattern);
  return match?.index ?? -1;
}

function findFirstBusinessLogicPosition(code: string): number {
  // Business logic indicators (excluding imports, type declarations, rate limits)
  const businessPatterns = [
    /(?:const|let|var)\s+\w+\s*=\s*await/,  // Async operations
    /(?:db|database|prisma|supabase)\./i,    // Database calls
    /fetch\s*\(/,                             // External API calls
    /(?:create|update|delete|insert)\w*\(/i, // CRUD operations
  ];
  
  for (const pattern of businessPatterns) {
    const match = code.match(pattern);
    if (match?.index !== undefined) {
      return match.index;
    }
  }
  
  return -1;
}

// ============================================================================
// Helper Injection Code Generation
// ============================================================================

export interface InjectionOptions {
  rateLimitConfig?: {
    limit?: number;
    windowMs?: number;
    keyGenerator?: string;
  };
  auditConfig?: {
    action?: string;
    includeBody?: boolean;
    includeUser?: boolean;
  };
  validationSchema?: string;
}

/**
 * Generate rate limit wrapper code
 */
export function generateRateLimitWrapper(options: InjectionOptions = {}): string {
  const config = options.rateLimitConfig ?? {};
  const limit = config.limit ?? 100;
  const windowMs = config.windowMs ?? 60000;
  
  return `
  // @intent rate-limit-required
  const rateLimitResult = await ensureRateLimit(request, {
    limit: ${limit},
    windowMs: ${windowMs},
    keyGenerator: ${config.keyGenerator ?? '(req) => req.headers.get("x-forwarded-for") ?? "anonymous"'},
  });
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } }
    );
  }`;
}

/**
 * Generate audit wrapper code
 */
export function generateAuditWrapper(options: InjectionOptions = {}): string {
  const config = options.auditConfig ?? {};
  const action = config.action ?? 'unknown';
  
  return `
    // @intent audit-required
    await ensureAudit({
      action: '${action}',
      timestamp: new Date().toISOString(),
      userId: ${config.includeUser ? 'session?.user?.id' : 'undefined'},
      metadata: ${config.includeBody ? '{ body: validatedInput }' : '{}'},
    });`;
}

/**
 * Generate input validation wrapper code
 */
export function generateValidationWrapper(options: InjectionOptions = {}): string {
  const schema = options.validationSchema ?? 'InputSchema';
  
  return `
  // @intent input-validation
  const rawBody = await request.json();
  const validationResult = ${schema}.safeParse(rawBody);
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: validationResult.error.issues },
      { status: 400 }
    );
  }
  const validatedInput = validationResult.data;`;
}

// ============================================================================
// AST-Based Patch Primitives
// ============================================================================

export interface PatchPrimitive {
  type: 'insert' | 'replace' | 'delete' | 'wrap';
  /** Exact character offset */
  start: number;
  /** End offset (for replace/delete) */
  end?: number;
  /** Content to insert/replace with */
  content: string;
  /** Description for debugging */
  description: string;
}

/**
 * Create a patch to insert code after function opening brace
 */
export function createEarlyGuardPatch(
  content: string,
  handler: HandlerLocation,
  guardCode: string
): PatchPrimitive {
  const braceOffset = content.indexOf('{', handler.offset);
  
  return {
    type: 'insert',
    start: braceOffset + 1,
    content: guardCode,
    description: `Insert early guard in ${handler.method} handler`,
  };
}

/**
 * Create a patch to add import statement
 */
export function createImportPatch(
  content: string,
  importStatement: string
): PatchPrimitive {
  // Find last import statement
  const importMatches = [...content.matchAll(/^import\s+.*?['"][^'"]+['"];?\s*$/gm)];
  
  if (importMatches.length > 0) {
    const lastImport = importMatches[importMatches.length - 1];
    const insertOffset = (lastImport.index ?? 0) + lastImport[0].length;
    
    return {
      type: 'insert',
      start: insertOffset,
      content: '\n' + importStatement,
      description: 'Add import statement',
    };
  }
  
  // No imports found, add at top
  return {
    type: 'insert',
    start: 0,
    content: importStatement + '\n',
    description: 'Add import statement at file start',
  };
}

/**
 * Create a patch to wrap code before return statement
 */
export function createBeforeReturnPatch(
  content: string,
  handler: HandlerLocation,
  wrapperCode: string
): PatchPrimitive | null {
  const handlerEnd = findFunctionEnd(content, handler.offset + handler.signature.length);
  const handlerCode = content.substring(handler.offset, handlerEnd.offset);
  
  // Find the last return statement
  const returnMatch = handlerCode.match(/(\s*)return\s+(?:NextResponse|Response)/);
  if (!returnMatch || returnMatch.index === undefined) {
    return null;
  }
  
  const absoluteOffset = handler.offset + returnMatch.index;
  const indent = returnMatch[1] || '  ';
  
  return {
    type: 'insert',
    start: absoluteOffset,
    content: wrapperCode.split('\n').map(line => indent + line.trim()).join('\n') + '\n' + indent,
    description: `Insert code before return in ${handler.method} handler`,
  };
}

/**
 * Apply patches to content (immutable)
 */
export function applyPatches(content: string, patches: PatchPrimitive[]): string {
  // Sort patches by offset descending (apply from end to start to preserve offsets)
  const sortedPatches = [...patches].sort((a, b) => b.start - a.start);
  
  let result = content;
  for (const patch of sortedPatches) {
    switch (patch.type) {
      case 'insert':
        result = result.slice(0, patch.start) + patch.content + result.slice(patch.start);
        break;
      case 'replace':
        result = result.slice(0, patch.start) + patch.content + result.slice(patch.end ?? patch.start);
        break;
      case 'delete':
        result = result.slice(0, patch.start) + result.slice(patch.end ?? patch.start);
        break;
    }
  }
  
  return result;
}

// ============================================================================
// Framework Adapter Implementation
// ============================================================================

export const NextJSAppRouterAdapter: FrameworkAdapter = {
  name: 'nextjs-app-router',
  
  async detect(root: string): Promise<boolean> {
    return detect(root);
  },
  
  getRateLimitImport(): string {
    return "import { ensureRateLimit } from '@/lib/rate-limit';";
  },
  
  getRateLimitCheck(): string {
    return generateRateLimitWrapper();
  },
  
  getAuditImport(): string {
    return "import { ensureAudit } from '@/lib/audit';";
  },
  
  getAuditCall(action: string): string {
    return generateAuditWrapper({ auditConfig: { action } });
  },
  
  getValidationImport(): string {
    return "import { z } from 'zod';\nimport { ensureInputValidation } from '@/lib/validation';";
  },
  
  getIntentAnchorsExport(intents: string[]): string {
    return `\n// Machine-checkable intent declaration\nexport const __isl_intents = [${intents.map(i => `"${i}"`).join(', ')}] as const;\n`;
  },
  
  getErrorResponse(status: number, message: string): string {
    return `NextResponse.json({ error: '${message}' }, { status: ${status} })`;
  },
};

// ============================================================================
// Comprehensive Route Analysis
// ============================================================================

/**
 * Analyze a route file completely
 */
export async function analyzeRouteFile(filePath: string): Promise<RouteFile | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const handlers = locateHandlers(content, filePath);
    const routePath = extractRoutePath(filePath);
    
    return {
      filePath,
      routePath,
      handlers,
      content,
    };
  } catch {
    return null;
  }
}

/**
 * Generate all necessary patches for a handler
 */
export function generateHandlerPatches(
  content: string,
  handler: HandlerLocation,
  options: {
    addRateLimit?: boolean;
    addAudit?: boolean;
    addValidation?: boolean;
    validationSchema?: string;
    auditAction?: string;
  } = {}
): PatchPrimitive[] {
  const patches: PatchPrimitive[] = [];
  
  // Check what's already present
  const handlerEnd = findFunctionEnd(content, handler.offset + handler.signature.length);
  const handlerCode = content.substring(handler.offset, handlerEnd.offset);
  const hasRateLimit = /@intent\s+rate-limit|ensureRateLimit/i.test(handlerCode);
  const hasAudit = /@intent\s+audit|ensureAudit/i.test(handlerCode);
  const hasValidation = /safeParse|ensureInputValidation/i.test(handlerCode);
  
  // Add rate limit (always first)
  if (options.addRateLimit && !hasRateLimit) {
    const rateLimitPatch = createEarlyGuardPatch(content, handler, generateRateLimitWrapper());
    rateLimitPatch.description = `Insert rate limit guard in ${handler.method} handler`;
    patches.push(rateLimitPatch);
  }
  
  // Add validation (after rate limit)
  if (options.addValidation && !hasValidation) {
    // Find position after rate limit guard or at function start
    const rateLimitEndMatch = handlerCode.match(/ensureRateLimit[^;]+;/);
    let insertOffset: number;
    
    if (rateLimitEndMatch && rateLimitEndMatch.index !== undefined) {
      insertOffset = handler.offset + rateLimitEndMatch.index + rateLimitEndMatch[0].length;
    } else {
      insertOffset = content.indexOf('{', handler.offset) + 1;
      // If we're also adding rate limit, it will be inserted first, so adjust
      if (options.addRateLimit && !hasRateLimit) {
        // Validation will be added after the rate limit code we're inserting
        const rateLimitCode = generateRateLimitWrapper();
        insertOffset += rateLimitCode.length;
      }
    }
    
    patches.push({
      type: 'insert',
      start: insertOffset,
      content: generateValidationWrapper({ validationSchema: options.validationSchema }),
      description: `Insert validation in ${handler.method} handler`,
    });
  }
  
  // Add audit (before return)
  if (options.addAudit && !hasAudit) {
    const auditPatch = createBeforeReturnPatch(
      content,
      handler,
      generateAuditWrapper({ auditConfig: { action: options.auditAction ?? handler.method.toLowerCase() } })
    );
    if (auditPatch) {
      patches.push(auditPatch);
    }
  }
  
  return patches;
}

// ============================================================================
// Fix Recipe Integration
// ============================================================================

/**
 * Create fix patches for a violation using the adapter
 */
export function createFixPatches(
  violation: Violation,
  content: string
): Patch[] {
  const patches: Patch[] = [];
  const handlers = locateHandlers(content, violation.file);
  
  // Find the relevant handler
  const handler = handlers.find(h => 
    violation.line && h.line <= violation.line && h.endLine >= violation.line
  ) ?? handlers[0];
  
  if (!handler) {
    return patches;
  }
  
  // Generate patches based on rule
  if (violation.ruleId.includes('rate-limit')) {
    if (!content.includes('ensureRateLimit')) {
      patches.push({
        type: 'insert',
        file: violation.file,
        target: /^import/m,
        content: NextJSAppRouterAdapter.getRateLimitImport() + '\n',
        position: 'after',
        description: 'Add rate limit import',
      });
    }
    
    patches.push({
      type: 'insert',
      file: violation.file,
      target: new RegExp(`export\\s+(?:async\\s+)?function\\s+${handler.method}\\s*\\([^)]*\\)\\s*\\{`),
      content: generateRateLimitWrapper(),
      position: 'after',
      description: 'Add rate limit check',
    });
  }
  
  if (violation.ruleId.includes('audit')) {
    if (!content.includes('ensureAudit')) {
      patches.push({
        type: 'insert',
        file: violation.file,
        target: /^import/m,
        content: NextJSAppRouterAdapter.getAuditImport() + '\n',
        position: 'after',
        description: 'Add audit import',
      });
    }
    
    patches.push({
      type: 'insert',
      file: violation.file,
      target: /return\s+(?:NextResponse|Response)/,
      content: generateAuditWrapper({ auditConfig: { action: handler.method.toLowerCase() } }) + '\n',
      position: 'before',
      description: 'Add audit call',
    });
  }
  
  if (violation.ruleId.includes('validation') || violation.ruleId.includes('input')) {
    if (!content.includes("from 'zod'")) {
      patches.push({
        type: 'insert',
        file: violation.file,
        target: /^import/m,
        content: NextJSAppRouterAdapter.getValidationImport() + '\n',
        position: 'after',
        description: 'Add validation import',
      });
    }
    
    patches.push({
      type: 'insert',
      file: violation.file,
      target: /const\s+(?:body|data)\s*=\s*await\s+\w+\.json\(\)/,
      content: generateValidationWrapper() + '\n',
      position: 'after',
      description: 'Add input validation',
    });
  }
  
  return patches;
}

// ============================================================================
// Exports
// ============================================================================

export default NextJSAppRouterAdapter;
