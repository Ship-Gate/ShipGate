/**
 * Express Middleware for API Versioning
 */

import type {
  VersioningMiddlewareConfig,
  VersionContext,
  VersionTransformer,
  TransformableRequest,
  TransformableResponse,
} from '../types.js';
import { extractVersionFromUrl, stripVersionFromUrl } from '../strategies/url.js';
import { extractVersionFromHeader } from '../strategies/header.js';
import { extractVersionFromQuery, stripVersionFromQuery } from '../strategies/query.js';

// Express-like types (to avoid requiring express as a dependency)
interface ExpressRequest {
  url: string;
  originalUrl?: string;
  path?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | undefined>;
  body?: unknown;
  params?: Record<string, string>;
  apiVersion?: VersionContext;
}

interface ExpressResponse {
  setHeader(name: string, value: string | number): void;
  json(body: unknown): void;
  send(body?: unknown): void;
  locals?: Record<string, unknown>;
}

type NextFunction = (err?: Error) => void;

export type ExpressMiddleware = (
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction
) => void;

/**
 * Create Express versioning middleware
 */
export function versioningMiddleware(config: VersioningMiddlewareConfig): ExpressMiddleware {
  const {
    strategy,
    header = 'API-Version',
    param = 'version',
    prefix = '/v',
    versions,
    default: defaultVersion,
    sunset = {},
    transformers = {},
    deprecationUrl,
  } = config;

  return (req: ExpressRequest, res: ExpressResponse, next: NextFunction): void => {
    try {
      // Extract version based on strategy
      let version = extractVersion(req, strategy, { header, param, prefix });
      
      // Use default if no version specified
      if (!version) {
        version = defaultVersion;
      }
      
      // Validate version exists
      if (!versions[version]) {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({
          error: 'Invalid API version',
          message: `Version ${version} is not supported`,
          supportedVersions: Object.keys(versions),
        }));
        return;
      }
      
      // Check if version is sunset
      const sunsetDate = sunset[version];
      const isSunset = sunsetDate ? new Date() >= sunsetDate : false;
      const isDeprecated = sunsetDate !== undefined;
      
      // Add version context to request
      const context: VersionContext = {
        version,
        domain: versions[version],
        isSunset,
        sunsetDate,
      };
      req.apiVersion = context;
      
      // Add deprecation headers if applicable
      if (isDeprecated) {
        res.setHeader('Deprecation', 'true');
        if (sunsetDate) {
          res.setHeader('Sunset', sunsetDate.toUTCString());
        }
        if (deprecationUrl) {
          res.setHeader('Link', `<${deprecationUrl}>; rel="deprecation"`);
        }
      }
      
      // Add API-Version response header
      res.setHeader('API-Version', version);
      
      // Strip version from URL for routing (if using URL strategy)
      if (strategy === 'url') {
        req.url = stripVersionFromUrl(req.url, { prefix });
        if (req.originalUrl) {
          req.originalUrl = stripVersionFromUrl(req.originalUrl, { prefix });
        }
      } else if (strategy === 'query') {
        req.url = stripVersionFromQuery(req.url, { param });
        if (req.originalUrl) {
          req.originalUrl = stripVersionFromQuery(req.originalUrl, { param });
        }
      }
      
      // Apply request transformer if needed
      const transformerKey = findTransformerKey(version, defaultVersion, transformers);
      if (transformerKey && transformers[transformerKey]?.request) {
        const transformable: TransformableRequest = {
          body: req.body as Record<string, unknown>,
          query: req.query as Record<string, unknown>,
          params: req.params,
          headers: normalizeHeaders(req.headers),
        };
        
        const transformed = transformers[transformerKey].request!(transformable);
        
        if (transformed.body) {
          req.body = transformed.body;
        }
      }
      
      // Store original json method for response transformation
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      
      // Override json to transform response
      res.json = function(body: unknown): void {
        if (transformerKey && transformers[transformerKey]?.response) {
          const transformable: TransformableResponse = {
            body: body as Record<string, unknown>,
          };
          
          const transformed = transformers[transformerKey].response!(transformable);
          originalJson(transformed.body);
        } else {
          originalJson(body);
        }
      };
      
      // Override send for JSON content
      res.send = function(body?: unknown): void {
        if (typeof body === 'object' && body !== null && transformerKey && transformers[transformerKey]?.response) {
          const transformable: TransformableResponse = {
            body: body as Record<string, unknown>,
          };
          
          const transformed = transformers[transformerKey].response!(transformable);
          originalSend(transformed.body);
        } else {
          originalSend(body);
        }
      };
      
      next();
    } catch (error) {
      next(error as Error);
    }
  };
}

/**
 * Extract version from request based on strategy
 */
function extractVersion(
  req: ExpressRequest,
  strategy: string,
  options: { header: string; param: string; prefix: string }
): string | null {
  switch (strategy) {
    case 'url':
      return extractVersionFromUrl(req.url, { prefix: options.prefix });
    case 'header':
      return extractVersionFromHeader(normalizeHeaders(req.headers), { header: options.header });
    case 'query':
      return extractVersionFromQuery(req.url, { param: options.param });
    default:
      return null;
  }
}

/**
 * Find transformer key for version transformation
 */
function findTransformerKey(
  requestVersion: string,
  defaultVersion: string,
  transformers: Record<string, VersionTransformer>
): string | null {
  // Look for direct transformation key
  const directKey = `${requestVersion}->${defaultVersion}`;
  if (transformers[directKey]) {
    return directKey;
  }
  
  // Look for reverse (for response transformation)
  const reverseKey = `${defaultVersion}->${requestVersion}`;
  if (transformers[reverseKey]) {
    return reverseKey;
  }
  
  return null;
}

/**
 * Normalize headers to string record
 */
function normalizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      normalized[key] = value;
    } else if (Array.isArray(value)) {
      normalized[key] = value[0];
    }
  }
  return normalized;
}

/**
 * Create version-specific router
 */
export function versionRouter(
  version: string,
  config: VersioningMiddlewareConfig
): ExpressMiddleware {
  return (req: ExpressRequest, res: ExpressResponse, next: NextFunction): void => {
    if (req.apiVersion?.version === version) {
      next();
    } else {
      // Skip this router
      next();
    }
  };
}

export default versioningMiddleware;
