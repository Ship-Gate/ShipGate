/**
 * Project Routes
 *
 * POST   /api/v1/projects              — create a project
 * GET    /api/v1/projects              — list all projects
 * GET    /api/v1/projects/:id          — get project by id
 * PUT    /api/v1/projects/:id/spec     — update project spec
 * DELETE /api/v1/projects/:id         — delete project
 */

import { Hono } from 'hono';
import {
  createProject,
  getProject,
  listProjects,
  updateProjectSpec,
  deleteProject,
} from '@isl-lang/project-store';
import type { GeneratedSpec } from '@isl-lang/spec-generator';

const projectRoutes = new Hono();

projectRoutes.post('/api/v1/projects', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return c.json({ error: 'name (string) is required' }, 422);
  }

  const project = await createProject(
    body.name.trim(),
    body.description ?? '',
    body.metadata ?? {},
  );

  return c.json({ success: true, project }, 201);
});

projectRoutes.get('/api/v1/projects', async (c) => {
  const projects = await listProjects();
  return c.json({ success: true, projects });
});

projectRoutes.get('/api/v1/projects/:id', async (c) => {
  const id = c.req.param('id');
  const project = await getProject(id);
  if (!project) return c.json({ error: 'Project not found' }, 404);
  return c.json({ success: true, project });
});

projectRoutes.put('/api/v1/projects/:id/spec', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  if (!body?.spec) return c.json({ error: 'spec (GeneratedSpec) is required' }, 422);

  const updated = await updateProjectSpec(id, body.spec as GeneratedSpec, body.changeRequest);
  if (!updated) return c.json({ error: 'Project not found' }, 404);
  return c.json({ success: true, project: updated });
});

projectRoutes.delete('/api/v1/projects/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await deleteProject(id);
  if (!deleted) return c.json({ error: 'Project not found' }, 404);
  return c.json({ success: true });
});

export default projectRoutes;
