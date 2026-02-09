/**
 * Sample Fastify App with Verification Adapter
 * 
 * Demonstrates one-line adapter wiring for verification.
 * Run with: pnpm tsx examples/fastify-sample/server.ts
 * Verify with: shipgate verify --spec examples/fastify-sample/auth.isl --impl examples/fastify-sample/server.ts
 */

import Fastify from 'fastify';
import { fastifyVerificationAdapter, getCollector } from '../../src/index.js';

const fastify = Fastify({ logger: true });

// One line of adapter wiring
await fastify.register(fastifyVerificationAdapter, {
  domain: 'Auth',
  behaviorExtractor: (req) => {
    // Map routes to behaviors
    if (req.url.startsWith('/api/login')) return 'Login';
    if (req.url.startsWith('/api/users')) return 'GetUser';
    return `${req.method} ${req.url}`;
  },
});

// Sample routes
fastify.post('/api/login', async (request, reply) => {
  const { email, password } = request.body as { email: string; password: string };

  // Simulate login logic
  if (email === 'test@example.com' && password === 'password123') {
    return { success: true, token: 'mock-token-123' };
  }

  reply.code(401);
  return { success: false, error: 'Invalid credentials' };
});

fastify.get('/api/users/:id', async (request, reply) => {
  const { id } = request.params as { id: string };

  // Simulate user lookup
  return {
    id,
    email: 'user@example.com',
    name: 'Test User',
  };
});

// Health check (will be ignored by adapter)
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Export traces endpoint (for verification)
fastify.get('/api/traces', async () => {
  const collector = getCollector();
  return collector.export();
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log('Server listening on http://localhost:3000');
    console.log('Traces available at http://localhost:3000/api/traces');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
