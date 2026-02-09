#!/usr/bin/env npx tsx
/**
 * Prioritized Backlog Generator
 * 
 * Ranks packages by dependency importance and product impact to generate
 * a prioritized completion backlog.
 * 
 * Usage:
 *   npx tsx scripts/completeness-backlog.ts
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  PackageCompleteness,
  PrioritizedBacklog,
  CompletionStatus,
} from './completeness-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const packagesDir = join(rootDir, 'packages');
const reportsDir = join(rootDir, 'reports');

// ---------------------------------------------------------------------------
// Load experimental.json for core package detection
// ---------------------------------------------------------------------------

interface ExperimentalConfig {
  production: Record<string, string[]>;
  partial: Record<string, string[]>;
  experimental: Record<string, string[]>;
  internal: { packages: string[] };
  [key: string]: unknown;
}

const expCfg: ExperimentalConfig = JSON.parse(
  readFileSync(join(rootDir, 'experimental.json'), 'utf-8'),
);

function flattenCategory(cat: Record<string, string[] | unknown>): string[] {
  const out: string[] = [];
  for (const v of Object.values(cat)) {
    if (Array.isArray(v)) out.push(...v);
  }
  return out;
}

const productionPackages = new Set(flattenCategory(expCfg.production));
const corePackages = new Set(expCfg.production.core ?? []);

// ---------------------------------------------------------------------------
// Build dependency graph
// ---------------------------------------------------------------------------

function extractDependencies(pkgJson: Record<string, unknown>): string[] {
  const deps: string[] = [];
  
  const allDeps = {
    ...((pkgJson.dependencies ?? {}) as Record<string, string>),
    ...((pkgJson.devDependencies ?? {}) as Record<string, string>),
    ...((pkgJson.peerDependencies ?? {}) as Record<string, string>),
  };

  for (const [name, version] of Object.entries(allDeps)) {
    // Only track workspace dependencies
    if (version.startsWith('workspace:') || name.startsWith('@isl-lang/')) {
      deps.push(name);
    }
  }

  return deps;
}

function buildDependencyGraph(): Map<string, { dependents: string[]; dependencies: string[] }> {
  const graph = new Map<string, { dependents: string[]; dependencies: string[] }>();

  const dirs = readdirSync(packagesDir).filter((d) => {
    const full = join(packagesDir, d);
    return statSync(full).isDirectory();
  });

  for (const dirName of dirs) {
    const pkgJsonPath = join(packagesDir, dirName, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;

    try {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) as Record<string, unknown>;
      const name = (pkgJson.name as string) ?? `@isl-lang/${dirName}`;
      
      if (!graph.has(name)) {
        graph.set(name, { dependents: [], dependencies: [] });
      }

      const deps = extractDependencies(pkgJson);
      graph.get(name)!.dependencies = deps;

      // Build reverse graph (dependents)
      for (const dep of deps) {
        if (!graph.has(dep)) {
          graph.set(dep, { dependents: [], dependencies: [] });
        }
        graph.get(dep)!.dependents.push(name);
      }
    } catch {
      // Skip invalid packages
    }
  }

  return graph;
}

// ---------------------------------------------------------------------------
// Calculate priority score
// ---------------------------------------------------------------------------

function calculatePriority(
  pkgName: string,
  status: CompletionStatus,
  completeness: PackageCompleteness | null,
  graph: Map<string, { dependents: string[]; dependencies: string[] }>,
): {
  priorityScore: number;
  factors: {
    dependencyCount: number;
    isCore: boolean;
    blocksOthers: boolean;
    productImpact: number;
  };
} {
  const node = graph.get(pkgName) ?? { dependents: [], dependencies: [] };
  const dependencyCount = node.dependents.length;
  const isCore = corePackages.has(pkgName);
  const isProduction = productionPackages.has(pkgName);

  // Check if this package blocks others (has incomplete dependencies)
  let blocksOthers = false;
  if (status !== 'complete') {
    const incompleteDeps = node.dependencies.filter((dep) => {
      const depNode = graph.get(dep);
      if (!depNode) return false;
      // Check if any dependent of this package depends on incomplete packages
      return depNode.dependents.some((dependent) => {
        const dependentNode = graph.get(dependent);
        return dependentNode && dependentNode.dependencies.includes(dep);
      });
    });
    blocksOthers = incompleteDeps.length > 0;
  }

  // Product impact score (0-10)
  // Higher for production packages, core packages, and packages with many dependents
  let productImpact = 0;
  if (isCore) productImpact += 5;
  if (isProduction) productImpact += 3;
  if (dependencyCount > 10) productImpact += 2;
  else if (dependencyCount > 5) productImpact += 1;
  
  // Boost impact if package is incomplete but has many dependents
  if (status !== 'complete' && dependencyCount > 5) {
    productImpact += 2;
  }

  // Priority score combines all factors
  // Higher score = higher priority
  let priorityScore = 0;
  
  // Dependency count weight
  priorityScore += dependencyCount * 2;
  
  // Core package weight
  if (isCore) priorityScore += 50;
  
  // Production package weight
  if (isProduction) priorityScore += 30;
  
  // Blocks others weight
  if (blocksOthers) priorityScore += 20;
  
  // Product impact weight
  priorityScore += productImpact * 3;
  
  // Incomplete packages get higher priority
  if (status === 'shell') priorityScore += 10;
  else if (status === 'partial') priorityScore += 5;

  return {
    priorityScore,
    factors: {
      dependencyCount,
      isCore,
      blocksOthers,
      productImpact: Math.min(10, productImpact),
    },
  };
}

// ---------------------------------------------------------------------------
// Generate prioritized backlog
// ---------------------------------------------------------------------------

function generateBacklog(
  completenessReport: { packages: PackageCompleteness[] },
): PrioritizedBacklog {
  const graph = buildDependencyGraph();
  const prioritized: PrioritizedBacklog['prioritized'] = [];

  for (const pkg of completenessReport.packages) {
    const priority = calculatePriority(
      pkg.name,
      pkg.declaredStatus,
      pkg,
      graph,
    );

    prioritized.push({
      name: pkg.name,
      dir: pkg.dir,
      status: pkg.declaredStatus,
      priorityScore: priority.priorityScore,
      factors: priority.factors,
      missingDeliverables: pkg.missingForComplete,
    });
  }

  // Sort by priority score (descending)
  prioritized.sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    generatedAt: new Date().toISOString(),
    prioritized,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('\n📊 Generating Prioritized Backlog...\n');

  // Load completeness report
  const completenessPath = join(reportsDir, 'completeness.json');
  if (!existsSync(completenessPath)) {
    console.error('❌ completeness.json not found. Run completeness-checker.ts first.');
    process.exit(1);
  }

  const completenessReport = JSON.parse(
    readFileSync(completenessPath, 'utf-8'),
  ) as { packages: PackageCompleteness[] };

  const backlog = generateBacklog(completenessReport);

  // Write backlog
  const backlogPath = join(reportsDir, 'completeness-backlog.json');
  writeFileSync(backlogPath, JSON.stringify(backlog, null, 2) + '\n');

  console.log(`✅ Generated backlog with ${backlog.prioritized.length} packages`);
  console.log(`📄 reports/completeness-backlog.json\n`);

  // Show top 10
  console.log('🔝 Top 10 Priority Packages:');
  console.log('');
  for (let i = 0; i < Math.min(10, backlog.prioritized.length); i++) {
    const item = backlog.prioritized[i];
    console.log(`${i + 1}. ${item.name} (${item.status})`);
    console.log(`   Score: ${item.priorityScore} | Dependents: ${item.factors.dependencyCount} | Core: ${item.factors.isCore ? 'Yes' : 'No'}`);
    if (item.missingDeliverables.length > 0) {
      console.log(`   Missing: ${item.missingDeliverables.join(', ')}`);
    }
    console.log('');
  }
}

main();
