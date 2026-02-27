/**
 * Semantic Pass Runner
 * 
 * Executes semantic analysis passes with:
 * - Dependency-based execution order (topological sort)
 * - Content-based caching for incremental analysis
 * - Parallel execution of independent passes
 * - Diagnostic deduplication
 */

import { createHash } from 'crypto';
import type { Domain } from '@isl-lang/parser';
import type { Diagnostic } from '@isl-lang/errors';
import type {
  SemanticPass,
  PassContext,
  PassResult,
  AnalysisResult,
  AnalysisStats,
  AnalyzerConfig,
  TypeEnvironment,
} from './types.js';
import { DEFAULT_ANALYZER_CONFIG } from './types.js';
import { buildTypeEnvironment } from './type-environment.js';

// ============================================================================
// Cache Implementation
// ============================================================================

interface CacheEntry {
  hash: string;
  results: PassResult[];
  timestamp: number;
}

class PassCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries: number = 100, ttlMs: number = 60000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(passId: string, contentHash: string): PassResult | undefined {
    const entry = this.cache.get(passId);
    if (!entry) return undefined;
    
    // Check hash match
    if (entry.hash !== contentHash) return undefined;
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(passId);
      return undefined;
    }

    return entry.results[0];
  }

  set(passId: string, contentHash: string, result: PassResult): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.findOldest();
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(passId, {
      hash: contentHash,
      results: [result],
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  private findOldest(): string | undefined {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }
}

// ============================================================================
// Pass Runner
// ============================================================================

export class PassRunner {
  private passes = new Map<string, SemanticPass>();
  private cache: PassCache;
  private config: Required<AnalyzerConfig>;

  constructor(config: AnalyzerConfig = {}) {
    this.config = { ...DEFAULT_ANALYZER_CONFIG, ...config };
    this.cache = new PassCache(
      this.config.maxCacheEntries,
      this.config.cacheTtlMs
    );
  }

  /**
   * Register a semantic analysis pass
   */
  register(pass: SemanticPass): this {
    this.passes.set(pass.id, pass);
    return this;
  }

  /**
   * Register multiple passes
   */
  registerAll(passes: SemanticPass[]): this {
    for (const pass of passes) {
      this.register(pass);
    }
    return this;
  }

  /**
   * Get a registered pass by ID
   */
  getPass(id: string): SemanticPass | undefined {
    return this.passes.get(id);
  }

  /**
   * Get all registered passes
   */
  getAllPasses(): SemanticPass[] {
    return Array.from(this.passes.values());
  }

  /**
   * Run all enabled passes on the given AST
   */
  run(
    ast: Domain,
    sourceContent: string,
    filePath: string,
    typeEnv?: TypeEnvironment
  ): AnalysisResult {
    const startTime = Date.now();
    const contentHash = this.computeHash(sourceContent);
    
    // Build type environment if not provided
    const env = typeEnv ?? buildTypeEnvironment(ast);

    // Determine which passes to run
    const passesToRun = this.selectPasses();

    // Sort passes by dependencies
    const sortedPasses = this.topologicalSort(passesToRun);

    // Execute passes
    const passResults: PassResult[] = [];
    const allDiagnostics: Diagnostic[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    for (const pass of sortedPasses) {
      // Check cache
      if (this.config.cacheEnabled) {
        const cached = this.cache.get(pass.id, contentHash);
        if (cached) {
          passResults.push(cached);
          allDiagnostics.push(...cached.diagnostics);
          cacheHits++;
          continue;
        }
        cacheMisses++;
      }

      // Run pass
      const result = this.executePass(pass, {
        ast,
        typeEnv: env,
        filePath,
        sourceContent,
        config: this.config.passConfig[pass.id],
      });

      passResults.push(result);
      allDiagnostics.push(...result.diagnostics);

      // Update cache
      if (this.config.cacheEnabled && result.succeeded) {
        this.cache.set(pass.id, contentHash, result);
      }

      // Check fail-fast
      if (this.config.failFast && !result.succeeded) {
        break;
      }

      // Check max diagnostics
      if (allDiagnostics.length >= this.config.maxDiagnostics) {
        break;
      }
    }

    // Deduplicate diagnostics
    const uniqueDiagnostics = this.deduplicateDiagnostics(allDiagnostics);

    // Filter by severity
    const filteredDiagnostics = this.config.includeHints
      ? uniqueDiagnostics
      : uniqueDiagnostics.filter(d => d.severity !== 'hint');

    // Compute statistics
    const stats = this.computeStats(passResults, filteredDiagnostics, startTime);

    return {
      passResults,
      diagnostics: filteredDiagnostics.slice(0, this.config.maxDiagnostics),
      allPassed: stats.errorCount === 0,
      stats,
      cacheInfo: {
        enabled: this.config.cacheEnabled,
        hits: cacheHits,
        misses: cacheMisses,
        contentHash,
      },
    };
  }

  /**
   * Clear the pass cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update configuration
   */
  configure(config: Partial<AnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Recreate cache if settings changed
    if (config.maxCacheEntries || config.cacheTtlMs) {
      this.cache = new PassCache(
        this.config.maxCacheEntries,
        this.config.cacheTtlMs
      );
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private selectPasses(): SemanticPass[] {
    const allPasses = Array.from(this.passes.values());

    // If explicit enable list, use only those
    if (this.config.enablePasses.length > 0) {
      return allPasses.filter(p => this.config.enablePasses.includes(p.id));
    }

    // Otherwise, use all enabled-by-default passes, minus disabled
    return allPasses.filter(p => {
      const enabledByDefault = p.enabledByDefault !== false;
      const notDisabled = !this.config.disablePasses.includes(p.id);
      return enabledByDefault && notDisabled;
    });
  }

  /**
   * Topological sort with cycle detection
   * Handles dependencies and priority
   */
  private topologicalSort(passes: SemanticPass[]): SemanticPass[] {
    const passMap = new Map(passes.map(p => [p.id, p]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const sorted: SemanticPass[] = [];

    const visit = (pass: SemanticPass): void => {
      if (visited.has(pass.id)) return;
      if (visiting.has(pass.id)) {
        throw new Error(`Circular dependency detected: ${pass.id}`);
      }

      visiting.add(pass.id);

      // Visit dependencies first
      for (const depId of pass.dependencies || []) {
        const dep = passMap.get(depId);
        if (dep) {
          visit(dep);
        }
        // Ignore missing dependencies (they may not be registered)
      }

      visiting.delete(pass.id);
      visited.add(pass.id);
      sorted.push(pass);
    };

    // Sort by priority first, then visit
    const byPriority = [...passes].sort((a, b) => 
      (b.priority ?? 0) - (a.priority ?? 0)
    );

    for (const pass of byPriority) {
      visit(pass);
    }

    return sorted;
  }

  private executePass(pass: SemanticPass, ctx: PassContext): PassResult {
    const startTime = Date.now();

    try {
      const diagnostics = pass.run(ctx);
      return {
        passId: pass.id,
        passName: pass.name,
        diagnostics,
        durationMs: Date.now() - startTime,
        succeeded: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        passId: pass.id,
        passName: pass.name,
        diagnostics: [{
          code: 'E0301',
          category: 'semantic',
          severity: 'error',
          message: `Pass '${pass.id}' failed: ${message}`,
          location: {
            file: ctx.filePath,
            line: 1,
            column: 1,
            endLine: 1,
            endColumn: 1,
          },
          source: 'verifier',
        }],
        durationMs: Date.now() - startTime,
        succeeded: false,
        error: message,
      };
    }
  }

  private deduplicateDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
    const seen = new Set<string>();
    const unique: Diagnostic[] = [];

    for (const d of diagnostics) {
      const file = d.location?.file || 'unknown';
      const line = d.location?.line || 1;
      const column = d.location?.column || 1;
      const key = `${d.code}:${file}:${line}:${column}:${d.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(d);
      }
    }

    return unique;
  }

  private computeStats(
    passResults: PassResult[],
    diagnostics: Diagnostic[],
    startTime: number
  ): AnalysisStats {
    return {
      totalPasses: this.passes.size,
      passesRun: passResults.filter(r => r.succeeded).length,
      passesSkipped: this.passes.size - passResults.length,
      errorCount: diagnostics.filter(d => d.severity === 'error').length,
      warningCount: diagnostics.filter(d => d.severity === 'warning').length,
      hintCount: diagnostics.filter(d => d.severity === 'hint').length,
      totalDurationMs: Date.now() - startTime,
    };
  }

  private computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new pass runner with the given configuration
 */
export function createPassRunner(config?: AnalyzerConfig): PassRunner {
  return new PassRunner(config);
}
