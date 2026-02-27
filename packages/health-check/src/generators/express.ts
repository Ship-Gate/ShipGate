/**
 * Express Middleware Generator
 * 
 * Generates Express middleware for health check endpoints.
 */

import type { Request, Response, NextFunction, Router } from 'express';
import type {
  HealthCheckConfig,
  CheckResult,
  HealthCheckResponse,
  ExpressMiddlewareConfig,
  HealthStatus,
} from '../types.js';
import { HealthAggregator } from '../aggregator.js';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type HealthMiddleware = (req: Request, res: Response, next: NextFunction) => void;
export type HealthRouterFactory = () => Router;

// ═══════════════════════════════════════════════════════════════════════════
// Express Health Middleware Generator
// ═══════════════════════════════════════════════════════════════════════════

export class ExpressHealthGenerator {
  private aggregator: HealthAggregator;
  private config: Required<ExpressMiddlewareConfig>;
  private startTime: number;
  private requestCounts: Map<string, number[]> = new Map();

  constructor(
    checks: HealthCheckConfig[],
    config: ExpressMiddlewareConfig
  ) {
    this.aggregator = new HealthAggregator(checks, {
      cacheResults: true,
      cacheTtl: 1000, // Cache for 1 second
    });
    this.config = {
      version: config.version,
      serviceName: config.serviceName,
      includeDetails: config.includeDetails ?? true,
      customHeaders: config.customHeaders ?? {},
      basePath: config.basePath ?? '/health',
      enableCors: config.enableCors ?? true,
      rateLimitWindow: config.rateLimitWindow ?? 60000,
      rateLimitMax: config.rateLimitMax ?? 100,
    };
    this.startTime = Date.now();
  }

  /**
   * Create the main health check middleware
   */
  createMiddleware(): HealthMiddleware {
    return async (req: Request, res: Response) => {
      // Rate limiting
      if (this.isRateLimited(req)) {
        res.status(429).json({
          status: 'error',
          message: 'Too many requests',
        });
        return;
      }

      // CORS headers
      if (this.config.enableCors) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      }

      // Custom headers
      for (const [key, value] of Object.entries(this.config.customHeaders)) {
        res.setHeader(key, value);
      }

      // Cache control
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      // Handle OPTIONS request
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }

