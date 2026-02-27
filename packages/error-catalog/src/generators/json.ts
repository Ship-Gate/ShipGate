/**
 * JSON catalog generator
 */

import type { ErrorCatalog } from '../catalog.js';
import type {
  ErrorDefinition,
  GeneratorOutput,
  JsonConfig,
} from '../types.js';

/**
 * JSON catalog structure
 */
interface JsonCatalog {
  $schema: string;
  version: string;
  generatedAt: string;
  stats: {
    totalErrors: number;
    byDomain: Record<string, number>;
    byHttpStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    retriableCount: number;
    deprecatedCount: number;
  };
  domains: JsonDomain[];
  errors: JsonError[];
  index: {
    byId: Record<string, number>;
    byCode: Record<string, number>;
  };
}

/**
 * JSON domain structure
 */
interface JsonDomain {
  id: string;
  name: string;
  description?: string;
  errorCount: number;
  errorIds: string[];
}

/**
 * JSON error structure
 */
interface JsonError {
  id: string;
  code: string;
  domain: string;
  httpStatus: number;
  httpStatusName: string;
  message: string;
  description: string;
  retriable: boolean;
  retryAfter?: number;
  severity: string;
  causes: string[];
  resolutions: string[];
  relatedErrors: string[];
  tags: string[];
  example?: {
    request?: {
      method: string;
      path: string;
      body?: Record<string, unknown>;
    };
    response: {
      status: number;
      body: Record<string, unknown>;
    };
  };
  deprecated?: {
    since: string;
    replacement?: string;
    message: string;
  };
  metadata: Record<string, unknown>;
  source?: {
    file: string;
    line?: number;
  };
}

/**
 * JSON generator class
 */
export class JsonGenerator {
  private config: JsonConfig;

  constructor(config: JsonConfig) {
    this.config = {
      pretty: true,
      includeSourceLocations: false,
      ...config,
    };
  }

  /**
   * Generate JSON catalog
   */
  async generate(catalog: ErrorCatalog): Promise<GeneratorOutput[]> {
    const errors = catalog.getAllErrors();
    const stats = catalog.getStats();
    const groups = catalog.getGroups();

    const jsonCatalog: JsonCatalog = {
      $schema: 'https://intentos.dev/schemas/error-catalog.json',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      stats: {
        ...stats,
        byHttpStatus: this.convertNumberKeys(stats.byHttpStatus),
      },
      domains: groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        errorCount: g.errors.length,
        errorIds: g.errors.map((e) => e.id),
      })),
      errors: errors.map((e, i) => this.convertError(e, i)),
      index: this.buildIndex(errors),
    };

    const content = this.config.pretty
      ? JSON.stringify(jsonCatalog, null, 2)
      : JSON.stringify(jsonCatalog);

    return [
      {
        path: this.config.outputFile,
        content,
        type: 'json',
      },
    ];
  }

  /**
   * Convert error to JSON format
   */
  private convertError(error: ErrorDefinition, index: number): JsonError {
    const jsonError: JsonError = {
      id: error.id,
      code: error.code,
      domain: error.domain,
      httpStatus: error.httpStatus,
      httpStatusName: this.getStatusName(error.httpStatus),
      message: error.message,
      description: error.description,
      retriable: error.retriable,
      severity: error.severity,
      causes: error.causes,
      resolutions: error.resolutions,
      relatedErrors: error.relatedErrors,
      tags: error.tags,
      metadata: error.metadata,
    };

    if (error.retryAfter) {
      jsonError.retryAfter = error.retryAfter;
    }

    if (error.example) {
      jsonError.example = error.example;
    }

    if (error.deprecated) {
      jsonError.deprecated = error.deprecated;
    }

    if (this.config.includeSourceLocations && error.sourceFile) {
      jsonError.source = {
        file: error.sourceFile,
        line: error.sourceLine,
      };
    }

    return jsonError;
  }

  /**
   * Build lookup index
   */
  private buildIndex(
    errors: ErrorDefinition[]
  ): JsonCatalog['index'] {
    const byId: Record<string, number> = {};
    const byCode: Record<string, number> = {};

    errors.forEach((error, index) => {
      byId[error.id] = index;
      byCode[error.code] = index;
    });

    return { byId, byCode };
  }

  /**
   * Convert number keys to string keys
   */
  private convertNumberKeys(
    obj: Record<number, number>
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Get HTTP status name
   */
  private getStatusName(status: number): string {
    const names: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      408: 'Request Timeout',
      409: 'Conflict',
      410: 'Gone',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      501: 'Not Implemented',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };
    return names[status] ?? 'Unknown';
  }
}

/**
 * Generate minimal error lookup JSON
 */
export function generateErrorLookup(
  catalog: ErrorCatalog
): Record<string, { code: string; message: string; httpStatus: number }> {
  const errors = catalog.getAllErrors();
  const lookup: Record<
    string,
    { code: string; message: string; httpStatus: number }
  > = {};

  for (const error of errors) {
    lookup[error.id] = {
      code: error.code,
      message: error.message,
      httpStatus: error.httpStatus,
    };
  }

  return lookup;
}

/**
 * Generate error codes enum JSON
 */
export function generateErrorCodesJson(
  catalog: ErrorCatalog
): Record<string, string> {
  const errors = catalog.getAllErrors();
  const codes: Record<string, string> = {};

  for (const error of errors) {
    codes[error.id] = error.code;
  }

  return codes;
}
