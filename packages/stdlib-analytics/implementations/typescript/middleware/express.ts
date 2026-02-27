/**
 * Express Analytics Middleware
 * 
 * Automatically tracks page views and enriches context.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Analytics } from '../index';
import type { Context, PageContext, DeviceContext, CampaignContext } from '../types';

export interface ExpressAnalyticsOptions {
  /** Analytics client instance */
  analytics: Analytics;
  
  /** Extract user ID from request */
  getUserId?: (req: Request) => string | undefined;
  
  /** Extract anonymous ID from request */
  getAnonymousId?: (req: Request) => string | undefined;
  
  /** Auto-track page views */
  trackPageViews?: boolean;
  
  /** Paths to exclude from tracking */
  excludePaths?: string[];
  
  /** Custom context enrichment */
  enrichContext?: (req: Request) => Partial<Context>;
}

/**
 * Create Express analytics middleware
 */
export function createExpressMiddleware(
  options: ExpressAnalyticsOptions
): RequestHandler {
  const {
    analytics,
    getUserId = defaultGetUserId,
    getAnonymousId = defaultGetAnonymousId,
    trackPageViews = true,
    excludePaths = ['/health', '/ready', '/metrics', '/favicon.ico'],
    enrichContext,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip excluded paths
    if (excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Build context
    const context = buildContext(req, enrichContext);

    // Attach analytics to request
    (req as AnalyticsRequest).analytics = {
      track: (event: string, properties?: Record<string, unknown>) => {
        return analytics.track({
          event,
          userId: getUserId(req),
          anonymousId: getAnonymousId(req),
          properties,
          context,
        });
      },
      identify: (userId: string, traits?: Record<string, unknown>) => {
        return analytics.identify({
          userId,
          anonymousId: getAnonymousId(req),
          traits,
          context,
        });
      },
      page: (name?: string, properties?: Record<string, unknown>) => {
        return analytics.page({
          userId: getUserId(req),
          anonymousId: getAnonymousId(req),
          name,
          properties,
          context,
        });
      },
      group: (groupId: string, traits?: Record<string, unknown>) => {
        const userId = getUserId(req);
        if (!userId) {
          return Promise.resolve({ ok: false, error: { code: 'INVALID_USER_ID', message: 'User ID required' } } as any);
        }
        return analytics.group({
          userId,
          groupId,
          traits,
          context,
        });
      },
    };

    // Auto-track page view for GET requests
    if (trackPageViews && req.method === 'GET' && !isApiRequest(req)) {
      // Track after response is sent
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          analytics.page({
            userId: getUserId(req),
            anonymousId: getAnonymousId(req),
            name: req.path,
            context,
          });
        }
      });
    }

    next();
  };
}

/**
 * Build context from Express request
 */
function buildContext(
  req: Request,
  enrichContext?: (req: Request) => Partial<Context>
): Context {
  const baseContext: Context = {
    ip: getClientIP(req),
    userAgent: req.headers['user-agent'],
    locale: parseAcceptLanguage(req.headers['accept-language']),
    page: buildPageContext(req),
    device: buildDeviceContext(req),
    campaign: buildCampaignContext(req),
    referrer: buildReferrerContext(req),
  };

  if (enrichContext) {
    return { ...baseContext, ...enrichContext(req) };
  }

  return baseContext;
}

function buildPageContext(req: Request): PageContext {
  const protocol = req.protocol || 'https';
  const host = req.get('host') || '';
  const url = `${protocol}://${host}${req.originalUrl}`;
  const referrer = req.headers['referer'] || req.headers['referrer'];

  return {
    path: req.path,
    url,
    search: req.url.includes('?') ? req.url.split('?')[1] : undefined,
    referrer: Array.isArray(referrer) ? referrer[0] : referrer,
  };
}

function buildDeviceContext(req: Request): DeviceContext {
  const ua = req.headers['user-agent'] || '';
  
  return {
    type: detectDeviceType(ua),
    browser: detectBrowser(ua),
    osName: detectOS(ua),
  };
}

function buildCampaignContext(req: Request): CampaignContext | undefined {
  const query = req.query;
  
  if (!query.utm_source && !query.utm_campaign) {
    return undefined;
  }

  return {
    source: query.utm_source as string,
    medium: query.utm_medium as string,
    name: query.utm_campaign as string,
    term: query.utm_term as string,
    content: query.utm_content as string,
  };
}

function buildReferrerContext(req: Request): { url?: string } | undefined {
  const referrer = req.headers['referer'] || req.headers['referrer'];
  
  if (!referrer) {
    return undefined;
  }

  return { url: Array.isArray(referrer) ? referrer[0] : referrer };
}

// Helper functions

function defaultGetUserId(req: Request): string | undefined {
  // Try common patterns
  return (req as any).user?.id || 
         (req as any).session?.userId ||
         undefined;
}

function defaultGetAnonymousId(req: Request): string | undefined {
  // Try cookies or generate
  return req.cookies?.anonymousId ||
         req.headers['x-anonymous-id'] as string ||
         undefined;
}

function getClientIP(req: Request): string | undefined {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] as string ||
         req.socket?.remoteAddress;
}

function parseAcceptLanguage(header?: string): string | undefined {
  if (!header) return undefined;
  const match = header.match(/^([a-zA-Z]{2}(-[a-zA-Z]{2})?)/);
  return match ? match[1] : undefined;
}

function detectDeviceType(ua: string): string {
  if (/mobile/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

function detectBrowser(ua: string): string | undefined {
  if (/chrome/i.test(ua)) return 'Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  if (/edge/i.test(ua)) return 'Edge';
  if (/msie|trident/i.test(ua)) return 'Internet Explorer';
  return undefined;
}

function detectOS(ua: string): string | undefined {
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  return undefined;
}

function isApiRequest(req: Request): boolean {
  const contentType = req.headers['accept'] || '';
  return req.path.startsWith('/api') ||
         contentType.includes('application/json') ||
         req.xhr;
}

// Type extension for Express Request
export interface AnalyticsRequest extends Request {
  analytics: {
    track: (event: string, properties?: Record<string, unknown>) => Promise<any>;
    identify: (userId: string, traits?: Record<string, unknown>) => Promise<any>;
    page: (name?: string, properties?: Record<string, unknown>) => Promise<any>;
    group: (groupId: string, traits?: Record<string, unknown>) => Promise<any>;
  };
}
