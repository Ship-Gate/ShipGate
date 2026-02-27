/**
 * DependencyGraph: maps ISL construct → generated files → dependent files
 * Used for incremental codegen: only regenerate files affected by changes
 */

import type { DomainDeclaration } from '@isl-lang/parser';
import { getEntityNames, getBehaviorNames, getEndpointPaths } from './diff.js';
import type { IncrementalDiffResult } from './types.js';

export type FileType = 'service' | 'route' | 'test' | 'component' | 'schema' | 'types' | 'config';

export interface GeneratedFile {
  path: string;
  type: FileType;
  /** ISL constructs this file was generated from */
  sources: string[];
}

export interface DependencyGraphOptions {
  /** Output directory prefix for paths */
  outDir?: string;
}

/**
 * Maps ISL constructs (entities, behaviors, endpoints) to generated files
 * and tracks which files import from which (for dependent regeneration)
 */
export class DependencyGraph {
  private entityToFiles = new Map<string, Set<string>>();
  private behaviorToFiles = new Map<string, Set<string>>();
  private endpointToFiles = new Map<string, Set<string>>();
  private fileToSources = new Map<string, Set<string>>();
  private fileImports = new Map<string, Set<string>>();
  private readonly outDir: string;

  constructor(options: DependencyGraphOptions = {}) {
    this.outDir = options.outDir ?? '';
  }

  /**
   * Register a generated file and its ISL sources
   */
  registerFile(
    filePath: string,
    type: FileType,
    sources: { entities?: string[]; behaviors?: string[]; endpoints?: string[] }
  ): void {
    const fullPath = this.outDir ? `${this.outDir}/${filePath}`.replace(/\/+/g, '/') : filePath;
    const allSources = new Set<string>();

    for (const e of sources.entities ?? []) {
      allSources.add(`entity:${e}`);
      let set = this.entityToFiles.get(e);
      if (!set) {
        set = new Set();
        this.entityToFiles.set(e, set);
      }
      set.add(fullPath);
    }
    for (const b of sources.behaviors ?? []) {
      allSources.add(`behavior:${b}`);
      let set = this.behaviorToFiles.get(b);
      if (!set) {
        set = new Set();
        this.behaviorToFiles.set(b, set);
      }
      set.add(fullPath);
    }
    for (const ep of sources.endpoints ?? []) {
      allSources.add(`endpoint:${ep}`);
      let set = this.endpointToFiles.get(ep);
      if (!set) {
        set = new Set();
        this.endpointToFiles.set(ep, set);
      }
      set.add(fullPath);
    }

    this.fileToSources.set(fullPath, allSources);
  }

  /**
   * Register that fileA imports from fileB
   */
  registerImport(fileA: string, fileB: string): void {
    const a = this.outDir ? `${this.outDir}/${fileA}`.replace(/\/+/g, '/') : fileA;
    const b = this.outDir ? `${this.outDir}/${fileB}`.replace(/\/+/g, '/') : fileB;
    let set = this.fileImports.get(a);
    if (!set) {
      set = new Set();
      this.fileImports.set(a, set);
    }
    set.add(b);
  }

  /**
   * Build graph from domain and typical codegen output structure
   */
  buildFromDomain(domain: DomainDeclaration, generatedFiles: GeneratedFile[]): void {
    for (const f of generatedFiles) {
      const entities: string[] = [];
      const behaviors: string[] = [];
      const endpoints: string[] = [];

      for (const src of f.sources) {
        if (src.startsWith('entity:')) entities.push(src.slice(7));
        else if (src.startsWith('behavior:')) behaviors.push(src.slice(9));
        else if (src.startsWith('endpoint:')) endpoints.push(src.slice(9));
      }

      this.registerFile(f.path, f.type, { entities, behaviors, endpoints });
    }
  }

  /**
   * Get all files that need regeneration given an incremental diff
   */
  getAffectedFiles(diff: IncrementalDiffResult): Set<string> {
    const affected = new Set<string>();

    const addFromEntity = (name: string) => {
      const files = this.entityToFiles.get(name);
      if (files) for (const f of files) affected.add(f);
    };
    const addFromBehavior = (name: string) => {
      const files = this.behaviorToFiles.get(name);
      if (files) for (const f of files) affected.add(f);
    };
    const addFromEndpoint = (path: string) => {
      const files = this.endpointToFiles.get(path);
      if (files) for (const f of files) affected.add(f);
    };

    for (const n of diff.entities.added) addFromEntity(n);
    for (const n of diff.entities.removed) addFromEntity(n);
    for (const n of diff.entities.changed) addFromEntity(n);

    for (const n of diff.behaviors.added) addFromBehavior(n);
    for (const n of diff.behaviors.removed) addFromBehavior(n);
    for (const n of diff.behaviors.changed) addFromBehavior(n);

    for (const p of diff.endpoints.added) addFromEndpoint(p);
    for (const p of diff.endpoints.removed) addFromEndpoint(p);
    for (const p of diff.endpoints.changed) addFromEndpoint(p);

    // Add files that import from affected files (transitive)
    let prevSize = 0;
    while (affected.size !== prevSize) {
      prevSize = affected.size;
      for (const [file, imports] of this.fileImports) {
        for (const imp of imports) {
          if (affected.has(imp)) affected.add(file);
        }
      }
    }

    return affected;
  }

  /**
   * Infer typical generated files from domain (for vibe-style codegen)
   */
  static inferFromDomain(domain: DomainDeclaration, options: { framework?: string } = {}): GeneratedFile[] {
    const entities = getEntityNames(domain);
    const behaviors = getBehaviorNames(domain);
    const framework = options.framework ?? 'nextjs';
    const files: GeneratedFile[] = [];

    for (const e of entities) {
      const base = e.toLowerCase();
      files.push({ path: `src/lib/${base}.service.ts`, type: 'service', sources: [`entity:${e}`] });
      files.push({ path: `src/routes/${base}.ts`, type: 'route', sources: [`entity:${e}`] });
      files.push({ path: `src/__tests__/${base}.test.ts`, type: 'test', sources: [`entity:${e}`] });
      if (framework === 'nextjs') {
        files.push({ path: `src/app/${base}/page.tsx`, type: 'component', sources: [`entity:${e}`] });
        files.push({ path: `src/components/${base}-list.tsx`, type: 'component', sources: [`entity:${e}`] });
      }
    }

    for (const b of behaviors) {
      const base = b.toLowerCase();
      files.push({ path: `src/lib/${base}.service.ts`, type: 'service', sources: [`behavior:${b}`] });
      files.push({ path: `src/__tests__/${base}.test.ts`, type: 'test', sources: [`behavior:${b}`] });
    }

    files.push({ path: 'prisma/schema.prisma', type: 'schema', sources: entities.map((e) => `entity:${e}`) });

    return files;
  }
}
