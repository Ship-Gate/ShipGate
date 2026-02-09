/**
 * Incremental Parsing and Changed-Only Processing
 * 
 * Only processes files that have changed since last run.
 * 
 * @module @isl-lang/pipeline/performance
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import { parseISL, type DomainDeclaration } from '@isl-lang/isl-core';
import { runSemanticRules, type SemanticViolation } from '../semantic-rules.js';
import { getParseCache, getGateCache } from './cache.js';

// ============================================================================
// Types
// ============================================================================

export interface FileHash {
  file: string;
  hash: string;
  mtime: number;
}

export interface IncrementalState {
  files: FileHash[];
  timestamp: number;
}

export interface IncrementalResult<T> {
  result: T;
  processedFiles: string[];
  skippedFiles: string[];
  changedFiles: string[];
}

// ============================================================================
// File Change Detection
// ============================================================================

export class IncrementalProcessor {
  private stateFile: string;
  private state: IncrementalState | null = null;

  constructor(stateFile = '.isl-incremental-state.json') {
    this.stateFile = stateFile;
  }

  /**
   * Load incremental state
   */
  async loadState(): Promise<void> {
    try {
      const content = await fs.readFile(this.stateFile, 'utf-8');
      this.state = JSON.parse(content) as IncrementalState;
    } catch {
      this.state = { files: [], timestamp: 0 };
    }
  }

  /**
   * Save incremental state
   */
  async saveState(): Promise<void> {
    if (this.state) {
      await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2), 'utf-8');
    }
  }

  /**
   * Detect changed files
   */
  async detectChangedFiles(files: string[]): Promise<{
    changed: string[];
    unchanged: string[];
  }> {
    if (!this.state) {
      await this.loadState();
    }

    const changed: string[] = [];
    const unchanged: string[] = [];
    const newHashes: FileHash[] = [];

    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        const content = await fs.readFile(file, 'utf-8');
        const hash = this.computeHash(content);
        const mtime = stats.mtimeMs;

        const existing = this.state!.files.find(f => f.file === file);
        
        if (!existing || existing.hash !== hash || existing.mtime !== mtime) {
          changed.push(file);
        } else {
          unchanged.push(file);
        }

        newHashes.push({ file, hash, mtime });
      } catch {
        // File doesn't exist or can't be read - treat as changed
        changed.push(file);
      }
    }

    // Update state
    this.state = {
      files: newHashes,
      timestamp: Date.now(),
    };

    return { changed, unchanged };
  }

  /**
   * Process files incrementally
   */
  async processIncremental<T>(
    files: string[],
    processor: (changedFiles: string[]) => Promise<T>
  ): Promise<IncrementalResult<T>> {
    const { changed, unchanged } = await this.detectChangedFiles(files);

    if (changed.length === 0) {
      // No changes - return cached result if available
      return {
        result: await processor([]) as T,
        processedFiles: [],
        skippedFiles: unchanged,
        changedFiles: [],
      };
    }

    const result = await processor(changed);

    return {
      result,
      processedFiles: changed,
      skippedFiles: unchanged,
      changedFiles: changed,
    };
  }

  /**
   * Compute file hash
   */
  private computeHash(content: string): string {
    const hash = createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }
}

// ============================================================================
// Incremental Parse
// ============================================================================

export async function parseIncremental(
  files: string[],
  options: { useCache?: boolean; changedOnly?: boolean } = {}
): Promise<IncrementalResult<Map<string, { ast: DomainDeclaration; errors: unknown[] }>>> {
  const { useCache = true, changedOnly = true } = options;
  const parseCache = useCache ? getParseCache() : null;
  const processor = new IncrementalProcessor();

  if (changedOnly) {
    await processor.loadState();
  }

  const result = new Map<string, { ast: DomainDeclaration; errors: unknown[] }>();
  const processedFiles: string[] = [];
  const skippedFiles: string[] = [];

  const filesToProcess = changedOnly
    ? (await processor.detectChangedFiles(files)).changed
    : files;

  for (const file of files) {
    if (!filesToProcess.includes(file) && changedOnly) {
      // Try cache
      if (parseCache) {
        const cached = parseCache.get('', file); // Would need actual source
        if (cached) {
          result.set(file, cached);
          skippedFiles.push(file);
          continue;
        }
      }
      skippedFiles.push(file);
      continue;
    }

    // Parse file
    const source = await fs.readFile(file, 'utf-8');
    const parseResult = parseISL(source, file);

    result.set(file, { ast: parseResult.ast as DomainDeclaration, errors: parseResult.errors });

    if (parseCache) {
      parseCache.set(source, file, { ast: parseResult.ast as DomainDeclaration, errors: parseResult.errors });
    }

    processedFiles.push(file);
  }

  if (changedOnly) {
    await processor.saveState();
  }

  return {
    result,
    processedFiles,
    skippedFiles,
    changedFiles: filesToProcess,
  };
}

// ============================================================================
// Incremental Gate (Changed-Only Default)
// ============================================================================

export async function gateIncremental(
  codeMap: Map<string, string>,
  options: { useCache?: boolean; changedOnly?: boolean } = {}
): Promise<IncrementalResult<SemanticViolation[]>> {
  const { useCache = true, changedOnly = true } = options;
  const gateCache = useCache ? getGateCache() : null;
  const processor = new IncrementalProcessor();

  if (changedOnly) {
    await processor.loadState();
  }

  // Detect changed files
  const files = Array.from(codeMap.keys());
  const { changed, unchanged } = changedOnly
    ? await processor.detectChangedFiles(files)
    : { changed: files, unchanged: [] };

  // Try cache for unchanged files
  if (changedOnly && unchanged.length > 0 && gateCache) {
    const unchangedMap = new Map<string, string>();
    for (const file of unchanged) {
      const content = codeMap.get(file);
      if (content) {
        unchangedMap.set(file, content);
      }
    }

    const cached = gateCache.get(unchangedMap);
    if (cached) {
      // Only process changed files
      const changedMap = new Map<string, string>();
      for (const file of changed) {
        const content = codeMap.get(file);
        if (content) {
          changedMap.set(file, content);
        }
      }

      const newViolations = runSemanticRules(changedMap);
      const allViolations = [...cached, ...newViolations];

      // Update cache
      gateCache.set(codeMap, allViolations);

      return {
        result: allViolations,
        processedFiles: changed,
        skippedFiles: unchanged,
        changedFiles: changed,
      };
    }
  }

  // Process all files
  const violations = runSemanticRules(codeMap);

  if (gateCache) {
    gateCache.set(codeMap, violations);
  }

  if (changedOnly) {
    await processor.saveState();
  }

  return {
    result: violations,
    processedFiles: changed,
    skippedFiles: unchanged,
    changedFiles: changed,
  };
}
