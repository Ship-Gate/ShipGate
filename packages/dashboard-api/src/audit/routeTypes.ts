import type { AuditRecord } from './types.js';

// ── API response wrappers for audit routes ──────────────────────────────

export { ListAuditQuerySchema, ExportAuditQuerySchema } from './types.js';

export interface AuditApiResponse<T> {
  ok: true;
  data: T;
}

export interface PaginatedAuditResponse {
  ok: true;
  data: AuditRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
