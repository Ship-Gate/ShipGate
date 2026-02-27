/**
 * Express.js Codegen Adapter
 *
 * Generates Express API from ISL specs.
 * Structure: src/routes/, src/controllers/, src/middleware/, src/services/, src/validators/
 * Uses Prisma for DB access.
 *
 * @module @isl-lang/pipeline/adapters/express-adapter
 */

import type { ISLAST, BehaviorAST, RepoContext } from '@isl-lang/translator';
import type {
  FrameworkAdapter,
  ISLSpec,
  ISLEndpoint,
  FileMap,
  GeneratedFile,
  CodegenContext,
} from './codegen-framework-adapter.js';

function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function camelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function getZodType(typeName: string, constraints: Array<{ expression: string }>): string {
  const baseTypes: Record<string, string> = {
    String: 'z.string()',
    Email: 'z.string().email()',
    Int: 'z.number().int()',
    Float: 'z.number()',
    Boolean: 'z.boolean()',
    UUID: 'z.string().uuid()',
    DateTime: 'z.date()',
  };
  let zodType = baseTypes[typeName] ?? 'z.unknown()';
  for (const constraint of constraints) {
    if (constraint.expression.includes('min length')) {
      const match = constraint.expression.match(/min length (\d+)/);
      if (match) zodType += `.min(${match[1]})`;
    }
    if (constraint.expression.includes('max length')) {
      const match = constraint.expression.match(/max length (\d+)/);
      if (match) zodType += `.max(${match[1]})`;
    }
  }
  return zodType;
}

function getErrorStatusCode(errorName: string): number {
  const codes: Record<string, number> = {
    InvalidCredentials: 401,
    Unauthorized: 401,
    AccountLocked: 423,
    AccountDisabled: 403,
    NotFound: 404,
    Conflict: 409,
    RateLimited: 429,
  };
  return codes[errorName] ?? 400;
}

function generateControllerContent(endpoint: ISLEndpoint): string {
  const kebab = kebabCase(endpoint.name);
  const intents = endpoint.intents.map((i) => i.tag);
  const hasRateLimit = intents.includes('rate-limit-required');
  const hasAudit = intents.includes('audit-required');
  const errorClasses = endpoint.output.errors
    .map((e) => `class ${e.name}Error extends Error {
  constructor(message = '${e.when}') {
    super(message);
    this.name = '${e.name}Error';
  }
}`)
    .join('\n');

  return `/**
 * Controller: ${endpoint.name}
 * Generated from ISL
 */
import type { Request, Response, NextFunction } from 'express';
import { execute as ${camelCase(endpoint.name)}Service } from '../services/${kebab}.js';
import { ${endpoint.name}Schema } from '../validators/${kebab}.js';
${hasRateLimit ? "import { rateLimiter } from '../middleware/rate-limit.js';" : ''}
${hasAudit ? "import { auditLog } from '../middleware/audit.js';" : ''}
${errorClasses ? `\n${errorClasses}\n` : ''}

export async function ${camelCase(endpoint.name)}Controller(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
${hasRateLimit ? `    // @intent rate-limit-required - applied via middleware` : ''}
    const parseResult = ${endpoint.name}Schema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
      return;
    }

    const input = parseResult.data;
    const result = await ${camelCase(endpoint.name)}Service(input);
${hasAudit ? `    await auditLog({ action: '${endpoint.name}', success: true, req });` : ''}
    res.json(result);
  } catch (error) {
${endpoint.output.errors.map((e) => `
    if (error instanceof ${e.name}Error) {
      res.status(${getErrorStatusCode(e.name)}).json({ error: '${e.when}' });
      return;
    }`).join('')}
    next(error);
  }
}
`;
}

function generateRouteContent(endpoint: ISLEndpoint, spec: ISLSpec): string {
  const kebab = kebabCase(endpoint.name);
  const intents = endpoint.intents.map((i) => i.tag);
  const hasRateLimit = intents.includes('rate-limit-required');

  return `/**
 * Routes for ${endpoint.name}
 * Generated from ISL domain "${spec.name}"
 */
import { Router } from 'express';
import { ${camelCase(endpoint.name)}Controller } from '../controllers/${kebab}.js';
${hasRateLimit ? "import { rateLimiter } from '../middleware/rate-limit.js';" : ''}

const router = Router();
const controller = ${camelCase(endpoint.name)}Controller;

${hasRateLimit ? "router.post('/', rateLimiter, controller);" : 'router.post("/", controller);'}

export default router;
`;
}

function generateServiceContent(endpoint: ISLEndpoint): string {
  const kebab = kebabCase(endpoint.name);
  return `/**
 * Service: ${endpoint.name}
 * Generated from ISL - uses Prisma for DB
 */
import { prisma } from '../lib/db.js';
import type { ${endpoint.name}Input } from '../validators/${kebab}.js';

export async function execute(input: ${endpoint.name}Input): Promise<unknown> {
  // TODO: Implement ${endpoint.name} with Prisma
  // Example:
  // const user = await prisma.user.findUnique({ where: { email: input.email } });
  // ...
  throw new Error('IMPLEMENTATION_REQUIRED: ${endpoint.name}');
}
`;
}

function generateValidatorContent(endpoint: ISLEndpoint): string {
  return `/**
 * Validators for ${endpoint.name}
 */
import { z } from 'zod';

export const ${endpoint.name}Schema = z.object({
${endpoint.input.map((f) => `  ${f.name}: ${getZodType(f.type.name, f.constraints)},`).join('\n')}
});

