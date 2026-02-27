/**
 * HTTP Server
 */

import type {
  Method,
  Headers,
  QueryParams,
  StatusCode,
  ServerOptions,
  ServerRequest,
  ServerResponse,
  RequestBody,
  RouteHandler,
  Middleware,
  Route,
} from './types';

/**
 * HTTP Server
 */
export class HTTPServer {
  private routes: Route[] = [];
  private globalMiddleware: Middleware[] = [];
  private options: ServerOptions;

  constructor(options: ServerOptions) {
    this.options = {
      host: '0.0.0.0',
      bodyLimit: 1024 * 1024, // 1MB
      ...options,
    };
  }

  /**
   * Add global middleware
   */
  use(middleware: Middleware): this {
    this.globalMiddleware.push(middleware);
    return this;
  }

  /**
   * Register route
   */
  route(
    method: Method | Method[],
    path: string,
    handler: RouteHandler,
    middleware?: Middleware[]
  ): this {
    this.routes.push({
      method,
      path,
      handler,
      middleware,
    });
    return this;
  }

  /**
   * GET route
   */
  get(path: string, handler: RouteHandler, middleware?: Middleware[]): this {
    return this.route('GET', path, handler, middleware);
  }

  /**
   * POST route
   */
  post(path: string, handler: RouteHandler, middleware?: Middleware[]): this {
    return this.route('POST', path, handler, middleware);
  }

  /**
   * PUT route
   */
  put(path: string, handler: RouteHandler, middleware?: Middleware[]): this {
    return this.route('PUT', path, handler, middleware);
  }

  /**
   * PATCH route
   */
  patch(path: string, handler: RouteHandler, middleware?: Middleware[]): this {
    return this.route('PATCH', path, handler, middleware);
  }

  /**
   * DELETE route
   */
  delete(path: string, handler: RouteHandler, middleware?: Middleware[]): this {
    return this.route('DELETE', path, handler, middleware);
  }

  /**
   * Create route group with shared prefix/middleware
   */
  group(
    prefix: string,
    middleware: Middleware[],
    define: (group: RouteGroup) => void
  ): this {
    const group = new RouteGroup(prefix, middleware);
    define(group);
    
    for (const route of group.getRoutes()) {
      this.routes.push(route);
    }
    
    return this;
  }

  /**
   * Match route for request
   */
  matchRoute(method: Method, path: string): {
    route: Route;
    params: Record<string, string>;
  } | null {
    for (const route of this.routes) {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      if (!methods.includes(method)) continue;

      const params = this.matchPath(route.path, path);
      if (params !== null) {
        return { route, params };
      }
    }
    return null;
  }

  /**
   * Handle incoming request (for integration with Node.js http server)
   */
  async handleRequest(
    req: {
      method: string;
      url: string;
      headers: Record<string, string | string[] | undefined>;
      socket: { remoteAddress?: string };
    },
    rawBody: Buffer
  ): Promise<{
    status: number;
    headers: Headers;
    body: string;
  }> {
    const url = new URL(req.url || '/', `http://localhost:${this.options.port}`);
    const method = req.method as Method;
    const path = url.pathname;

    // Parse query params
    const query: QueryParams = {};
    url.searchParams.forEach((value, key) => {
      const existing = query[key];
      if (existing) {
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          query[key] = [existing, value];
        }
      } else {
        query[key] = value;
      }
    });

    // Match route
    const match = this.matchRoute(method, path);
    
