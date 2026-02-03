/**
 * Framework Adapters - Generate framework-specific code patterns
 *
 * @module @isl-lang/healer/adapters
 */

import type { FrameworkAdapter, FrameworkDetection, SupportedFramework, ISLType } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Next.js App Router Adapter
// ============================================================================

export const NextJSAppAdapter: FrameworkAdapter = {
  name: 'nextjs-app',

  async detect(projectRoot: string): Promise<FrameworkDetection> {
    const evidence: string[] = [];
    let confidence = 0;

    // Check for next.config
    if (fs.existsSync(path.join(projectRoot, 'next.config.js')) ||
        fs.existsSync(path.join(projectRoot, 'next.config.mjs')) ||
        fs.existsSync(path.join(projectRoot, 'next.config.ts'))) {
      evidence.push('next.config found');
      confidence += 0.3;
    }

    // Check for app directory (App Router)
    if (fs.existsSync(path.join(projectRoot, 'app')) ||
        fs.existsSync(path.join(projectRoot, 'src', 'app'))) {
      evidence.push('app directory found');
      confidence += 0.4;
    }

    // Check package.json for next
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
      if (pkg.dependencies?.next || pkg.devDependencies?.next) {
        evidence.push('next in dependencies');
        confidence += 0.3;
      }
    } catch {}

    return {
      framework: 'nextjs-app',
      confidence,
      evidence,
    };
  },

  getRateLimitImport() {
    return "import { rateLimit } from '@/lib/rate-limit';";
  },

  getRateLimitCheck(options = {}) {
    const { limit = 10, window = '60s', identifier = 'ip' } = options;
    return `
  // @intent rate-limit-required
  const rateLimitResult = await rateLimit(request, {
    limit: ${limit},
    window: '${window}',
    identifier: '${identifier}',
  });
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }`;
  },

  getAuditImport() {
    return "import { audit } from '@/lib/audit';";
  },

  getAuditSuccessCall(action: string, metadata = {}) {
    const metaStr = Object.entries(metadata)
      .map(([k, v]) => `${k}: '${v}'`)
      .join(', ');
    return `
    // @intent audit-required
    await audit({
      action: '${action}',
      success: true,
      timestamp: new Date().toISOString(),${metaStr ? `\n      ${metaStr},` : ''}
    });`;
  },

  getAuditFailureCall(action: string, error?: string) {
    return `
    // @intent audit-required
    await audit({
      action: '${action}',
      success: false,
      error: ${error ? `'${error}'` : 'error.message'},
      timestamp: new Date().toISOString(),
    });`;
  },

  getAuthImport() {
    return "import { auth } from '@/lib/auth';";
  },

  getAuthCheck(options = {}) {
    const { required = true, roles = [] } = options;
    const rolesCheck = roles.length > 0
      ? `\n    if (!${JSON.stringify(roles)}.includes(session.user.role)) {\n      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });\n    }`
      : '';
    return `
  // @intent auth-required
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }${rolesCheck}`;
  },

  getValidationImport() {
    return "import { z } from 'zod';";
  },

  generateValidationSchema(types: ISLType[]) {
    // Simplified schema generation
    return `const InputSchema = z.object({
  // TODO: Generate from ISL types
});`;
  },

  getValidationCheck(schemaName: string) {
    return `
  // @intent input-validation
  const validationResult = ${schemaName}.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validationResult.error.flatten() },
      { status: 400 }
    );
  }
  const input = validationResult.data;`;
  },

  getIntentAnchorsExport(intents: string[]) {
    return `\n// Machine-checkable intent declaration\nexport const __isl_intents = [${intents.map(i => `"${i}"`).join(', ')}] as const;\n`;
  },

  getIntentComment(intent: string) {
    return `// @intent ${intent}`;
  },

  getErrorResponse(status: number, message: string, options = {}) {
    const { errorCode, details } = options;
    const body: Record<string, unknown> = { error: message };
    if (errorCode) body.code = errorCode;
    if (details) body.details = details;
    return `NextResponse.json(${JSON.stringify(body)}, { status: ${status} })`;
  },

  getSuccessResponse(data: string) {
    return `NextResponse.json(${data})`;
  },

  getRouteFilePattern() {
    return '**/app/**/route.ts';
  },

  getHandlerSignature(method: string) {
    return `export async function ${method.toUpperCase()}(request: Request)`;
  },

  getRequestBodyAccessor() {
    return 'await request.json()';
  },

  getHeaderAccessor(name: string) {
    return `request.headers.get('${name}')`;
  },
};

