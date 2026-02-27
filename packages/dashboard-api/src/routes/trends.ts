import { Router, type Request, type Response } from 'express';
import type { Queries } from '../db/queries.js';
import {
  TrendsQuerySchema,
  DriftQuerySchema,
  type ApiResponse,
  type TrendPoint,
  type DriftAlert,
} from '../types.js';
import { validateQuery } from '../middleware/validate.js';

export function trendsRouter(queries: Queries): Router {
  const router = Router();

  // ── GET /api/v1/trends — score trends over time ────────────────────
  router.get(
    '/',
    validateQuery(TrendsQuerySchema),
    (req: Request, res: Response): void => {
      const { repo, branch, days } = req.query as unknown as {
        repo: string;
        branch?: string;
        days: number;
      };

      const trends = queries.getTrends(repo, days, branch);
      const response: ApiResponse<TrendPoint[]> = { ok: true, data: trends };
      res.json(response);
    },
  );

  return router;
}

export function driftRouter(queries: Queries): Router {
  const router = Router();

  // ── GET /api/v1/drift — drift alerts ───────────────────────────────
  router.get(
    '/',
    validateQuery(DriftQuerySchema),
    (req: Request, res: Response): void => {
      const { repo, threshold } = req.query as unknown as {
        repo: string;
        threshold: number;
      };

      const alerts = queries.getDriftAlerts(repo, threshold);
      const response: ApiResponse<DriftAlert[]> = { ok: true, data: alerts };
      res.json(response);
    },
  );

  return router;
}