    if (!match) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Not Found' }),
      };
    }

    // Build request object
    const headers: Headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers[key.toLowerCase()] = value;
      }
    }

    const request: ServerRequest = {
      method,
      path,
      url: req.url || '/',
      headers,
      query,
      params: match.params,
      body: this.createRequestBody(rawBody, headers),
      ip: req.socket.remoteAddress,
      protocol: 'http',
      context: {},
    };

    // Build response object
    let responseStatus = 200;
    const responseHeaders: Headers = {};
    let responseBody = '';

    const response: ServerResponse = {
      status(code: StatusCode) {
        responseStatus = code;
        return this;
      },
      header(name: string, value: string) {
        responseHeaders[name] = value;
        return this;
      },
      json(data: unknown) {
        responseHeaders['Content-Type'] = 'application/json';
        responseBody = JSON.stringify(data);
        return this;
      },
      text(data: string) {
        responseHeaders['Content-Type'] = 'text/plain';
        responseBody = data;
        return this;
      },
      html(data: string) {
        responseHeaders['Content-Type'] = 'text/html';
        responseBody = data;
        return this;
      },
      redirect(url: string, status = 302) {
        responseStatus = status;
        responseHeaders['Location'] = url;
        return this;
      },
      send() {
        // No-op, response is built
      },
    };

    // Execute middleware chain
    const middleware = [...this.globalMiddleware, ...(match.route.middleware || [])];
    
    try {
      await this.executeMiddleware(middleware, request, response, async () => {
        await match.route.handler(request, response);
      });
    } catch (error) {
      responseStatus = 500;
      responseHeaders['Content-Type'] = 'application/json';
      responseBody = JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      status: responseStatus,
      headers: responseHeaders,
      body: responseBody,
    };
  }

  // Private methods

  private matchPath(
    pattern: string,
    path: string
  ): Record<string, string> | null {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) {
      // Check for wildcard
      if (!pattern.includes('*')) {
        return null;
      }
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart.startsWith(':')) {
        // Parameter
        params[patternPart.slice(1)] = pathPart;
      } else if (patternPart === '*') {
        // Wildcard - match rest
        params['*'] = pathParts.slice(i).join('/');
        break;
      } else if (patternPart !== pathPart) {
        return null;
      }
    }

    return params;
  }

  private createRequestBody(buffer: Buffer, headers: Headers): RequestBody {
    const contentType = (headers['content-type'] as string) || '';

    return {
      async json<T>(): Promise<T> {
        return JSON.parse(buffer.toString());
      },
      async text(): Promise<string> {
        return buffer.toString();
      },
      async form(): Promise<Record<string, string>> {
        const params = new URLSearchParams(buffer.toString());
        const result: Record<string, string> = {};
        params.forEach((value, key) => {
          result[key] = value;
        });
        return result;
      },
      async buffer(): Promise<Buffer> {
        return buffer;
      },
    };
  }

  private async executeMiddleware(
    middleware: Middleware[],
    request: ServerRequest,
    response: ServerResponse,
    handler: () => Promise<void>
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < middleware.length) {
        const mw = middleware[index++];
        await mw(request, response, next);
      } else {
        await handler();
      }
    };

    await next();
  }
}

/**
 * Route group for organizing routes
 */
export class RouteGroup {
  private routes: Route[] = [];

  constructor(
    private prefix: string,
    private middleware: Middleware[]
  ) {}

  route(
    method: Method | Method[],
    path: string,
    handler: RouteHandler,
    middleware?: Middleware[]
  ): this {
    this.routes.push({
      method,
      path: this.prefix + path,
      handler,
      middleware: [...this.middleware, ...(middleware || [])],
    });
    return this;
  }

  get(path: string, handler: RouteHandler, middleware?: Middleware[]): this {
    return this.route('GET', path, handler, middleware);
  }

  post(path: string, handler: RouteHandler, middleware?: Middleware[]): this {
    return this.route('POST', path, handler, middleware);
  }

  put(path: string, handler: RouteHandler, middleware?: Middleware[]): this {
    return this.route('PUT', path, handler, middleware);
  }

  delete(path: string, handler: RouteHandler, middleware?: Middleware[]): this {
    return this.route('DELETE', path, handler, middleware);
  }

  getRoutes(): Route[] {
    return this.routes;
  }
}

/**
 * Create HTTP server
 */
export function createServer(options: ServerOptions): HTTPServer {
  return new HTTPServer(options);
}
