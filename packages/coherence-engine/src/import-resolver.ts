/**
 * ImportResolver
 *
 * Scans generated files for import statements, checks each against the manifest,
 * reports unresolved imports with suggested fixes, and auto-fixes simple cases.
 */

import { parseImports, isProjectImport } from './parser.js';
import type { CoherenceCheckResult, UnresolvedImport } from './types.js';
import * as path from 'path';

export interface ImportResolverOptions {
  rootDir?: string;
  pathAliases?: Record<string, string>;
}

/**
 * Resolves imports against a manifest of generated files.
 */
export class ImportResolver {
  private rootDir: string;
  private pathAliases: Record<string, string>;

  constructor(options: ImportResolverOptions = {}) {
    this.rootDir = options.rootDir ?? 'src';
    this.pathAliases = options.pathAliases ?? { '@': this.rootDir };
  }

  /**
   * Check all files for unresolved imports.
   */
  checkAll(
    files: Map<string, string>,
    autoFix: boolean = false
  ): CoherenceCheckResult {
    const unresolved: UnresolvedImport[] = [];
    const autoFixes: CoherenceCheckResult['autoFixes'] = [];

    const allPaths = new Set<string>();
    for (const p of files.keys()) {
      allPaths.add(this.normalizePath(p));
      allPaths.add(p);
      // Add paths without extension
      const ext = path.extname(p);
      if (ext) {
        allPaths.add(p.slice(0, -ext.length));
      }
    }

    for (const [filePath, content] of files) {
      const imports = parseImports(content);
      const dir = path.dirname(filePath);

      for (const imp of imports) {
        if (!isProjectImport(imp.specifier)) continue;

        const resolved = this.resolveSpecifier(imp.specifier, dir, allPaths);

        if (!resolved.found) {
          const suggestedFix = this.suggestFix(imp.specifier, dir, allPaths);

          unresolved.push({
            file: filePath,
            specifier: imp.specifier,
            line: imp.line,
            suggestedFix: suggestedFix ?? undefined,
            reason: resolved.reason ?? 'unknown',
          });

          if (autoFix && suggestedFix) {
            autoFixes.push({
              file: filePath,
              specifier: imp.specifier,
              fix: suggestedFix,
            });
          }
        }
      }
    }

    // Apply auto-fixes if requested
    if (autoFix && autoFixes.length > 0) {
      this.applyAutoFixes(files, autoFixes);
    }

    return {
      coherent: unresolved.length === 0,
      unresolved,
      autoFixes,
    };
  }

  /**
   * Reset the resolver state.
   */
  reset(): void {
    // No-op; state is per-check
  }

  /**
   * Get a report of unresolved imports with suggested fixes.
   */
  reportUnresolved(result: CoherenceCheckResult): string {
    const lines: string[] = ['Unresolved imports:'];

    for (const u of result.unresolved) {
      lines.push(`  ${u.file}:${u.line} - ${u.specifier}`);
      if (u.suggestedFix) {
        lines.push(`    → Suggested fix: ${u.suggestedFix}`);
      }
      lines.push(`    Reason: ${u.reason}`);
    }

    return lines.join('\n');
  }

  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  private resolveSpecifier(
    specifier: string,
    fromDir: string,
    allPaths: Set<string>
  ): { found: boolean; reason?: UnresolvedImport['reason'] } {
    const resolved = this.resolvePath(specifier, fromDir);

    // Check exact match
    if (allPaths.has(resolved)) return { found: true };

    // Check with extension
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const withExt = resolved + ext;
      if (allPaths.has(withExt)) return { found: true };
    }

    // Check index files
    const indexPath = path.join(resolved, 'index');
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const withExt = this.normalizePath(indexPath + ext);
      if (allPaths.has(withExt)) return { found: true };
    }

    // Check if we have a wrong path (missing extension)
    const base = path.basename(resolved);
    for (const p of allPaths) {
      if (p.endsWith(resolved) || p.endsWith(resolved + '.ts') || p.endsWith(resolved + '.tsx')) {
        return { found: false, reason: 'missing_extension' };
      }
    }

    return { found: false, reason: 'missing_file' };
  }

  private resolvePath(specifier: string, fromDir: string): string {
    let resolved = specifier;

    if (specifier.startsWith('@/')) {
      const alias = this.pathAliases['@'] ?? this.rootDir;
      resolved = specifier.replace(/^@\//, alias + '/');
    } else if (specifier.startsWith('@')) {
      for (const [alias, target] of Object.entries(this.pathAliases)) {
        if (specifier.startsWith(alias + '/')) {
          resolved = specifier.replace(alias, target);
          break;
        }
      }
    }

    if (resolved.startsWith('.') || resolved.startsWith('/')) {
      resolved = path.join(fromDir, resolved);
    }

    return this.normalizePath(path.normalize(resolved));
  }

  private suggestFix(
    specifier: string,
    fromDir: string,
    allPaths: Set<string>
  ): string | null {
    const resolved = this.resolvePath(specifier, fromDir);

    // Try adding .ts/.tsx extension to resolved path
    for (const ext of ['.ts', '.tsx']) {
      const withExt = resolved + ext;
      if (allPaths.has(withExt)) {
        const rel = this.toRelativeImport(withExt, fromDir);
        return this.preferAliasIfUnderSrc(rel, withExt);
      }
    }

    // Try finding similar path (wrong relative path)
    const base = path.basename(resolved);
    for (const p of allPaths) {
      const norm = this.normalizePath(p);
      if (norm.endsWith('/' + base) || norm.endsWith('/' + base + '.ts') || norm.endsWith('/' + base + '.tsx')) {
        const rel = this.toRelativeImport(p, fromDir);
        return this.preferAliasIfUnderSrc(rel, p);
      }
    }

    return null;
  }

  private preferAliasIfUnderSrc(relative: string, absolutePath: string): string {
    const norm = this.normalizePath(absolutePath);
    if (norm.startsWith(this.rootDir + '/')) {
      const sub = norm.slice(this.rootDir.length + 1).replace(/\.(ts|tsx|js|jsx)$/, '');
      return `@/${sub}`;
    }
    return relative;
  }

  private toRelativeImport(targetPath: string, fromDir: string): string {
    const targetDir = path.dirname(targetPath);
    const targetBase = path.basename(targetPath, path.extname(targetPath));
    const targetFile = path.join(targetDir, targetBase);
    const relative = path.relative(fromDir, targetFile);
    const normalized = this.normalizePath(relative);
    return normalized.startsWith('.') ? normalized : `./${normalized}`;
  }

  private applyAutoFixes(
    files: Map<string, string>,
    fixes: CoherenceCheckResult['autoFixes']
  ): void {
    const byFile = new Map<string, Array<{ specifier: string; fix: string }>>();
    for (const f of fixes) {
      const list = byFile.get(f.file) ?? [];
      list.push({ specifier: f.specifier, fix: f.fix });
      byFile.set(f.file, list);
    }

    for (const [filePath, fileFixes] of byFile) {
      let content = files.get(filePath);
      if (!content) continue;

      for (const { specifier, fix } of fileFixes) {
        const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        content = content.replace(
          new RegExp(`(['"\`])${escaped}\\1`, 'g'),
          `$1${fix}$1`
        );
      }

      files.set(filePath, content);
    }
  }
}
