/**
 * Fix Engine
 *
 * Orchestrates security-pattern detection, suggestion generation,
 * and patch application for the shipgate autofix pipeline.
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import type { FixSuggestion } from './fix-suggestion.js';
import { runAllPatternDetectors } from './security-patterns.js';
import {
  generatePatchFromSuggestions,
  generatePatchFile,
} from './diff-generator.js';

// ============================================================================
// Types
// ============================================================================

export type FixMode = 'interactive' | 'auto' | 'dry-run';

export interface FixEngineOptions {
  /** interactive = ask per fix, auto = apply non-breaking, dry-run = display only */
  mode: FixMode;
  /** Write a combined patch file to this path (for CI) */
  outputPatch?: string;
  /** Only apply fixes above this confidence */
  minConfidence?: number;
  /** Include breaking changes when mode=auto */
  includeBreaking?: boolean;
}

export interface FixEngineResult {
  /** All suggestions found */
  suggestions: FixSuggestion[];
  /** Suggestions that were applied */
  applied: FixSuggestion[];
  /** Suggestions skipped by the user or by policy */
  skipped: FixSuggestion[];
  /** Combined patch content (if --output was given) */
  patchContent?: string;
  /** Per-file summary */
  fileSummary: FileSummary[];
}

export interface FileSummary {
  file: string;
  total: number;
  applied: number;
  skipped: number;
}

// ============================================================================
// Engine Class
// ============================================================================

export class FixEngine {
  private options: Required<FixEngineOptions>;

  constructor(options: FixEngineOptions) {
    this.options = {
      mode: options.mode,
      outputPatch: options.outputPatch ?? '',
      minConfidence: options.minConfidence ?? 0.5,
      includeBreaking: options.includeBreaking ?? false,
    };
  }

  /**
   * Scan files for violations and return suggestions.
   * Does NOT apply anything — use `applyFixes` for that.
   */
  async scan(files: string[]): Promise<FixSuggestion[]> {
    const allSuggestions: FixSuggestion[] = [];

    for (const filePath of files) {
      const absPath = resolve(filePath);
      const source = await readFile(absPath, 'utf-8');
      const suggestions = runAllPatternDetectors(absPath, source);
      allSuggestions.push(...suggestions);
    }

    // Filter by confidence
    return allSuggestions.filter(
      (s) => s.confidence >= this.options.minConfidence,
    );
  }

  /**
   * Scan source code directly (no file I/O).
   */
  scanSource(file: string, source: string): FixSuggestion[] {
    return runAllPatternDetectors(file, source).filter(
      (s) => s.confidence >= this.options.minConfidence,
    );
  }

  /**
   * Apply a list of accepted suggestions to the filesystem.
   */
  async applyFixes(
    suggestions: FixSuggestion[],
  ): Promise<{ applied: FixSuggestion[]; errors: Array<{ fix: FixSuggestion; error: string }> }> {
    const applied: FixSuggestion[] = [];
    const errors: Array<{ fix: FixSuggestion; error: string }> = [];

    // Group by file and apply in reverse-line order to preserve positions
    const byFile = groupByFile(suggestions);

    for (const [filePath, fixes] of byFile) {
      try {
        let content = await readFile(filePath, 'utf-8');

        // Sort by line descending so replacements don't shift earlier positions
        const sorted = [...fixes].sort(
          (a, b) => b.location.line - a.location.line,
        );

        for (const fix of sorted) {
          const idx = content.indexOf(fix.currentCode);
          if (idx >= 0) {
            content =
              content.slice(0, idx) +
              fix.suggestedCode +
              content.slice(idx + fix.currentCode.length);
            applied.push(fix);
          } else {
            errors.push({
              fix,
              error: `Could not find code block to replace in ${filePath}`,
            });
          }
        }

        await writeFile(filePath, content, 'utf-8');
      } catch (err) {
        for (const fix of fixes) {
          errors.push({
            fix,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return { applied, errors };
  }

  /**
   * Full run: scan, filter, optionally apply, and generate patch.
   *
   * The `promptFn` callback is invoked for each suggestion in interactive mode.
   * It receives the suggestion and should return the user's choice.
   */
  async run(
    files: string[],
    promptFn?: (fix: FixSuggestion) => Promise<PromptChoice>,
  ): Promise<FixEngineResult> {
    const suggestions = await this.scan(files);
    const applied: FixSuggestion[] = [];
    const skipped: FixSuggestion[] = [];

    for (const fix of suggestions) {
      const decision = await this.decideAction(fix, promptFn);
      if (decision === 'apply') {
        applied.push(fix);
      } else if (decision === 'skip-all') {
        skipped.push(fix, ...suggestions.slice(suggestions.indexOf(fix) + 1));
        break;
      } else {
        skipped.push(fix);
      }
    }

    // Apply accepted fixes
    if (applied.length > 0 && this.options.mode !== 'dry-run') {
      await this.applyFixes(applied);
    }

    // Generate patch content
    let patchContent: string | undefined;
    if (this.options.outputPatch || this.options.mode === 'dry-run') {
      const fileContents = new Map<string, string>();
      for (const file of files) {
        const absPath = resolve(file);
        fileContents.set(absPath, await readFile(absPath, 'utf-8'));
      }

      // For dry-run we generate the patch from all suggestions
      const targets = this.options.mode === 'dry-run' ? suggestions : applied;
      patchContent = generatePatchFromSuggestions(fileContents, targets);

      if (this.options.outputPatch) {
        await writeFile(this.options.outputPatch, patchContent, 'utf-8');
      }
    }

    // Build summary
    const fileSummary = buildFileSummary(suggestions, applied, skipped);

    return { suggestions, applied, skipped, patchContent, fileSummary };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private
  // ─────────────────────────────────────────────────────────────────────────

  private async decideAction(
    fix: FixSuggestion,
    promptFn?: (fix: FixSuggestion) => Promise<PromptChoice>,
  ): Promise<PromptChoice> {
    switch (this.options.mode) {
      case 'dry-run':
        return 'skip';

      case 'auto':
        // In auto mode, apply non-breaking fixes silently
        if (fix.breaking && !this.options.includeBreaking) {
          return 'skip';
        }
        return 'apply';

      case 'interactive':
        if (promptFn) {
          return promptFn(fix);
        }
        // Without a prompt function, default to skip
        return 'skip';

      default:
        return 'skip';
    }
  }
}

// ============================================================================
// Prompt Types
// ============================================================================

export type PromptChoice = 'apply' | 'skip' | 'skip-all' | 'diff';

// ============================================================================
// Helpers
// ============================================================================

function groupByFile(
  suggestions: FixSuggestion[],
): Map<string, FixSuggestion[]> {
  const map = new Map<string, FixSuggestion[]>();
  for (const s of suggestions) {
    const existing = map.get(s.file) ?? [];
    existing.push(s);
    map.set(s.file, existing);
  }
  return map;
}

function buildFileSummary(
  suggestions: FixSuggestion[],
  applied: FixSuggestion[],
  skipped: FixSuggestion[],
): FileSummary[] {
  const fileSet = new Set(suggestions.map((s) => s.file));
  const result: FileSummary[] = [];

  for (const file of fileSet) {
    result.push({
      file,
      total: suggestions.filter((s) => s.file === file).length,
      applied: applied.filter((s) => s.file === file).length,
      skipped: skipped.filter((s) => s.file === file).length,
    });
  }

  return result;
}
