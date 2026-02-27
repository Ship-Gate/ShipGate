/**
 * Fastify server factory for the Marketplace API.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { MarketplaceStore } from './db/store.js';
import { registerPackRoutes } from './routes/packs.js';
import { registerSearchRoutes } from './routes/search.js';

export interface ServerOptions {
  store?: MarketplaceStore;
  logger?: boolean;
}

export async function buildServer(opts: ServerOptions = {}): Promise<FastifyInstance> {
  const store = opts.store ?? new MarketplaceStore();
  const app = Fastify({ logger: opts.logger ?? false });

  await app.register(cors, { origin: true });

  // Decorate with store so routes can access it
  app.decorate('store', store);

  // Health check
  app.get('/health', async () => ({
    status: 'healthy',
    service: 'marketplace-api',
    timestamp: new Date().toISOString(),
  }));

  // API info
  app.get('/api', async () => ({
    name: 'Marketplace API',
    version: '0.1.0',
    endpoints: {
      packs: {
        list: 'GET /api/packs',
        publish: 'POST /api/packs (auth required)',
        get: 'GET /api/packs/:name',
        versions: 'GET /api/packs/:name/versions',
        getVersion: 'GET /api/packs/:name/versions/:version',
      },
      search: {
        query: 'GET /api/search?q=...',
      },
    },
  }));

  // Register route modules
  registerPackRoutes(app, store);
  registerSearchRoutes(app, store);

  // 404 fallback
  app.setNotFoundHandler(async (_request, reply) => {
    return reply.status(404).send({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    });
  });

  return app;
}
