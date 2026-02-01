/**
 * API Client - Higher-level wrapper around ISLClient for typed API calls
 */
import { ISLClient } from './ISLClient';
import type {
  Result,
  RequestOptions,
  ValidationResult,
  ISLError,
} from '../types';

export interface ApiEndpoint<TInput, TOutput, TError = ISLError> {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  validate?: (input: TInput) => ValidationResult;
  transform?: (data: unknown) => TOutput;
}

export interface ApiClientConfig {
  client: ISLClient;
  defaultOptions?: RequestOptions;
}

/**
 * Type-safe API client that wraps ISLClient with endpoint definitions
 */
export class ApiClient {
  private client: ISLClient;
  private defaultOptions: RequestOptions;

  constructor(config: ApiClientConfig) {
    this.client = config.client;
    this.defaultOptions = config.defaultOptions ?? {};
  }

  /**
   * Execute a typed API endpoint
   */
  async execute<TInput, TOutput, TError = ISLError>(
    endpoint: ApiEndpoint<TInput, TOutput, TError>,
    input?: TInput,
    options?: RequestOptions
  ): Promise<Result<TOutput, TError>> {
    // Validate input if validator is provided
    if (endpoint.validate && input !== undefined) {
      const validation = endpoint.validate(input);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            errors: validation.errors ?? [],
          } as TError,
        };
      }
    }

    // Build path with params
    const path = this.buildPath(endpoint.path, input as Record<string, unknown>);

    // Make request
    const result = await this.client.request<TInput, unknown, TError>(
      path,
      endpoint.method,
      endpoint.method !== 'GET' ? input : undefined,
      { ...this.defaultOptions, ...options }
    );

    // Transform response if transformer is provided
    if (result.success && endpoint.transform) {
      return {
        success: true,
        data: endpoint.transform(result.data),
      };
    }

    return result as Result<TOutput, TError>;
  }

  /**
   * Create a callable endpoint function
   */
  createEndpoint<TInput, TOutput, TError = ISLError>(
    endpoint: ApiEndpoint<TInput, TOutput, TError>
  ): (input?: TInput, options?: RequestOptions) => Promise<Result<TOutput, TError>> {
    return (input, options) => this.execute(endpoint, input, options);
  }

  /**
   * Batch multiple requests
   */
  async batch<T extends Record<string, Promise<Result<unknown, unknown>>>>(
    requests: T
  ): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
    const entries = Object.entries(requests);
    const results = await Promise.all(entries.map(([_, promise]) => promise));
    
    return Object.fromEntries(
      entries.map(([key], index) => [key, results[index]])
    ) as { [K in keyof T]: Awaited<T[K]> };
  }

  /**
   * Build path with URL parameters
   */
  private buildPath(template: string, params?: Record<string, unknown>): string {
    if (!params) return template;

    let path = template;
    const queryParams: Record<string, string> = {};

    for (const [key, value] of Object.entries(params)) {
      const placeholder = `:${key}`;
      if (path.includes(placeholder)) {
        path = path.replace(placeholder, encodeURIComponent(String(value)));
      } else if (value !== undefined && value !== null) {
        queryParams[key] = String(value);
      }
    }

    const queryString = new URLSearchParams(queryParams).toString();
    return queryString ? `${path}?${queryString}` : path;
  }

  /**
   * Get underlying ISL client
   */
  getClient(): ISLClient {
    return this.client;
  }
}

/**
 * Create typed API endpoints from ISL schemas
 */
export function createApi<TEndpoints extends Record<string, ApiEndpoint<unknown, unknown, unknown>>>(
  client: ISLClient,
  endpoints: TEndpoints
): {
  [K in keyof TEndpoints]: TEndpoints[K] extends ApiEndpoint<infer TIn, infer TOut, infer TErr>
    ? (input?: TIn, options?: RequestOptions) => Promise<Result<TOut, TErr>>
    : never;
} {
  const apiClient = new ApiClient({ client });
  
  return Object.fromEntries(
    Object.entries(endpoints).map(([key, endpoint]) => [
      key,
      apiClient.createEndpoint(endpoint as ApiEndpoint<unknown, unknown, unknown>),
    ])
  ) as {
    [K in keyof TEndpoints]: TEndpoints[K] extends ApiEndpoint<infer TIn, infer TOut, infer TErr>
      ? (input?: TIn, options?: RequestOptions) => Promise<Result<TOut, TErr>>
      : never;
  };
}

/**
 * Helper to create REST endpoints
 */
export const endpoints = {
  get: <TOutput, TError = ISLError>(path: string): ApiEndpoint<void, TOutput, TError> => ({
    path,
    method: 'GET',
  }),

  getWithParams: <TInput, TOutput, TError = ISLError>(
    path: string,
    validate?: (input: TInput) => ValidationResult
  ): ApiEndpoint<TInput, TOutput, TError> => ({
    path,
    method: 'GET',
    validate,
  }),

  post: <TInput, TOutput, TError = ISLError>(
    path: string,
    validate?: (input: TInput) => ValidationResult
  ): ApiEndpoint<TInput, TOutput, TError> => ({
    path,
    method: 'POST',
    validate,
  }),

  put: <TInput, TOutput, TError = ISLError>(
    path: string,
    validate?: (input: TInput) => ValidationResult
  ): ApiEndpoint<TInput, TOutput, TError> => ({
    path,
    method: 'PUT',
    validate,
  }),

  patch: <TInput, TOutput, TError = ISLError>(
    path: string,
    validate?: (input: TInput) => ValidationResult
  ): ApiEndpoint<TInput, TOutput, TError> => ({
    path,
    method: 'PATCH',
    validate,
  }),

  delete: <TOutput, TError = ISLError>(path: string): ApiEndpoint<void, TOutput, TError> => ({
    path,
    method: 'DELETE',
  }),
};
