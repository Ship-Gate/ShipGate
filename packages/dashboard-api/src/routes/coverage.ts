import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Queries } from '../db/queries.js';
import type { ApiResponse, CoverageSummary } from '../types.js';
import { validateQuery } from '../middleware/validate.js';

const CoverageQuerySchema = z.object({
  repo: z.string().optional(),
});

export function coverageRouter(queries: Queries): Router {
  const router = Router();

  // ── GET /api/v1/coverage — spec coverage summary ───────────────────
  router.get(
    '/',
    validateQuery(CoverageQuerySchema),
    (req: Request, res: Response): void => {
      const { repo } = req.query as { repo?: string };
      const summaries = queries.getCoverageSummary(repo);

      if (summaries.length === 0) {
        res.status(404).json({ ok: false, error: 'No reports found for this repo' });
        return;
      }

      const response: ApiResponse<CoverageSummary[]> = { ok: true, data: summaries };
      res.json(response);
    },
  );

  return router;
}
