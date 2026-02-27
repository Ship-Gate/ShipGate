/**
 * Shared Pagination Logic
 *
 * Canonical cursor-based pagination helpers shared across all SDK targets.
 */

import type {
  PaginationParams,
  PaginatedResponse,
  ApiResponse,
} from './types.js';

// ============================================================================
// Page Iterator
// ============================================================================

/**
 * Async generator that auto-paginates through all pages.
 *
 * @param fetchPage  function that fetches a single page given params
 * @param params     initial pagination params (cursor, limit)
 */
export async function* paginate<T>(
  fetchPage: (params: PaginationParams) => Promise<PaginatedResponse<T>>,
  params: PaginationParams = {},
): AsyncGenerator<T[], void, unknown> {
  let cursor = params.cursor;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchPage({ cursor, limit: params.limit });
    yield page.items;
    hasMore = page.hasMore;
    cursor = page.nextCursor;
  }
}

/**
 * Collect all items across every page into a single array.
 */
export async function paginateAll<T>(
  fetchPage: (params: PaginationParams) => Promise<PaginatedResponse<T>>,
  params: PaginationParams = {},
): Promise<T[]> {
  const all: T[] = [];
  for await (const page of paginate(fetchPage, params)) {
    all.push(...page);
  }
  return all;
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Extract a PaginatedResponse from a raw ApiResponse whose body
 * follows the standard `{ items, nextCursor, hasMore, total }` shape.
 */
export function toPaginatedResponse<T>(
  response: ApiResponse<{
    items: T[];
    nextCursor?: string;
    hasMore?: boolean;
    total?: number;
  }>,
): PaginatedResponse<T> {
  const { data } = response;
  return {
    items: data.items ?? [],
    nextCursor: data.nextCursor,
    hasMore: data.hasMore ?? !!data.nextCursor,
    total: data.total,
  };
}

/**
 * Build PaginationParams from common query-string conventions.
 */
export function buildPaginationQuery(
  params: PaginationParams,
): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.cursor) query['cursor'] = params.cursor;
  if (params.limit != null) query['limit'] = String(params.limit);
  return query;
}
