/**
 * PR Analysis - Spec Matcher
 *
 * Finds ISL spec files that correspond to changed source files.
 * Uses naming conventions and directory proximity to match specs.
 *
 * @module @isl-lang/gate/pr-analysis
 */

import { readdir } from 'fs/promises';
import { join, basename, dirname, relative } from 'path';

// ============================================================================
// Spec Discovery
// ============================================================================

/**
 * Recursively discover all `.isl` spec files under a root directory.
 */
export async function discoverSpecs(root: string): Promise<string[]> {
  const specs: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: import('fs').Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // skip unreadable directories
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, dist, .git, etc.
        if (/^(node_modules|dist|\.git|\.next|coverage|build)$/.test(entry.name)) {
          continue;
        }
        await walk(fullPath);
      } else if (entry.name.endsWith('.isl')) {
        // Store relative path from root
        specs.push(relative(root, fullPath).replace(/\\/g, '/'));
      }
    }
  }

  await walk(root);
  return specs;
}

// ============================================================================
// Spec Matching
// ============================================================================

/**
 * Find the best matching ISL spec for a given source file path.
 *
 * Matching strategies (in priority order):
 * 1. **Exact name match**: `src/payments/charge.ts` → `charge.isl`
 * 2. **Co-located spec**: `src/payments/charge.ts` → `src/payments/charge.isl`
 * 3. **Directory match**: `src/payments/charge.ts` → `payments.isl`
 * 4. **Parent directory match**: `src/payments/refund.ts` → `specs/payments.isl`
 *
 * @returns The matching spec path, or undefined if no match found.
 */
export function findMatchingSpec(
  filePath: string,
  availableSpecs: string[],
): string | undefined {
  if (availableSpecs.length === 0) return undefined;

  const fileBase = stripExtension(basename(filePath));
  const fileDir = dirname(filePath).replace(/\\/g, '/');

  // Strategy 1: Exact basename match (e.g. charge.ts → charge.isl)
  const exactMatch = availableSpecs.find((spec) => {
    const specBase = stripExtension(basename(spec));
    return specBase === fileBase;
  });
  if (exactMatch) return exactMatch;

  // Strategy 2: Co-located (same directory)
  const colocated = availableSpecs.find((spec) => {
    const specDir = dirname(spec).replace(/\\/g, '/');
    const specBase = stripExtension(basename(spec));
    return specDir === fileDir && specBase === fileBase;
  });
  if (colocated) return colocated;

  // Strategy 3: Directory name match (e.g. src/payments/charge.ts → payments.isl)
  const dirSegments = fileDir.split('/').filter(Boolean);
  for (let i = dirSegments.length - 1; i >= 0; i--) {
    const segment = dirSegments[i];
    const dirMatch = availableSpecs.find((spec) => {
      const specBase = stripExtension(basename(spec));
      return specBase === segment;
    });
    if (dirMatch) return dirMatch;
  }

  // Strategy 4: Spec path contains a parent directory segment matching the file's directory
  const parentMatch = availableSpecs.find((spec) => {
    const specDir = dirname(spec).replace(/\\/g, '/');
    return dirSegments.some((seg) => specDir.includes(seg));
  });
  if (parentMatch) return parentMatch;

  return undefined;
}

/**
 * Find all specs affected by the set of changed file paths.
 */
export function findAffectedSpecs(
  changedPaths: string[],
  availableSpecs: string[],
): string[] {
  const affected = new Set<string>();

  for (const filePath of changedPaths) {
    // If the file itself is a spec, it's affected
    if (filePath.endsWith('.isl')) {
      affected.add(filePath);
      continue;
    }

    const spec = findMatchingSpec(filePath, availableSpecs);
    if (spec) {
      affected.add(spec);
    }
  }

  return [...affected];
}

// ============================================================================
// Utilities
// ============================================================================

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}
