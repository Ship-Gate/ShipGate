/**
 * Go resolver — go.mod-aware dependency checks and ghost import detection
 * @module @isl-lang/hallucination-scanner/go/go-resolver
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { isGoStdlib, hasStdlibPrefix } from './stdlib.js';
import type {
  GoImport,
  GoFinding,
  GoModInfo,
  GoDependencyCheckResult,
  SourceLocation,
} from './types.js';

export interface GoResolverOptions {
  projectRoot: string;
  /** Optional entry files; otherwise discovers all .go files */
  entries?: string[] | undefined;
  /** Custom file reader (for testing) */
  readFile?: ((filePath: string) => Promise<string>) | undefined;
  /** Custom file existence check (for testing) */
  fileExists?: ((filePath: string) => Promise<boolean>) | undefined;
  /** Custom go.mod content provider (for testing) */
  goModContent?: string | undefined;
}

// ---- go.mod parsing (inline, no circular dep on firewall) ----

/**
 * Tokenize a single line: strip // comment, then split on whitespace.
 */
function tokenizeLine(line: string): string[] {
  const comment = line.indexOf('//');
  const content = comment >= 0 ? line.slice(0, comment).trim() : line.trim();
  if (!content) return [];
  return content.split(/\s+/);
}

/**
 * Parse go.mod content into GoModInfo.
 */
function parseGoMod(content: string, dir: string): GoModInfo | null {
  const lines = content.split(/\n/);
  let modulePath = '';
  let goVersion: string | undefined;
  const require = new Map<string, string>();
  const replace = new Map<string, string>();

  let i = 0;
  while (i < lines.length) {
    const tokens = tokenizeLine(lines[i] ?? '');
    i++;

    if (tokens.length === 0) continue;

    const directive = tokens[0];
    if (directive === 'module') {
      if (tokens.length >= 2) modulePath = tokens[1]!;
      continue;
    }

    if (directive === 'go') {
      if (tokens.length >= 2) goVersion = tokens[1];
      continue;
    }

    if (directive === 'require') {
      if (tokens.length >= 3) {
        require.set(tokens[1]!, tokens[2]!);
      } else if (tokens.length === 1 && i < lines.length && lines[i]?.trim() === '(') {
        i++;
        while (i < lines.length) {
          const blockTokens = tokenizeLine(lines[i] ?? '');
          i++;
          if (blockTokens.length >= 1 && blockTokens[0] === ')') break;
          if (blockTokens.length >= 2) {
            require.set(blockTokens[0]!, blockTokens[1]!);
          }
        }
      } else if (tokens.length === 2 && tokens[1] === '(') {
        while (i < lines.length) {
          const blockTokens = tokenizeLine(lines[i] ?? '');
          i++;
          if (blockTokens.length >= 1 && blockTokens[0] === ')') break;
          if (blockTokens.length >= 2) {
            require.set(blockTokens[0]!, blockTokens[1]!);
          }
        }
      }
      continue;
    }

    if (directive === 'replace') {
      if (tokens.length >= 4 && tokens[2] === '=>') {
        replace.set(tokens[1]!, tokens[3]!);
      } else if (tokens.length === 1) {
        if (i < lines.length && lines[i]?.trim() === '(') {
          i++;
          while (i < lines.length) {
            const blockTokens = tokenizeLine(lines[i] ?? '');
            i++;
            if (blockTokens.length >= 1 && blockTokens[0] === ')') break;
            if (blockTokens.length >= 4 && blockTokens[2] === '=>') {
              replace.set(blockTokens[0]!, blockTokens[3]!);
            }
          }
        }
      }
      continue;
    }
  }

  if (!modulePath) return null;

  return { modulePath, goVersion, require, replace, dir };
}

// ---- Import extraction using tree-sitter ----

interface TreeSitterImportSpec {
  path: string;
  startIndex: number;
  endIndex: number;
  line: number;
  column: number;
}

/**
 * Parse Go source and extract imports using tree-sitter-go.
 * Falls back to a lightweight AST-based extractor if tree-sitter is unavailable.
 */
