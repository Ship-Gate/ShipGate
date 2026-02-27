/**
 * Drift Watch Mode
 *
 * Monitors source and spec files for changes in real-time.
 * When code changes, it checks whether the corresponding spec may be stale.
 * When a spec changes, it logs a re-verify hint.
 */

import { watch as fsWatch, type FSWatcher } from 'fs';
import { readdir } from 'fs/promises';
import { join, extname, resolve } from 'path';
import type {
  DriftWatchConfig,
  DriftWatchEventCallback,
  DriftWatchHandle,
  DriftReport,
  DriftConfig,
} from './driftTypes.js';
import { DEFAULT_DRIFT_WATCH_CONFIG, DEFAULT_DRIFT_CONFIG } from './driftTypes.js';
import { detectDrift, findMatchingSpec, scanForDrift } from './detectDrift.js';

// ============================================================================
// WATCH FOR DRIFT
// ============================================================================

/**
 * Start watching for spec ↔ implementation drift in real-time.
 *
 * Monitors `.ts`, `.tsx`, `.js`, `.jsx`, and `.isl` files under the
 * root directory. When a code file changes, it looks for a matching
 * spec and runs drift detection. When a spec changes, it emits a
 * notification.
 *
 * @param config  - Watch configuration
 * @param onEvent - Callback for drift watch events
 * @returns Handle to control the watcher
 *
 * @example
 * ```typescript
 * const handle = watchForDrift(
 *   { rootDir: '/path/to/project' },
 *   (event) => {
 *     if (event.type === 'drift-detected' && event.report.driftScore > 50) {
 *       console.warn(`High drift: ${event.report.file}`);
 *     }
 *   },
 * );
 *
 * // Later: stop watching
 * await handle.stop();
 * ```
 */
export function watchForDrift(
  config: DriftWatchConfig,
  onEvent?: DriftWatchEventCallback,
): DriftWatchHandle {
  const rootDir = resolve(config.rootDir);
  const debounceMs = config.debounceMs ?? DEFAULT_DRIFT_WATCH_CONFIG.debounceMs;
  const warnThreshold = config.warnThreshold ?? DEFAULT_DRIFT_WATCH_CONFIG.warnThreshold;
  const verbose = config.verbose ?? false;

  const emit = onEvent ?? (() => {});
  let running = false;
  let watchers: FSWatcher[] = [];
  let debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
  const specExtensions = new Set(['.isl']);

  /**
   * Log message if verbose mode is enabled.
   */
  function log(message: string): void {
    if (verbose) {
      const timestamp = new Date().toISOString();
      process.stdout.write(`[drift-watch ${timestamp}] ${message}\n`);
    }
  }

  /**
   * Handle a file change event with debouncing.
   */
  function onFileChange(filename: string, dir: string): void {
    if (!running || !filename) return;

    const fullPath = join(dir, filename);
    const ext = extname(filename);

    // Clear existing timer for this file
    const existing = debounceTimers.get(fullPath);
    if (existing) clearTimeout(existing);

    // Debounce
    const timer = setTimeout(async () => {
      debounceTimers.delete(fullPath);

      try {
        if (specExtensions.has(ext)) {
          // Spec changed — emit notification
          log(`Spec updated: ${fullPath}`);
          emit({ type: 'spec-changed', file: fullPath, timestamp: new Date() });
        } else if (codeExtensions.has(ext)) {
          // Code changed — check for drift
          log(`Code changed: ${fullPath}`);
          emit({ type: 'code-changed', file: fullPath, timestamp: new Date() });

          const spec = await findMatchingSpec(fullPath);
          if (spec) {
            const report = await detectDrift(spec, fullPath);
            emit({ type: 'drift-detected', report });

            if (report.driftScore >= warnThreshold) {
              log(`High drift detected: ${fullPath} (score: ${report.driftScore})`);
              for (const indicator of report.indicators) {
                log(`  ${indicator.description}`);
              }
            }
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        emit({ type: 'error', error });
        log(`Error processing change: ${error.message}`);
      }
    }, debounceMs);

    debounceTimers.set(fullPath, timer);
  }

  /**
   * Recursively collect directories to watch.
   */
  async function collectWatchDirs(dir: string): Promise<string[]> {
    const dirs = [dir];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        // Skip ignored directories
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
          continue;
        }
        const subDirs = await collectWatchDirs(join(dir, entry.name));
        dirs.push(...subDirs);
      }
    } catch {
      // Directory not readable
    }
    return dirs;
  }

  /**
   * Start watching.
   */
  async function start(): Promise<void> {
    if (running) return;
    running = true;

    emit({ type: 'started', config });
    log(`Starting drift watch on: ${rootDir}`);

    const dirs = await collectWatchDirs(rootDir);
    log(`Watching ${dirs.length} directories`);

    for (const dir of dirs) {
      try {
        const watcher = fsWatch(dir, { persistent: true }, (_event, filename) => {
          if (filename) {
            onFileChange(filename, dir);
          }
        });

        watcher.on('error', (err) => {
          emit({ type: 'error', error: err });
        });

        watchers.push(watcher);
      } catch {
        // Skip directories we can't watch
      }
    }
  }

  /**
   * Stop watching.
   */
  async function stop(): Promise<void> {
    if (!running) return;
    running = false;

    // Clear all debounce timers
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer);
    }
    debounceTimers.clear();

    // Close all watchers
    for (const watcher of watchers) {
      watcher.close();
    }
    watchers = [];

    emit({ type: 'stopped' });
    log('Drift watch stopped');
  }

  /**
   * Run a full drift scan manually.
   */
  async function triggerScan(): Promise<DriftReport[]> {
    const driftConfig: DriftConfig = {
      rootDir,
      ...config.driftConfig,
    };
    const summary = await scanForDrift(driftConfig);
    return summary.reports;
  }

  // Auto-start
  start();

  return {
    stop,
    isWatching: () => running,
    triggerScan,
  };
}
