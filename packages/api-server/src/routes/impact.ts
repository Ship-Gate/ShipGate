/**
 * Impact Analysis Routes
 *
 * POST /api/v1/impact   — given old + new ISL spec, return full change impact
 */

import { Hono } from 'hono';
import { analyzeImpact } from '@isl-lang/impact-analyzer';
import type { GeneratedSpec } from '@isl-lang/spec-generator';

const impactRoutes = new Hono();

impactRoutes.post('/api/v1/impact', async (c) => {
  const body = await c.req.json().catch(() => null);

  if (!body?.oldSpec || !body?.newSpec) {
    return c.json({ error: 'oldSpec and newSpec (GeneratedSpec) are required' }, 422);
  }

  const oldSpec = body.oldSpec as GeneratedSpec;
  const newSpec = body.newSpec as GeneratedSpec;

  if (!oldSpec.entities || !newSpec.entities) {
    return c.json({ error: 'Both specs must have entities[]' }, 422);
  }

  const impact = analyzeImpact(oldSpec, newSpec);

  return c.json({
    success: true,
    impact,
  });
});

export default impactRoutes;
