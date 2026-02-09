import { Router, type Request, type Response } from 'express';
import type { Queries } from '../db/queries.js';
import {
  CreateReportSchema,
  ListReportsQuerySchema,
  type PaginatedResponse,
  type VerificationReport,
  type ApiResponse,
} from '../types.js';
import { validateBody, validateQuery } from '../middleware/validate.js';

export function reportsRouter(queries: Queries): Router {
  const router = Router();

  // ── POST /api/v1/reports — submit a verification report ────────────
  router.post(
    '/',
    validateBody(CreateReportSchema),
    (req: Request, res: Response): void => {
      const report = queries.insertReport(req.body);
      const response: ApiResponse<VerificationReport> = { ok: true, data: report };
      res.status(201).json(response);
    },
  );

  // ── GET /api/v1/reports — list reports (paginated, filtered) ───────
  router.get(
    '/',
    validateQuery(ListReportsQuerySchema),
    (req: Request, res: Response): void => {
      const query = req.query as unknown as {
        repo?: string;
        branch?: string;
        verdict?: string;
        triggeredBy?: string;
        page: number;
        limit: number;
      };

      const { reports, total } = queries.listReports({
        repo: query.repo,
        branch: query.branch,
        verdict: query.verdict as 'SHIP' | 'WARN' | 'NO_SHIP' | undefined,
        triggeredBy: query.triggeredBy as 'ci' | 'cli' | 'vscode' | undefined,
        page: query.page,
        limit: query.limit,
      });

      const totalPages = Math.ceil(total / query.limit);

      const response: PaginatedResponse<VerificationReport> = {
        ok: true,
        data: reports,
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

  // ── GET /api/v1/reports/:id — get a single report ─────────────────
  router.get('/:id', (req: Request, res: Response): void => {
    const id = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];
    if (!id) {
      res.status(400).json({ ok: false, error: 'Missing id parameter' });
      return;
    }
    const report = queries.getReport(id);
    if (!report) {
      res.status(404).json({ ok: false, error: 'Report not found' });
      return;
    }
    const response: ApiResponse<VerificationReport> = { ok: true, data: report };
    res.json(response);
  });

  return router;
}
