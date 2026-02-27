/**
 * Fastify Plugin for API Versioning
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

// Fastify-like types (to avoid requiring fastify as a dependency)
interface FastifyRequest {
  url: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  body?: unknown;
  params?: Record<string, unknown>;
  apiVersion?: VersionContext;
}

interface FastifyReply {
  header(name: string, value: string): FastifyReply;
  code(statusCode: number): FastifyReply;
  send(payload?: unknown): FastifyReply;
}

interface FastifyInstance {
  addHook(
    hookName: string,
    handler: (request: FastifyRequest, reply: FastifyReply, payload?: unknown) => void | Promise<unknown>
  ): void;
  decorateRequest(name: string, value: unknown): void;
}

interface FastifyPluginOptions extends VersioningMiddlewareConfig {}

export type FastifyPluginCallback = (
  instance: FastifyInstance,
  opts: FastifyPluginOptions,
  done: (err?: Error) => void
) => void;

/**
 * Fastify plugin for API versioning
 */
export const versioningPlugin: FastifyPluginCallback = (
  fastify: FastifyInstance,
  config: FastifyPluginOptions,
  done: (err?: Error) => void
): void => {
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

  // Decorate request with apiVersion property
  fastify.decorateRequest('apiVersion', null);

  // Add preHandler hook for version extraction
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Extract version based on strategy
    let version = extractVersion(request, strategy, { header, param, prefix });
    
    // Use default if no version specified
    if (!version) {
      version = defaultVersion;
    }
    
    // Validate version exists
    if (!versions[version]) {
      reply.code(400);
      reply.send({
        error: 'Invalid API version',
        message: `Version ${version} is not supported`,
        supportedVersions: Object.keys(versions),
      });
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
    request.apiVersion = context;
    
    // Add deprecation headers if applicable
    if (isDeprecated) {
      reply.header('Deprecation', 'true');
      if (sunsetDate) {
        reply.header('Sunset', sunsetDate.toUTCString());
      }
      if (deprecationUrl) {
        reply.header('Link', `<${deprecationUrl}>; rel="deprecation"`);
      }
    }
    
    // Add API-Version response header
    reply.header('API-Version', version);
    
    // Apply request transformer if needed
    const transformerKey = findTransformerKey(version, defaultVersion, transformers);
    if (transformerKey && transformers[transformerKey]?.request) {
      const transformable: TransformableRequest = {
        body: request.body as Record<string, unknown>,
        query: request.query as Record<string, unknown>,
        params: request.params as Record<string, string>,
        headers: normalizeHeaders(request.headers),
      };
      
      const transformed = transformers[transformerKey].request!(transformable);
      
      if (transformed.body) {
        request.body = transformed.body;
      }
    }
  });

  // Add preSerialization hook for response transformation
  fastify.addHook('preSerialization', async (
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown
  ): Promise<unknown> => {
    const version = request.apiVersion?.version;
    if (!version) return payload;
    
    const transformerKey = findTransformerKey(version, defaultVersion, transformers);
    if (!transformerKey || !transformers[transformerKey]?.response) {
      return payload;
    }
    
    const transformable: TransformableResponse = {
      body: payload as Record<string, unknown>,
    };
    
    const transformed = transformers[transformerKey].response!(transformable);
    return transformed.body;
  });

  done();
};

/**
 * Extract version from request based on strategy
 */
function extractVersion(
  request: FastifyRequest,
  strategy: string,
  options: { header: string; param: string; prefix: string }
): string | null {
  switch (strategy) {
    case 'url':
      return extractVersionFromUrl(request.url, { prefix: options.prefix });
    case 'header':
      return extractVersionFromHeader(normalizeHeaders(request.headers), { header: options.header });
    case 'query':
      return extractVersionFromQuery(request.url, { param: options.param });
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
  const directKey = `${requestVersion}->${defaultVersion}`;
  if (transformers[directKey]) {
    return directKey;
  }
  
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

export default versioningPlugin;
