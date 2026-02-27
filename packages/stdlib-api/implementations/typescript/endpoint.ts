// ============================================================================
// ISL Standard Library - Endpoint & Resource Types
// @isl-lang/stdlib-api
// ============================================================================

import type {
  HttpMethod,
  HttpStatus,
  ApiVersion,
  RequestHeader,
  QueryParam,
  PathParam,
  RequestBody,
  ResponseBody,
  AuthRequirement,
  RateLimit,
  CachePolicy,
  CorsPolicy,
  SecurityScheme,
  Server,
} from './http.js';

/**
 * Route pattern (e.g., "/users/:id/posts")
 */
export type RoutePattern = string;

/**
 * Endpoint identifier
 */
export type EndpointId = string;

/**
 * API Endpoint definition
 */
export interface Endpoint {
  id: EndpointId;
  name: string;
  description?: string;

  // Routing
  method: HttpMethod;
  path: RoutePattern;

  // Parameters
  pathParams?: PathParam[];
  queryParams?: QueryParam[];
  headers?: RequestHeader[];
  body?: RequestBody;

  // Responses
  responses: ResponseBody[];

  // Metadata
  tags?: string[];
  deprecated?: boolean;
  version?: ApiVersion;

  // Security
  authentication?: AuthRequirement;
  rateLimit?: RateLimit;

  // Caching
  cache?: CachePolicy;
}

/**
 * Validate an endpoint definition
 */
export function validateEndpoint(endpoint: Endpoint): string[] {
  const errors: string[] = [];

  // GET and DELETE should not have body
  if (
    (endpoint.method === 'GET' || endpoint.method === 'DELETE') &&
    endpoint.body
  ) {
    errors.push(`${endpoint.method} endpoints should not have a request body`);
  }

  // Should have at least one success response
  const hasSuccessResponse = endpoint.responses.some(
    (r) => r.status >= 200 && r.status < 300
  );
  if (!hasSuccessResponse) {
    errors.push('Endpoint should have at least one success response (2xx)');
  }

  // Path params should be in the path
  if (endpoint.pathParams) {
    for (const param of endpoint.pathParams) {
      if (!endpoint.path.includes(`:${param.name}`)) {
        errors.push(
          `Path parameter "${param.name}" not found in path "${endpoint.path}"`
        );
      }
    }
  }

  return errors;
}

/**
 * Extract path parameters from a route pattern
 */
export function extractPathParams(path: RoutePattern): string[] {
  const matches = path.match(/:([^/]+)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

/**
 * Build a URL from a route pattern and parameters
 */
export function buildUrl(
  path: RoutePattern,
  params: Record<string, string | number>
): string {
  let result = path;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, String(value));
  }
  return result;
}

/**
 * Relation types for resources
 */
export const RelationType = {
  HAS_ONE: 'HAS_ONE',
  HAS_MANY: 'HAS_MANY',
  BELONGS_TO: 'BELONGS_TO',
  MANY_TO_MANY: 'MANY_TO_MANY',
} as const;

export type RelationType = (typeof RelationType)[keyof typeof RelationType];

/**
 * Resource relation definition
 */
export interface ResourceRelation {
  name: string;
  target: string;
  type: RelationType;
  eager?: boolean;
}

/**
 * Resource operation configuration
 */
export interface ResourceOperation {
  enabled?: boolean;
  authentication?: AuthRequirement;
  rateLimit?: RateLimit;
  customHandler?: string;
  hooks?: {
    before?: string[];
    after?: string[];
  };
}

/**
 * RESTful Resource definition
 */
export interface Resource {
  name: string;
  path: RoutePattern;
  entity: string;

  // Standard CRUD operations
  operations?: {
    list?: ResourceOperation;
    get?: ResourceOperation;
    create?: ResourceOperation;
    update?: ResourceOperation;
    patch?: ResourceOperation;
    delete?: ResourceOperation;
  };

  // Nested resources
  children?: Resource[];

  // Relationships
  relations?: ResourceRelation[];
}

/**
 * Generate CRUD endpoints for a resource
 */