// ============================================================================
// Next.js Pages Router Adapter
// ============================================================================

export const NextJSPagesAdapter: FrameworkAdapter = {
  ...NextJSAppAdapter,
  name: 'nextjs-pages',

  async detect(projectRoot: string): Promise<FrameworkDetection> {
    const evidence: string[] = [];
    let confidence = 0;

    // Check for pages directory
    if (fs.existsSync(path.join(projectRoot, 'pages')) ||
        fs.existsSync(path.join(projectRoot, 'src', 'pages'))) {
      evidence.push('pages directory found');
      confidence += 0.4;
    }

    // Check for next.config
    if (fs.existsSync(path.join(projectRoot, 'next.config.js'))) {
      evidence.push('next.config found');
      confidence += 0.3;
    }

    return {
      framework: 'nextjs-pages',
      confidence,
      evidence,
    };
  },

  getErrorResponse(status: number, message: string) {
    return `res.status(${status}).json({ error: '${message}' })`;
  },

  getSuccessResponse(data: string) {
    return `res.status(200).json(${data})`;
  },

  getRouteFilePattern() {
    return '**/pages/api/**/*.ts';
  },

  getHandlerSignature(method: string) {
    return `export default async function handler(req: NextApiRequest, res: NextApiResponse)`;
  },

  getRequestBodyAccessor() {
    return 'req.body';
  },

  getHeaderAccessor(name: string) {
    return `req.headers['${name.toLowerCase()}']`;
  },
};

// ============================================================================
// Express Adapter
// ============================================================================

export const ExpressAdapter: FrameworkAdapter = {
  name: 'express',

  async detect(projectRoot: string): Promise<FrameworkDetection> {
    const evidence: string[] = [];
    let confidence = 0;

    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
      if (pkg.dependencies?.express) {
        evidence.push('express in dependencies');
        confidence += 0.5;
      }
    } catch {}

    return {
      framework: 'express',
      confidence,
      evidence,
    };
  },

  getRateLimitImport() {
    return "import { rateLimiter } from '../middleware/rate-limit';";
  },

  getRateLimitCheck(options = {}) {
    return `
  // @intent rate-limit-required
  // Rate limiting applied via middleware: rateLimiter()`;
  },

  getAuditImport() {
    return "import { auditLog } from '../services/audit';";
  },

  getAuditSuccessCall(action: string) {
    return `
    // @intent audit-required
    await auditLog({
      action: '${action}',
      userId: req.user?.id,
      ip: req.ip,
      success: true,
      timestamp: new Date().toISOString(),
    });`;
  },

  getAuditFailureCall(action: string, error?: string) {
    return `
    // @intent audit-required
    await auditLog({
      action: '${action}',
      userId: req.user?.id,
      ip: req.ip,
      success: false,
      error: ${error ? `'${error}'` : 'error.message'},
      timestamp: new Date().toISOString(),
    });`;
  },

  getAuthImport() {
    return "import { requireAuth } from '../middleware/auth';";
  },

  getAuthCheck(options = {}) {
    return `
  // @intent auth-required
  // Auth check applied via middleware: requireAuth()`;
  },

  getValidationImport() {
    return "import { z } from 'zod';";
  },

  generateValidationSchema(types: ISLType[]) {
    return `const InputSchema = z.object({
  // TODO: Generate from ISL types
});`;
  },

  getValidationCheck(schemaName: string) {
    return `
  // @intent input-validation
  const validationResult = ${schemaName}.safeParse(req.body);
  if (!validationResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationResult.error.flatten(),
    });
  }
  const input = validationResult.data;`;
  },

  getIntentAnchorsExport(intents: string[]) {
    return `\n// Machine-checkable intent declaration\nexport const __isl_intents = [${intents.map(i => `"${i}"`).join(', ')}] as const;\n`;
  },

  getIntentComment(intent: string) {
    return `// @intent ${intent}`;
  },

  getErrorResponse(status: number, message: string) {
    return `res.status(${status}).json({ error: '${message}' })`;
  },

  getSuccessResponse(data: string) {
    return `res.json(${data})`;
  },

  getRouteFilePattern() {
    return '**/routes/**/*.ts';
  },

  getHandlerSignature(method: string) {
    return `export const ${method}Handler = async (req: Request, res: Response)`;
  },

  getRequestBodyAccessor() {
    return 'req.body';
  },

  getHeaderAccessor(name: string) {
    return `req.headers['${name.toLowerCase()}']`;
  },
};

