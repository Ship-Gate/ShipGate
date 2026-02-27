// ============================================================================
// Sample Express App using stdlib-auth
// Demonstrates authentication with JWT middleware
// ============================================================================

import express from 'express';
import cookieParser from 'cookie-parser';
import { 
  AuthService,
  createInMemoryAuthService
} from '@isl-lang/stdlib-auth';
import { 
  registerAuthRoutes,
  authenticate,
  requireRole
} from '../../adapters/express/index.js';

// ============================================================================
// Setup
// ============================================================================

const app = express();
app.use(express.json());
app.use(cookieParser());

// Create auth service with in-memory repositories
const authService = createInMemoryAuthService({
  sessionDuration: 24 * 60 * 60 * 1000, // 24 hours
  extendedSessionDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
});

// ============================================================================
// Register Auth Routes
// ============================================================================

const authOptions = {
  authService,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: '24h',
  cookieName: 'auth_token',
  cookieSecure: false, // Set to true in production with HTTPS
  cookieHttpOnly: true,
  cookieSameSite: 'strict' as const
};

registerAuthRoutes(app, authOptions);

// ============================================================================
// Protected Routes
// ============================================================================

// Example protected route
app.get('/api/protected', authenticate(authOptions), (req, res) => {
  const authReq = req as any;
  res.json({
    message: 'This is a protected route',
    user: authReq.user,
    session: authReq.session
  });
});

// Admin-only route
app.get('/api/admin', 
  authenticate(authOptions),
  requireRole('admin')(authOptions),
  (req, res) => {
    const authReq = req as any;
    res.json({
      message: 'This is an admin-only route',
      user: authReq.user
    });
  }
);

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============================================================================
// Start Server
// ============================================================================

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
  console.log('Auth endpoints:');
  console.log('  POST /auth/login');
  console.log('  POST /auth/logout');
  console.log('  POST /auth/refresh');
  console.log('  GET  /auth/me');
  console.log('Protected endpoints:');
  console.log('  GET  /api/protected');
  console.log('  GET  /api/admin');
});