export type ${endpoint.name}Input = z.infer<typeof ${endpoint.name}Schema>;
`;
}

export const ExpressAdapter: FrameworkAdapter = {
  name: 'express',

  generateProjectStructure(spec: ISLSpec): FileMap {
    const map: FileMap = new Map();
    const ctx: CodegenContext = {
      spec,
      repoContext: { framework: 'express', validationLib: 'zod', routingStyle: 'explicit', conventions: { apiPrefix: '/api' } },
    };

    for (const behavior of spec.behaviors) {
      const routeFile = this.generateRouteFile(behavior, ctx);
      map.set(`src/routes/${kebabCase(behavior.name)}.ts`, routeFile.content);

      map.set(
        `src/controllers/${kebabCase(behavior.name)}.ts`,
        generateControllerContent(behavior)
      );
      map.set(
        `src/services/${kebabCase(behavior.name)}.ts`,
        generateServiceContent(behavior)
      );
      map.set(
        `src/validators/${kebabCase(behavior.name)}.ts`,
        generateValidatorContent(behavior)
      );
    }

    for (const m of this.generateMiddleware(spec)) {
      map.set(m.path, m.content);
    }

    const entry = this.generateEntryPoint(spec);
    map.set(entry.path, entry.content);

    map.set(
      'src/lib/db.ts',
      `/**
 * Prisma client
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
`
    );

    return map;
  },

  generateRouteFile(endpoint: ISLEndpoint, context: CodegenContext): GeneratedFile {
    const content = generateRouteContent(endpoint, context.spec);
    return { path: `src/routes/${kebabCase(endpoint.name)}.ts`, content };
  },

  generateMiddleware(spec: ISLSpec): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const hasRateLimit = spec.behaviors.some((b) =>
      b.intents.some((i) => i.tag === 'rate-limit-required')
    );
    const hasAudit = spec.behaviors.some((b) =>
      b.intents.some((i) => i.tag === 'audit-required')
    );

    files.push({
      path: 'src/middleware/error-handler.ts',
      content: `/**
 * Global error handler
 */
import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(500).json({ error: 'Internal server error' });
}
`,
    });

    files.push({
      path: 'src/middleware/request-logger.ts',
      content: `/**
 * Request logging middleware
 */
import type { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  const start = Date.now();
  _res.on('finish', () => {
    const duration = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(\`\${req.method} \${req.path} \${_res.statusCode} \${duration}ms\`);
  });
  next();
}
`,
    });

    files.push({
      path: 'src/middleware/cors.ts',
      content: `/**
 * CORS middleware - configure origins as needed
 */
import type { Request, Response, NextFunction } from 'express';

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
}
`,
    });

    if (hasRateLimit) {
      files.push({
        path: 'src/middleware/rate-limit.ts',
        content: `/**
 * Rate limiting middleware
 * @intent rate-limit-required
 */
import type { Request, Response, NextFunction } from 'express';

const limit = 100;
const windowMs = 60_000;
const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? req.socket.remoteAddress ?? 'anonymous';
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  if (now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  if (entry.count >= limit) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  entry.count++;
  next();
}
`,
      });
    }

    if (hasAudit) {
      files.push({
        path: 'src/middleware/audit.ts',
        content: `/**
 * Audit logging middleware
 * @intent audit-required
 */
import type { Request } from 'express';

export interface AuditEntry {
  action: string;
  success: boolean;
  req: Request;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  if (process.env['NODE_ENV'] === 'development') {
    // eslint-disable-next-line no-console
    console.log('[audit]', entry.action, entry.success);
  }
}
`,
      });
    }

    files.push({
      path: 'src/middleware/auth.ts',
      content: `/**
 * Auth middleware - JWT verification
 * Use with: router.get('/protected', authMiddleware, handler)
 */
import type { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  // TODO: Verify JWT and attach user to req
  next();
}
`,
    });

    return files;
  },

  generateEntryPoint(spec: ISLSpec): GeneratedFile {
    const routeImports = spec.behaviors
      .map((b) => `import ${kebabCase(b.name)}Routes from './routes/${kebabCase(b.name)}.js';`)
      .join('\n');
    const routeRegistrations = spec.behaviors
      .map((b) => `app.use('/api/${kebabCase(b.name)}', ${kebabCase(b.name)}Routes);`)
      .join('\n');

    return {
      path: 'src/index.ts',
      content: `/**
 * Express server - ${spec.name}
 * Generated from ISL
 */
import express from 'express';
import { requestLogger } from './middleware/request-logger.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';

${routeImports}

const app = express();
const PORT = process.env['PORT'] ?? 3000;

// Middleware stack
app.use(express.json());
app.use(requestLogger);
app.use(corsMiddleware);

// Routes
${routeRegistrations}

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(\`Server running on http://localhost:\${PORT}\`);
});

export default app;
`,
    };
  },

  getPackageDeps(): Record<string, string> {
    return {
      express: '^4.18.0',
      zod: '^3.22.0',
      '@prisma/client': '^5.0.0',
    };
  },

  getScripts(): Record<string, string> {
    return {
      dev: 'tsx watch src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
      'db:generate': 'prisma generate',
      'db:push': 'prisma db push',
    };
  },

  getTsConfig(): object {
    return {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        outDir: 'dist',
        rootDir: 'src',
        declaration: true,
        resolveJsonModule: true,
      },
      include: ['src/**/*.ts'],
      exclude: ['node_modules', 'dist'],
    };
  },
};