async function extractGoImports(
  source: string,
  filePath: string
): Promise<TreeSitterImportSpec[]> {
  try {
    // Dynamic import to avoid hard dep — tree-sitter may not be installed
    const ParserMod = await import('tree-sitter');
    const GoMod = await import('tree-sitter-go');

    const Parser = ParserMod.default ?? ParserMod;
    const Go = GoMod.default ?? GoMod;

    const parser = new Parser();
    parser.setLanguage(Go as unknown as InstanceType<typeof Parser>['getLanguage'] extends () => infer L ? L : never);

    const tree = parser.parse(source);
    const imports: TreeSitterImportSpec[] = [];

    const walk = (node: { type: string; childCount: number; child: (i: number) => typeof node | null; startIndex: number; endIndex: number }): void => {
      if (node.type === 'import_declaration') {
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (!child) continue;
          if (child.type === 'import_spec') {
            const spec = collectSpec(source, child);
            if (spec) imports.push(spec);
          } else if (child.type === 'import_spec_list') {
            for (let j = 0; j < child.childCount; j++) {
              const specNode = child.child(j);
              if (specNode?.type === 'import_spec') {
                const spec = collectSpec(source, specNode);
                if (spec) imports.push(spec);
              }
            }
          }
        }
        return; // no need to recurse into import_declaration children further
      }
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) walk(child);
      }
    };

    walk(tree.rootNode);
    return imports;
  } catch {
    // Fallback: lightweight import extraction without tree-sitter
    return extractGoImportsFallback(source, filePath);
  }
}

/**
 * Fallback import extraction using Go import grammar patterns.
 * NOT regex-only: uses structured block parsing for import ( ... ) groups.
 */
function extractGoImportsFallback(source: string, _filePath: string): TreeSitterImportSpec[] {
  const imports: TreeSitterImportSpec[] = [];
  const lines = source.split('\n');

  let inImportBlock = false;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    const trimmed = line.trim();

    // Single-line: import "path"
    if (trimmed.startsWith('import ') && !trimmed.includes('(')) {
      const match = trimmed.match(/^import\s+(?:\w+\s+)?"([^"]+)"/);
      if (match?.[1]) {
        const col = line.indexOf('"') + 1;
        imports.push({
          path: match[1],
          startIndex: sourceOffset(lines, lineIdx, col),
          endIndex: sourceOffset(lines, lineIdx, col + match[1].length + 2),
          line: lineIdx + 1,
          column: col + 1,
        });
      }
      continue;
    }

    // Start of import block
    if (trimmed === 'import (' || trimmed.startsWith('import (')) {
      inImportBlock = true;
      continue;
    }

    if (inImportBlock) {
      if (trimmed === ')') {
        inImportBlock = false;
        continue;
      }
      // Match lines like:  "fmt"  or  alias "path/to/pkg"
      const match = trimmed.match(/^(?:\w+\s+)?"([^"]+)"/);
      if (match?.[1]) {
        const col = line.indexOf('"') + 1;
        imports.push({
          path: match[1],
          startIndex: sourceOffset(lines, lineIdx, col),
          endIndex: sourceOffset(lines, lineIdx, col + match[1].length + 2),
          line: lineIdx + 1,
          column: col + 1,
        });
      }
    }
  }

  return imports;
}

function sourceOffset(lines: string[], lineIdx: number, col: number): number {
  let offset = 0;
  for (let i = 0; i < lineIdx; i++) {
    offset += (lines[i]?.length ?? 0) + 1; // +1 for newline
  }
  return offset + col;
}

function collectSpec(
  source: string,
  node: { childCount: number; child: (i: number) => { type: string; startIndex: number; endIndex: number; childCount: number; child: (i: number) => unknown } | null }
): TreeSitterImportSpec | null {
  for (let i = 0; i < node.childCount; i++) {
    const c = node.child(i);
    if (!c) continue;
    if (c.type === 'interpreted_string_literal' || c.type === 'raw_string_literal') {
      const raw = source.slice(c.startIndex, c.endIndex);
      const importPath = stripQuotes(raw);
      const before = source.slice(0, c.startIndex);
      const line = (before.match(/\n/g) ?? []).length + 1;
      const lastNewline = before.lastIndexOf('\n');
      const column = lastNewline === -1 ? c.startIndex + 1 : c.startIndex - lastNewline;
      return {
        path: importPath,
        startIndex: c.startIndex,
        endIndex: c.endIndex,
        line,
        column,
      };
    }
  }
  return null;
}

