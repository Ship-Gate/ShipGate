/**
 * Code Generation Routes
 *
 * POST /api/v1/generate         — ISL spec → full Next.js project files (sync, returns all files)
 * POST /api/v1/generate/stream  — ISL spec → SSE stream of generated files
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { generateCode, generateCodeStream } from '@isl-lang/codegen-fullstack';
import type { GeneratedSpec } from '@isl-lang/spec-generator';

const generateRoutes = new Hono();

generateRoutes.post('/api/v1/generate', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.spec) {
    return c.json({ error: 'spec (GeneratedSpec) is required' }, 422);
  }

  const spec = body.spec as GeneratedSpec;
  if (!spec.domainName || !Array.isArray(spec.entities) || !Array.isArray(spec.behaviors)) {
    return c.json({ error: 'spec must have domainName, entities[], and behaviors[]' }, 422);
  }

  const result = await generateCode(spec, {
    appName: body.appName,
    databaseProvider: body.databaseProvider ?? 'postgresql',
    authProvider: body.authProvider ?? 'nextauth',
  });

  return c.json({
    success: result.success,
    files: result.files,
    stats: result.stats,
    warnings: result.warnings,
    errors: result.errors,
  });
});

generateRoutes.post('/api/v1/generate/stream', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.spec) {
    return c.json({ error: 'spec (GeneratedSpec) is required' }, 422);
  }

  const spec = body.spec as GeneratedSpec;

  return streamSSE(c, async (stream) => {
    try {
      for await (const chunk of generateCodeStream(spec, {
        appName: body.appName,
        databaseProvider: body.databaseProvider ?? 'postgresql',
        authProvider: body.authProvider ?? 'nextauth',
      })) {
        await stream.writeSSE({
          data: JSON.stringify(chunk),
          event: chunk.type,
        });
      }
    } catch (err) {
      await stream.writeSSE({
        data: JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : String(err) }),
        event: 'error',
      });
    }
  });
});

export default generateRoutes;
