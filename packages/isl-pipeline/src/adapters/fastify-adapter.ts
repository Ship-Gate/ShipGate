/**
 * Fastify Codegen Adapter
 *
 * Generates Fastify API from ISL specs.
 * Structure: src/routes/, src/plugins/, src/schemas/, src/services/, src/hooks/
 * Uses JSON Schema from ISL constraints for validation and serialization.
 * Plugins: @fastify/jwt (auth), @fastify/cors, @fastify/rate-limit
 * Swagger: @fastify/swagger for OpenAPI from route schemas.
 *
 * @module @isl-lang/pipeline/adapters/fastify-adapter
 */

import type { ISLAST, BehaviorAST } from '@isl-lang/translator';
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

// ============================================================================
// JSON Schema Generator from ISL
// ============================================================================

interface FieldLike {
  name: string;
  type: { name?: string; kind?: string };
  optional?: boolean;
  constraints?: Array<{ expression?: string }>;
}

function islTypeToJsonSchema(typeName: string, constraints: Array<{ expression?: string }> = []): Record<string, unknown> {
  const baseTypes: Record<string, Record<string, unknown>> = {
    String: { type: 'string' },
    Email: { type: 'string', format: 'email' },
    Int: { type: 'integer' },
    Float: { type: 'number' },
    Boolean: { type: 'boolean' },
    UUID: { type: 'string', format: 'uuid' },
    DateTime: { type: 'string', format: 'date-time' },
  };
  let schema: Record<string, unknown> = { ...(baseTypes[typeName] ?? { type: 'string' }) };

  for (const c of constraints) {
    const expr = c.expression ?? '';
    const minMatch = expr.match(/min length (\d+)/i);
    if (minMatch) {
      schema = { ...schema, minLength: parseInt(minMatch[1]!, 10) };
    }
    const maxMatch = expr.match(/max length (\d+)/i);
    if (maxMatch) {
      schema = { ...schema, maxLength: parseInt(maxMatch[1]!, 10) };
    }
  }
  return schema;
}

