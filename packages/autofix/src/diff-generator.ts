/**
 * Diff Generator
 *
 * Creates unified diffs and patch files from fix suggestions.
 */

import * as diff from 'diff';

// ============================================================================
// Unified Diff
// ============================================================================

/**
 * Generate a unified diff between two code strings.
 */
export function generateUnifiedDiff(
  file: string,
  oldCode: string,
  newCode: string,
): string {
  return diff.createPatch(
    file,
    oldCode.endsWith('\n') ? oldCode : oldCode + '\n',
    newCode.endsWith('\n') ? newCode : newCode + '\n',
    'original',
    'fixed',
  );
}

/**
 * Generate a human-readable colourless side-by-side snippet.
 */
export function generateInlineDiff(
  oldCode: string,
  newCode: string,
): string {
  const parts = diff.diffLines(oldCode, newCode);
  const lines: string[] = [];

  for (const part of parts) {
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
    const partLines = part.value.replace(/\n$/, '').split('\n');
    for (const l of partLines) {
      lines.push(`${prefix} ${l}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Patch File
// ============================================================================

export interface PatchEntry {
  file: string;
  oldCode: string;
  newCode: string;
}

/**
 * Combine multiple fix suggestions into a single patch file
 * that can be applied with `git apply`.
 */
export function generatePatchFile(entries: PatchEntry[]): string {
  const patches: string[] = [];

  for (const entry of entries) {
    const patch = diff.createPatch(
      entry.file,
      entry.oldCode.endsWith('\n') ? entry.oldCode : entry.oldCode + '\n',
      entry.newCode.endsWith('\n') ? entry.newCode : entry.newCode + '\n',
      'a/' + entry.file,
      'b/' + entry.file,
    );
    patches.push(patch);
  }

  return patches.join('\n');
}

/**
 * Generate a patch file from FixSuggestions by applying them
 * sequentially to the original file content.
 */
export function generatePatchFromSuggestions(
  fileContents: Map<string, string>,
  suggestions: Array<{
    file: string;
    currentCode: string;
    suggestedCode: string;
  }>,
): string {
  // Group suggestions by file
  const byFile = new Map<
    string,
    Array<{ currentCode: string; suggestedCode: string }>
  >();

  for (const s of suggestions) {
    const existing = byFile.get(s.file) ?? [];
    existing.push({ currentCode: s.currentCode, suggestedCode: s.suggestedCode });
    byFile.set(s.file, existing);
  }

  const entries: PatchEntry[] = [];

  for (const [file, fixes] of byFile) {
    const original = fileContents.get(file) ?? '';
    let modified = original;

    for (const fix of fixes) {
      // Replace the first occurrence of currentCode
      const idx = modified.indexOf(fix.currentCode);
      if (idx >= 0) {
        modified =
          modified.slice(0, idx) +
          fix.suggestedCode +
          modified.slice(idx + fix.currentCode.length);
      }
    }

    if (modified !== original) {
      entries.push({ file, oldCode: original, newCode: modified });
    }
  }

  return generatePatchFile(entries);
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Format a compact diff block for CLI display (no colour codes).
 */
export function formatDiffBlock(
  file: string,
  startLine: number,
  endLine: number,
  oldCode: string,
  newCode: string,
): string {
  const header = `--- ${file}:${startLine}-${endLine} ---`;
  const separator = '-'.repeat(header.length);
  const inlinePatch = generateInlineDiff(oldCode, newCode);

  return [separator, header, separator, '', inlinePatch, '', separator].join('\n');
}
