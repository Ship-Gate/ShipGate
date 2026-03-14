/**
 * Project Store
 *
 * File-backed, in-process-cached project state store.
 * Stores projects as JSON files in `.shipgate/projects/` of the server's CWD.
 *
 * @module @isl-lang/project-store
 */

import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, readdir, unlink } from 'fs/promises';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import type { GeneratedSpec } from '@isl-lang/spec-generator';

export type ProjectStatus =
  | 'created'
  | 'spec_generated'
  | 'code_generated'
  | 'auditing'
  | 'ship'
  | 'no_ship'
  | 'error';

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  spec: GeneratedSpec | null;
  specHistory: Array<{ spec: GeneratedSpec; savedAt: string; changeRequest?: string }>;
  lastAuditScore: number | null;
  lastAuditVerdict: 'SHIP' | 'NO_SHIP' | 'WARN' | null;
  lastAuditAt: string | null;
  generatedFileCount: number;
  metadata: Record<string, unknown>;
}

const cache = new Map<string, ProjectRecord>();
let storeDir: string | null = null;

function getStoreDir(): string {
  if (!storeDir) {
    storeDir = resolve(process.env.SHIPGATE_STORE_DIR ?? join(process.cwd(), '.shipgate', 'projects'));
  }
  if (!existsSync(storeDir)) {
    mkdirSync(storeDir, { recursive: true });
  }
  return storeDir;
}

function projectPath(id: string): string {
  return join(getStoreDir(), `${id}.json`);
}

async function persist(project: ProjectRecord): Promise<void> {
  cache.set(project.id, project);
  await writeFile(projectPath(project.id), JSON.stringify(project, null, 2), 'utf-8');
}

export async function createProject(
  name: string,
  description: string,
  metadata: Record<string, unknown> = {},
): Promise<ProjectRecord> {
  const now = new Date().toISOString();
  const project: ProjectRecord = {
    id: randomUUID(),
    name,
    description,
    status: 'created',
    createdAt: now,
    updatedAt: now,
    spec: null,
    specHistory: [],
    lastAuditScore: null,
    lastAuditVerdict: null,
    lastAuditAt: null,
    generatedFileCount: 0,
    metadata,
  };
  await persist(project);
  return project;
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  if (cache.has(id)) return cache.get(id)!;
  const path = projectPath(id);
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, 'utf-8');
    const project = JSON.parse(raw) as ProjectRecord;
    cache.set(id, project);
    return project;
  } catch {
    return null;
  }
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const dir = getStoreDir();
  const files = await readdir(dir);
  const projects = await Promise.all(
    files
      .filter((f) => f.endsWith('.json'))
      .map((f) => getProject(f.replace('.json', ''))),
  );
  return (projects.filter(Boolean) as ProjectRecord[]).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function updateProjectSpec(
  id: string,
  spec: GeneratedSpec,
  changeRequest?: string,
): Promise<ProjectRecord | null> {
  const project = await getProject(id);
  if (!project) return null;
  if (project.spec) {
    project.specHistory.push({ spec: project.spec, savedAt: new Date().toISOString(), changeRequest });
    if (project.specHistory.length > 20) project.specHistory.shift();
  }
  project.spec = spec;
  project.status = 'spec_generated';
  project.updatedAt = new Date().toISOString();
  await persist(project);
  return project;
}

export async function updateProjectStatus(
  id: string,
  status: ProjectStatus,
  extras: Partial<Pick<ProjectRecord, 'lastAuditScore' | 'lastAuditVerdict' | 'generatedFileCount'>> = {},
): Promise<ProjectRecord | null> {
  const project = await getProject(id);
  if (!project) return null;
  project.status = status;
  project.updatedAt = new Date().toISOString();
  if (extras.lastAuditScore !== undefined) project.lastAuditScore = extras.lastAuditScore;
  if (extras.lastAuditVerdict !== undefined) project.lastAuditVerdict = extras.lastAuditVerdict;
  if (extras.lastAuditScore !== undefined) project.lastAuditAt = new Date().toISOString();
  if (extras.generatedFileCount !== undefined) project.generatedFileCount = extras.generatedFileCount;
  await persist(project);
  return project;
}

export async function deleteProject(id: string): Promise<boolean> {
  const path = projectPath(id);
  if (!existsSync(path)) return false;
  await unlink(path);
  cache.delete(id);
  return true;
}