function fieldsToJsonSchema(fields: FieldLike[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const f of fields) {
    const typeName = f.type?.name ?? f.type?.kind ?? 'String';
    const constraints = f.constraints ?? [];
    properties[f.name] = islTypeToJsonSchema(typeName, constraints);
    if (!f.optional) {
      required.push(f.name);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
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

// ============================================================================
// Content Generators
// ============================================================================

function generateSchemaContent(endpoint: ISLEndpoint): string {
  const bodySchema = fieldsToJsonSchema(endpoint.input);
  const responseSchema = {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: {},
    },
    required: ['success'],
  };

  return `/**
 * JSON Schema for ${endpoint.name}
 * Generated from ISL constraints
 */
export const ${endpoint.name}BodySchema = ${JSON.stringify(bodySchema, null, 2)} as const;

export const ${endpoint.name}ResponseSchema = ${JSON.stringify(responseSchema, null, 2)} as const;
`;
}

function generateRouteContent(endpoint: ISLEndpoint, spec: ISLSpec): string {
  const kebab = kebabCase(endpoint.name);
  const intents = endpoint.intents.map((i) => i.tag);
  const hasRateLimit = intents.includes('rate-limit-required');
  const hasAuth = endpoint.intents.some((i) => i.tag === 'auth-required') ||
    spec.behaviors.some((b) => b.intents?.some((i) => i.tag === 'auth-required'));

  const hooks = [];
  if (hasAuth) hooks.push("  preHandler: [fastify.authenticate]");
  if (hasRateLimit) hooks.push("  // Rate limit applied via plugin");

  return `/**
 * Routes for ${endpoint.name}
 * Generated from ISL domain "${spec.name}"
 */
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { execute as ${camelCase(endpoint.name)}Service } from '../services/${kebab}.js';
import { ${endpoint.name}BodySchema } from '../schemas/${kebab}.js';

export default async function ${kebab}Routes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  fastify.post<{
    Body: Record<string, unknown>;
  }>('/', {
    schema: {
      body: ${endpoint.name}BodySchema,
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: {} },
          required: ['success'],
        },
        400: {
          type: 'object',
          properties: { error: { type: 'string' }, details: {} },
        },
      },
    },
${hooks.length ? hooks.join(',\n') + ',' : ''}
  }, async (request, reply) => {
    const input = request.body;
    const result = await ${camelCase(endpoint.name)}Service(input);
    return reply.send({ success: true, data: result });
  });
}
`;
}

function generateServiceContent(endpoint: ISLEndpoint): string {
  const kebab = kebabCase(endpoint.name);
  return `/**
 * Service: ${endpoint.name}
 * Generated from ISL - uses Prisma for DB
 */
import { prisma } from '../lib/db.js';

export async function execute(input: Record<string, unknown>): Promise<unknown> {
  // TODO: Implement ${endpoint.name} with Prisma
  // Example:
  // const user = await prisma.user.findUnique({ where: { email: input.email } });
  // ...
  throw new Error('IMPLEMENTATION_REQUIRED: ${endpoint.name}');
}
`;
}

export const FastifyAdapter: FrameworkAdapter = {
  name: 'fastify',

  generateProjectStructure(spec: ISLSpec): FileMap {
    const map: FileMap = new Map();
    const ctx: CodegenContext = {
      spec,
      repoContext: {
        framework: 'fastify',
        validationLib: 'json-schema',
        routingStyle: 'explicit',
        conventions: { apiPrefix: '/api' },
      },
    };

    for (const behavior of spec.behaviors) {
      const routeFile = this.generateRouteFile(behavior, ctx);
      map.set(`src/routes/${kebabCase(behavior.name)}.ts`, routeFile.content);

      map.set(
        `src/schemas/${kebabCase(behavior.name)}.ts`,
        generateSchemaContent(behavior)
      );
      map.set(
        `src/services/${kebabCase(behavior.name)}.ts`,
        generateServiceContent(behavior)
      );
    }

    for (const m of this.generateMiddleware(spec)) {
      map.set(m.path, m.content);
    }

    const entry = this.generateEntryPoint(spec);
    map.set(entry.path, entry.content);

    const configFile = this.generateConfig(spec);
    map.set(configFile.path, configFile.content);

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
      b.intents?.some((i) => i.tag === 'rate-limit-required')
    );
    const hasAudit = spec.behaviors.some((b) =>
      b.intents?.some((i) => i.tag === 'audit-required')
    );

    files.push({
      path: 'src/plugins/auth.ts',
      content: `/**
 * Auth plugin - JWT via @fastify/jwt
 * Use with: fastify.authenticate in preHandler
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';

const authPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fastify.register(fjwt, {
    secret: process.env['JWT_SECRET'] ?? 'change-me-in-production',
  });

  fastify.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });
};

export default fp(authPlugin, { name: 'auth-plugin' });
`,
    });

    files.push({
      path: 'src/plugins/cors.ts',
      content: `/**
 * CORS plugin - @fastify/cors
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';

const corsPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
};

export default fp(corsPlugin, { name: 'cors-plugin' });
`,
    });

    if (hasRateLimit) {
      files.push({
        path: 'src/plugins/rate-limit.ts',
        content: `/**
 * Rate limiting plugin - @fastify/rate-limit
 * @intent rate-limit-required
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

const rateLimitPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
};

export default fp(rateLimitPlugin, { name: 'rate-limit-plugin' });
`,
      });
    }

    if (hasAudit) {
      files.push({
        path: 'src/hooks/audit.ts',
        content: `/**
 * Audit hook - @intent audit-required
 */
export interface AuditEntry {
  action: string;
  success: boolean;
  metadata?: Record<string, string>;
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
      path: 'src/hooks/error-handler.ts',
      content: `/**
 * Global error handler hook
 */
import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  reply.status(error.statusCode ?? 500).send({
    error: error.message ?? 'Internal server error',
  });
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
      .map((b) => `  await app.register(${kebabCase(b.name)}Routes, { prefix: '/api/${kebabCase(b.name)}' });`)
      .join('\n');

    const hasRateLimit = spec.behaviors.some((b) =>
      b.intents?.some((i) => i.tag === 'rate-limit-required')
    );

    return {
      path: 'src/app.ts',
      content: `/**
 * Fastify server - ${spec.name}
 * Generated from ISL
 */
import Fastify from 'fastify';
import { loadConfig } from './fastify.config.js';
import authPlugin from './plugins/auth.js';
import corsPlugin from './plugins/cors.js';
${hasRateLimit ? "import rateLimitPlugin from './plugins/rate-limit.js';" : ''}

${routeImports}

async function buildApp() {
  const config = loadConfig();
  const app = Fastify({ logger: config.logger });

  await app.register(corsPlugin);
${hasRateLimit ? '  await app.register(rateLimitPlugin);' : ''}
  await app.register(authPlugin);

  // Routes (autoload)
${routeRegistrations}

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    reply.status(err.statusCode ?? 500).send({ error: err.message ?? 'Internal server error' });
  });

  return app;
}

export async function start() {
  const app = await buildApp();
  const config = loadConfig();
  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
  return app;
}

const isMain = process.argv[1]?.includes('app.');
if (isMain) {
  start().catch(console.error);
}

export default buildApp;
`,
    };
  },

  generateConfig(_spec: ISLSpec): GeneratedFile {
    return {
      path: 'src/fastify.config.ts',
      content: `/**
 * Fastify config - production defaults
 * Logger: pino, trust proxy, body limit, connection timeout
 */
export interface FastifyConfig {
  port: number;
  host: string;
  logger: { level: string };
  trustProxy: boolean;
  bodyLimit: number;
  connectionTimeout: number;
}

export function loadConfig(): FastifyConfig {
  return {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    host: process.env['HOST'] ?? '0.0.0.0',
    logger: {
      level: process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
    },
    trustProxy: process.env['TRUST_PROXY'] === 'true',
    bodyLimit: parseInt(process.env['BODY_LIMIT'] ?? '1048576', 10), // 1MB
    connectionTimeout: parseInt(process.env['CONNECTION_TIMEOUT'] ?? '0', 10),
  };
}
`,
    };
  },

  getPackageDeps(): Record<string, string> {
    return {
      fastify: '^4.24.0',
      '@fastify/jwt': '^8.0.0',
      '@fastify/cors': '^8.0.0',
      '@fastify/rate-limit': '^9.0.0',
      '@fastify/swagger': '^8.0.0',
      'fastify-plugin': '^4.0.0',
      '@prisma/client': '^5.0.0',
    };
  },

  getScripts(): Record<string, string> {
    return {
      dev: 'tsx watch src/app.ts',
      build: 'tsc',
      start: 'node dist/app.js',
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
