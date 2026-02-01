/**
 * Shared Types for API Generation
 */

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'schema' | 'types' | 'routes' | 'handlers' | 'middleware' | 'config';
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiEndpoint {
  path: string;
  method: ApiMethod;
  behavior: string;
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  requestBody?: RequestBody;
  responses: ApiResponse[];
  parameters: ApiParameter[];
  security: SecurityRequirement[];
}

export interface RequestBody {
  required: boolean;
  contentType: string;
  schema: SchemaRef;
}

export interface ApiResponse {
  statusCode: number;
  description: string;
  schema?: SchemaRef;
}

export interface ApiParameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  type: string;
  description?: string;
}

export interface SecurityRequirement {
  type: 'bearer' | 'apiKey' | 'oauth2' | 'basic';
  scopes?: string[];
}

export interface SchemaRef {
  $ref?: string;
  type?: string;
  properties?: Record<string, SchemaRef>;
  items?: SchemaRef;
  required?: string[];
}

export interface DomainSpec {
  name: string;
  version: string;
  entities: EntitySpec[];
  behaviors: BehaviorSpec[];
  types: TypeSpec[];
}

export interface EntitySpec {
  name: string;
  fields: FieldSpec[];
}

export interface BehaviorSpec {
  name: string;
  description?: string;
  input?: { fields: FieldSpec[] };
  output?: { success: string; errors: ErrorSpec[] };
  security?: SecuritySpec[];
}

export interface FieldSpec {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

export interface ErrorSpec {
  name: string;
  when?: string;
  retriable: boolean;
}

export interface SecuritySpec {
  type: string;
  details: unknown;
}

export interface TypeSpec {
  name: string;
  baseType: string;
  constraints: { name: string; value: unknown }[];
}
