// ============================================================================
// ISL Standard Library - CRUD Behavior Types
// @isl-lang/stdlib-api
// ============================================================================

/**
 * Sort order for list operations
 */
export const SortOrder = {
  ASC: 'ASC',
  DESC: 'DESC',
} as const;

export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

/**
 * Pagination information
 */
export interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextCursor?: string;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  requestId: string;
  timestamp: Date;
  etag?: string;
}

/**
 * List resources input
 */
export interface ListInput {
  page?: number;
  pageSize?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
  filters?: Record<string, unknown>;
  fields?: string[];
  include?: string[];
}

/**
 * List resources output
 */
export interface ListOutput<T> {
  data: T[];
  pagination: Pagination;
  meta: ResponseMeta;
}

/**
 * Get resource input
 */
export interface GetInput {
  id: string;
  fields?: string[];
  include?: string[];
}

/**
 * Get resource output
 */
export interface GetOutput<T> {
  data: T;
  meta: ResponseMeta;
}

/**
 * Create resource input
 */
export interface CreateInput<TInput> {
  data: TInput;
  idempotencyKey?: string;
}

/**
 * Create resource output
 */
export interface CreateOutput<T> {
  data: T;
  meta: ResponseMeta & { location: string };
}

/**
 * Update resource input
 */
export interface UpdateInput<TInput> {
  id: string;
  data: TInput;
  ifMatch?: string;
}

/**
 * Update resource output
 */
export interface UpdateOutput<T> {
  data: T;
  meta: ResponseMeta & { etag: string };
}

/**
 * Patch operations
 */
export const PatchOp = {
  ADD: 'ADD',
  REMOVE: 'REMOVE',
  REPLACE: 'REPLACE',
  MOVE: 'MOVE',
  COPY: 'COPY',
  TEST: 'TEST',
} as const;

export type PatchOp = (typeof PatchOp)[keyof typeof PatchOp];

/**
 * Patch operation definition (JSON Patch RFC 6902)
 */
export interface PatchOperation {
  op: PatchOp;
  path: string;
  value?: unknown;
  from?: string;
}

/**
 * Patch resource input
 */
export interface PatchInput {
  id: string;
  operations: PatchOperation[];
  ifMatch?: string;
}

/**
 * Patch resource output
 */
export interface PatchOutput<T> {
  data: T;
  meta: ResponseMeta;
}

/**
 * Delete resource input
 */
export interface DeleteInput {
  id: string;
  soft?: boolean;
  ifMatch?: string;
}

/**
 * Delete resource output
 */
export interface DeleteOutput {
  meta: ResponseMeta & { softDeleted: boolean };
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: unknown;
}

/**
 * API Error types
 */
export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

/**
 * Standard API errors
 */
export const ApiErrors = {
  notFound: (resource: string, id: string): ApiError => ({
    code: 'NOT_FOUND',
    message: `${resource} with id "${id}" not found`,
    status: 404,
  }),

  forbidden: (action: string): ApiError => ({
    code: 'FORBIDDEN',
    message: `You do not have permission to ${action}`,
    status: 403,
  }),

  conflict: (message: string, existingId?: string): ApiError => ({
    code: 'CONFLICT',
    message,
    status: 409,
    details: existingId ? { existingId } : undefined,
  }),

  validationError: (errors: ValidationError[]): ApiError => ({
    code: 'VALIDATION_ERROR',
    message: 'Input validation failed',
    status: 422,
    details: { errors },
  }),

  preconditionFailed: (message: string): ApiError => ({
    code: 'PRECONDITION_FAILED',
    message,
    status: 412,
  }),

  invalidPatch: (operation: PatchOperation, reason: string): ApiError => ({
    code: 'INVALID_PATCH',
    message: `Invalid patch operation: ${reason}`,
    status: 422,
    details: { operation, reason },
  }),

  invalidFilter: (field: string, reason: string): ApiError => ({
    code: 'INVALID_FILTER',
    message: `Invalid filter on field "${field}": ${reason}`,
    status: 400,
    details: { field, reason },
  }),

  invalidSort: (field: string): ApiError => ({
    code: 'INVALID_SORT',
    message: `Field "${field}" is not sortable`,
    status: 400,
    details: { field },
  }),
} as const;

/**
 * Bulk operation item result
 */
export interface BulkItemResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  index: number;
}

/**
 * Bulk create input
 */
export interface BulkCreateInput<TInput> {
  items: TInput[];
  stopOnError?: boolean;
}

/**
 * Bulk create output
 */
export interface BulkCreateOutput<T, TInput> {
  created: T[];
  failed: Array<{
    index: number;
    error: string;
    data: TInput;
  }>;
  meta: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

/**
 * Bulk update input
 */
export interface BulkUpdateInput<TInput> {
  updates: Array<{ id: string; data: TInput }>;
}

/**
 * Bulk update output
 */
export interface BulkUpdateOutput<T> {
  updated: T[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * Bulk delete input
 */
export interface BulkDeleteInput {
  ids: string[];
  soft?: boolean;
}

/**
 * Bulk delete output
 */
export interface BulkDeleteOutput {
  deleted: string[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * Create pagination info
 */
export function createPagination(
  total: number,
  page: number,
  pageSize: number,
  nextCursor?: string
): Pagination {
  const totalPages = Math.ceil(total / pageSize);
  return {
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
    nextCursor,
  };
}

/**
 * Generate a simple unique ID (for environments without crypto.randomUUID)
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Create response metadata
 */
export function createMeta(etag?: string): ResponseMeta {
  return {
    requestId: generateRequestId(),
    timestamp: new Date(),
    etag,
  };
}

/**
 * Apply JSON Patch operations to an object
 */
export function applyPatch<T extends Record<string, unknown>>(
  target: T,
  operations: PatchOperation[]
): T {
  const result = { ...target };

  for (const op of operations) {
    const pathParts = op.path.split('/').filter(Boolean);
    const lastKey = pathParts.pop();

    if (!lastKey) continue;

    // Navigate to parent
    let current: Record<string, unknown> = result;
    for (const key of pathParts) {
      if (typeof current[key] === 'object' && current[key] !== null) {
        current = current[key] as Record<string, unknown>;
      }
    }

    switch (op.op) {
      case 'ADD':
      case 'REPLACE':
        current[lastKey] = op.value;
        break;
      case 'REMOVE':
        delete current[lastKey];
        break;
      case 'COPY':
        if (op.from) {
          const fromParts = op.from.split('/').filter(Boolean);
          let fromValue: unknown = result;
          for (const key of fromParts) {
            if (
              typeof fromValue === 'object' &&
              fromValue !== null &&
              key in fromValue
            ) {
              fromValue = (fromValue as Record<string, unknown>)[key];
            }
          }
          current[lastKey] = fromValue;
        }
        break;
      case 'MOVE':
        if (op.from) {
          const fromParts = op.from.split('/').filter(Boolean);
          const fromLastKey = fromParts.pop();
          let fromParent: Record<string, unknown> = result;
          for (const key of fromParts) {
            if (
              typeof fromParent[key] === 'object' &&
              fromParent[key] !== null
            ) {
              fromParent = fromParent[key] as Record<string, unknown>;
            }
          }
          if (fromLastKey && fromLastKey in fromParent) {
            current[lastKey] = fromParent[fromLastKey];
            delete fromParent[fromLastKey];
          }
        }
        break;
      case 'TEST':
        // Test operation - just validate, don't modify
        break;
    }
  }

  return result;
}

export default {
  SortOrder,
  PatchOp,
  ApiErrors,
  createPagination,
  createMeta,
  applyPatch,
};
