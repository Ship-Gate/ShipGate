/**
 * ISL Ship — Main Orchestrator
 *
 * Parses an ISL spec and generates a complete, runnable full-stack application.
 */

import { parse, type Domain } from '@isl-lang/parser';
import type { ShipOptions, ShipResult, ShipStats, GeneratedFile } from './types.js';
import { resolveStack, toKebabCase } from './types.js';
import { generatePrismaSchema } from './generators/prisma.js';
import { generateBackend } from './generators/backend.js';
import { generateContracts } from './generators/contracts.js';
import { generateScaffold } from './generators/scaffold.js';

/**
 * Generate a complete full-stack application from an ISL specification.
 *
 * @param islSource - Raw ISL source code
 * @param options - Ship configuration options
 * @returns ShipResult with all generated files
 */
export function ship(islSource: string, options: ShipOptions): ShipResult {
  const start = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  const allFiles: GeneratedFile[] = [];

  // ── Step 1: Parse ISL spec ──────────────────────────────────────────────────
  const parseResult = parse(islSource, options.specPath);

  if (!parseResult.success || !parseResult.domain) {
    const parseErrors = parseResult.errors?.map(e =>
      `${e.message} at ${e.location?.file ?? '<unknown>'}:${e.location?.line ?? 0}:${e.location?.column ?? 0}`
    ) ?? ['Unknown parse error'];
    return {
      success: false,
      projectName: options.projectName ?? 'unknown',
      files: [],
      errors: parseErrors,
      warnings: [],
      duration: Date.now() - start,
      stats: emptyStats(),
    };
  }

  const domain = parseResult.domain;
  const stack = resolveStack(options.stack);
  const projectName = options.projectName ?? domain.name.name;

  // ── Step 2: Generate database layer ─────────────────────────────────────────
  try {
    const dbFiles = generatePrismaSchema(domain, stack);
    allFiles.push(...dbFiles);
  } catch (e) {
    errors.push(`Database generation failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Step 3: Generate backend layer ──────────────────────────────────────────
  try {
    const backendFiles = generateBackend(domain, stack);
    allFiles.push(...backendFiles);
  } catch (e) {
    errors.push(`Backend generation failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Step 4: Generate runtime contracts ──────────────────────────────────────
  if (stack.runtime) {
    try {
      const contractFiles = generateContracts(domain);
      allFiles.push(...contractFiles);
    } catch (e) {
      errors.push(`Contract generation failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Step 5: Generate project scaffold ───────────────────────────────────────
  try {
    const scaffoldFiles = generateScaffold(domain, stack, projectName);
    allFiles.push(...scaffoldFiles);
  } catch (e) {
    errors.push(`Scaffold generation failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Step 6: Compute stats ───────────────────────────────────────────────────
  const stats = computeStats(domain, allFiles);

  return {
    success: errors.length === 0,
    projectName,
    files: allFiles,
    errors,
    warnings,
    duration: Date.now() - start,
    stats,
  };
}

/**
 * Generate a complete full-stack application from a parsed ISL Domain.
 * Use this if you've already parsed the spec.
 */
export function shipFromDomain(domain: Domain, options: Omit<ShipOptions, 'specPath'>): ShipResult {
  const start = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  const allFiles: GeneratedFile[] = [];

  const stack = resolveStack(options.stack);
  const projectName = options.projectName ?? domain.name.name;

  try { allFiles.push(...generatePrismaSchema(domain, stack)); } catch (e) {
    errors.push(`Database generation failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  try { allFiles.push(...generateBackend(domain, stack)); } catch (e) {
    errors.push(`Backend generation failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (stack.runtime) {
    try { allFiles.push(...generateContracts(domain)); } catch (e) {
      errors.push(`Contract generation failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  try { allFiles.push(...generateScaffold(domain, stack, projectName)); } catch (e) {
    errors.push(`Scaffold generation failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    success: errors.length === 0,
    projectName,
    files: allFiles,
    errors,
    warnings,
    duration: Date.now() - start,
    stats: computeStats(domain, allFiles),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStats(domain: Domain, files: GeneratedFile[]): ShipStats {
  return {
    entities: domain.entities.length,
    behaviors: domain.behaviors.length,
    endpoints: domain.apis.reduce((sum, api) => sum + api.endpoints.length, 0),
    screens: domain.screens.length,
    events: domain.events.length,
    workflows: domain.workflows.length,
    totalFiles: files.length,
  };
}

function emptyStats(): ShipStats {
  return { entities: 0, behaviors: 0, endpoints: 0, screens: 0, events: 0, workflows: 0, totalFiles: 0 };
}
