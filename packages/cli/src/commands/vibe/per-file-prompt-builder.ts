/**
 * Per-File Prompt Builder for Backend Code Generation
 *
 * Builds focused prompts for each backend file, including:
 * - Full ISL spec
 * - Prisma schema (already generated)
 * - Previously generated files' exports/types
 * - Specific file purpose and requirements
 *
 * Each prompt explicitly instructs: "Do NOT use comment stubs. Write complete implementation code."
 */

export interface FileToGenerate {
  path: string;
  purpose: string;
  dependencies: string[];
}

export interface PerFilePromptContext {
  islContent: string;
  prismaSchema: string;
  framework: string;
  database: string;
  domain: DomainLike;
  previouslyGenerated: Map<string, string>;
}

export interface DomainLike {
  name?: { name?: string };
  entities?: Array<{ name: { name: string }; fields?: Array<{ name: { name: string }; type?: { name?: { name: string }; kind?: string } }> }>;
  behaviors?: Array<{
    name: { name: string };
    input?: { fields?: Array<{ name: { name: string }; optional?: boolean }> };
    errors?: Array<{ name?: { name: string }; when?: string }>;
    actors?: Array<{ must?: string }>;
  }>;
  apis?: Array<{
    basePath?: { value?: string };
    endpoints?: Array<{ method: string; path: { value: string }; behavior?: { name: string } }>;
  }>;
}

const NO_STUB_INSTRUCTION = `
CRITICAL: Do NOT use comment stubs. Write complete implementation code. Every function must have a real body.
No "// TODO: implement", no "throw new Error('Not implemented')", no placeholder comments.
`;

/**
 * Get the ordered list of backend files to generate.
 * Framework-aware: Next.js uses app/api/route.ts; Express uses src/routes/, src/controllers/, src/services/, src/validators/.
 */
export function getBackendFilesToGenerate(
  domain: DomainLike,
  framework: string,
  database: string,
): FileToGenerate[] {
  const files: FileToGenerate[] = [];

  if (database !== 'none') {
    files.push({
      path: framework === 'express' ? 'src/lib/db.ts' : 'src/lib/db.ts',
      purpose: 'Prisma client singleton',
      dependencies: [],
    });
  }

  const hasAuth = domain.behaviors?.some(
    (b) => b.actors?.some((a) => a.must === 'authenticated'),
  );

  if (framework === 'express') {
    return getExpressFilesToGenerate(domain, database, hasAuth, files);
  }

  if (framework === 'fastify') {
    return getFastifyFilesToGenerate(domain, database, hasAuth, files);
  }

  return getNextJSFilesToGenerate(domain, database, hasAuth, files);
}

