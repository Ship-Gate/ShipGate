import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { domainsRouter } from './routes/domains';
import { verificationsRouter } from './routes/verifications';
import { analyticsRouter } from './routes/analytics';
import { requestLogger, errorLogger, logger } from './middleware/logging';
import { authenticate, optionalAuth } from './middleware/auth';

export function createApp() {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Health check (no auth required)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
    });
  });

  // API routes
  const apiRouter = express.Router();

  // Apply authentication based on environment
  if (process.env.NODE_ENV === 'production') {
    apiRouter.use(authenticate);
  } else {
    apiRouter.use(optionalAuth);
  }

  // Mount route handlers
  apiRouter.use('/domains', domainsRouter);
  apiRouter.use('/verifications', verificationsRouter);
  apiRouter.use('/analytics', analyticsRouter);

  app.use('/api', apiRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found',
    });
  });

  // Error logging
  app.use(errorLogger);

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { 
      message: err.message, 
      stack: err.stack 
    });

    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

    res.status(500).json({
      error: 'Internal Server Error',
      message,
    });
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
