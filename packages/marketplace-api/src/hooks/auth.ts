/**
 * Authentication hook for Fastify.
 *
 * Validates Bearer tokens against author API key hashes stored in the DB.
 * Uses SHA-256 to hash the raw token and compares against stored hashes.
 */

import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MarketplaceStore } from '../db/store.js';

/**
 * Hash a raw API key to the stored format.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Create a preHandler hook that authenticates requests via Bearer token.
 * On success the authenticated Author is attached to `request.author`.
 */
export function createAuthHook(store: MarketplaceStore) {
  return async function authHook(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header. Use: Bearer <api-key>',
      });
    }

    const rawKey = authHeader.slice(7);
    if (!rawKey) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Empty API key',
      });
    }

    const keyHash = hashApiKey(rawKey);
    const author = store.getAuthorByApiKeyHash(keyHash);

    if (!author) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
    }

    // Attach author to the request for downstream handlers
    (request as any).author = author;
  };
}
