// ============================================================================
// OpenAPIGenerator Class
// Converts ISL spec → OpenAPI 3.1 JSON with full feature support
// ============================================================================

import * as YAML from 'yaml';
// Domain from parser - compatible with @isl-lang/parser parse() result
type Domain = Parameters<typeof normalizeDomain>[0];
import { normalizeDomain } from './adapter.js';
import { generate as generateSpec } from './generator.js';
import type { GenerateOptions, GeneratedFile, OpenAPISpec } from './types.js';

export interface OpenAPIGeneratorOptions extends GenerateOptions {
  /** Add default servers (localhost, production placeholder) */
  defaultServers?: boolean;
  /** Add Bearer JWT security when actors require auth */
  addBearerAuth?: boolean;
  /** Add pagination params (page, limit, sort, order) on list endpoints */
  addPaginationParams?: boolean;
}

const DEFAULT_SERVERS = [
  { url: 'http://localhost:3000', description: 'Development server' },
  { url: 'https://api.example.com', description: 'Production server (placeholder)' },
];

const PAGINATION_PARAMS = [
  {
    name: 'page',
    in: 'query' as const,
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
    description: 'Page number (1-based)',
  },
  {
    name: 'limit',
    in: 'query' as const,
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    description: 'Items per page',
  },
  {
    name: 'sort',
    in: 'query' as const,
    required: false,
    schema: { type: 'string' },
    description: 'Sort field',
  },
  {
    name: 'order',
    in: 'query' as const,
    required: false,
    schema: { type: 'string', enum: ['asc', 'desc'] },
    description: 'Sort order',
  },
];

/**
 * OpenAPIGenerator - Converts ISL spec to OpenAPI 3.1
 *
 * Mappings:
 * - ISL entity → OpenAPI schemas (components/schemas)
 * - ISL endpoint → OpenAPI paths with method, params, body, responses
 * - ISL constraint → OpenAPI validation (minimum, maximum, pattern, format, enum)
 * - ISL actor permissions → OpenAPI security schemes
 * - ISL error types → OpenAPI error response schemas (400, 401, 403, 404, 409, 500)
 */
export class OpenAPIGenerator {
  private options: OpenAPIGeneratorOptions;

  constructor(options: OpenAPIGeneratorOptions = {}) {
    this.options = {
      version: '3.1',
      format: 'json',
      defaultServers: true,
      addBearerAuth: true,
      addPaginationParams: true,
      ...options,
    };
  }

  /**
   * Generate OpenAPI spec from ISL Domain (parser AST)
   */
  generate(domain: Domain): GeneratedFile[] {
    const normalized = normalizeDomain(domain);
    const genOptions: GenerateOptions = {
      ...this.options,
      version: this.options.version ?? '3.1',
      format: this.options.format ?? 'json',
    };

    // Add default servers if not provided
    if (this.options.defaultServers && (!genOptions.servers || genOptions.servers.length === 0)) {
      genOptions.servers = DEFAULT_SERVERS;
    }

    // Add Bearer JWT when actors require auth
    if (this.options.addBearerAuth && (!genOptions.auth || genOptions.auth.length === 0)) {
      const hasAuthActors = normalized.behaviors.some(
        (b) => b.actors?.some((a) => a.constraints?.length)
      );
      if (hasAuthActors) {
        genOptions.auth = [
          {
            type: 'http',
            name: 'bearerAuth',
            scheme: 'bearer',
          },
        ];
      }
    }

    let files = generateSpec(normalized as Parameters<typeof generateSpec>[0], genOptions);

    // Post-process: add pagination params to list endpoints
    if (this.options.addPaginationParams && files.length > 0) {
      const spec = this.parseSpec(files[0]);
      if (spec) {
        this.addPaginationToListEndpoints(spec, normalized);
        files = [
          {
            ...files[0],
            content:
              this.options.format === 'json'
                ? JSON.stringify(spec, null, 2)
                : YAML.stringify(spec, { lineWidth: 0 }),
          },
        ];
      }
    }

    return files;
  }

  /**
   * Generate and return the raw OpenAPI spec object
   */
  generateSpec(domain: Domain): OpenAPISpec {
    const files = this.generate(domain);
    const content = files[0]?.content || '{}';
    return this.options.format === 'json' ? JSON.parse(content) : YAML.parse(content);
  }

  private parseSpec(file: GeneratedFile): OpenAPISpec | null {
    try {
      return file.format === 'json' ? JSON.parse(file.content) : YAML.parse(file.content);
    } catch {
      return null;
    }
  }

  private addPaginationToListEndpoints(
    spec: OpenAPISpec,
    normalized: ReturnType<typeof normalizeDomain>
  ): void {
    const listBehaviors = normalized.behaviors.filter(
      (b) =>
        b.name.toLowerCase().startsWith('list') ||
        b.name.toLowerCase().startsWith('search') ||
        b.name.toLowerCase().startsWith('find')
    );

    for (const pathKey of Object.keys(spec.paths || {})) {
      const pathItem = spec.paths![pathKey] as Record<string, { parameters?: unknown[] }>;
      for (const method of ['get', 'post']) {
        const op = pathItem[method];
        if (!op) continue;

        const opId = (op as { operationId?: string }).operationId ?? '';
        const isListOp =
          listBehaviors.some((b) => opId.toLowerCase() === b.name.toLowerCase()) ||
          opId.toLowerCase().startsWith('list') ||
          opId.toLowerCase().startsWith('search');

        if (isListOp && op.parameters) {
          const hasPagination = op.parameters.some(
            (p: unknown) => (p as { name?: string })?.name === 'page' || (p as { name?: string })?.name === 'limit'
          );
          if (!hasPagination) {
            op.parameters = [...(op.parameters || []), ...PAGINATION_PARAMS];
          }
        }
      }
    }
  }
}

/**
 * Convenience function: generate OpenAPI from parser Domain
 */
export function generateFromDomain(
  domain: Domain,
  options: OpenAPIGeneratorOptions = {}
): GeneratedFile[] {
  return new OpenAPIGenerator(options).generate(domain);
}
