/**
 * Surgical Diff Applier
 *
 * Applies AI-returned diffs (unified diff or full replacement) to files
 * without rewriting entire files when a small patch suffices.
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import * as diff from 'diff';
import type { SurgicalDiff, ApplyDiffResult } from './types.js';

/** Parse AI response into surgical diffs */
export function parseAIResponse(
  response: string,
  defaultPath?: string,
): Array<{ path: string; diff?: string; fullReplacement?: string }> {
  const results: Array<{ path: string; diff?: string; fullReplacement?: string }> = [];

  // Try JSON array first if response looks like JSON
  if (response.trim().startsWith('[')) {
    try {
      const arr = JSON.parse(response) as Array<Record<string, string>>;
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const path = (item.path ?? item.file ?? defaultPath) as string;
          if (!path) continue;
          const content = item.content ?? item.fixed ?? item.code;
          const diffStr = item.diff;
          if (diffStr) {
            results.push({ path, diff: diffStr });
          } else if (content) {
            results.push({ path, fullReplacement: content });
          }
        }
      }
    } catch {
      // Fall through
    }
  }

  // Fallback: try regex for embedded JSON array
  if (results.length === 0) {
    const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      try {
        const arr = JSON.parse(jsonMatch[0]) as Array<Record<string, string>>;
        for (const item of arr) {
          const path = (item.path ?? item.file ?? defaultPath) as string;
          if (!path) continue;
          const content = item.content ?? item.fixed ?? item.code;
          const diffStr = item.diff;
          if (diffStr) {
            results.push({ path, diff: diffStr });
          } else if (content) {
            results.push({ path, fullReplacement: content });
          }
        }
      } catch {
        // Fall through
      }
    }
  }

  // Try single JSON object
  if (results.length === 0) {
    const singleMatch = response.match(/\{\s*"path"\s*:\s*"[^"]+"\s*,[\s\S]*\}/);
    if (singleMatch) {
      try {
        const obj = JSON.parse(singleMatch[0]) as Record<string, string>;
        const path = (obj.path ?? obj.file ?? defaultPath) as string;
        if (path) {
          if (obj.diff) results.push({ path, diff: obj.diff });
          else if (obj.content ?? obj.fixed ?? obj.code) {
            results.push({ path, fullReplacement: obj.content ?? obj.fixed ?? obj.code });
          }
        }
      } catch {
        // Fall through
      }
    }
  }

  // Try unified diff in response (```diff ... ``` or --- \n +++ \n @@ ...)
  if (results.length === 0 && response.includes('---') && response.includes('+++')) {
    const diffMatch = response.match(/---\s+(?:a\/)?(.+)\n\+\+\+\s+(?:b\/)?(.+)\n([\s\S]*?)(?=\n---|$)/);
    if (diffMatch) {
      const path = diffMatch[1]!.trim();
      results.push({ path, diff: `--- ${path}\n+++ ${path}\n${diffMatch[3]}` });
    }
  }

  return results;
}

/**
 * Apply a unified diff to source content
 * Uses the `diff` package's applyPatch if it's a valid patch, otherwise manual line apply
 */
function applyUnifiedDiff(original: string, patch: string): string | null {
  try {
    const patched = diff.applyPatch(original, patch);
    return typeof patched === 'string' ? patched : null;
  } catch {
    return null;
  }
}

/**
 * Apply a surgical diff to a file
 */
export async function applySurgicalDiff(
  surgical: SurgicalDiff,
  projectRoot: string,
): Promise<ApplyDiffResult> {
  const filePath = resolve(projectRoot, surgical.file);

  if (!existsSync(filePath)) {
    if (surgical.fullReplacement) {
      try {
        await writeFile(filePath, surgical.fullReplacement, 'utf-8');
        return { success: true, file: surgical.file, applied: true };
      } catch (err) {
        return {
          success: false,
          file: surgical.file,
          applied: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    return {
      success: false,
      file: surgical.file,
      applied: false,
      error: 'File does not exist and no full replacement provided',
    };
  }

  const original = await readFile(filePath, 'utf-8');

  let newContent: string | null = null;

  if (surgical.fullReplacement) {
    newContent = surgical.fullReplacement;
  } else if (surgical.diff) {
    newContent = applyUnifiedDiff(original, surgical.diff);
  }

  if (!newContent) {
    return {
      success: false,
      file: surgical.file,
      applied: false,
      error: 'Could not apply diff or parse replacement',
    };
  }

  // Sanity check: don't apply if change is too drastic (e.g. AI returned wrong file)
  const sizeRatio = newContent.length / Math.max(original.length, 1);
  if (sizeRatio < 0.2 || sizeRatio > 10) {
    return {
      success: false,
      file: surgical.file,
      applied: false,
      error: `Suspicious size ratio (${sizeRatio.toFixed(1)}x) — refusing to apply`,
    };
  }

  try {
    await writeFile(filePath, newContent, 'utf-8');
    return { success: true, file: surgical.file, applied: true };
  } catch (err) {
    return {
      success: false,
      file: surgical.file,
      applied: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Apply multiple surgical diffs
 */
export async function applySurgicalDiffs(
  diffs: SurgicalDiff[],
  projectRoot: string,
): Promise<ApplyDiffResult[]> {
  const results: ApplyDiffResult[] = [];
  for (const d of diffs) {
    results.push(await applySurgicalDiff(d, projectRoot));
  }
  return results;
}
