/**
 * Spec Generation Routes
 *
 * POST /api/v1/spec/generate  — natural language prompt → ISL spec
 * POST /api/v1/spec/validate  — validate an ISL string
 * POST /api/v1/spec/refine    — refine an existing ISL spec with a change request
 */

import { Hono } from 'hono';
import { generateSpec, refineSpec } from '@isl-lang/spec-generator';

const specRoutes = new Hono();

specRoutes.post('/api/v1/spec/generate', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return c.json({ error: 'prompt (string) is required' }, 422);
  }

  const result = await generateSpec(body.prompt, {
    template: body.template,
    provider: body.provider,
    model: body.model,
    apiKey: body.apiKey,
  });

  return c.json({
    success: result.success,
    spec: result.spec,
    rawISL: result.rawISL,
    errors: result.errors,
    tokensUsed: result.tokensUsed,
    model: result.model,
    durationMs: result.durationMs,
  }, result.success ? 200 : 422);
});

specRoutes.post('/api/v1/spec/validate', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.isl !== 'string') {
    return c.json({ error: 'isl (string) is required' }, 422);
  }

  const { parseGeneratedISL } = await import('@isl-lang/spec-generator');
  const parsed = parseGeneratedISL(body.isl, '', 'manual');

  return c.json({
    isValid: parsed.isValid,
    errors: parsed.validationErrors,
    spec: parsed,
  });
});

specRoutes.post('/api/v1/spec/refine', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.existingSpec !== 'string' || typeof body.changeRequest !== 'string') {
    return c.json({ error: 'existingSpec (string) and changeRequest (string) are required' }, 422);
  }

  const result = await refineSpec({
    existingSpec: body.existingSpec,
    changeRequest: body.changeRequest,
    provider: body.provider,
    model: body.model,
    apiKey: body.apiKey,
  });

  return c.json({
    success: result.success,
    updatedSpec: result.updatedSpec,
    rawISL: result.rawISL,
    changeSummary: result.changeSummary,
    errors: result.errors,
    durationMs: result.durationMs,
  }, result.success ? 200 : 422);
});

export default specRoutes;
