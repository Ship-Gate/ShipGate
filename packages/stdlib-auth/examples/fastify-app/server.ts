// ============================================================================
// Sample Fastify App using stdlib-auth
// Demonstrates authentication with JWT middleware
// ============================================================================

import Fastify from 'fastify';
import { 
  AuthService,
  createInMemoryAuthService,
  InMemoryUserRepository,
  InMemorySessionRepository
} from '@isl-lang/stdlib-auth';
import { 
  registerAuthPlugin,
  authenticate,
  requireRole
} from '../../adapters/fastify/index.js';

// ============================================================================
// Setup
// ============================================================================

const fastify = Fastify({ logger: true });

// Create auth service with in-memory repositories
const authService = createInMemoryAuthService({
  sessionDuration: 24 * 60 * 60 * 1000, // 24 hours
  extendedSessionDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
});

// ============================================================================
// Register Auth Plugin
// ============================================================================

await fastify.register(registerAuthPlugin, {
  authService,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: '24h',
  cookieName: 'auth_token',
  cookieSecure: false, // Set to true in production with HTTPS
  cookieHttpOnly: true,
  cookieSameSite: 'strict'
});

// ============================================================================
// Protected Routes
// ============================================================================

// Example protected route
fastify.get('/api/protected', {
  preHandler: async (request, reply) => {
    return authenticate(request, reply, {
      authService,
      jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    });
  }
}, async (request, reply) => {
  const authReq = request as any;
  return {
    message: 'This is a protected route',
    user: authReq.user,
    session: authReq.session
  };
});

// Admin-only route
fastify.get('/api/admin', {
  preHandler: [
    async (request, reply) => {
      return authenticate(request, reply, {
        authService,
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production'
      });
    },
    async (request, reply) => {
      return requireRole('admin')(request, reply, {
        authService,
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production'
      });
    }
  ]
}, async (request, reply) => {
  return {
    message: 'This is an admin-only route',
    user: (request as any).user
  };
});

// ============================================================================
// Health Check
// ============================================================================

fastify.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

// ============================================================================
// Start Server
// ============================================================================

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);
    console.log('Auth endpoints:');
    console.log('  POST /auth/login');
    console.log('  POST /auth/logout');
    console.log('  POST /auth/refresh');
    console.log('  GET  /auth/me');
    console.log('Protected endpoints:');
    console.log('  GET  /api/protected');
    console.log('  GET  /api/admin');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
