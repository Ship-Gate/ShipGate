/**
 * Deployment Adapters — Registry and factory
 */

import type { Domain } from '@isl-lang/parser';
import type { DeploymentAdapter, ISLSpec } from './types.js';
import { toKebabCase } from '../types.js';
import { VercelAdapter } from './vercel-adapter.js';
import { DockerAdapter } from './docker-adapter.js';
import { RailwayAdapter } from './railway-adapter.js';
import { FlyAdapter } from './fly-adapter.js';

const ADAPTERS: Record<string, DeploymentAdapter> = {
  vercel: VercelAdapter,
  docker: DockerAdapter,
  railway: RailwayAdapter,
  fly: FlyAdapter,
};

export type { DeploymentAdapter, ISLSpec, DeploymentPlatform } from './types.js';
export { VercelAdapter } from './vercel-adapter.js';
export { DockerAdapter } from './docker-adapter.js';
export { RailwayAdapter } from './railway-adapter.js';
export { FlyAdapter } from './fly-adapter.js';

/**
 * Build ISLSpec from Domain and stack for deployment adapters.
 */
export function buildDeploymentSpec(
  domain: Domain,
  projectName: string,
  database: string
): ISLSpec {
  const envVars: string[] = [];
  if (domain.config?.entries) {
    for (const entry of domain.config.entries as Array<{ source: string; reference: { value: string } }>) {
      if (entry.source === 'env' || entry.source === 'secret') {
        envVars.push(entry.reference.value);
      }
    }
  }

  return {
    domainName: domain.name.name,
    projectName,
    apis: (domain.apis ?? []).map((api: { basePath?: { value: string }; endpoints?: Array<{ method?: string; path?: { value: string }; behavior?: { name?: { name: string } | string } }> }) => ({
      basePath: api.basePath?.value,
      endpoints: (api.endpoints ?? []).map((ep: { method?: string; path?: { value: string }; behavior?: { name?: { name: string } | string } }) => ({
        method: ep.method ?? 'GET',
        path: ep.path?.value ?? '/',
        behavior: (typeof ep.behavior?.name === 'object' ? ep.behavior?.name?.name : ep.behavior?.name) as string | undefined,
      })),
    })),
    entities: domain.entities.map((e: { name: { name: string } }) => ({ name: e.name.name })),
    hasPostgres: database === 'postgres',
    hasSqlite: database === 'sqlite',
    envVars: envVars.length > 0 ? envVars : undefined,
  };
}

/**
 * Get deployment adapter by platform.
 */
export function getDeploymentAdapter(platform: string): DeploymentAdapter | null {
  const normalized = platform?.toLowerCase().trim();
  return ADAPTERS[normalized] ?? null;
}

/**
 * List supported deployment platforms.
 */
export function getDeploymentPlatforms(): string[] {
  return Object.keys(ADAPTERS);
}
