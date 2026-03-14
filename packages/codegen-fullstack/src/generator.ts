/**
 * Full-Stack Code Generator
 *
 * Orchestrates generation of a complete Next.js 14 App Router project from
 * an ISL domain spec. Produces Prisma schema, API routes, TypeScript types,
 * auth config, and package.json.
 *
 * @module @isl-lang/codegen-fullstack/generator
 */

import type { GeneratedSpec } from '@isl-lang/spec-generator';
import type { GeneratedFile, CodegenOptions, CodegenResult, StreamChunk } from './types.js';
import { generatePrismaSchema } from './prisma-generator.js';
import { generateApiRoutes } from './api-generator.js';

function toKebabCase(name: string): string {
  return name.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`).replace(/^-/, '');
}

function generateTypeFile(spec: GeneratedSpec): GeneratedFile {
  const lines = [`// Auto-generated TypeScript types from ISL spec: ${spec.domainName}\n`];

  for (const en of spec.enums ?? []) {
    lines.push(`export const ${en.name} = {`);
    for (const v of en.values) lines.push(`  ${v}: '${v}',`);
    lines.push(`} as const;\n`);
    lines.push(`export type ${en.name} = keyof typeof ${en.name};\n`);
  }

  for (const entity of spec.entities) {
    lines.push(`export interface ${entity.name} {`);
    for (const field of entity.fields) {
      const opt = field.optional || field.modifiers?.includes('optional') ? '?' : '';
      const tsType = islTypeToTs(field.type, spec);
      lines.push(`  ${field.name}${opt}: ${tsType};`);
    }
    lines.push(`}\n`);
  }

  for (const behavior of spec.behaviors) {
    lines.push(`export interface ${behavior.name}Input {`);
    for (const field of behavior.input) {
      const opt = field.optional || field.modifiers?.includes('optional') ? '?' : '';
      lines.push(`  ${field.name}${opt}: ${islTypeToTs(field.type, spec)};`);
    }
    lines.push(`}\n`);

    if (behavior.output.errors && behavior.output.errors.length > 0) {
      const codes = behavior.output.errors.map((e) => `'${e.name}'`).join(' | ');
      lines.push(`export type ${behavior.name}ErrorCode = ${codes};\n`);
    }
  }

  return {
    path: 'lib/types.ts',
    content: lines.join('\n'),
    language: 'typescript',
    description: 'Generated TypeScript types from ISL entities and behaviors',
  };
}

function islTypeToTs(type: string, spec: GeneratedSpec): string {
  const map: Record<string, string> = {
    String: 'string', Email: 'string', URL: 'string', UUID: 'string',
    Int: 'number', Decimal: 'number', Float: 'number',
    Boolean: 'boolean', DateTime: 'Date | string', JSON: 'unknown',
  };
  if (map[type]) return map[type]!;
  const enumMatch = spec.enums?.find((e) => e.name === type);
  if (enumMatch) return type;
  const entityMatch = spec.entities.find((e) => e.name === type);
  if (entityMatch) return type;
  return 'unknown';
}

function generatePrismaClient(): GeneratedFile {
  return {
    path: 'lib/prisma.ts',
    content: `import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
`,
    language: 'typescript',
    description: 'Prisma client singleton',
  };
}

function generateAuthLib(): GeneratedFile {
  return {
    path: 'lib/auth.ts',
    content: `import { NextRequest } from 'next/server';

export interface AuthSession {
  userId: string;
  email: string;
  role: string;
}

/**
 * Verify the incoming request's auth token and return a session.
 * Replace this stub with your auth provider (NextAuth, Clerk, Lucia, etc.)
 */
export async function requireAuth(request: NextRequest): Promise<AuthSession | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  // TODO: replace with real JWT/session verification
  // Example with NextAuth:
  //   const session = await getServerSession(authOptions);
  //   return session?.user ? { userId: session.user.id, email: session.user.email, role: session.user.role } : null;

  return null;
}

export function requireRole(session: AuthSession | null, role: string): boolean {
  if (!session) return false;
  return session.role === role || session.role === 'admin';
}
`,
    language: 'typescript',
    description: 'Auth helper — replace stub with real provider',
  };
}

function generatePackageJson(spec: GeneratedSpec, options: CodegenOptions): GeneratedFile {
  const appName = options.appName ?? toKebabCase(spec.domainName);
  return {
    path: 'package.json',
    content: JSON.stringify({
      name: appName,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
        typecheck: 'tsc --noEmit',
        'db:push': 'prisma db push',
        'db:generate': 'prisma generate',
        'db:studio': 'prisma studio',
      },
      dependencies: {
        next: '^14.2.0',
        react: '^18.3.0',
        'react-dom': '^18.3.0',
        '@prisma/client': '^5.0.0',
        zod: '^3.22.0',
        clsx: '^2.1.0',
        'tailwind-merge': '^2.3.0',
      },
      devDependencies: {
        prisma: '^5.0.0',
        typescript: '^5.3.0',
        '@types/node': '^20.0.0',
        '@types/react': '^18.3.0',
        '@types/react-dom': '^18.3.0',
        tailwindcss: '^3.4.0',
        autoprefixer: '^10.4.0',
        postcss: '^8.4.0',
        eslint: '^8.57.0',
        'eslint-config-next': '^14.2.0',
      },
    }, null, 2),
    language: 'json',
    description: 'package.json with Next.js 14 dependencies',
  };
}

