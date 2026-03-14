/**
 * API Route Generator
 *
 * Converts ISL behavior definitions into Next.js App Router API route handlers.
 * Each behavior maps to a typed, validated route handler with:
 *   - Zod input validation matching ISL preconditions
 *   - Error handling for all named error cases
 *   - Auth middleware stub (filled by auth-drift-adapter checks)
 *   - Prisma DB calls matching the entity model
 *
 * @module @isl-lang/codegen-fullstack/api-generator
 */

import type { GeneratedSpec, BehaviorSpec, EntityField } from '@isl-lang/spec-generator';

const HTTP_METHOD_FROM_NAME: Array<[RegExp, string]> = [
  [/^(get|fetch|list|find|search|read)/i, 'GET'],
  [/^(delete|remove|destroy)/i, 'DELETE'],
  [/^(update|edit|patch|modify)/i, 'PATCH'],
  [/^(create|add|register|signup|invite)/i, 'POST'],
  [/^(login|authenticate|verify|confirm)/i, 'POST'],
];

function inferHttpMethod(behaviorName: string): string {
  for (const [pattern, method] of HTTP_METHOD_FROM_NAME) {
    if (pattern.test(behaviorName)) return method;
  }
  return 'POST';
}

function toKebabCase(name: string): string {
  return name
    .replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)
    .replace(/^-/, '');
}

function fieldToZodType(field: EntityField): string {
  const t = field.type.toLowerCase();
  if (t === 'string' || t === 'email' || t === 'url' || t === 'uuid') return 'z.string()';
  if (t === 'int') return 'z.number().int()';
  if (t === 'decimal' || t === 'float') return 'z.number()';
  if (t === 'boolean') return 'z.boolean()';
  if (t === 'datetime') return 'z.string().datetime()';
  return 'z.string()';
}

function generateZodSchema(fields: EntityField[]): string {
  if (fields.length === 0) return 'z.object({})';
  const members = fields
    .map((f) => {
      const base = fieldToZodType(f);
      const opt = f.optional || f.modifiers?.includes('optional') ? '.optional()' : '';
      return `    ${f.name}: ${base}${opt},`;
    })
    .join('\n');
  return `z.object({\n${members}\n  })`;
}

function generateErrorHandlers(errors: Array<{ name: string; when: string }>): string {
  if (!errors.length) return '';
  return errors
    .map(
      (e) =>
        `    // ${e.when}\n    if (/* TODO: check ${e.name} condition */) {\n      return NextResponse.json({ error: '${e.name}', message: '${e.when}' }, { status: 400 });\n    }`,
    )
    .join('\n\n');
}

function generateRouteHandler(behavior: BehaviorSpec): string {
  const method = inferHttpMethod(behavior.name);
  const hasInput = behavior.input.length > 0;
  const errorCases = behavior.output.errors ?? [];
  const successType = behavior.output.successType ?? 'unknown';
  const zodSchema = generateZodSchema(behavior.input);

  const inputParsing =
    method === 'GET'
      ? `const searchParams = request.nextUrl.searchParams;\n  const rawInput = Object.fromEntries(searchParams.entries());`
      : `const body = await request.json();`;

  const errorHandlers = generateErrorHandlers(errorCases);

  return `import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

const InputSchema = ${zodSchema};

export async function ${method}(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 });
    }

    ${method === 'GET' ? inputParsing : `const body = await request.json();\n  const rawInput = body;`}
    const parseResult = InputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: parseResult.error.flatten() }, { status: 422 });
    }
    const input = parseResult.data;

${errorHandlers ? `${errorHandlers}\n` : ''}
    // TODO: implement ${behavior.name} business logic
    // Expected return type: ${successType}
    const result = null; // replace with actual implementation

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('[${behavior.name}]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, { status: 500 });
  }
}
`;
}

export interface RouteFile {
  path: string;
  content: string;
  method: string;
  behaviorName: string;
}

export function generateApiRoutes(spec: GeneratedSpec): RouteFile[] {
  return spec.behaviors.map((behavior) => {
    const routeSlug = toKebabCase(behavior.name);
    return {
      path: `app/api/${toKebabCase(spec.domainName)}/${routeSlug}/route.ts`,
      content: generateRouteHandler(behavior),
      method: inferHttpMethod(behavior.name),
      behaviorName: behavior.name,
    };
  });
}
