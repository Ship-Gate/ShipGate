/**
 * Watch Command
 * 
 * Watch ISL files and relevant code targets, rerun parse/check + optionally gate on changes.
 * 
 * Usage:
 *   isl watch [files...]              # Watch and check on changes
 *   isl watch [files...] --gate       # Also run gate on changes
 *   isl watch [files...] --heal        # Run heal on changes
 *   isl watch [files...] --changed-only # Only process changed files
 */

import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, relative, join, dirname } from 'path';
import { createHash } from 'crypto';
import chalk from 'chalk';
import { check, type CheckResult, type FileCheckResult } from './check.js';
import { gate, type GateResult } from './gate.js';
import { loadConfig, type ISLConfig } from '../config.js';
import { parse as parseISL } from '@isl-lang/parser';
import type { DomainDeclaration } from '@isl-lang/parser';

// Try to import chokidar, fallback to fs.watch if not available
async function getChokidar(): Promise<typeof import('chokidar') | null> {
  try {
    return await import('chokidar');
  } catch {
    // chokidar not available, will use fs.watch fallback
    return null;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface WatchOptions {
  /** Run gate after check */
  gate?: boolean;
  /** Run heal after check */
  heal?: boolean;
  /** Only process changed files (not all files) */
  changedOnly?: boolean;
  /** Implementation path for gate */
  impl?: string;
  /** Gate threshold */
  threshold?: number;
  /** Verbose output */
  verbose?: boolean;
  /** Quiet mode */
  quiet?: boolean;
  /** Debounce delay in ms */
  debounceMs?: number;
}

export interface WatchCache {
  /** Cached AST by file path */
  ast: Map<string, DomainDeclaration | null>;
  /** Cached diagnostics by file path */
  diagnostics: Map<string, FileCheckResult>;
  /** File content hash for change detection */
  contentHash: Map<string, string>;
  /** Last check timestamp */
  lastCheck: Map<string, number>;
}

export interface WatchResult {
  /** Whether watch started successfully */
  started: boolean;
  /** Error if failed to start */
  error?: string;
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Create a new watch cache
 */
function createCache(): WatchCache {
  return {
    ast: new Map(),
    diagnostics: new Map(),
    contentHash: new Map(),
    lastCheck: new Map(),
  };
}

/**
 * Hash file content for change detection
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 16);
}

/**
 * Check if file has changed
 */
function hasFileChanged(cache: WatchCache, filePath: string, content: string): boolean {
  const newHash = hashContent(content);
  const oldHash = cache.contentHash.get(filePath);
  
  if (!oldHash) return true;
  return newHash !== oldHash;
}

/**
 * Update cache with file content and AST
 */
function updateCache(
  cache: WatchCache,
  filePath: string,
  content: string,
  ast: DomainDeclaration | null,
  diagnostics: FileCheckResult
): void {
  cache.contentHash.set(filePath, hashContent(content));
  cache.ast.set(filePath, ast);
  cache.diagnostics.set(filePath, diagnostics);
  cache.lastCheck.set(filePath, Date.now());
}

// ============================================================================
// File Processing
// ============================================================================

/**
 * Process a single ISL file (parse + check)
 */
async function processFile(
  filePath: string,
  cache: WatchCache,
  options: WatchOptions
): Promise<FileCheckResult> {
  try {
    const content = await readFile(filePath, 'utf-8');
    
    // Check cache first
    if (!hasFileChanged(cache, filePath, content)) {
      const cached = cache.diagnostics.get(filePath);
      if (cached) {
        return cached;
      }
    }

    // Parse
    const { domain: ast, errors: parseErrors } = parseISL(content, filePath);
    
    // Build diagnostics (simplified check)
    const errors = parseErrors.map(err => ({
      file: filePath,
      line: 'span' in err ? err.span.start.line : err.line ?? 1,
      column: 'span' in err ? err.span.start.column : err.column ?? 1,
      message: err.message,
      severity: 'error' as const,
      code: err.code ?? 'E0000',
    }));

    const result: FileCheckResult = {
      file: filePath,
      valid: errors.length === 0,
      errors,
      warnings: [],
      stats: ast ? {
        entities: ast.entities.length,
        behaviors: ast.behaviors.length,
        invariants: ast.invariants?.length ?? 0,
      } : undefined,
    };

    // Update cache
    updateCache(cache, filePath, content, ast, result);
    
    return result;
  } catch (error) {
    return {
      file: filePath,
      valid: false,
      errors: [{
        file: filePath,
        message: error instanceof Error ? error.message : String(error),
        severity: 'error',
      }],
      warnings: [],
    };
  }
}

/**
 * Process multiple files
 */
async function processFiles(
  files: string[],
  cache: WatchCache,
  options: WatchOptions
): Promise<CheckResult> {
  const startTime = Date.now();
  const results: FileCheckResult[] = [];

  for (const file of files) {
    const result = await processFile(file, cache, options);
    results.push(result);
  }

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  return {
    success: totalErrors === 0,
    files: results,
    totalErrors,
    totalWarnings,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// Debounce
// ============================================================================

/**
 * Debounce function calls
 */
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

// ============================================================================
// Watch Implementation
// ============================================================================

/**
 * Watch ISL files and rerun checks on changes
 */
export async function watch(
  filePatterns: string[],
  options: WatchOptions = {}
): Promise<WatchResult> {
  const {
    gate: runGate = false,
    heal: runHeal = false,
    changedOnly = false,
    impl,
    threshold = 95,
    verbose = false,
    quiet = false,
    debounceMs = 300,
  } = options;

  // Load config
  const { config } = await loadConfig();

  // Resolve files to watch
  const { glob } = await import('glob');
  const filesToWatch = new Set<string>();
  
  for (const pattern of filePatterns.length > 0 ? filePatterns : config?.include ?? ['**/*.isl']) {
    if (pattern.endsWith('.isl')) {
      filesToWatch.add(resolve(pattern));
    } else {
      const matches = await glob(pattern, {
        cwd: process.cwd(),
        ignore: config?.exclude ?? ['node_modules/**', 'dist/**'],
      });
      for (const match of matches) {
        if (match.endsWith('.isl')) {
          filesToWatch.add(resolve(match));
        }
      }
    }
  }

  if (filesToWatch.size === 0) {
    return {
      started: false,
      error: 'No ISL files found to watch',
    };
  }

  // Create cache
  const cache = createCache();

  // Initial check
  if (!quiet) {
    console.log(chalk.cyan(`Watching ${filesToWatch.size} file${filesToWatch.size === 1 ? '' : 's'}...`));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));
  }

  // Process files initially
  const filesArray = Array.from(filesToWatch);
  const initialResult = await processFiles(filesArray, cache, options);
  
  if (!quiet) {
    printWatchResult(initialResult, { verbose, quiet });
  }

  // Setup file watcher
  const filesToProcess = new Set<string>();
  let processing = false;
  
  // Get chokidar if available
  const chokidar = await getChokidar();

  const processChangedFiles = debounce(async () => {
    if (processing) return;
    processing = true;

    try {
      const files = changedOnly 
        ? Array.from(filesToProcess)
        : filesArray;

      if (files.length === 0) {
        processing = false;
        return;
      }

      if (!quiet && files.length > 0) {
        const relPaths = files.map(f => relative(process.cwd(), f));
        console.log(chalk.gray(`\n[${new Date().toLocaleTimeString()}] Checking ${files.length} file${files.length === 1 ? '' : 's'}...`));
      }

      const result = await processFiles(files, cache, options);
      
      if (!quiet) {
        printWatchResult(result, { verbose, quiet });
      }

      // Run gate if requested
      if (runGate && result.success && impl) {
        // Find ISL files that passed
        const islFiles = files.filter(f => f.endsWith('.isl'));
        for (const specFile of islFiles) {
          if (!quiet) {
            console.log(chalk.cyan(`\nRunning gate for ${relative(process.cwd(), specFile)}...`));
          }
          
          try {
            const gateResult = await gate(specFile, {
              impl,
              threshold,
              verbose,
              format: quiet ? 'quiet' : 'pretty',
            });
            
            if (!quiet) {
              if (gateResult.decision === 'SHIP') {
                console.log(chalk.green(`  ✓ SHIP (${gateResult.trustScore}%)`));
              } else {
                console.log(chalk.red(`  ✗ NO-SHIP (${gateResult.trustScore}%)`));
              }
            }
          } catch (error) {
            if (!quiet) {
              console.log(chalk.red(`  ✗ Gate error: ${error instanceof Error ? error.message : String(error)}`));
            }
          }
        }
      }

      // Run heal if requested (placeholder - would need heal implementation)
      if (runHeal && !result.success) {
        if (!quiet) {
          console.log(chalk.yellow('  Heal not yet implemented'));
        }
      }

      filesToProcess.clear();
    } catch (error) {
      if (!quiet) {
        console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      }
    } finally {
      processing = false;
    }
  }, debounceMs);

  // Setup watcher
  if (chokidar) {
    // Use chokidar if available
    const watcher = chokidar.watch(Array.from(filesToWatch), {
      ignored: /node_modules|dist|\.git/,
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('change', (filePath) => {
      if (filesToWatch.has(resolve(filePath))) {
        filesToProcess.add(resolve(filePath));
        processChangedFiles();
      }
    });

    watcher.on('add', (filePath) => {
      const resolved = resolve(filePath);
      if (resolved.endsWith('.isl') && !filesToWatch.has(resolved)) {
        filesToWatch.add(resolved);
        filesToProcess.add(resolved);
        processChangedFiles();
      }
    });

    watcher.on('error', (error) => {
      if (!quiet) {
        console.log(chalk.red(`Watcher error: ${error.message}`));
      }
    });

    // Handle shutdown
    process.on('SIGINT', () => {
      watcher.close();
      if (!quiet) {
        console.log(chalk.gray('\n\nStopped watching.'));
      }
      process.exit(0);
    });

    return { started: true };
  } else {
    // Fallback to fs.watch (less efficient but works)
    const { watch } = await import('fs');
    const watchers = new Map<string, ReturnType<typeof watch>>();

    for (const filePath of filesToWatch) {
      try {
        const dir = dirname(filePath);
        const watcher = watch(dir, (eventType, filename) => {
          if (filename && filename.endsWith('.isl')) {
            const fullPath = resolve(dir, filename);
            if (filesToWatch.has(fullPath)) {
              filesToProcess.add(fullPath);
              processChangedFiles();
            }
          }
        });
        watchers.set(filePath, watcher);
      } catch (error) {
        // File might not exist yet
      }
    }

    // Handle shutdown
    process.on('SIGINT', () => {
      for (const watcher of watchers.values()) {
        watcher.close();
      }
      if (!quiet) {
        console.log(chalk.gray('\n\nStopped watching.'));
      }
      process.exit(0);
    });

    return { started: true };
  }
}

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Print watch result (minimal output)
 */
function printWatchResult(
  result: CheckResult,
  options: { verbose?: boolean; quiet?: boolean }
): void {
  const { verbose = false, quiet = false } = options;

  if (quiet) {
    // Only show errors
    if (!result.success) {
      for (const file of result.files) {
        if (!file.valid) {
          for (const err of file.errors) {
            console.log(`${file.file}:${err.line}:${err.column}: ${err.message}`);
          }
        }
      }
    }
    return;
  }

  // Minimal output - only show what changed
  if (result.success) {
    if (result.totalWarnings > 0) {
      console.log(chalk.green(`✓ ${result.files.length} file${result.files.length === 1 ? '' : 's'} OK`) + 
        chalk.yellow(` (${result.totalWarnings} warning${result.totalWarnings === 1 ? '' : 's'})`));
    } else {
      console.log(chalk.green(`✓ ${result.files.length} file${result.files.length === 1 ? '' : 's'} OK`));
    }
  } else {
    console.log(chalk.red(`✗ ${result.totalErrors} error${result.totalErrors === 1 ? '' : 's'}`));
    
    if (verbose) {
      for (const file of result.files) {
        if (!file.valid) {
          const relPath = relative(process.cwd(), file.file);
          console.log(chalk.red(`  ${relPath}`));
          for (const err of file.errors) {
            console.log(`    ${err.line}:${err.column} ${err.message}`);
          }
        }
      }
    } else {
      // Show first few errors
      let shown = 0;
      for (const file of result.files) {
        if (!file.valid && shown < 3) {
          const relPath = relative(process.cwd(), file.file);
          for (const err of file.errors.slice(0, 3 - shown)) {
            console.log(chalk.red(`  ${relPath}:${err.line}:${err.column} ${err.message}`));
            shown++;
          }
        }
      }
      if (result.totalErrors > shown) {
        console.log(chalk.gray(`  ... and ${result.totalErrors - shown} more error${result.totalErrors - shown === 1 ? '' : 's'}`));
      }
    }
  }
}

export default watch;