// ============================================================================
// Fastify Adapter
// ============================================================================

export const FastifyAdapter: FrameworkAdapter = {
  ...ExpressAdapter,
  name: 'fastify',

  async detect(projectRoot: string): Promise<FrameworkDetection> {
    const evidence: string[] = [];
    let confidence = 0;

    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
      if (pkg.dependencies?.fastify) {
        evidence.push('fastify in dependencies');
        confidence += 0.5;
      }
    } catch {}

    return {
      framework: 'fastify',
      confidence,
      evidence,
    };
  },

  getErrorResponse(status: number, message: string) {
    return `reply.code(${status}).send({ error: '${message}' })`;
  },

  getSuccessResponse(data: string) {
    return `reply.send(${data})`;
  },

  getHandlerSignature(method: string) {
    return `export const ${method}Handler = async (request: FastifyRequest, reply: FastifyReply)`;
  },

  getRequestBodyAccessor() {
    return 'request.body';
  },

  getHeaderAccessor(name: string) {
    return `request.headers['${name.toLowerCase()}']`;
  },
};

// ============================================================================
// Framework Detection
// ============================================================================

const ALL_ADAPTERS: FrameworkAdapter[] = [
  NextJSAppAdapter,
  NextJSPagesAdapter,
  ExpressAdapter,
  FastifyAdapter,
];

/**
 * Detect framework from project structure
 */
export async function detectFramework(projectRoot: string): Promise<FrameworkDetection> {
  const results: Array<{ adapter: FrameworkAdapter; detection: FrameworkDetection }> = [];

  for (const adapter of ALL_ADAPTERS) {
    const detection = await adapter.detect(projectRoot);
    results.push({ adapter, detection });
  }

  // Sort by confidence and return highest
  results.sort((a, b) => b.detection.confidence - a.detection.confidence);

  if (results[0].detection.confidence > 0.5) {
    return results[0].detection;
  }

  // Default to Next.js App Router
  return {
    framework: 'nextjs-app',
    confidence: 0.5,
    evidence: ['default fallback'],
  };
}

/**
 * Get framework adapter (auto-detect or use override)
 */
export async function getFrameworkAdapter(
  projectRoot: string,
  override?: SupportedFramework
): Promise<FrameworkAdapter> {
  if (override) {
    const adapter = ALL_ADAPTERS.find(a => a.name === override);
    if (adapter) return adapter;
  }

  const detection = await detectFramework(projectRoot);

  switch (detection.framework) {
    case 'nextjs-app':
      return NextJSAppAdapter;
    case 'nextjs-pages':
      return NextJSPagesAdapter;
    case 'express':
      return ExpressAdapter;
    case 'fastify':
      return FastifyAdapter;
    default:
      return NextJSAppAdapter;
  }
}
