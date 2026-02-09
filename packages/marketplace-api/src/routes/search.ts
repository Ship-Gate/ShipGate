/**
 * Search Routes (Fastify)
 *
 * GET /api/search?q=... – full-text search across packs.
 */

import type { FastifyInstance } from 'fastify';
import type { MarketplaceStore } from '../db/store.js';
import type { PackCategory } from '../types.js';

export function registerSearchRoutes(app: FastifyInstance, store: MarketplaceStore): void {
  app.get('/api/search', async (request, reply) => {
    const qs = request.query as Record<string, string | undefined>;
    const q = qs.q?.trim();

    if (!q) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Query parameter "q" is required',
      });
    }

    const limit = Math.min(parseInt(qs.limit ?? '20', 10) || 20, 100);
    const offset = parseInt(qs.offset ?? '0', 10) || 0;

    const { results, total, query } = store.searchPacks(q, {
      category: qs.category as PackCategory | undefined,
      limit,
      offset,
    });

    return {
      query,
      total,
      results: results.map(r => ({
        name: r.name,
        displayName: r.displayName,
        description: r.description,
        author: r.authorUsername ?? r.authorId,
        category: r.category,
        version: r.latestVersion?.version ?? '0.0.0',
        downloads: r.downloads,
        stars: r.stars,
        isVerified: r.isVerified,
      })),
    };
  });
}
