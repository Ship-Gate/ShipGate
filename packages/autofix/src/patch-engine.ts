/**
 * Patch Engine
 * 
 * Applies patches to files with AST support when possible, regex fallback otherwise.
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { Patch } from './patcher.js';
import { CodePatcher } from './patcher.js';
import { generateUnifiedDiff } from './diff-generator.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of applying patches
 */
export interface ApplyPatchesResult {
  /** Whether all patches were applied successfully */
  success: boolean;
  /** Applied patches */
  applied: Patch[];
  /** Failed patches */
  failed: Array<{ patch: Patch; reason: string }>;
  /** Unified diff of all changes */
  diff: string;
  /** Files modified */
  filesModified: string[];
}

/**
 * Options for applying patches
 */
export interface ApplyPatchesOptions {
  /** Project root directory */
  projectRoot: string;
  /** Dry run mode (don't write files) */
  dryRun?: boolean;
  /** Whether to use AST when possible */
  useAST?: boolean;
}

// ============================================================================
// Patch Engine
// ============================================================================

/**
 * Apply patches to files
 */
export async function applyPatches(
  patches: Patch[],
  options: ApplyPatchesOptions
): Promise<ApplyPatchesResult> {
  const {
    projectRoot,
    dryRun = false,
  } = options;

  const applied: Patch[] = [];
  const failed: Array<{ patch: Patch; reason: string }> = [];
  const filesModified = new Set<string>();
  const fileContents = new Map<string, string>();

  // Group patches by file
  const patchesByFile = new Map<string, Patch[]>();
  for (const patch of patches) {
    const file = patch.file;
    const existing = patchesByFile.get(file) || [];
    existing.push(patch);
    patchesByFile.set(file, existing);
  }

  // Process each file
  for (const [file, filePatches] of patchesByFile) {
    const filePath = resolve(projectRoot, file);

    // Read file content
    let content: string;
    if (existsSync(filePath)) {
      try {
        content = await readFile(filePath, 'utf-8');
      } catch (error) {
        for (const patch of filePatches) {
          failed.push({
            patch,
            reason: `Failed to read file: ${error instanceof Error ? error.message : 'unknown error'}`,
          });
        }
        continue;
      }
    } else {
      // File doesn't exist - create it
      content = '';
    }

    // Store original content
    fileContents.set(file, content);

    // Apply patches using CodePatcher
    const patcher = new CodePatcher(content);
    const result = patcher.applyPatches(filePatches);

    if (result.success) {
      // Write file if not dry run
      if (!dryRun) {
        try {
          await writeFile(filePath, result.patchedCode, 'utf-8');
          filesModified.add(file);
        } catch (error) {
          for (const patch of filePatches) {
            failed.push({
              patch,
              reason: `Failed to write file: ${error instanceof Error ? error.message : 'unknown error'}`,
            });
          }
          continue;
        }
      } else {
        filesModified.add(file);
      }

      applied.push(...result.appliedPatches);
      failed.push(...result.failedPatches.map(f => ({ patch: f.patch, reason: f.reason })));
    } else {
      // Some patches failed
      applied.push(...result.appliedPatches);
      failed.push(...result.failedPatches.map(f => ({ patch: f.patch, reason: f.reason })));
    }
  }

  // Generate unified diff
  const diffParts: string[] = [];
  for (const [file, originalContent] of fileContents) {
    const filePatches = patchesByFile.get(file) || [];
    if (filePatches.length === 0) continue;

    // Get patched content
    const filePath = resolve(projectRoot, file);
    let patchedContent: string;
    if (dryRun) {
      // Apply patches in memory for diff
      const patcher = new CodePatcher(originalContent);
      const result = patcher.applyPatches(filePatches);
      patchedContent = result.patchedCode;
    } else {
      if (existsSync(filePath)) {
        patchedContent = await readFile(filePath, 'utf-8');
      } else {
        patchedContent = originalContent;
      }
    }

    if (patchedContent !== originalContent) {
      const diff = generateUnifiedDiff(file, originalContent, patchedContent);
      diffParts.push(diff);
    }
  }

  return {
    success: failed.length === 0,
    applied,
    failed,
    diff: diffParts.join('\n'),
    filesModified: Array.from(filesModified),
  };
}

/**
 * Preview patches without applying
 */
export async function previewPatches(
  patches: Patch[],
  options: ApplyPatchesOptions
): Promise<ApplyPatchesResult> {
  return applyPatches(patches, { ...options, dryRun: true });
}
