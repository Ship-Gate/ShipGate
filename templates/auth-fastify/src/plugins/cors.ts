/**
 * Golden Auth Template (Fastify) — CORS plugin
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';

const corsPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
};

export default fp(corsPlugin, { name: 'cors-plugin' });
