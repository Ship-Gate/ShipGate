/**
 * CoherenceEngine
 *
 * Maintains a ProjectManifest of generated files and ensures imports
 * resolve correctly. Provides manifest context to codegen prompts and
 * runs final coherence checks.
 */

import { parseImports, parseExports, isProjectImport, normalizePathForLookup } from './parser.js';
import type { ProjectManifest, ManifestEntry, CodegenContext, CoherenceCheckResult } from './types.js';
import { ImportResolver } from './import-resolver.js';

export interface CoherenceEngineOptions {
  /** Root directory for path resolution (e.g. 'src' for @/ alias) */
  rootDir?: string;
  /** Path alias mapping (e.g. { '@': 'src' }) */
  pathAliases?: Record<string, string>;
}

/**
 * CoherenceEngine maintains a manifest of generated files and ensures
 * they work together as a coherent project.
 */
export class CoherenceEngine {
  private manifest: ProjectManifest = new Map();
  private resolver: ImportResolver;
  private rootDir: string;

  constructor(options: CoherenceEngineOptions = {}) {
    this.rootDir = options.rootDir ?? 'src';
    this.resolver = new ImportResolver({
      rootDir: this.rootDir,
      pathAliases: options.pathAliases ?? { '@': this.rootDir },
    });
  }

  /**
   * Get the current project manifest for injection into codegen prompts.
   */
  getManifest(): ProjectManifest {
    return new Map(this.manifest);
  }

  /**
   * Get codegen context (manifest as plain object) for prompt injection.
   */
  getCodegenContext(): CodegenContext {
    const manifestObj: CodegenContext['manifest'] = {};
    for (const [path, entry] of this.manifest) {
      manifestObj[path] = {
        exports: [...entry.exports],
        types: [...entry.types],
        dependencies: [...entry.dependencies],
      };
    }

    const suggestedImports = this.getSuggestedImports();

    return {
      manifest: manifestObj,
      suggestedImports,
    };
  }

  /**
   * Format manifest as a string for prompt injection.
   */
  formatManifestForPrompt(): string {
    const lines: string[] = ['## Existing Generated Files (use these paths for imports)\n'];
    for (const [path, entry] of this.manifest) {
      const exportsStr = [...entry.exports, ...entry.types].filter(Boolean).join(', ');
      lines.push(`- \`${path}\`: exports ${exportsStr || '(various)'}`);
    }
    return lines.join('\n');
  }

  /**
   * Register a generated file and update the manifest.
   */
  registerFile(filePath: string, content: string): void {
    const imports = parseImports(content);
    const exportsList = parseExports(content);

    const exports: string[] = [];
    const types: string[] = [];
    const dependencies: string[] = [];

    for (const exp of exportsList) {
      if (exp.isType) {
        types.push(exp.name);
      } else {
        exports.push(exp.name);
      }
    }

    const projectDeps = new Set<string>();
    for (const imp of imports) {
      if (isProjectImport(imp.specifier)) {
        projectDeps.add(imp.specifier);
      }
    }
    dependencies.push(...projectDeps);

    const entry: ManifestEntry = {
      exports,
      types,
      dependencies: [...new Set(dependencies)],
    };

    this.manifest.set(filePath, entry);
  }

  /**
   * Run final coherence check: every import resolves to an actual export.
   */
  runCoherenceCheck(
    files: Map<string, string> | Record<string, string>,
    options?: { autoFix?: boolean }
  ): CoherenceCheckResult {
    const fileMap = files instanceof Map ? files : new Map(Object.entries(files));
    return this.resolver.checkAll(fileMap, options?.autoFix ?? false);
  }

  /**
   * Clear the manifest (e.g. when starting a new generation).
   */
  reset(): void {
    this.manifest.clear();
  }

  private getSuggestedImports(): string[] {
    const suggestions: string[] = [];
    for (const [path] of this.manifest) {
      const normalized = path.replace(/\.(ts|tsx|js|jsx)$/, '');
      if (path.startsWith('src/')) {
        suggestions.push(`@/${normalized.replace(/^src\//, '')}`);
      }
      suggestions.push(`./${path}`);
    }
    return [...new Set(suggestions)];
  }
}