export function generateCrudEndpoints(resource: Resource): Endpoint[] {
  const endpoints: Endpoint[] = [];
  const basePath = resource.path;
  const itemPath = `${basePath}/:id`;

  if (resource.operations?.list?.enabled !== false) {
    endpoints.push({
      id: `${resource.name}_list`,
      name: `List ${resource.name}`,
      method: 'GET',
      path: basePath,
      responses: [{ status: 200 as HttpStatus }],
      authentication: resource.operations?.list?.authentication,
      rateLimit: resource.operations?.list?.rateLimit,
    });
  }

  if (resource.operations?.get?.enabled !== false) {
    endpoints.push({
      id: `${resource.name}_get`,
      name: `Get ${resource.name}`,
      method: 'GET',
      path: itemPath,
      pathParams: [{ name: 'id', type: 'string' }],
      responses: [
        { status: 200 as HttpStatus },
        { status: 404 as HttpStatus },
      ],
      authentication: resource.operations?.get?.authentication,
      rateLimit: resource.operations?.get?.rateLimit,
    });
  }

  if (resource.operations?.create?.enabled !== false) {
    endpoints.push({
      id: `${resource.name}_create`,
      name: `Create ${resource.name}`,
      method: 'POST',
      path: basePath,
      body: { schema: resource.entity },
      responses: [
        { status: 201 as HttpStatus },
        { status: 422 as HttpStatus },
      ],
      authentication: resource.operations?.create?.authentication,
      rateLimit: resource.operations?.create?.rateLimit,
    });
  }

  if (resource.operations?.update?.enabled !== false) {
    endpoints.push({
      id: `${resource.name}_update`,
      name: `Update ${resource.name}`,
      method: 'PUT',
      path: itemPath,
      pathParams: [{ name: 'id', type: 'string' }],
      body: { schema: resource.entity },
      responses: [
        { status: 200 as HttpStatus },
        { status: 404 as HttpStatus },
        { status: 422 as HttpStatus },
      ],
      authentication: resource.operations?.update?.authentication,
      rateLimit: resource.operations?.update?.rateLimit,
    });
  }

  if (resource.operations?.patch?.enabled !== false) {
    endpoints.push({
      id: `${resource.name}_patch`,
      name: `Patch ${resource.name}`,
      method: 'PATCH',
      path: itemPath,
      pathParams: [{ name: 'id', type: 'string' }],
      body: { schema: 'PatchOperation[]' },
      responses: [
        { status: 200 as HttpStatus },
        { status: 404 as HttpStatus },
        { status: 422 as HttpStatus },
      ],
      authentication: resource.operations?.patch?.authentication,
      rateLimit: resource.operations?.patch?.rateLimit,
    });
  }

  if (resource.operations?.delete?.enabled !== false) {
    endpoints.push({
      id: `${resource.name}_delete`,
      name: `Delete ${resource.name}`,
      method: 'DELETE',
      path: itemPath,
      pathParams: [{ name: 'id', type: 'string' }],
      responses: [
        { status: 204 as HttpStatus },
        { status: 404 as HttpStatus },
      ],
      authentication: resource.operations?.delete?.authentication,
      rateLimit: resource.operations?.delete?.rateLimit,
    });
  }

  return endpoints;
}

/**
 * API Definition
 */
export interface ApiDefinition {
  name: string;
  version: ApiVersion;
  basePath?: string;

  description?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };

  // Configuration
  versioningStrategy?: 'URL_PATH' | 'HEADER' | 'QUERY_PARAM' | 'ACCEPT';
  defaultContentType?: string;

  // Security
  securitySchemes?: SecurityScheme[];
  defaultAuth?: AuthRequirement;
  cors?: CorsPolicy;

  // Endpoints
  endpoints: Endpoint[];
  resources?: Resource[];

  // Documentation
  servers?: Server[];
  externalDocs?: {
    description?: string;
    url: string;
  };
}

/**
 * Create a new API definition with defaults
 */
export function createApiDefinition(
  config: Partial<ApiDefinition> & { name: string; endpoints: Endpoint[] }
): ApiDefinition {
  return {
    version: { major: 1, minor: 0 },
    basePath: '/',
    defaultContentType: 'application/json',
    versioningStrategy: 'URL_PATH',
    ...config,
  };
}

export default {
  RelationType,
  validateEndpoint,
  extractPathParams,
  buildUrl,
  generateCrudEndpoints,
  createApiDefinition,
};
