/**
 * Golden Auth Template (Fastify) — JWT plugin via @fastify/jwt
 * Use with: fastify.authenticate in preHandler
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import type { JWTPayload } from '../types/auth.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  await fastify.register(fjwt, { secret });

  fastify.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
  });
};

export default fp(authPlugin, { name: 'auth-plugin' });
