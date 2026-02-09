/**
 * Agent 29 - Env Reality Owner
 * 
 * Detect invented env vars and missing env definitions with precision.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  extractFromEnvFiles,
  extractFromZodSchemas,
  extractFromKubernetes,
  extractFromDockerfile,
} from './extractors/definitions.js';
import { extractUsages } from './extractors/usages.js';
import { analyzeEnvReality } from './analyzer.js';
import type { EnvRealityResult, EnvDefinition } from './types.js';

export * from './types.js';

/**
 * Configuration for env reality checker
 */
export interface EnvRealityCheckerConfig {
  /** Project root directory */
  projectRoot: string;
  /** Patterns for source files to scan */
  sourcePatterns?: string[];
  /** Patterns for env files to scan */
  envFilePatterns?: string[];
  /** Patterns for schema files to scan */
  schemaPatterns?: string[];
  /** Patterns for kubernetes manifests */
  k8sPatterns?: string[];
  /** Patterns for dockerfiles */
  dockerfilePatterns?: string[];
  /** Whether to include node_modules */
  includeNodeModules?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<Omit<EnvRealityCheckerConfig, 'projectRoot'>> = {
  sourcePatterns: ['**/*.{ts,tsx,js,jsx,mts,mjs}'],
  envFilePatterns: ['.env*'],
  schemaPatterns: ['**/*schema*.ts', '**/config/**/*.ts'],
  k8sPatterns: ['**/*.yaml', '**/*.yml'],
  dockerfilePatterns: ['**/Dockerfile*'],
  includeNodeModules: false,
};

/**
 * Check environment variable reality
 */
export async function checkEnvReality(
  config: EnvRealityCheckerConfig
): Promise<EnvRealityResult> {
  const {
    projectRoot,
    sourcePatterns = DEFAULT_CONFIG.sourcePatterns,
    envFilePatterns = DEFAULT_CONFIG.envFilePatterns,
    schemaPatterns = DEFAULT_CONFIG.schemaPatterns,
    k8sPatterns = DEFAULT_CONFIG.k8sPatterns,
    dockerfilePatterns = DEFAULT_CONFIG.dockerfilePatterns,
    includeNodeModules = DEFAULT_CONFIG.includeNodeModules,
  } = config;

  // Collect all definitions
  const definitions: EnvDefinition[] = [];

  // 1. Extract from .env files
  const envFiles = await findFiles(projectRoot, envFilePatterns, includeNodeModules);
  definitions.push(...extractFromEnvFiles(projectRoot, envFiles));

  // 2. Extract from Zod schemas
  const schemaFiles = await findFiles(projectRoot, schemaPatterns, includeNodeModules);
  definitions.push(...extractFromZodSchemas(projectRoot, schemaFiles));

  // 3. Extract from Kubernetes manifests
  const k8sFiles = await findFiles(projectRoot, k8sPatterns, includeNodeModules);
  definitions.push(...extractFromKubernetes(projectRoot, k8sFiles));

  // 4. Extract from Dockerfiles
  const dockerfiles = await findFiles(projectRoot, dockerfilePatterns, includeNodeModules);
  definitions.push(...extractFromDockerfile(projectRoot, dockerfiles));

  // Collect all usages
  const sourceFiles = await findFiles(projectRoot, sourcePatterns, includeNodeModules);
  const usages = extractUsages(projectRoot, sourceFiles);

  // Analyze
  return analyzeEnvReality(definitions, usages);
}

/**
 * Find files matching patterns
 */
async function findFiles(
  projectRoot: string,
  patterns: string[],
  includeNodeModules: boolean
): Promise<string[]> {
  // Dynamically import glob to avoid dependency issues
  const { glob } = await import('glob');
  
  const ignore = includeNodeModules ? [] : ['**/node_modules/**', '**/dist/**', '**/build/**'];
  
  const allFiles: string[] = [];
  
  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore,
      absolute: false,
    });
    allFiles.push(...files);
  }

  // Remove duplicates and normalize paths
  return Array.from(new Set(allFiles.map(f => path.normalize(f))));
}

/**
 * Format results as human-readable report
 */
export function formatReport(result: EnvRealityResult): string {
  const lines: string[] = [];

  lines.push('═'.repeat(80));
  lines.push('ENVIRONMENT VARIABLE REALITY CHECK REPORT');
  lines.push('═'.repeat(80));
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('─'.repeat(80));
  lines.push(`Total Definitions: ${result.summary.totalDefinitions}`);
  lines.push(`Total Usages: ${result.summary.totalUsages}`);
  lines.push(`Total Issues: ${result.summary.totalClaims}`);
  lines.push(`  - Used but Undefined: ${result.summary.usedButUndefined}`);
  lines.push(`  - Defined but Unused: ${result.summary.definedButUnused}`);
  lines.push(`  - Renamed Drift: ${result.summary.renamedDrift}`);
  lines.push(`  - Type Mismatches: ${result.summary.typeMismatches}`);
  lines.push('');

  // Claims by severity
  const errors = result.claims.filter(c => c.severity === 'error');
  const warnings = result.claims.filter(c => c.severity === 'warning');
  const infos = result.claims.filter(c => c.severity === 'info');

  if (errors.length > 0) {
    lines.push('ERRORS');
    lines.push('─'.repeat(80));
    for (const claim of errors) {
      lines.push(`[${claim.type}] ${claim.variable}`);
      lines.push(`  ${claim.message}`);
      if (claim.usage) {
        lines.push(`  Usage: ${claim.usage.file}:${claim.usage.line}`);
      }
      lines.push(`  Remediation: ${claim.remediation.join(', ')}`);
      lines.push('');
    }
  }

  if (warnings.length > 0) {
    lines.push('WARNINGS');
    lines.push('─'.repeat(80));
    for (const claim of warnings) {
      lines.push(`[${claim.type}] ${claim.variable}`);
      lines.push(`  ${claim.message}`);
      if (claim.usage) {
        lines.push(`  Usage: ${claim.usage.file}:${claim.usage.line}`);
      }
      if (claim.definition) {
        lines.push(`  Definition: ${claim.definition.file}:${claim.definition.line}`);
      }
      lines.push(`  Remediation: ${claim.remediation.join(', ')}`);
      lines.push('');
    }
  }

  if (infos.length > 0) {
    lines.push('INFO');
    lines.push('─'.repeat(80));
    for (const claim of infos) {
      lines.push(`[${claim.type}] ${claim.variable}`);
      lines.push(`  ${claim.message}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
