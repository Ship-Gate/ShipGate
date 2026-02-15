/**
 * Golden Auth Template (Fastify) — Auth routes
 * Schema-based validation from JSON Schema
 */

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import * as authService from '../services/auth.js';
import {
  registerBodySchema,
  loginBodySchema,
  refreshBodySchema,
  logoutBodySchema,
} from '../schemas/auth.js';

const authResponseSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string' },
      },
    },
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    accessTokenExpiresAt: { type: 'string' },
    refreshTokenExpiresAt: { type: 'string' },
  },
};

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' },
  },
};

export default async function authRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  fastify.post<{ Body: authService.RegisterInput }>(
    '/register',
    {
      schema: {
        body: registerBodySchema,
        response: {
          200: authResponseSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await authService.register(request.body);
        return reply.send(result);
      } catch (err) {
        if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
          return reply.status(409).send({ error: 'Email already taken', code: 'EMAIL_TAKEN' });
        }
        throw err;
      }
    }
  );

  fastify.post<{ Body: authService.LoginInput }>(
    '/login',
    {
      schema: {
        body: loginBodySchema,
        response: {
          200: authResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await authService.login(request.body);
        return reply.send(result);
      } catch (err) {
        if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
          return reply.status(401).send({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
        }
        throw err;
      }
    }
  );

  fastify.post<{ Body: { refreshToken: string } }>(
    '/logout',
    {
      schema: {
        body: logoutBodySchema,
        response: {
          200: { type: 'object', properties: { success: { type: 'boolean' } } },
        },
      },
    },
    async (request, reply) => {
      await authService.logout(request.body.refreshToken);
      return reply.send({ success: true });
    }
  );

  fastify.post<{ Body: authService.RefreshInput }>(
    '/refresh',
    {
      schema: {
        body: refreshBodySchema,
        response: {
          200: authResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await authService.refresh(request.body);
        return reply.send(result);
      } catch (err) {
        if (err instanceof Error && err.message === 'INVALID_REFRESH_TOKEN') {
          return reply.status(401).send({ error: 'Invalid or expired refresh token', code: 'INVALID_REFRESH_TOKEN' });
        }
        throw err;
      }
    }
  );
}
