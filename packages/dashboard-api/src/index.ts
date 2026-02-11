import express, { type Express } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { Database } from 'sql.js';
import { getEnvConfig } from './config/env.js';
import { getLogger } from './utils/logger.js';
import { getMetrics } from './utils/metrics.js';
import { getTelemetry } from './utils/telemetry.js';

import { openDatabase, openMemoryDatabase, saveDatabase } from './db/schema.js';
import { createQueries } from './db/queries.js';
import { reportsRouter } from './routes/reports.js';
import { proofBundlesRouter } from './routes/proof-bundles.js';
import { coverageRouter } from './routes/coverage.js';
import { trendsRouter, driftRouter } from './routes/trends.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { securityHeaders } from './middleware/security.js';
import { ensureAuditSchema } from './audit/schema.js';
import { createAuditQueries } from './audit/queries.js';
import { createAuditService } from './audit/service.js';
import { auditRouter } from './audit/routes.js';
import { createBackboneQueries } from './backbone/queries.js';
import { backboneRouter } from './backbone/routes.js';

// Re-export types for consumers
export type {
  VerificationReport,
  CreateReportInput,
  FileResult,
  Coverage,
  TrendPoint,
  DriftAlert,
  CoverageSummary,
  ApiResponse,
  PaginatedResponse,
  ApiError,
} from './types.js';

export { openDatabase, openMemoryDatabase, saveDatabase } from './db/schema.js';
export type { Database } from './db/schema.js';
export { createQueries, type Queries } from './db/queries.js';

// Audit module exports
export {
  ensureAuditSchema,
  createAuditQueries,
  createAuditService,
  auditRouter,
  auditRecordsToCsv,
  type AuditQueries,
  type AuditService,
  type AuditEvent,
  type AuditActor,
  type AuditRecord,
} from './audit/index.js';

// Backbone module (orgs / projects / runs / artifacts / verdicts)
export {
  BACKBONE_SCHEMA_SQL,
  BACKBONE_SCHEMA_VERSION,
  createBackboneQueries,
  backboneRouter,
  type BackboneQueries,
  type Org,
  type Project,
  type Run,
  type Artifact,
  type Verdict,
  type RunWithDetails,
  type CreateOrgInput,
  type CreateProjectInput,
  type SubmitRunInput,
} from './backbone/index.js';

// Auth module
export {
  // Types
  type Role,
  type User,
  type Permission,
  type ApiKeyInfo,
  ROLES,
  PERMISSIONS,
  // Schema
  AUTH_SCHEMA_SQL,
  // Passwords
  hashPassword,
  verifyPassword,
  // JWT
  createToken,
  verifyToken,
  type JwtPayload,
  // Repository
  createAuthRepository,
  type AuthRepository,
  type CreateUserInput,
  // Middleware
  createAuthMiddleware,
  authorize,
  requirePermission,
  scopeQuery,
} from './auth/index.js';

// ── App factory ────────────────────────────────────────────────────────

export interface CreateAppOptions {
  /** SQLite database instance (already initialised). */
  db: Database;
  /** Disable rate limiting (useful for tests). */
  disableRateLimit?: boolean;
  /** Disable audit logging (not recommended for production). */
  disableAudit?: boolean;
}

/**
 * Creates and configures the Express application.
 * The database must be opened beforehand (async) and passed in.
 */
export function createApp(options: CreateAppOptions): Express {
  // ── Environment validation ───────────────────────────────────────────
  const config = getEnvConfig();
  const logger = getLogger(config.LOG_LEVEL);
  const metrics = getMetrics();
  const telemetry = getTelemetry(config.ENABLE_TRACING);

  logger.info('Initializing dashboard API', { nodeEnv: config.NODE_ENV });

  const queries = createQueries(options.db);

  // ── Audit subsystem ──────────────────────────────────────────────────
  ensureAuditSchema(options.db);
  const auditQueries = createAuditQueries(options.db);
  const _auditService = createAuditService(auditQueries);

  const app = express();

  // ── Global middleware ────────────────────────────────────────────────
  app.use(express.json({ limit: '2mb' }));
  
  // Security headers (must be before other middleware)
  app.use(securityHeaders);
  
  // CORS configuration
  const corsOrigin = process.env['DASHBOARD_CORS_ORIGIN'];
  app.use(
    cors({
      origin: corsOrigin ? corsOrigin.split(',') : process.env['NODE_ENV'] === 'production' ? false : '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      credentials: true,
      maxAge: 86400, // 24 hours
    }),
  );

  if (!options.disableRateLimit) {
    const limiter = rateLimit({
      windowMs: 60_000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: { ok: false, error: 'Rate limit exceeded' },
    });
    // express-rate-limit v7 ships Express 5 types; cast through unknown
    // to bridge the express-serve-static-core v4/v5 type gap.
    app.use(limiter as unknown as express.RequestHandler);
  }

  // ── Metrics endpoint ──────────────────────────────────────────────────
  if (config.ENABLE_METRICS) {
    app.get('/api/v1/metrics', (_req, res) => {
      metrics.increment('metrics.endpoint.requests');
      res.json({ ok: true, data: metrics.getMetrics() });
    });
  }

  // ── Health check ─────────────────────────────────────────────────────
  app.get('/api/v1/health', (_req, res) => {
    metrics.increment('health.checks');
    res.json({ ok: true, data: { status: 'healthy', uptime: process.uptime() } });
  });

  // ── Backbone subsystem (orgs / projects / runs / artifacts / verdicts)
  const bbQueries = createBackboneQueries(options.db);

  // ── Route mounts ─────────────────────────────────────────────────────
  app.use('/api/v1/reports', reportsRouter(queries));
  app.use('/api/v1/proof-bundles', proofBundlesRouter(queries));
  app.use('/api/v1/coverage', coverageRouter(queries));
  app.use('/api/v1/trends', trendsRouter(queries));
  app.use('/api/v1/drift', driftRouter(queries));
  app.use('/api/v1/audit', auditRouter(auditQueries));
  app.use('/api/v1/backbone', backboneRouter(bbQueries));

  // ── Error handling ───────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// ── Standalone server ──────────────────────────────────────────────────

const isDirectRun =
  process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('index.ts');

if (isDirectRun) {
  (async () => {
    const config = getEnvConfig();
    const logger = getLogger(config.LOG_LEVEL);
    const port = config.DASHBOARD_PORT;
    
    const db = await openDatabase();
    const app = createApp({ db });

    const server = app.listen(port, () => {
      logger.info(`Dashboard API listening on http://localhost:${port}`, { port });
    });

    // Graceful shutdown handler
    let shutdownInProgress = false;
    
    async function gracefulShutdown(signal: string): Promise<void> {
      if (shutdownInProgress) {
        return;
      }
      shutdownInProgress = true;
      
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      // Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed');
      });
      
      // Give existing connections time to finish (30 seconds max)
      const shutdownTimeout = setTimeout(() => {
        logger.warn('Shutdown timeout exceeded, forcing exit');
        process.exit(1);
      }, 30000);
      
      try {
        // Persist database
        saveDatabase(db);
        db.close();
        logger.info('Database saved and closed');
        
        clearTimeout(shutdownTimeout);
        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        clearTimeout(shutdownTimeout);
        process.exit(1);
      }
    }

    // Handle shutdown signals
    process.on('SIGINT', () => {
      void gracefulShutdown('SIGINT');
    });

    process.on('SIGTERM', () => {
      void gracefulShutdown('SIGTERM');
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      void gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      void gracefulShutdown('unhandledRejection');
    });
  })();
}
