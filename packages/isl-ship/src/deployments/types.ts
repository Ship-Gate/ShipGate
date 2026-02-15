/**
 * Deployment Adapter Types
 *
 * Interface and types for platform-specific deployment configuration generation.
 */

import type { GeneratedFile } from '../types.js';

/** Minimal ISL spec context for deployment config generation */
export interface ISLSpec {
  domainName: string;
  projectName: string;
  apis: Array<{
    basePath?: string;
    endpoints: Array<{ method: string; path: string; behavior?: string }>;
  }>;
  entities: Array<{ name: string }>;
  hasPostgres: boolean;
  hasSqlite: boolean;
  envVars?: string[];
}

export type DeploymentPlatform = 'vercel' | 'docker' | 'railway' | 'render' | 'fly';

export interface DeploymentAdapter {
  name: string;
  platform: DeploymentPlatform;
  generateConfig(spec: ISLSpec, framework: string, db: string): GeneratedFile[];
  /** Platform-specific .env.example with documented vars */
  generateEnvTemplate(spec: ISLSpec, framework: string, db: string): GeneratedFile;
  getDeployCommand(): string;
  getRequirements(): string[];
}