      try {
        const result = await this.aggregator.checkAll();
        const response = this.buildResponse(result);

        const statusCode = this.getStatusCode(response.status);
        res.status(statusCode).json(response);
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          version: this.config.version,
          uptime: this.getUptime(),
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Health check failed',
        });
      }
    };
  }

  /**
   * Create liveness probe middleware
   */
  createLivenessMiddleware(): HealthMiddleware {
    return (_req: Request, res: Response) => {
      if (this.config.enableCors) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Cache-Control', 'no-cache');

      res.status(200).json({
        status: 'ok',
        uptime: this.getUptime(),
      });
    };
  }

  /**
   * Create readiness probe middleware
   */
  createReadinessMiddleware(): HealthMiddleware {
    return async (_req: Request, res: Response) => {
      if (this.config.enableCors) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Cache-Control', 'no-cache');

      try {
        const result = await this.aggregator.checkAll();
        const isReady = result.criticalFailures.length === 0;

        res.status(isReady ? 200 : 503).json({
          status: isReady ? 'ok' : 'fail',
          checks: this.config.includeDetails
            ? Object.fromEntries(result.checks)
            : undefined,
        });
      } catch (error) {
        res.status(503).json({
          status: 'fail',
          error: error instanceof Error ? error.message : 'Readiness check failed',
        });
      }
    };
  }

  /**
   * Create an Express router with all health endpoints
   */
  createRouter(): HealthRouterFactory {
    return () => {
      // Dynamic import to avoid hard dependency on express
      const express = require('express');
      const router = express.Router();

      router.get('/', this.createMiddleware());
      router.get('/live', this.createLivenessMiddleware());
      router.get('/ready', this.createReadinessMiddleware());

      // Individual check endpoints
      for (const check of this.aggregator.getChecks()) {
        router.get(`/check/${check.name}`, this.createSingleCheckMiddleware(check));
      }

      return router;
    };
  }

  /**
   * Create middleware for a single health check
   */
  private createSingleCheckMiddleware(check: HealthCheckConfig): HealthMiddleware {
    return async (_req: Request, res: Response) => {
      if (this.config.enableCors) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Cache-Control', 'no-cache');

      try {
        const result = await check.check();
        const statusCode = this.getStatusCode(result.status);

        res.status(statusCode).json({
          name: check.name,
          critical: check.critical,
          ...result,
        });
      } catch (error) {
        res.status(500).json({
          name: check.name,
          critical: check.critical,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Check failed',
          timestamp: Date.now(),
        });
      }
    };
  }

  /**
   * Build health check response
   */
  private buildResponse(result: { 
    status: HealthStatus; 
    checks: Map<string, CheckResult>;
    duration: number;
  }): HealthCheckResponse {
    return {
      status: result.status,
      version: this.config.version,
      uptime: this.getUptime(),
      timestamp: new Date().toISOString(),
      checks: this.config.includeDetails
        ? Object.fromEntries(result.checks)
        : {},
    };
  }

  /**
   * Get HTTP status code from health status
   */
  private getStatusCode(status: HealthStatus): number {
    switch (status) {
      case 'healthy':
        return 200;
      case 'degraded':
        return 200; // Still serving, just degraded
      case 'unhealthy':
        return 503;
      default:
        return 500;
    }
  }

  /**
   * Get uptime in seconds
   */
  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Check if request is rate limited
   */
  private isRateLimited(req: Request): boolean {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const windowStart = now - this.config.rateLimitWindow;

    // Get or create request timestamps for this IP
    let timestamps = this.requestCounts.get(ip) ?? [];
    
    // Filter out old timestamps
    timestamps = timestamps.filter(t => t > windowStart);
    
    // Add current timestamp
    timestamps.push(now);
    this.requestCounts.set(ip, timestamps);

    // Check if over limit
    return timestamps.length > this.config.rateLimitMax;
  }

  /**
   * Get base path for health endpoints
   */
  getBasePath(): string {
    return this.config.basePath;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create Express health middleware
 */
export function healthMiddleware(
  checks: HealthCheckConfig[] | Record<string, HealthCheckConfig>,
  config?: Partial<ExpressMiddlewareConfig>
): HealthMiddleware {
  const checkArray = Array.isArray(checks) 
    ? checks 
    : Object.values(checks);

  const generator = new ExpressHealthGenerator(checkArray, {
    version: config?.version ?? '1.0.0',
    serviceName: config?.serviceName ?? 'unknown',
    ...config,
  });

  return generator.createMiddleware();
}

/**
 * Create Express health router
 */
export function healthRouter(
  checks: HealthCheckConfig[] | Record<string, HealthCheckConfig>,
  config?: Partial<ExpressMiddlewareConfig>
): HealthRouterFactory {
  const checkArray = Array.isArray(checks) 
    ? checks 
    : Object.values(checks);

  const generator = new ExpressHealthGenerator(checkArray, {
    version: config?.version ?? '1.0.0',
    serviceName: config?.serviceName ?? 'unknown',
    ...config,
  });

  return generator.createRouter();
}

/**
 * Create a simple health check handler
 */
export function createHealthHandler(
  checks: Record<string, HealthCheckConfig>,
  options: {
    version?: string;
    includeDetails?: boolean;
  } = {}
): (req: Request, res: Response) => Promise<void> {
  const aggregator = new HealthAggregator(Object.values(checks));
  const startTime = Date.now();

  return async (_req: Request, res: Response) => {
    const result = await aggregator.checkAll();
    
    const response: HealthCheckResponse = {
      status: result.status,
      version: options.version ?? '1.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks: options.includeDetails !== false
        ? Object.fromEntries(result.checks)
        : {},
    };

    const statusCode = result.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(response);
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Middleware
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create middleware that adds health check to app state
 */
export function attachHealthChecks(
  checks: HealthCheckConfig[]
): (req: Request, res: Response, next: NextFunction) => void {
  const aggregator = new HealthAggregator(checks);

  return (req: Request, _res: Response, next: NextFunction) => {
    // Attach health check functions to request for use in routes
    (req as Request & { healthChecks: HealthAggregator }).healthChecks = aggregator;
    next();
  };
}

/**
 * Create a simple ping endpoint
 */
export function pingMiddleware(): HealthMiddleware {
  return (_req: Request, res: Response) => {
    res.status(200).send('pong');
  };
}

/**
 * Create a version endpoint
 */
export function versionMiddleware(version: string): HealthMiddleware {
  return (_req: Request, res: Response) => {
    res.status(200).json({
      version,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    });
  };
}
