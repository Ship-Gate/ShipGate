// ============================================================================
// ISL Incremental Parser
// Caches parse results and provides incremental updates
// ============================================================================

import { parse, type ParseResult, type Domain } from '@intentos/parser';
import type { AnalysisResult } from './analyzer.js';
import { ISLAnalyzer } from './analyzer.js';

// ============================================================================
// Parse Cache Entry
// ============================================================================

export interface ParseCache {
  uri: string;
  version: number;
  source: string;
  sourceHash: number;
  result: AnalysisResult;
  timestamp: number;
}

// ============================================================================
// Incremental Result
// ============================================================================

export interface IncrementalResult {
  cached: boolean;
  result: AnalysisResult;
}

// ============================================================================
// Incremental Parser
// ============================================================================

export class IncrementalParser {
  private cache = new Map<string, ParseCache>();
  private analyzer = new ISLAnalyzer();
  private maxCacheSize = 50;

  /**
   * Parse a document, using cache if available
   */
  parse(
    uri: string,
    source: string,
    version: number,
    options?: { typeCheck?: boolean }
  ): IncrementalResult {
    const sourceHash = this.hashString(source);
    
    // Check cache
    const cached = this.cache.get(uri);
    if (cached && cached.sourceHash === sourceHash) {
      // Update timestamp for LRU
      cached.timestamp = Date.now();
      return { cached: true, result: cached.result };
    }

    // Parse fresh
    const result = this.analyzer.analyze(source, {
      filePath: uri,
      typeCheck: options?.typeCheck ?? true,
      collectSymbols: true,
      collectReferences: true,
    });

    // Store in cache
    this.setCache(uri, {
      uri,
      version,
      source,
      sourceHash,
      result,
      timestamp: Date.now(),
    });

    return { cached: false, result };
  }

  /**
   * Invalidate cache for a document
   */
  invalidate(uri: string): void {
    this.cache.delete(uri);
  }

  /**
   * Invalidate all caches
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Get cached result if available
   */
  getCached(uri: string): AnalysisResult | undefined {
    return this.cache.get(uri)?.result;
  }

  /**
   * Check if a document is cached
   */
  isCached(uri: string, source: string): boolean {
    const cached = this.cache.get(uri);
    if (!cached) return false;
    return cached.sourceHash === this.hashString(source);
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hits: 0, // Would need to track this
      misses: 0,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setCache(uri: string, entry: ParseCache): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(uri, entry);
  }

  private evictOldest(): void {
    let oldest: { uri: string; timestamp: number } | undefined;
    
    for (const [uri, entry] of this.cache) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = { uri, timestamp: entry.timestamp };
      }
    }

    if (oldest) {
      this.cache.delete(oldest.uri);
    }
  }

  private hashString(str: string): number {
    // Simple string hash (djb2 algorithm)
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return hash >>> 0; // Convert to unsigned 32-bit integer
  }
}
