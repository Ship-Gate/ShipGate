/**
 * Template Cache: Golden templates stored as pre-parsed objects in .isl-cache/templates/
 * Loaded from disk on pipeline start, not re-read per file
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { sha256 } from './hash.js';

export interface CachedTemplate {
  id: string;
  content: string;
  hash: string;
  timestamp: number;
}

export interface TemplateCacheOptions {
  /** Cache directory (default: .isl-cache/templates) */
  cacheDir: string;
}

/**
 * Manages pre-parsed template cache for codegen
 * Load templates once at pipeline start
 */
export class TemplateCache {
  private readonly templatesDir: string;
  private cache = new Map<string, CachedTemplate>();

  constructor(options: TemplateCacheOptions) {
    this.templatesDir = options.cacheDir;
  }

  /**
   * Load all templates from disk (call at pipeline start)
   */
  async load(): Promise<void> {
    this.cache.clear();
    if (!existsSync(this.templatesDir)) return;

    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(this.templatesDir, { withFileTypes: true });
      for (const f of files) {
        if (f.isFile() && f.name.endsWith('.json')) {
          const path = join(this.templatesDir, f.name);
          const data = await readFile(path, 'utf-8');
          const t = JSON.parse(data) as CachedTemplate;
          this.cache.set(t.id, t);
        }
      }
    } catch {
      // No templates yet
    }
  }

  /**
   * Get template by id (from in-memory cache)
   */
  get(id: string): CachedTemplate | undefined {
    return this.cache.get(id);
  }

  /**
   * Store template to disk and memory
   */
  async set(id: string, content: string): Promise<void> {
    const t: CachedTemplate = {
      id,
      content,
      hash: sha256(content),
      timestamp: Date.now(),
    };
    this.cache.set(id, t);
    await mkdir(this.templatesDir, { recursive: true });
    await writeFile(join(this.templatesDir, `${id}.json`), JSON.stringify(t, null, 2), 'utf-8');
  }

  /**
   * Check if template exists and is current (by content hash)
   */
  has(id: string, contentHash?: string): boolean {
    const t = this.cache.get(id);
    if (!t) return false;
    if (contentHash) return t.hash === contentHash;
    return true;
  }

  /**
   * Number of cached templates
   */
  get size(): number {
    return this.cache.size;
  }
}
