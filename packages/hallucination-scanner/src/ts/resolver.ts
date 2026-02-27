/**
 * TypeScript/JavaScript resolver — package.json-aware dependency checks
 * and ghost import detection.
 *
 * Detects:
 * - Missing packages (used in code but not in package.json)
 * - Phantom packages (no package.json found at all)
 * - Ghost imports (relative imports pointing to non-existent files)
 * - Fake builtins (node:fakemod)
 * - Type-only imports missing from devDependencies
 *
 * @module @isl-lang/hallucination-scanner/ts/resolver
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { parseImports, extractPackageName } from './import-parser.js';
import { isFakeNodeBuiltin } from './builtins.js';
import type {
  TsImport,
  TsFinding,
  TsDependencyCheckResult,
  PackageManifest,
  SourceLocation,
} from './types.js';

export interface TsResolverOptions {
  projectRoot: string;
  /** Optional entry files; otherwise discovers all .ts/.tsx/.js/.jsx/.mjs/.cjs files */
  entries?: string[] | undefined;
  /** Custom file reader (for testing) */
  readFile?: ((filePath: string) => Promise<string>) | undefined;
  /** Custom file existence check (for testing) */
  fileExists?: ((filePath: string) => Promise<boolean>) | undefined;
  /** Custom package.json content (for testing) */
  packageJsonContent?: string | undefined;
  /** Whether to check relative imports resolve to real files (default: true) */
  checkRelativeImports?: boolean | undefined;
}

// ── package.json loading ─────────────────────────────────────────────────

/**
 * Load and parse a package.json manifest.
 */
async function loadPackageManifest(
  projectRoot: string,
  readFileFn: (p: string) => Promise<string>,
  fileExistsFn: (p: string) => Promise<boolean>,
  customContent?: string,
): Promise<PackageManifest | null> {
  if (customContent) {
    try {
      return JSON.parse(customContent) as PackageManifest;
    } catch {
      return null;
    }
  }

  const pkgPath = path.join(projectRoot, 'package.json');
  if (!(await fileExistsFn(pkgPath))) return null;

  try {
    const content = await readFileFn(pkgPath);
    return JSON.parse(content) as PackageManifest;
  } catch {
    return null;
  }
}

/**
 * Get the set of all declared package names from package.json
 * (dependencies + devDependencies + peerDependencies + optionalDependencies).
 */
function getDeclaredPackages(manifest: PackageManifest): Set<string> {
  const pkgs = new Set<string>();
  const sections = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ];
  for (const section of sections) {
    if (section) {
      for (const name of Object.keys(section)) {
        pkgs.add(name);
      }
    }
  }
  return pkgs;
}

// ── File discovery ───────────────────────────────────────────────────────

const TS_JS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.turbo', '.next', 'coverage', '.nuxt']);

async function discoverTsJsFiles(projectRoot: string): Promise<string[]> {
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
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(fullPath);
      } else if (TS_JS_EXTENSIONS.has(path.extname(entry.name))) {
        results.push(fullPath);
      }
    }
  }

  await walk(projectRoot);
  return results;
}

// ── Relative import resolution ───────────────────────────────────────────

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

/**
 * Check if a relative import resolves to a real file.
 * Tries the specifier as-is, then with common extensions, then as directory index.
 */
async function relativeImportExists(
  specifier: string,
  fromFile: string,
  fileExistsFn: (p: string) => Promise<boolean>,
): Promise<boolean> {
  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, specifier);

  // Try exact path
  if (await fileExistsFn(resolved)) return true;

  // Try with extensions
  for (const ext of RESOLVE_EXTENSIONS) {
    if (await fileExistsFn(resolved + ext)) return true;
  }

  return false;
}

// ── Main resolver ────────────────────────────────────────────────────────

/**
 * Run the full TS/JS resolver: load package.json, parse source files, detect
 * missing packages, ghost imports, fake builtins, and compute trust score.
 */
