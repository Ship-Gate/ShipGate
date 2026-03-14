import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';

import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import healthRoutes from './routes/health.js';
import verifyRoutes from './routes/verify.js';
import gateRoutes from './routes/gate.js';
import scanRoutes from './routes/scan.js';
import specRoutes from './routes/spec.js';
import generateRoutes from './routes/generate.js';
import impactRoutes from './routes/impact.js';
import projectRoutes from './routes/projects.js';
import templateRoutes from './routes/templates.js';
import shipAuditRoutes from './routes/ship-audit.js';
import openapiRoutes from './openapi.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());
app.use('*', rateLimitMiddleware);
app.use('*', authMiddleware);

app.route('/', healthRoutes);
app.route('/', verifyRoutes);
app.route('/', gateRoutes);
app.route('/', scanRoutes);
app.route('/', specRoutes);
app.route('/', generateRoutes);
app.route('/', impactRoutes);
app.route('/', projectRoutes);
app.route('/', templateRoutes);
app.route('/', shipAuditRoutes);
app.route('/', openapiRoutes);

app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

app.onError((err, c) => {
  console.error('[api-server] Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

const port = Number(process.env['PORT'] ?? 4000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[shipgate-api] Server running on http://localhost:${info.port}`);
  console.log(`[shipgate-api] OpenAPI spec: http://localhost:${info.port}/api/v1/openapi.json`);
  console.log(`[shipgate-api] Health check: http://localhost:${info.port}/api/v1/health`);
});

export { app };
export default app;