function stripQuotes(raw: string): string {
  if (raw.length < 2) return raw;
  const q = raw[0];
  if (q === '"' || q === '`') return raw.slice(1, -1);
  return raw;
}

// ---- Import classification ----

/**
 * Classify a Go import path: stdlib, internal (same module), or external.
 */
function classifyImport(
  importPath: string,
  goMod: GoModInfo | null
): Pick<GoImport, 'isStdlib' | 'isInternal' | 'isExternal' | 'moduleRoot'> {
  // 1. Check stdlib
  if (isGoStdlib(importPath)) {
    return { isStdlib: true, isInternal: false, isExternal: false };
  }

  // 2. Check internal (belongs to current module)
  if (goMod && importPath.startsWith(goMod.modulePath + '/')) {
    return { isStdlib: false, isInternal: true, isExternal: false };
  }
  if (goMod && importPath === goMod.modulePath) {
    return { isStdlib: false, isInternal: true, isExternal: false };
  }

  // 3. External — find module root from go.mod require
  let moduleRoot: string | undefined;
  if (goMod) {
    for (const [modPath] of goMod.require) {
      if (importPath === modPath || importPath.startsWith(modPath + '/')) {
        moduleRoot = modPath;
        break;
      }
    }
  }

  return { isStdlib: false, isInternal: false, isExternal: true, moduleRoot };
}

// ---- File discovery ----

async function discoverGoFiles(
  projectRoot: string,
): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip vendor, .git, testdata, node_modules
        if (['vendor', '.git', 'testdata', 'node_modules'].includes(entry.name)) continue;
        await walk(fullPath);
      } else if (entry.name.endsWith('.go')) {
        results.push(fullPath);
      }
    }
  }

  await walk(projectRoot);
  return results;
}

// ---- Main resolver ----

/**
 * Run the full Go resolver: load go.mod, parse Go files, detect
 * missing modules, fake packages, unknown stdlib, and compute trust score.
 */
export async function resolveGo(options: GoResolverOptions): Promise<GoDependencyCheckResult> {
  const projectRoot = path.resolve(options.projectRoot);
  const readFileFn = options.readFile ?? ((p: string) => fs.readFile(p, 'utf-8'));
  const fileExistsFn = options.fileExists ?? (async (p: string) => {
    try { await fs.access(p); return true; } catch { return false; }
  });

  // 1. Load go.mod
  let goMod: GoModInfo | null = null;
  if (options.goModContent) {
    goMod = parseGoMod(options.goModContent, projectRoot);
  } else {
    const goModPath = path.join(projectRoot, 'go.mod');
    if (await fileExistsFn(goModPath)) {
      const content = await readFileFn(goModPath);
      goMod = parseGoMod(content, projectRoot);
    }
  }

  const declaredModules = new Set<string>();
  if (goMod) {
    for (const [modPath] of goMod.require) {
      declaredModules.add(modPath);
    }
  }

  // 2. Discover and parse Go files
  const files = options.entries ?? await discoverGoFiles(projectRoot);
  const allImports: GoImport[] = [];
  const findings: GoFinding[] = [];
  const seenExternalModules = new Set<string>();

  for (const file of files) {
    let source: string;
    try {
      source = await readFileFn(file);
    } catch {
      continue;
    }

    const rawImports = await extractGoImports(source, file);

    for (const raw of rawImports) {
      const classification = classifyImport(raw.path, goMod);
      const location: SourceLocation = {
        file,
        line: raw.line,
        column: raw.column,
      };

      const goImport: GoImport = {
        path: raw.path,
        ...classification,
        location,
      };
      allImports.push(goImport);

      // ---- Finding detection ----

      // A) Unknown stdlib: looks like stdlib prefix but not in known list
      if (!classification.isStdlib && hasStdlibPrefix(raw.path)) {
        findings.push({
          kind: 'unknown_stdlib',
          message: `Import "${raw.path}" looks like a stdlib package but is not in the known Go stdlib`,
          importPath: raw.path,
          location,
          suggestion: `Check for typos — did you mean a known stdlib package under "${raw.path.split('/')[0]}"?`,
        });
        continue;
      }

      if (classification.isStdlib) continue; // known stdlib, no issues

      // B) Internal: verify package directory exists on disk
      if (classification.isInternal && goMod) {
        const relPath = raw.path.slice(goMod.modulePath.length + 1);
        const pkgDir = path.join(projectRoot, relPath);
        if (!(await fileExistsFn(pkgDir))) {
          findings.push({
            kind: 'unresolved_internal',
            message: `Internal package "${raw.path}" does not exist at ${relPath}`,
            importPath: raw.path,
            location,
            suggestion: `Create the package directory "${relPath}" or fix the import path`,
          });
        }
        continue;
      }

      // C) External: check if module is in go.mod
      if (classification.isExternal) {
        if (classification.moduleRoot) {
          seenExternalModules.add(classification.moduleRoot);
        } else {
          // No matching module in go.mod
          const guessedRoot = guessModuleRoot(raw.path);
          seenExternalModules.add(guessedRoot);

          if (goMod) {
            // go.mod exists but module not declared
            findings.push({
              kind: 'missing_module',
              message: `Module for "${raw.path}" is not declared in go.mod`,
              importPath: raw.path,
              moduleRoot: guessedRoot,
              location,
              suggestion: `Run: go get ${guessedRoot}`,
            });
          } else {
            // No go.mod at all — flag as fake/unverifiable
            findings.push({
              kind: 'fake_package',
              message: `Import "${raw.path}" cannot be verified — no go.mod found in project`,
              importPath: raw.path,
              moduleRoot: guessedRoot,
              location,
              suggestion: `Initialize the module: go mod init <module-path>`,
            });
          }
        }
      }
    }
  }

  const missingModules = Array.from(seenExternalModules).filter(m => !declaredModules.has(m));
  const trustScore = computeTrustScore(findings);

  return {
    success: findings.length === 0,
    goMod,
    imports: allImports,
    findings,
    declaredModules,
    missingModules,
    trustScore,
  };
}

