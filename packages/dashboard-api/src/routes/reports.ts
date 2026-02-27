import { Router, type Request, type Response } from 'express';
import type { Queries } from '../db/queries.js';
import {
  CreateReportSchema,
  ListReportsQuerySchema,
  type ApiResponse,
  type PaginatedResponse,
  type ReportDiff,
  type VerificationReport,
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
        q?: string;
        from?: string;
        to?: string;
        page: number;
        limit: number;
      };

      const { reports, total } = queries.listReports({
        repo: query.repo,
        branch: query.branch,
        verdict: query.verdict as 'SHIP' | 'WARN' | 'NO_SHIP' | undefined,
        triggeredBy: query.triggeredBy as 'ci' | 'cli' | 'vscode' | undefined,
        q: query.q,
        from: query.from,
        to: query.to,
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

  // ── GET /api/v1/reports/:id/diff — compare to previous run ───────────
  router.get('/:id/diff', (req: Request, res: Response): void => {
    const id = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];
    if (!id) {
      res.status(400).json({ ok: false, error: 'Missing id parameter' });
      return;
    }
    const diff = queries.getReportDiff(id);
    if (!diff) {
      res.status(404).json({ ok: false, error: 'Report not found' });
      return;
    }
    const response: ApiResponse<ReportDiff> = { ok: true, data: diff };
    res.json(response);
  });

  return router;
}
