import { Router, type Request, type Response } from 'express';
import type { AuditQueries } from './queries.js';
import {
  ListAuditQuerySchema,
  ExportAuditQuerySchema,
  type PaginatedAuditResponse,
  type AuditApiResponse,
} from './routeTypes.js';
import { auditRecordsToCsv } from './csv.js';
import { validateQuery } from '../middleware/validate.js';

/**
 * Express router for audit log endpoints.
 *
 * All endpoints are read-only. Audit records are written
 * internally by the audit service — never via the API.
 */
export function auditRouter(auditQueries: AuditQueries): Router {
  const router = Router();

  // ── GET /api/v1/audit — list audit events (paginated + filtered) ────
  router.get(
    '/',
    validateQuery(ListAuditQuerySchema),
    (req: Request, res: Response): void => {
      const query = req.query as unknown as {
        type?: string;
        actor?: string;
        from?: string;
        to?: string;
        page: number;
        limit: number;
      };

      const { records, total } = auditQueries.listAuditRecords({
        type: query.type as Parameters<typeof auditQueries.listAuditRecords>[0]['type'],
        actor: query.actor,
        from: query.from,
        to: query.to,
        page: query.page,
        limit: query.limit,
      });

      const totalPages = Math.ceil(total / query.limit);

      const response: PaginatedAuditResponse = {
        ok: true,
        data: records,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
        },
      };

      res.json(response);
    },
  );

  // ── GET /api/v1/audit/export — CSV export ───────────────────────────
  router.get(
    '/export',
    validateQuery(ExportAuditQuerySchema),
    (req: Request, res: Response): void => {
      const query = req.query as unknown as {
        type?: string;
        actor?: string;
        from?: string;
        to?: string;
      };

      const records = auditQueries.exportAuditRecords({
        type: query.type as Parameters<typeof auditQueries.exportAuditRecords>[0]['type'],
        actor: query.actor,
        from: query.from,
        to: query.to,
      });

      const csv = auditRecordsToCsv(records);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
      res.send(csv);
    },
  );

  // ── GET /api/v1/audit/verify — verify hash chain integrity ──────────
  router.get('/verify', (_req: Request, res: Response): void => {
    const result = auditQueries.verifyHashChain();

    const response: AuditApiResponse<{ valid: boolean; brokenAtId?: string }> = {
      ok: true,
      data: result,
    };

    res.json(response);
  });

  // ── GET /api/v1/audit/:id — get single audit record ─────────────────
  router.get('/:id', (req: Request, res: Response): void => {
    const record = auditQueries.getAuditRecord(req.params['id']!);
    if (!record) {
      res.status(404).json({ ok: false, error: 'Audit record not found' });
      return;
    }

    const response: AuditApiResponse<typeof record> = { ok: true, data: record };
    res.json(response);
  });

  return router;
}
