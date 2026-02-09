/**
 * Rust resolver - Cargo-aware dependency checks and module graph
 * @module @isl-lang/hallucination-scanner/rust/resolver
 */

import * as path from 'node:path';
import { loadCargoManifest, getDeclaredCrates } from './cargo.js';
import { buildRustModuleGraph, findUnreachableModules } from './module-graph.js';
import type {
  RustDependencyCheckResult,
  RustFinding,
  RustModuleGraph,
  RustUse,
  SourceLocation,
} from './types.js';

export interface RustResolverOptions {
  projectRoot: string;
  /** Optional entry files; otherwise discovers all .rs files under src/ */
  entries?: string[];
  readFile?: (filePath: string) => Promise<string>;
  fileExists?: (filePath: string) => Promise<boolean>;
}

/**
 * Run the full Rust resolver: load Cargo.toml, build module graph, detect
 * missing crates, fake modules, unreachable imports, and compute trust score.
 */
export async function resolveRust(options: RustResolverOptions): Promise<RustDependencyCheckResult> {
  const projectRoot = path.resolve(options.projectRoot);
  const manifest = await loadCargoManifest(projectRoot);
  const declaredCrates = manifest ? getDeclaredCrates(manifest) : new Set<string>();

  const graph = await buildRustModuleGraph({
    projectRoot,
    entries: options.entries,
    readFile: options.readFile,
    fileExists: options.fileExists,
  });

  const findings: RustFinding[] = [];
  const missingCrateSet = new Set<string>();

  // 1) Missing crates: used in code but not in Cargo.toml
  for (const crateName of graph.externalCrateRefs) {
    if (!declaredCrates.has(crateName)) {
      missingCrateSet.add(crateName);
      const firstLocation = findFirstUseLocation(graph, crateName);
      findings.push({
        kind: 'missing_crate',
        message: `Crate "${crateName}" is used but not declared in Cargo.toml`,
        crate: crateName,
        location: firstLocation,
        suggestion: `Add to Cargo.toml: [dependencies]\n${crateName} = "..."`,
      });
    }
  }

  // 2) Fake module: use crate::foo::bar where foo is not a known module in the crate
  const knownModules = buildKnownModuleSet(graph);
  for (const [, node] of graph.nodes) {
    for (const u of node.uses) {
      if (u.isCrate) {
        const segments = u.path.split('::');
        // crate::foo::bar => check that "foo" is a known module
        if (segments.length >= 2) {
          const firstMod = segments[1];
          if (firstMod && !knownModules.has(firstMod)) {
            findings.push({
              kind: 'fake_module',
              message: `Module "${firstMod}" referenced via crate::${firstMod} does not exist in the module tree`,
              path: u.path,
              location: u.location,
              suggestion: `Ensure "mod ${firstMod};" is declared in lib.rs/main.rs, or check for typos`,
            });
          }
        }
      }
    }
  }

  // 3) Unreachable imports: modules never reached from main/lib
  const unreachable = findUnreachableModules(graph);
  for (const modulePath of unreachable) {
    const node = graph.nodes.get(modulePath);
    if (node && node.uses.length > 0) {
      const firstUse = node.uses[0];
      if (firstUse) {
        findings.push({
          kind: 'unreachable_import',
          message: `Module is not reachable from crate entry points (main.rs/lib.rs)`,
          path: modulePath,
          location: firstUse.location,
          suggestion: 'Ensure this module is included via mod declarations from lib.rs or main.rs',
        });
      }
    }
  }

  const missingCrates = Array.from(missingCrateSet);
  const trustScore = computeTrustScoreFromFindings(findings, graph);

  return {
    success: findings.length === 0,
    manifest,
    graph,
    findings,
    declaredCrates,
    missingCrates,
    trustScore,
  };
}

/**
 * Build set of known module names from the graph's children.
 * A module name is derived from the file path: src/foo.rs -> "foo", src/bar/mod.rs -> "bar"
 */
function buildKnownModuleSet(graph: RustModuleGraph): Set<string> {
  const known = new Set<string>();
  for (const [, node] of graph.nodes) {
    for (const childPath of node.children) {
      const base = path.basename(childPath, '.rs');
      if (base === 'mod') {
        // src/foo/mod.rs => module name is parent dir name
        known.add(path.basename(path.dirname(childPath)));
      } else {
        // src/foo.rs => module name is "foo"
        known.add(base);
      }
    }
  }
  return known;
}

/**
 * Find the first source location where a given crate is used in the graph
 */
function findFirstUseLocation(graph: RustModuleGraph, crateName: string): SourceLocation {
  for (const [, node] of graph.nodes) {
    for (const u of node.uses) {
      if (u.root === crateName) {
        return u.location;
      }
    }
  }
  return { file: 'unknown', line: 1, column: 1 };
}

/**
 * Compute 0-100 trust score from findings (100 = no issues)
 */
function computeTrustScoreFromFindings(findings: RustFinding[], _graph: RustModuleGraph): number {
  if (findings.length === 0) {
    return 100;
  }

  let penalty = 0;
  for (const f of findings) {
    switch (f.kind) {
      case 'missing_crate':
        penalty += 25;
        break;
      case 'fake_module':
        penalty += 20;
        break;
      case 'unreachable_import':
        penalty += 10;
        break;
      default:
        penalty += 15;
    }
  }

  const score = Math.max(0, 100 - penalty);
  return Math.min(100, score);
}

/**
 * Scan a single Rust file (no Cargo.toml required); returns uses and optional
 * dependency check if manifest is found.
 */
export async function scanRustFile(
  filePath: string,
  content: string,
  options?: { projectRoot?: string }
): Promise<{
  uses: RustUse[];
  externalCrates: string[];
  checkResult?: RustDependencyCheckResult;
}> {
  const { parseUseStatements, externalCratesFromUses } = await import('./use-parser.js');
  const uses = parseUseStatements(content, filePath);
  const externalCrates = Array.from(externalCratesFromUses(uses));

  const projectRoot = options?.projectRoot ?? path.dirname(filePath);
  const checkResult = await resolveRust({
    projectRoot,
    entries: [filePath],
    readFile: async (p) => (path.normalize(p) === path.normalize(filePath) ? content : (await import('node:fs/promises')).readFile(p, 'utf-8')),
    fileExists: async (p) => {
      if (path.normalize(p) === path.normalize(filePath)) return true;
      try {
        await (await import('node:fs/promises')).access(p);
        return true;
      } catch {
        return false;
      }
    },
  });

  return { uses, externalCrates, checkResult };
}
