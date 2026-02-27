// ============================================================================
// ISL Standard Library - Auth Middleware
// @isl-lang/stdlib-api
// ============================================================================

import type { Middleware } from '../types.js';

export interface AuthOptions {
  type: 'bearer' | 'basic' | 'apiKey';
  token?: string | (() => string | Promise<string>);
  username?: string;
  password?: string;
  headerName?: string;
  queryParam?: string;
}

/**
 * Authentication middleware. Injects auth headers/params into every request.
 */
export function authMiddleware(options: AuthOptions): Middleware {
  return {
    name: 'auth',
    async execute(ctx, next) {
      const req = ctx.request;
      const headers = { ...req.headers };

      switch (options.type) {
        case 'bearer': {
          const token =
            typeof options.token === 'function'
              ? await options.token()
              : options.token ?? '';
          headers['Authorization'] = `Bearer ${token}`;
          break;
        }
        case 'basic': {
          const encoded = btoa(`${options.username ?? ''}:${options.password ?? ''}`);
          headers['Authorization'] = `Basic ${encoded}`;
          break;
        }
        case 'apiKey': {
          const key =
            typeof options.token === 'function'
              ? await options.token()
              : options.token ?? '';
          if (options.queryParam) {
            const separator = req.url.includes('?') ? '&' : '?';
            ctx.request = {
              ...req,
              url: `${req.url}${separator}${encodeURIComponent(options.queryParam)}=${encodeURIComponent(key)}`,
              headers,
            };
            return next(ctx);
          }
          headers[options.headerName ?? 'X-API-Key'] = key;
          break;
        }
      }

      ctx.request = { ...req, headers };
      return next(ctx);
    },
  };
}
