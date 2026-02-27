
import { FastifyInstance } from 'fastify';

export function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/login', async (request, reply) => {
    // Login handler
    return { success: true };
  });

  app.post('/api/register', async (request, reply) => {
    // Register handler
    return { success: true };
  });
}
