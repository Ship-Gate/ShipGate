// ============================================================================
// ISL Standard Library - GraphQL Client Implementation
// @isl-lang/stdlib-api
// ============================================================================

import type { Result } from '@isl-lang/stdlib-core';
import type { ApiResponse } from '../types.js';
import type { ApiError } from '../errors.js';
import { graphqlError } from '../errors.js';
import type { GraphQLResponse } from './types.js';

/**
 * Parse a raw ApiResponse into a typed GraphQLResponse, detecting GraphQL-level errors.
 */
export function parseGraphQLResponse<T>(
  result: Result<ApiResponse, ApiError>,
): Result<GraphQLResponse<T>, ApiError> {
  if (!result.ok) {
    return result;
  }

  const body = result.value.data as GraphQLResponse<T> | undefined;

  if (!body) {
    return {
      ok: false,
      error: graphqlError('Empty response body from GraphQL endpoint'),
    };
  }

  // GraphQL spec: if errors[] is present and data is null/absent, it's a full error
  if (body.errors && body.errors.length > 0 && !body.data) {
    return {
      ok: false,
      error: graphqlError(
        body.errors.map((e) => e.message).join('; '),
        body.errors,
      ),
    };
  }

  // Partial errors (data + errors) — still return ok with the errors attached
  return {
    ok: true,
    value: {
      data: body.data,
      errors: body.errors,
      extensions: body.extensions,
    },
  };
}
