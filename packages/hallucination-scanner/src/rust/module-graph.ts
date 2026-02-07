/**
 * Build Rust module graph from source files
 * @module @isl-lang/hallucination-scanner/rust/module-graph
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseUseStatements, externalCratesFromUses } from './use-parser.js';
import type { RustModuleGraph, RustModuleNode, RustUse, SourceLocation } from './types.js';

export interface ModuleGraphOptions {
  projectRoot: string;
  /** Entry files (e.g. ['src/main.rs', 'src/lib.rs']) */
  entries?: string[] | undefined;
  readFile?: ((filePath: string) => Promise<string>) | undefined;
  fileExists?: ((filePath: string) => Promise<boolean>) | undefined;
}

const defaultReadFile = (p: string) => fs.readFile(p, 'utf-8');
const defaultFileExists = async (p: string) => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/');
}

/**
 * Regex to match `mod` declarations (not inline mod blocks with body).
 * Matches: mod foo; pub mod foo; pub(crate) mod foo;
 * Does NOT match: mod foo { ... } (inline module with body)
 */
const MOD_DECL = /^\s*(?:pub(?:\s*\([^)]*\))?\s+)?mod\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/gm;

/**
 * Parse `mod` declarations from Rust source (only file-backed mods, not inline blocks)
 */
export function parseModDeclarations(source: string): string[] {
  const mods: string[] = [];
  MOD_DECL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MOD_DECL.exec(source)) !== null) {
    mods.push(match[1]);
  }
  return mods;
}

/**
 * Resolve a mod declaration to a file path.
 * Rust module resolution:
 *   mod foo; in src/main.rs  -> src/foo.rs OR src/foo/mod.rs
 *   mod bar; in src/foo.rs   -> src/foo/bar.rs OR src/foo/bar/mod.rs
 *   mod bar; in src/foo/mod.rs -> src/foo/bar.rs OR src/foo/bar/mod.rs
 */
async function resolveModPath(
  parentFile: string,
  modName: string,
  fileExists: (p: string) => Promise<boolean>,
): Promise<string | null> {
  const parentDir = path.dirname(parentFile);
  const parentBase = path.basename(parentFile, '.rs');

  // If parent is mod.rs or main.rs or lib.rs, child is sibling
  const isRoot = parentBase === 'mod' || parentBase === 'main' || parentBase === 'lib';
  const searchDir = isRoot ? parentDir : path.join(parentDir, parentBase);

  // Try <searchDir>/<modName>.rs
  const flat = normalizePath(path.join(searchDir, `${modName}.rs`));
  if (await fileExists(flat)) return flat;

  // Try <searchDir>/<modName>/mod.rs
  const nested = normalizePath(path.join(searchDir, modName, 'mod.rs'));
  if (await fileExists(nested)) return nested;

  return null;
}

/**
 * Discover .rs files under a directory (e.g. src/)
 */
async function discoverRsFiles(
  dir: string,
  fileExists: (p: string) => Promise<boolean>,
  readDir: (p: string) => Promise<string[]>
): Promise<string[]> {
  const result: string[] = [];
  try {
    const entries = await readDir(dir);
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const full = path.join(dir, name);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat) continue;
      if (stat.isFile() && name.endsWith('.rs')) {
        result.push(normalizePath(full));
      } else if (stat.isDirectory()) {
        result.push(...(await discoverRsFiles(full, fileExists, readDir)));
      }
    }
  } catch {
    // ignore
  }
  return result;
}

/**
 * Build module graph: for each .rs file under projectRoot/src (or entries),
 * parse use statements and collect external crates.
 */
export async function buildRustModuleGraph(options: ModuleGraphOptions): Promise<RustModuleGraph> {
  const projectRoot = normalizePath(path.resolve(options.projectRoot));
  const readFile = options.readFile ?? defaultReadFile;
  const fileExists = options.fileExists ?? defaultFileExists;

  const nodes = new Map<string, RustModuleNode>();
  const externalCrateRefs = new Set<string>();

  const srcDir = path.join(projectRoot, 'src');
  let filePaths: string[] = options.entries ?? [];

  if (filePaths.length === 0) {
    const hasSrc = await fileExists(srcDir);
    if (hasSrc) {
      filePaths = await discoverRsFiles(srcDir, fileExists, (p) => fs.readdir(p));
    }
    if (filePaths.length === 0) {
      return { entries: [], nodes, externalCrateRefs };
    }
  }

  const entries: string[] = [];
  for (const filePath of filePaths) {
    const normalized = normalizePath(path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath));
    if (path.basename(normalized) === 'main.rs' || path.basename(normalized) === 'lib.rs') {
      entries.push(normalized);
    }
  }
  if (entries.length === 0 && filePaths.length > 0) {
    entries.push(normalizePath(path.isAbsolute(filePaths[0]) ? filePaths[0] : path.join(projectRoot, filePaths[0])));
  }

  for (const filePath of filePaths) {
    const normalized = normalizePath(path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath));
    let source: string;
    try {
      source = await readFile(normalized);
    } catch {
      continue;
    }

    const uses = parseUseStatements(source, normalized);
    const externalCrates = externalCratesFromUses(uses);

    for (const c of externalCrates) {
      externalCrateRefs.add(c);
    }

    const modDecls = parseModDeclarations(source);
    const children: string[] = [];

    for (const modName of modDecls) {
      const resolved = await resolveModPath(normalized, modName, fileExists);
      if (resolved) {
        children.push(resolved);
      }
    }

    nodes.set(normalized, {
      path: normalized,
      uses,
      externalCrates,
      children,
    });
  }

  return {
    entries,
    nodes,
    externalCrateRefs,
  };
}

/**
 * Find modules that are never reached from any entry (unreachable from main/lib)
 * A node is reachable if it's an entry or is a child (mod) of a reachable node.
 * We don't resolve mod declarations here; "unreachable" in this scanner means
 * the module file is not in the dependency set of any entry. For a simple
 * implementation we only flag external crate use that's missing; unreachable
 * can be "imports that reference a path that doesn't exist in the crate".
 */
export function findUnreachableModules(
  graph: RustModuleGraph,
  _options?: { fromEntries?: boolean }
): Set<string> {
  const reached = new Set<string>();
  const queue = [...graph.entries];

  while (queue.length > 0) {
    const p = queue.shift()!;
    if (reached.has(p)) continue;
    reached.add(p);
    const node = graph.nodes.get(p);
    if (node) {
      for (const child of node.children) {
        queue.push(child);
      }
    }
  }

  const unreachable = new Set<string>();
  for (const [p] of graph.nodes) {
    if (!reached.has(p) && !graph.entries.includes(p)) {
      unreachable.add(p);
    }
  }
  return unreachable;
}
