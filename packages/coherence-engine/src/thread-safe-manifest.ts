/**
 * ThreadSafeProjectManifest — ProjectManifest safe for concurrent writes
 *
 * Streams register their generated exports as they complete.
 * Later streams can read (but not block on) earlier stream results.
 * Final coherence check runs after all streams complete.
 *
 * Uses a simple mutex (Promise chain) for registerFile to avoid races.
 */

import { parseImports, parseExports, isProjectImport } from './parser.js';
import type { ProjectManifest, ManifestEntry, CodegenContext, CoherenceCheckResult } from './types.js';
import { ImportResolver } from './import-resolver.js';

export interface ThreadSafeManifestOptions {
  /** Root directory for path resolution */
  rootDir?: string;
  /** Path alias mapping */
  pathAliases?: Record<string, string>;
}

/**
 * Thread-safe manifest for parallel codegen.
 * registerFile is serialized; getManifest/getCodegenContext return snapshots (safe for concurrent reads).
 */
export class ThreadSafeProjectManifest {
  private readonly manifest = new Map<string, ManifestEntry>();
  private registerQueue: Promise<void> = Promise.resolve();
  private readonly resolver: ImportResolver;

  constructor(options: ThreadSafeManifestOptions = {}) {
    const rootDir = options.rootDir ?? 'src';
    this.resolver = new ImportResolver({
      rootDir,
      pathAliases: options.pathAliases ?? { '@': rootDir },
    });
  }

  /**
   * Register a generated file. Thread-safe — serialized with other registrations.
   */
  async registerFile(filePath: string, content: string): Promise<void> {
    const entry = this.parseEntry(filePath, content);
    this.registerQueue = this.registerQueue.then(() => {
      this.manifest.set(filePath, entry);
    });
    await this.registerQueue;
  }

  /**
   * Synchronous register (use when not in concurrent context).
   * For parallel streams, prefer registerFile (async).
   */
  registerFileSync(filePath: string, content: string): void {
    const entry = this.parseEntry(filePath, content);
    this.manifest.set(filePath, entry);
  }

  private parseEntry(filePath: string, content: string): ManifestEntry {
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

    return {
      exports,
      types,
      dependencies: [...new Set(dependencies)],
    };
  }

  /**
   * Get a snapshot of the manifest. Safe for concurrent reads.
   */
  getManifest(): ProjectManifest {
    return new Map(this.manifest);
  }

  /**
   * Get codegen context for prompt injection. Safe for concurrent reads.
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
   * Format manifest as string for prompt injection.
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
   * Run final coherence check. Call after all streams complete.
   */
  runCoherenceCheck(
    files: Map<string, string> | Record<string, string>,
    options?: { autoFix?: boolean },
  ): CoherenceCheckResult {
    const fileMap = files instanceof Map ? files : new Map(Object.entries(files));
    return this.resolver.checkAll(fileMap, options?.autoFix ?? false);
  }

  /** Clear the manifest */
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