function generateEnvFile(spec: GeneratedSpec): GeneratedFile {
  return {
    path: '.env.example',
    content: `# Database
DATABASE_URL="postgresql://user:password@localhost:5432/${toKebabCase(spec.domainName)}"

# Auth (replace with your provider)
NEXTAUTH_SECRET="replace-with-32-char-secret"
NEXTAUTH_URL="http://localhost:3000"

# Optional: Stripe
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
`,
    language: 'env',
    description: 'Environment variable template',
  };
}

function generateShipgateConfig(spec: GeneratedSpec): GeneratedFile {
  return {
    path: '.shipgate.yml',
    content: `# ShipGate verification config — auto-generated for ${spec.domainName}
version: 1

verify:
  threshold: 80
  failOn: noship

scan:
  exclude:
    - node_modules
    - .next
    - prisma/migrations

ai:
  provider: anthropic
`,
    language: 'markdown',
    description: 'ShipGate verification configuration',
  };
}

function generateNextConfig(): GeneratedFile {
  return {
    path: 'next.config.js',
    content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
};

module.exports = nextConfig;
`,
    language: 'typescript',
    description: 'Next.js configuration',
  };
}

function generateTsConfig(): GeneratedFile {
  return {
    path: 'tsconfig.json',
    content: JSON.stringify({
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./*'] },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    }, null, 2),
    language: 'json',
    description: 'TypeScript configuration',
  };
}

export async function* generateCodeStream(
  spec: GeneratedSpec,
  options: CodegenOptions = {},
): AsyncGenerator<StreamChunk> {
  const phases: Array<{ name: string; run: () => GeneratedFile[] }> = [
    {
      name: 'Prisma schema',
      run: () => [{
        path: 'prisma/schema.prisma',
        content: generatePrismaSchema(spec, options.databaseProvider ?? 'postgresql'),
        language: 'prisma',
        description: 'Prisma database schema',
      }],
    },
    {
      name: 'TypeScript types',
      run: () => [generateTypeFile(spec)],
    },
    {
      name: 'API routes',
      run: () => generateApiRoutes(spec).map((r) => ({
        path: r.path,
        content: r.content,
        language: 'typescript' as const,
        description: `${r.method} handler for ${r.behaviorName}`,
      })),
    },
    {
      name: 'Library files',
      run: () => [generatePrismaClient(), generateAuthLib()],
    },
    {
      name: 'Config files',
      run: () => [
        generatePackageJson(spec, options),
        generateEnvFile(spec),
        generateShipgateConfig(spec),
        generateNextConfig(),
        generateTsConfig(),
      ],
    },
  ];

  const total = phases.length;
  let current = 0;

  for (const phase of phases) {
    yield { type: 'progress', progress: { current, total, phase: phase.name } };
    const files = phase.run();
    for (const file of files) {
      yield { type: 'file_start', path: file.path, message: file.description };
      yield { type: 'file_content', path: file.path, content: file.content };
      yield { type: 'file_end', path: file.path };
    }
    current++;
  }

  yield { type: 'done', message: `Generated ${spec.entities.length} entities, ${spec.behaviors.length} behaviors` };
}

export async function generateCode(
  spec: GeneratedSpec,
  options: CodegenOptions = {},
): Promise<CodegenResult> {
  const files: GeneratedFile[] = [];
  const warnings: string[] = [];

  for await (const chunk of generateCodeStream(spec, options)) {
    if (chunk.type === 'file_end' && chunk.path) {
      continue;
    }
    if (chunk.type === 'file_content' && chunk.path && chunk.content) {
      const existing = files.find((f) => f.path === chunk.path);
      if (!existing) {
        files.push({
          path: chunk.path,
          content: chunk.content,
          language: 'typescript',
          description: '',
        });
      }
    }
    if (chunk.type === 'error' && chunk.message) {
      warnings.push(chunk.message);
    }
  }

  const allLines = files.reduce((sum, f) => sum + f.content.split('\n').length, 0);
  const apiRouteFiles = files.filter((f) => f.path.includes('/api/'));

  return {
    success: true,
    files,
    spec,
    warnings,
    errors: [],
    stats: {
      totalFiles: files.length,
      totalLines: allLines,
      entities: spec.entities.length,
      behaviors: spec.behaviors.length,
      apiRoutes: apiRouteFiles.length,
      components: 0,
    },
  };
}
