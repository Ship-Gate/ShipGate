// ============================================================================
// ISL Standard Library - GraphQL Client Builder
// @isl-lang/stdlib-api
// ============================================================================

import type { Result } from '@isl-lang/stdlib-core';
import type { Middleware, ClientConfig } from '../types.js';
import type { ApiError } from '../errors.js';
import type { GraphQLClient, GraphQLClientBuilder, GraphQLRequestOptions, GraphQLResponse } from './types.js';
import { executeFetch, createContext } from '../rest/methods.js';
import { buildChain } from '../interceptors.js';
import { parseGraphQLResponse } from './client.js';

/**
 * Create a GraphQL client builder.
 *
 * Usage:
 * ```ts
 * const gql = createGraphQLClient()
 *   .url('https://api.example.com/graphql')
 *   .header('Authorization', 'Bearer token')
 *   .build();
 *
 * const result = await gql.query<{ users: User[] }>(
 *   `query GetUsers($limit: Int!) { users(limit: $limit) { id name } }`,
 *   { variables: { limit: 10 } },
 * );
 * ```
 */
export function createGraphQLClient(): GraphQLClientBuilder {
  const config: ClientConfig = {
    baseUrl: '',
    headers: { 'Content-Type': 'application/json' },
    timeout: 30_000,
    middleware: [],
    fetchFn: globalThis.fetch?.bind(globalThis),
  };

  const builder: GraphQLClientBuilder = {
    url(endpoint: string) {
      config.baseUrl = endpoint;
      return builder;
    },
    header(name: string, value: string) {
      config.headers[name] = value;
      return builder;
    },
    headers(headers: Record<string, string>) {
      Object.assign(config.headers, headers);
      return builder;
    },
    timeout(ms: number) {
      config.timeout = ms;
      return builder;
    },
    middleware(mw: Middleware) {
      config.middleware.push(mw);
      return builder;
    },
    fetchFn(fn: typeof globalThis.fetch) {
      config.fetchFn = fn;
      return builder;
    },
    build(): GraphQLClient {
      const snapshot: ClientConfig = {
        baseUrl: config.baseUrl,
        headers: { ...config.headers },
        timeout: config.timeout,
        middleware: [...config.middleware],
        fetchFn: config.fetchFn,
      };

      async function execute<T>(
        queryOrMutation: string,
        options?: GraphQLRequestOptions,
      ): Promise<Result<GraphQLResponse<T>, ApiError>> {
        const body: Record<string, unknown> = { query: queryOrMutation };
        if (options?.variables) body.variables = options.variables;
        if (options?.operationName) body.operationName = options.operationName;

        const requestConfig = {
          url: snapshot.baseUrl,
          method: 'POST' as const,
          headers: { ...snapshot.headers, ...options?.headers },
          body,
          timeout: options?.timeout ?? snapshot.timeout,
          signal: options?.signal,
        };

        const ctx = createContext(requestConfig);
        const finalHandler = (c: import('../types.js').MiddlewareContext) => executeFetch(c.request, snapshot.fetchFn);
        const chain = buildChain(snapshot.middleware, finalHandler);

        const rawResult = await chain(ctx);
        return parseGraphQLResponse<T>(rawResult);
      }

      return {
        query: <T = unknown>(query: string, options?: GraphQLRequestOptions) =>
          execute<T>(query, options),
        mutation: <T = unknown>(mutation: string, options?: GraphQLRequestOptions) =>
          execute<T>(mutation, options),
      };
    },
  };

  return builder;
}
