/**
 * Intent Marketplace Express App
 * 
 * REST API for publishing, discovering, and managing verified intent packages.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { intentsRouter } from './routes/intents.js';
import { searchRouter } from './routes/search.js';
import { trustRouter } from './routes/trust.js';

export interface AppConfig {
  corsOrigins?: string | string[];
  trustProxy?: boolean;
}

export function createApp(config: AppConfig = {}): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.corsOrigins ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Trust proxy for production behind reverse proxy
  if (config.trustProxy) {
    app.set('trust proxy', 1);
  }

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'marketplace-api',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  app.use('/api/intents', intentsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/trending', searchRouter);
  
  // Trust routes mounted under intents
  app.use('/api/intents', trustRouter);

  // API info
  app.get('/api', (_req, res) => {
    res.json({
      name: 'Intent Marketplace API',
      version: '0.1.0',
      endpoints: {
        intents: {
          list: 'GET /api/intents',
          create: 'POST /api/intents',
          get: 'GET /api/intents/:name',
          versions: 'GET /api/intents/:name/versions',
          trust: 'GET /api/intents/:name/trust',
        },
        search: {
          query: 'GET /api/search?q=...',
          trending: 'GET /api/trending',
        },
      },
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const isDev = process.env.NODE_ENV !== 'production';
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: isDev ? err.message : 'An unexpected error occurred',
      ...(isDev && { stack: err.stack }),
    });
  });

  return app;
}
