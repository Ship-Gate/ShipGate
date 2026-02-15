/**
 * Golden Auth Template (Fastify) — Entry point
 * Production-quality auth with Prisma, JWT (@fastify/jwt), bcrypt, JSON Schema
 */

import Fastify from 'fastify';
import { loadConfig } from './fastify.config.js';
import authPlugin from './plugins/auth.js';
import corsPlugin from './plugins/cors.js';
import authRoutes from './routes/auth.js';

async function buildApp() {
  const config = loadConfig();
  const app = Fastify({ logger: config.logger });

  await app.register(corsPlugin);
  await app.register(authPlugin);

  await app.register(authRoutes, { prefix: '/api/auth' });

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    reply.status(err.statusCode ?? 500).send({
      error: err.message ?? 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });

  return app;
}

export async function start() {
  const app = await buildApp();
  const config = loadConfig();
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Auth API running on http://${config.host}:${config.port}`);
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