function getExpressFilesToGenerate(
  domain: DomainLike,
  database: string,
  hasAuth: boolean,
  files: FileToGenerate[],
): FileToGenerate[] {
  const baseDeps = database !== 'none' ? ['src/lib/db.ts'] : [];

  files.push({
    path: 'src/lib/errors.ts',
    purpose: 'AppError base class and behavior-specific error classes',
    dependencies: [],
  });

  files.push({
    path: 'src/middleware/error-handler.ts',
    purpose: 'Global Express error handler middleware',
    dependencies: ['src/lib/errors.ts'],
  });

  files.push({
    path: 'src/middleware/request-logger.ts',
    purpose: 'Request logging middleware',
    dependencies: [],
  });

  files.push({
    path: 'src/middleware/cors.ts',
    purpose: 'CORS middleware',
    dependencies: [],
  });

  if (hasAuth) {
    files.push({
      path: 'src/middleware/auth.ts',
      purpose: 'JWT verification middleware',
      dependencies: ['src/lib/errors.ts'],
    });
  }

  const domainName = (domain.name?.name ?? 'app').toLowerCase();
  const behaviors = domain.behaviors ?? [];
  const entities = domain.entities ?? [];

  for (const b of behaviors) {
    const name = b.name?.name ?? 'unknown';
    const kebab = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    files.push({
      path: `src/validators/${kebab}.ts`,
      purpose: `Zod schemas for ${name} input`,
      dependencies: [],
    });
    files.push({
      path: `src/services/${kebab}.ts`,
      purpose: `Business logic for ${name} (Prisma)`,
      dependencies: [...baseDeps, `src/validators/${kebab}.ts`],
    });
    files.push({
      path: `src/controllers/${kebab}.ts`,
      purpose: `Request handler for ${name}`,
      dependencies: [`src/services/${kebab}.ts`, `src/validators/${kebab}.ts`],
    });
    files.push({
      path: `src/routes/${kebab}.ts`,
      purpose: `Express Router for ${name}`,
      dependencies: [`src/controllers/${kebab}.ts`],
    });
  }

  if (behaviors.length === 0 && entities.length > 0) {
    for (const entity of entities) {
      const name = entity.name.name;
      const kebab = name.toLowerCase() + 's';
      files.push({
        path: `src/validators/${kebab}.ts`,
        purpose: `Zod schemas for ${name} CRUD`,
        dependencies: [],
      });
      files.push({
        path: `src/services/${kebab}.ts`,
        purpose: `CRUD service for ${name}`,
        dependencies: [...baseDeps, `src/validators/${kebab}.ts`],
      });
      files.push({
        path: `src/controllers/${kebab}.ts`,
        purpose: `CRUD controller for ${name}`,
        dependencies: [`src/services/${kebab}.ts`],
      });
      files.push({
        path: `src/routes/${kebab}.ts`,
        purpose: `Express Router for ${name} CRUD`,
        dependencies: [`src/controllers/${kebab}.ts`],
      });
    }
  }

  const routePaths = files.filter((f) => f.path.startsWith('src/routes/')).map((f) => f.path);
  files.push({
    path: 'src/index.ts',
    purpose: 'Express app entry point: express.json(), middleware stack, route registration, error handler',
    dependencies: ['src/middleware/error-handler.ts', 'src/middleware/request-logger.ts', 'src/middleware/cors.ts', ...routePaths],
  });

  return files;
}

function getFastifyFilesToGenerate(
  domain: DomainLike,
  database: string,
  hasAuth: boolean,
  files: FileToGenerate[],
): FileToGenerate[] {
  const baseDeps = database !== 'none' ? ['src/lib/db.ts'] : [];

  files.push({
    path: 'src/fastify.config.ts',
    purpose: 'Fastify config: pino logger, trust proxy, body limit, connection timeout',
    dependencies: [],
  });

  files.push({
    path: 'src/lib/errors.ts',
    purpose: 'AppError base class and behavior-specific error classes',
    dependencies: [],
  });

  files.push({
    path: 'src/plugins/error-handler.ts',
    purpose: 'Global Fastify error handler',
    dependencies: ['src/lib/errors.ts'],
  });

  files.push({
    path: 'src/plugins/cors.ts',
    purpose: 'CORS plugin (@fastify/cors)',
    dependencies: [],
  });

  files.push({
    path: 'src/plugins/auth.ts',
    purpose: 'JWT auth plugin (@fastify/jwt)',
    dependencies: ['src/lib/errors.ts'],
  });

  if (hasAuth) {
    files.push({
      path: 'src/hooks/auth.ts',
      purpose: 'onRequest auth hook',
      dependencies: ['src/plugins/auth.ts'],
    });
  }

  const domainName = (domain.name?.name ?? 'app').toLowerCase();
  const behaviors = domain.behaviors ?? [];
  const entities = domain.entities ?? [];

  for (const b of behaviors) {
    const name = b.name?.name ?? 'unknown';
    const kebab = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    files.push({
      path: `src/schemas/${kebab}.ts`,
      purpose: `JSON Schema for ${name} (from ISL constraints)`,
      dependencies: [],
    });
    files.push({
      path: `src/services/${kebab}.ts`,
      purpose: `Business logic for ${name} (Prisma)`,
      dependencies: [...baseDeps, `src/schemas/${kebab}.ts`],
    });
    files.push({
      path: `src/routes/${kebab}.ts`,
      purpose: `Fastify route for ${name} with schema validation`,
      dependencies: [`src/services/${kebab}.ts`, `src/schemas/${kebab}.ts`],
    });
  }

  if (behaviors.length === 0 && entities.length > 0) {
    for (const entity of entities) {
      const name = entity.name.name;
      const kebab = name.toLowerCase() + 's';
      files.push({
        path: `src/schemas/${kebab}.ts`,
        purpose: `JSON Schema for ${name} CRUD`,
        dependencies: [],
      });
      files.push({
        path: `src/services/${kebab}.ts`,
        purpose: `CRUD service for ${name}`,
        dependencies: [...baseDeps, `src/schemas/${kebab}.ts`],
      });
      files.push({
        path: `src/routes/${kebab}.ts`,
        purpose: `Fastify route for ${name} CRUD`,
        dependencies: [`src/services/${kebab}.ts`],
      });
    }
  }

  const routePaths = files.filter((f) => f.path.startsWith('src/routes/')).map((f) => f.path);
  files.push({
    path: 'src/app.ts',
    purpose: 'Fastify app: plugins (cors, auth, rate-limit), route autoloading, error handler',
    dependencies: ['src/fastify.config.ts', 'src/plugins/cors.ts', 'src/plugins/auth.ts', ...routePaths],
  });

  return files;
}

