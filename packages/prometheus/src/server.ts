// ============================================================================
// Metrics HTTP Server - Serve /metrics endpoint
// ============================================================================

import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { Registry } from 'prom-client';

/**
 * Server options
 */
export interface ServerOptions {
  /** Port to listen on */
  port: number;
  
  /** Path for metrics endpoint */
  path: string;
  
  /** Optional host to bind to */
  host?: string;
}

/**
 * HTTP server for Prometheus metrics
 */
export class MetricsServer {
  private registry: Registry;
  private options: ServerOptions;
  private server: Server | null = null;

  constructor(registry: Registry, options: ServerOptions) {
    this.registry = registry;
    this.options = options;
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer(async (req, res) => {
        await this.handleRequest(req, res);
      });

      this.server.on('error', reject);

      this.server.listen(this.options.port, this.options.host, () => {
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
      return;
    }

    // Ready check endpoint
    if (url.pathname === '/ready' || url.pathname === '/readyz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
      return;
    }

    // Metrics endpoint
    if (url.pathname === this.options.path) {
      try {
        const metrics = await this.registry.metrics();
        res.writeHead(200, { 'Content-Type': this.registry.contentType });
        res.end(metrics);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error collecting metrics: ${error}`);
      }
      return;
    }

    // 404 for other paths
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  /**
   * Get server address
   */
  getAddress(): { port: number; host: string } | null {
    if (!this.server) return null;
    
    const addr = this.server.address();
    if (!addr || typeof addr === 'string') return null;
    
    return {
      port: addr.port,
      host: addr.address,
    };
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }
}

/**
 * Create a standalone metrics server
 */
export function createMetricsServer(
  registry: Registry,
  options: Partial<ServerOptions> = {}
): MetricsServer {
  return new MetricsServer(registry, {
    port: options.port ?? 9090,
    path: options.path ?? '/metrics',
    host: options.host,
  });
}

/**
 * Express/Connect middleware for metrics
 */
export function metricsMiddleware(registry: Registry, path: string = '/metrics') {
  return async (
    req: { url?: string; method?: string },
    res: { writeHead: Function; end: Function; setHeader: Function },
    next: Function
  ) => {
    const url = req.url ?? '';
    
    if (url === path && req.method === 'GET') {
      try {
        const metrics = await registry.metrics();
        res.setHeader('Content-Type', registry.contentType);
        res.end(metrics);
      } catch (error) {
        res.writeHead(500);
        res.end(`Error: ${error}`);
      }
    } else {
      next();
    }
  };
}

/**
 * Koa middleware for metrics
 */
export function koaMetricsMiddleware(registry: Registry, path: string = '/metrics') {
  return async (ctx: { path: string; method: string; body: string; type: string; status: number }, next: Function) => {
    if (ctx.path === path && ctx.method === 'GET') {
      try {
        ctx.body = await registry.metrics();
        ctx.type = registry.contentType;
        ctx.status = 200;
      } catch (error) {
        ctx.status = 500;
        ctx.body = `Error: ${error}`;
      }
    } else {
      await next();
    }
  };
}

/**
 * Fastify plugin for metrics
 */
export function fastifyMetricsPlugin(registry: Registry, path: string = '/metrics') {
  return async (fastify: { get: Function }) => {
    fastify.get(path, async (_request: unknown, reply: { type: Function; send: Function }) => {
      const metrics = await registry.metrics();
      reply.type(registry.contentType).send(metrics);
    });
  };
}