/**
 * Guess the module root from an import path.
 * For "github.com/foo/bar/baz" -> "github.com/foo/bar"
 * For "golang.org/x/text/transform" -> "golang.org/x/text"
 */
function guessModuleRoot(importPath: string): string {
  const parts = importPath.split('/');
  // github.com, gitlab.com, bitbucket.org patterns: host/owner/repo
  if (parts.length >= 3 && (parts[0]?.includes('.') ?? false)) {
    return parts.slice(0, 3).join('/');
  }
  // golang.org/x/foo -> 3 parts
  if (parts.length >= 3) {
    return parts.slice(0, 3).join('/');
  }
  return importPath;
}

/**
 * Compute 0-100 trust score from findings (100 = no issues)
 */
function computeTrustScore(findings: GoFinding[]): number {
  if (findings.length === 0) return 100;

  let penalty = 0;
  for (const f of findings) {
    switch (f.kind) {
      case 'missing_module':
        penalty += 25;
        break;
      case 'fake_package':
        penalty += 30;
        break;
      case 'unknown_stdlib':
        penalty += 20;
        break;
      case 'unresolved_internal':
        penalty += 15;
        break;
      default:
        penalty += 15;
    }
  }

  return Math.max(0, Math.min(100, 100 - penalty));
}

/**
 * Scan a single Go file; returns imports and optional dependency check
 * if go.mod is found in the project.
 */
export async function scanGoFile(
  filePath: string,
  content: string,
  options?: { projectRoot?: string }
): Promise<{
  imports: GoImport[];
  findings: GoFinding[];
  checkResult?: GoDependencyCheckResult;
}> {
  const projectRoot = options?.projectRoot ?? path.dirname(filePath);

  const checkResult = await resolveGo({
    projectRoot,
    entries: [filePath],
    readFile: async (p) =>
      path.normalize(p) === path.normalize(filePath)
        ? content
        : fs.readFile(p, 'utf-8'),
    fileExists: async (p) => {
      if (path.normalize(p) === path.normalize(filePath)) return true;
      try {
        await fs.access(p);
        return true;
      } catch {
        return false;
      }
    },
  });

  return {
    imports: checkResult.imports,
    findings: checkResult.findings,
    checkResult,
  };
}