function getNextJSFilesToGenerate(
  domain: DomainLike,
  database: string,
  hasAuth: boolean,
  files: FileToGenerate[],
): FileToGenerate[] {
  files.push({
    path: 'src/lib/validators.ts',
    purpose: 'Zod schemas for all behavior inputs',
    dependencies: database !== 'none' ? ['src/lib/db.ts'] : [],
  });

  files.push({
    path: 'src/lib/errors.ts',
    purpose: 'AppError base class and behavior-specific error classes',
    dependencies: [],
  });

  if (hasAuth) {
    files.push({
      path: 'src/middleware/auth.ts',
      purpose: 'JWT verification and verifyAuth function',
      dependencies: ['src/lib/errors.ts'],
    });
  }

  const domainName = (domain.name?.name ?? 'app').toLowerCase();
  const basePath = domain.apis?.[0]?.basePath?.value ?? '/api/v1';
  const routeDeps = ['src/lib/validators.ts', 'src/lib/errors.ts']
    .concat(database !== 'none' ? ['src/lib/db.ts'] : [])
    .concat(hasAuth ? ['src/middleware/auth.ts'] : []);

  if (domain.apis?.length && domain.apis[0]?.endpoints?.length) {
    const seenPaths = new Set<string>();
    for (const ep of domain.apis[0].endpoints) {
      const pathVal = (ep as { path?: { value?: string } }).path?.value ?? `/${domainName}s`;
      const routeSegment = pathVal.replace(/^\//, '').replace(/:(\w+)/g, '[$1]');
      const filePath = `src/app${basePath}/${routeSegment}/route.ts`;
      if (seenPaths.has(filePath)) continue;
      seenPaths.add(filePath);
      const behaviorName = (ep as { behavior?: { name?: string } }).behavior?.name;
      files.push({
        path: filePath,
        purpose: `Route handler for ${pathVal} (${ep.method}${behaviorName ? `, behavior: ${behaviorName}` : ''})`,
        dependencies: routeDeps,
      });
    }
  } else {
    const entities = domain.entities ?? [];
    for (const entity of entities) {
      const plural = entity.name.name.toLowerCase() + 's';
      files.push({
        path: `src/app${basePath}/${plural}/route.ts`,
        purpose: `CRUD route for ${entity.name.name} (GET list, POST create)`,
        dependencies: routeDeps,
      });
    }
  }

  return files;
}

/**
 * Build a prompt for generating a single backend file.
 */
export function buildPerFilePrompt(
  file: FileToGenerate,
  ctx: PerFilePromptContext,
): string {
  const { islContent, prismaSchema, framework, database, previouslyGenerated } = ctx;

  const previousExports = buildPreviousExportsSection(file.dependencies, previouslyGenerated);

  const frameworkSection = framework === 'nextjs'
    ? `## Next.js App Router
- Route handlers export: \`export async function GET(request: Request)\`, \`export async function POST(request: Request)\`
- Parse body: \`await request.json()\`
- Return: \`NextResponse.json(data, { status: code })\`
- Import: \`import { NextResponse } from 'next/server'\`
- Use \`Request\` (Web API), NOT NextRequest for verifyAuth`
    : framework === 'express'
    ? `## Express
- Structure: src/routes/, src/controllers/, src/services/, src/validators/, src/middleware/
- Routes: \`const router = Router(); router.post('/', controller); export default router;\`
- Controllers: \`(req: Request, res: Response, next: NextFunction) => { try { ... res.json(data); } catch (e) { next(e); } }\`
- Services: Business logic, call Prisma, return typed results
- Validators: Zod schemas, \`schema.safeParse(req.body)\`
- Middleware: errorHandler, requestLogger, cors, auth (JWT), rate-limit
- Entry: src/index.ts with app.use(express.json()), app.use(middleware), app.use('/api/...', router), app.use(errorHandler)`
    : `## Fastify
- Structure: src/routes/, src/plugins/, src/schemas/, src/services/, src/hooks/
- Entry: src/app.ts with Fastify instance, plugin registration, route autoloading
- Routes: fastify.post('/', { schema: { body, response } }, async (request, reply) => ...)
- Schemas: JSON Schema objects from ISL (src/schemas/*.ts)
- Plugins: auth (@fastify/jwt), cors (@fastify/cors), rate-limit (@fastify/rate-limit)
- Hooks: onRequest for auth, preHandler for validation
- Config: src/fastify.config.ts (pino logger, trust proxy, body limit)`;

  const prismaSection = database !== 'none'
    ? `## Prisma Schema (use camelCase for all field names)
\`\`\`prisma
${prismaSchema}
\`\`\``
    : '';

  return `Generate a ${framework} backend file: ${file.path}

${NO_STUB_INSTRUCTION}

## File Purpose
${file.purpose}

## ISL Specification
\`\`\`isl
${islContent}
\`\`\`

${prismaSection}

${frameworkSection}

## Previously Generated Files (import from these, match their exports)
${previousExports || '(none - this is the first file)'}

## Prisma Field Naming
- Prisma uses camelCase (assigneeId, createdAt, userId)
- ISL may use snake_case — convert to camelCase in code

## Output
Return ONLY the complete TypeScript code for this file. No markdown fences, no explanations.
Every function must have a real implementation.
`.trim();
}

function buildPreviousExportsSection(
  dependencies: string[],
  previouslyGenerated: Map<string, string>,
): string {
  const sections: string[] = [];
  for (const dep of dependencies) {
    const content = previouslyGenerated.get(dep);
    if (content) {
      const exports = extractExports(content);
      if (exports.length > 0) {
        sections.push(`### ${dep}\n\`\`\`typescript\n${exports.join('\n')}\n\`\`\``);
      } else {
        sections.push(`### ${dep}\n\`\`\`typescript\n${content.slice(0, 1500)}${content.length > 1500 ? '\n// ... (truncated)' : ''}\n\`\`\``);
      }
    }
  }
  return sections.join('\n\n');
}

function extractExports(content: string): string[] {
  const lines = content.split('\n');
  const exports: string[] = [];
  let inBlock = false;
  let block: string[] = [];

  for (const line of lines) {
    if (line.match(/^export (const|function|class|async function|type|interface)/)) {
      if (block.length) {
        exports.push(block.join('\n'));
        block = [];
      }
      block.push(line);
      inBlock = true;
    } else if (inBlock) {
      if (line.trim() === '' || line.startsWith(' ') || line.startsWith('\t')) {
        block.push(line);
      } else {
        inBlock = false;
        if (block.length) {
          exports.push(block.join('\n'));
          block = [];
        }
      }
    }
  }
  if (block.length) exports.push(block.join('\n'));
  return exports;
}
