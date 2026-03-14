/**
 * Template Routes
 *
 * GET  /api/v1/templates         — list all primitive templates
 * GET  /api/v1/templates/:id     — get a specific template's ISL
 */

import { Hono } from 'hono';
import { listTemplates, getTemplateSpec } from '@isl-lang/app-primitives';
import type { AppTemplate } from '@isl-lang/app-primitives';

const templateRoutes = new Hono();

templateRoutes.get('/api/v1/templates', (c) => {
  return c.json({ success: true, templates: listTemplates() });
});

templateRoutes.get('/api/v1/templates/:id', (c) => {
  const id = c.req.param('id') as AppTemplate;
  const spec = getTemplateSpec(id);
  if (!spec) {
    return c.json({ error: `Template "${id}" not found or not yet implemented` }, 404);
  }
  return c.json({ success: true, spec });
});

export default templateRoutes;
