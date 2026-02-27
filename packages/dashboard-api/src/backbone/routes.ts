/**
 * Backbone REST routes — projects, runs, verdicts, artifacts.
 *
 * All routes live under /api/v1/backbone and require JWT auth.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { BackboneQueries } from './queries.js';
import {
  CreateOrgSchema,
  CreateProjectSchema,
  SubmitRunSchema,
  ListRunsQuerySchema,
} from './types.js';
import { validateBody, validateQuery } from '../middleware/validate.js';

export function backboneRouter(q: BackboneQueries): Router {
  const router = Router();

  // ── Orgs ───────────────────────────────────────────────────────────

  router.post('/orgs', validateBody(CreateOrgSchema), (req: Request, res: Response) => {
    try {
      const org = q.createOrg(req.body);
      res.status(201).json({ ok: true, data: org });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('UNIQUE constraint')) {
        res.status(409).json({ ok: false, error: 'Org name already exists' });
        return;
      }
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.get('/orgs', (_req: Request, res: Response) => {
    const orgs = q.listOrgs();
    res.json({ ok: true, data: orgs });
  });

  router.get('/orgs/:id', (req: Request<{ id: string }>, res: Response) => {
    const org = q.getOrg(req.params.id);
    if (!org) {
      res.status(404).json({ ok: false, error: 'Org not found' });
      return;
    }
    res.json({ ok: true, data: org });
  });

  // ── Projects ───────────────────────────────────────────────────────

  router.post('/projects', validateBody(CreateProjectSchema), (req: Request, res: Response) => {
    try {
      const org = q.getOrg(req.body.orgId);
      if (!org) {
        res.status(404).json({ ok: false, error: 'Org not found' });
        return;
      }
      const project = q.createProject(req.body);
      res.status(201).json({ ok: true, data: project });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('UNIQUE constraint')) {
        res.status(409).json({ ok: false, error: 'Project name already exists in this org' });
        return;
      }
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.get('/projects', (req: Request, res: Response) => {
    const orgId = typeof req.query['orgId'] === 'string' ? req.query['orgId'] : undefined;
    const projects = q.listProjects(orgId);
    res.json({ ok: true, data: projects });
  });

  router.get('/projects/:id', (req: Request<{ id: string }>, res: Response) => {
    const project = q.getProject(req.params.id);
    if (!project) {
      res.status(404).json({ ok: false, error: 'Project not found' });
      return;
    }
    res.json({ ok: true, data: project });
  });

  // ── Runs ───────────────────────────────────────────────────────────

  router.post('/runs', validateBody(SubmitRunSchema), (req: Request, res: Response) => {
    try {
      const project = q.getProject(req.body.projectId);
      if (!project) {
        res.status(404).json({ ok: false, error: 'Project not found' });
        return;
      }
      const run = q.submitRun(req.body);
      res.status(201).json({ ok: true, data: run });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ ok: false, error: message });
    }
  });

  router.get('/runs', validateQuery(ListRunsQuerySchema), (req: Request, res: Response) => {
    const query = req.query as unknown as import('./types.js').ListRunsQuery;
    const { runs, total } = q.listRuns(query);
    res.json({
      ok: true,
      data: runs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  });

  router.get('/runs/:id', (req: Request<{ id: string }>, res: Response) => {
    const run = q.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ ok: false, error: 'Run not found' });
      return;
    }
    res.json({ ok: true, data: run });
  });

  // ── Verdicts ───────────────────────────────────────────────────────

  router.get('/projects/:id/verdict', (req: Request<{ id: string }>, res: Response) => {
    const project = q.getProject(req.params.id);
    if (!project) {
      res.status(404).json({ ok: false, error: 'Project not found' });
      return;
    }
    const latest = q.getLatestVerdict(req.params.id);
    if (!latest) {
      res.status(404).json({ ok: false, error: 'No verdicts found for this project' });
      return;
    }
    res.json({ ok: true, data: latest });
  });

  // ── Artifacts ──────────────────────────────────────────────────────

  router.get('/runs/:id/artifacts', (req: Request<{ id: string }>, res: Response) => {
    const run = q.getRun(req.params.id);
    if (!run) {
      res.status(404).json({ ok: false, error: 'Run not found' });
      return;
    }
    const artifacts = q.getArtifactsForRun(req.params.id);
    res.json({ ok: true, data: artifacts });
  });

  router.get('/artifacts/:id', (req: Request<{ id: string }>, res: Response) => {
    const artifact = q.getArtifact(req.params.id);
    if (!artifact) {
      res.status(404).json({ ok: false, error: 'Artifact not found' });
      return;
    }
    res.json({ ok: true, data: artifact });
  });

  return router;
}
