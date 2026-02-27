/**
 * Next.js App Router Codegen Adapter
 *
 * Generates Next.js App Router API routes from ISL specs.
 * Structure: app/api/[behavior]/route.ts
 *
 * @module @isl-lang/pipeline/adapters/nextjs-adapter
 */

import type { ISLAST, BehaviorAST, RepoContext } from '@isl-lang/translator';
import { generateNextJSRoute, generateTests } from '../code-templates.js';
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

export const NextJSAdapter: FrameworkAdapter = {
  name: 'nextjs',

  generateProjectStructure(spec: ISLSpec): FileMap {
    const map: FileMap = new Map();
    const ctx: CodegenContext = { spec, repoContext: { framework: 'nextjs', validationLib: 'zod', routingStyle: 'file-based', conventions: { apiPrefix: '/api' } } };

    for (const behavior of spec.behaviors) {
      const behaviorKebab = kebabCase(behavior.name);
      const routePath = `app/api/${behaviorKebab}/route.ts`;
      const routeFile = this.generateRouteFile(behavior, ctx);
      map.set(routePath, routeFile.content);

      const testPath = `app/api/${behaviorKebab}/route.test.ts`;
      const templateCtx = { ast: spec, behavior, repoContext: ctx.repoContext };
      map.set(testPath, generateTests(templateCtx));
    }

    const middleware = this.generateMiddleware(spec);
    for (const m of middleware) {
      map.set(m.path, m.content);
    }

    const entry = this.generateEntryPoint(spec);
    map.set(entry.path, entry.content);

    return map;
  },

  generateRouteFile(endpoint: ISLEndpoint, context: CodegenContext): GeneratedFile {
    const templateCtx = {
      ast: context.spec,
      behavior: endpoint,
      repoContext: context.repoContext,
    };
    const content = generateNextJSRoute(templateCtx);
    const path = `app/api/${kebabCase(endpoint.name)}/route.ts`;
    return { path, content };
  },

  generateMiddleware(spec: ISLSpec): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    const hasRateLimit = spec.behaviors.some((b) =>
      b.intents.some((i) => i.tag === 'rate-limit-required')
    );
    if (hasRateLimit) {
      files.push({
        path: 'lib/rate-limit.ts',
        content: `/**
 * Rate limiting for API routes
 * @intent rate-limit-required
 */
import type { NextRequest } from 'next/server';

const limit = 100;
const windowMs = 60_000;
const store = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(request: NextRequest): Promise<{ success: boolean }> {
  const key = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'anonymous';
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true };
  }

  if (now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true };
  }

  if (entry.count >= limit) {
    return { success: false };
  }

  entry.count++;
  return { success: true };
}
`,
      });
    }

    const hasNoPII = spec.behaviors.some((b) =>
      b.intents.some((i) => i.tag === 'no-pii-logging')
    );
    if (hasNoPII) {
      files.push({
        path: 'lib/logger.ts',
        content: `/**
 * Safe logger - PII-safe logging (@intent no-pii-logging)
 * Auto-redacts sensitive fields before logging
 */
const PII_FIELDS = ['email', 'password', 'token', 'secret', 'credential', 'ssn', 'phone'];

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = PII_FIELDS.some(f => k.toLowerCase().includes(f)) ? '[REDACTED]' : v;
  }
  return out;
}

export const safeLogger = {
  info: (msg: string, data?: Record<string, unknown>) => {
    const entry = { level: 'info', message: msg, timestamp: new Date().toISOString(), ...(data && { data: redactObject(data) }) };
    if (process.env['NODE_ENV'] !== 'test') process.stdout.write(JSON.stringify(entry) + '\\n');
  },
  error: (msg: string, data?: Record<string, unknown>) => {
    const entry = { level: 'error', message: msg, timestamp: new Date().toISOString(), ...(data && { data: redactObject(data) }) };
    process.stderr.write(JSON.stringify(entry) + '\\n');
  },
  warn: (msg: string, data?: Record<string, unknown>) => {
    const entry = { level: 'warn', message: msg, timestamp: new Date().toISOString(), ...(data && { data: redactObject(data) }) };
    process.stderr.write(JSON.stringify(entry) + '\\n');
  },
};

export function redactPII<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) return obj;
  return redactObject(obj as Record<string, unknown>) as T;
}
`,
      });
    }

    const hasAudit = spec.behaviors.some((b) =>
      b.intents.some((i) => i.tag === 'audit-required')
    );
    if (hasAudit) {
      files.push({
        path: 'lib/audit.ts',
        content: `/**
 * Audit logging
 * @intent audit-required
 */
export interface AuditEntry {
  action: string;
  timestamp: string;
  success: boolean;
  reason?: string;
  requestId?: string;
}

export async function audit(entry: AuditEntry): Promise<void> {
  // TODO: Send to audit backend (e.g. Datadog, Splunk)
  const line = JSON.stringify({ level: 'audit', ...entry }) + '\n';
  if (process.env['NODE_ENV'] === 'development' && typeof process?.stdout?.write === 'function') {
    process.stdout.write(line);
  }
}
`,
      });
    }

    return files;
  },

  generateEntryPoint(_spec: ISLSpec): GeneratedFile {
    return {
      path: 'app/layout.tsx',
      content: `export const metadata = {
  title: 'API',
  description: 'Generated from ISL',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
    };
  },

  getPackageDeps(): Record<string, string> {
    return {
      next: '^14.0.0',
      react: '^18.0.0',
      'react-dom': '^18.0.0',
      zod: '^3.22.0',
    };
  },

  getScripts(): Record<string, string> {
    return {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: 'next lint',
    };
  },

  getTsConfig(): object {
    return {
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
    };
  },
};
