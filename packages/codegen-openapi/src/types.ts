// ============================================================================
// OpenAPI Generator Types
// ============================================================================

export interface GenerateOptions {
  /** OpenAPI version (3.0 or 3.1) */
  version?: '3.0' | '3.1';
  /** Output format */
  format?: 'json' | 'yaml';
  /** Base path for all endpoints */
  basePath?: string;
  /** Include server URLs */
  servers?: ServerConfig[];
  /** Include authentication schemes */
  auth?: AuthConfig[];
  /** Include examples from ISL scenarios */
  includeExamples?: boolean;
  /** Include deprecation info */
  includeDeprecated?: boolean;
  /** Custom tags for operations */
  customTags?: Record<string, string[]>;
}

export interface ServerConfig {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariable>;
}

export interface ServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

export interface AuthConfig {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  name: string;
  scheme?: 'basic' | 'bearer';
  in?: 'header' | 'query' | 'cookie';
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  authorizationCode?: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes: Record<string, string>;
  };
  clientCredentials?: {
    tokenUrl: string;
    scopes: Record<string, string>;
  };
}

export interface GeneratedFile {
  path: string;
  content: string;
  format: 'json' | 'yaml';
}

// OpenAPI Schema Types
export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
  components?: OpenAPIComponents;
  security?: OpenAPISecurityRequirement[];
  tags?: OpenAPITag[];
}

export interface OpenAPIInfo {
  title: string;
  description?: string;
  version: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<string, OpenAPIServerVariable>;
}

export interface OpenAPIServerVariable {
  default: string;
  enum?: string[];
  description?: string;
}

export interface OpenAPIPathItem {
  summary?: string;
  description?: string;
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  parameters?: OpenAPIParameter[];
}

export interface OpenAPIOperation {
  operationId: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  security?: OpenAPISecurityRequirement[];
  deprecated?: boolean;
}

export interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema: OpenAPISchema;
  example?: unknown;
}

export interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIResponse {
  $ref?: string;
  description?: string;
  content?: Record<string, OpenAPIMediaType>;
  headers?: Record<string, OpenAPIHeader>;
}

export interface OpenAPIMediaType {
  schema: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, OpenAPIExample>;
}

export interface OpenAPIHeader {
  description?: string;
  required?: boolean;
  schema: OpenAPISchema;
}

export interface OpenAPIExample {
  summary?: string;
  description?: string;
  value: unknown;
}

export interface OpenAPISchema {
  type?: string | string[];
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  additionalProperties?: boolean | OpenAPISchema;
  items?: OpenAPISchema;
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  not?: OpenAPISchema;
  $ref?: string;
  example?: unknown;
}

export interface OpenAPIComponents {
  schemas?: Record<string, OpenAPISchema>;
  responses?: Record<string, OpenAPIResponse>;
  parameters?: Record<string, OpenAPIParameter>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  headers?: Record<string, OpenAPIHeader>;
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
}

export interface OpenAPISecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'header' | 'query' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OpenAPIOAuthFlows;
  openIdConnectUrl?: string;
}

export interface OpenAPIOAuthFlows {
  implicit?: OpenAPIOAuthFlow;
  password?: OpenAPIOAuthFlow;
  clientCredentials?: OpenAPIOAuthFlow;
  authorizationCode?: OpenAPIOAuthFlow;
}

export interface OpenAPIOAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface OpenAPISecurityRequirement {
  [name: string]: string[];
}

export interface OpenAPITag {
  name: string;
  description?: string;
  externalDocs?: {
    url: string;
    description?: string;
  };
}