export async function resolveTs(options: TsResolverOptions): Promise<TsDependencyCheckResult> {
  const projectRoot = path.resolve(options.projectRoot);
  const checkRelative = options.checkRelativeImports !== false;
  const readFileFn = options.readFile ?? ((p: string) => fs.readFile(p, 'utf-8'));
  const fileExistsFn = options.fileExists ?? (async (p: string) => {
    try { await fs.access(p); return true; } catch { return false; }
  });

  // 1. Load package.json
  const manifest = await loadPackageManifest(projectRoot, readFileFn, fileExistsFn, options.packageJsonContent);
  const declaredPackages = manifest ? getDeclaredPackages(manifest) : new Set<string>();

  // 2. Discover and parse source files
  const files = options.entries ?? await discoverTsJsFiles(projectRoot);
  const allImports: TsImport[] = [];
  const findings: TsFinding[] = [];
  const seenPackages = new Set<string>();
  const reportedSpecifiers = new Set<string>();

  for (const file of files) {
    let source: string;
    try {
      source = await readFileFn(file);
    } catch {
      continue;
    }

    const fileImports = parseImports(source, file);

    for (const imp of fileImports) {
      allImports.push(imp);

      // ── A) Fake Node.js builtin ─────────────────────────────────
      if (isFakeNodeBuiltin(imp.specifier)) {
        if (!reportedSpecifiers.has(imp.specifier)) {
          reportedSpecifiers.add(imp.specifier);
          findings.push({
            kind: 'unknown_builtin',
            message: `"${imp.specifier}" uses the node: protocol but is not a real Node.js built-in module`,
            specifier: imp.specifier,
            location: imp.location,
            suggestion: `Remove the "node:" prefix or check for typos. Known builtins include: fs, path, crypto, http, etc.`,
          });
        }
        continue;
      }

      // Skip real builtins — no findings needed
      if (imp.isBuiltin) continue;

      // ── B) Relative import — check file exists ──────────────────
      if (imp.isRelative) {
        if (checkRelative) {
          const exists = await relativeImportExists(imp.specifier, file, fileExistsFn);
          if (!exists) {
            findings.push({
              kind: 'ghost_import',
              message: `Relative import "${imp.specifier}" does not resolve to an existing file`,
              specifier: imp.specifier,
              location: imp.location,
              suggestion: `Check the file path — no file found at ${imp.specifier} (tried with .ts, .tsx, .js, .jsx extensions and /index)`,
            });
          }
        }
        continue;
      }

      // ── C) Package import — check package.json ──────────────────
      const pkgName = imp.packageName ?? extractPackageName(imp.specifier);
      if (!pkgName) continue;

      seenPackages.add(pkgName);

      if (!manifest) {
        // No package.json at all
        if (!reportedSpecifiers.has(pkgName)) {
          reportedSpecifiers.add(pkgName);
          findings.push({
            kind: 'phantom_package',
            message: `Package "${pkgName}" cannot be verified — no package.json found in project`,
            specifier: imp.specifier,
            packageName: pkgName,
            location: imp.location,
            suggestion: `Initialize the project: npm init -y`,
          });
        }
        continue;
      }

      if (!declaredPackages.has(pkgName)) {
        if (!reportedSpecifiers.has(pkgName)) {
          reportedSpecifiers.add(pkgName);

          // Type-only import: suggest devDependency
          if (imp.kind === 'import-type') {
            findings.push({
              kind: 'type_only_missing',
              message: `Type-only import "${pkgName}" is not declared in package.json (consider adding to devDependencies)`,
              specifier: imp.specifier,
              packageName: pkgName,
              location: imp.location,
              suggestion: `Run: npm install -D ${pkgName}`,
            });
          } else {
            findings.push({
              kind: 'missing_package',
              message: `Package "${pkgName}" is used in code but not declared in package.json`,
              specifier: imp.specifier,
              packageName: pkgName,
              location: imp.location,
              suggestion: `Run: npm install ${pkgName}`,
            });
          }
        }
      }
    }
  }

  const missingPackages = Array.from(seenPackages).filter(p => !declaredPackages.has(p));
  const trustScore = computeTrustScore(findings);

  return {
    success: findings.length === 0,
    manifest,
    imports: allImports,
    findings,
    declaredPackages,
    missingPackages,
    trustScore,
  };
}

// ── Trust score ──────────────────────────────────────────────────────────

function computeTrustScore(findings: TsFinding[]): number {
  if (findings.length === 0) return 100;

  let penalty = 0;
  for (const f of findings) {
    switch (f.kind) {
      case 'missing_package':
        penalty += 25;
        break;
      case 'phantom_package':
        penalty += 30;
        break;
      case 'ghost_import':
        penalty += 20;
        break;
      case 'unknown_builtin':
        penalty += 20;
        break;
      case 'type_only_missing':
        penalty += 10;
        break;
      default:
        penalty += 15;
    }
  }

  return Math.max(0, Math.min(100, 100 - penalty));
}

// ── Single file scan ─────────────────────────────────────────────────────

/**
 * Scan a single TS/JS file; returns imports and optional dependency check
 * if package.json is found in the project.
 */
export async function scanTsFile(
  filePath: string,
  content: string,
  options?: { projectRoot?: string },
): Promise<{
  imports: TsImport[];
  findings: TsFinding[];
  checkResult?: TsDependencyCheckResult;
}> {
  const projectRoot = options?.projectRoot ?? path.dirname(filePath);

  const checkResult = await resolveTs({
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
