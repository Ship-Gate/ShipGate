/**
 * Patch Engine - Core Implementation
 *
 * Safe, idempotent patch application with unified diff output.
 *
 * Key guarantees:
 * - Idempotency: Running twice doesn't duplicate changes
 * - Safety: Only touches explicitly allowed files
 * - Auditability: Returns unified diff for proof bundles
 *
 * @module @isl-lang/patch-engine
 */

import * as diff from 'diff';
import type {
  Patch,
  PatchResult,
  SinglePatchResult,
  PatchEngineOptions,
  FileContext,
  PreflightResult,
  InsertImportPatch,
  AddHelperFunctionPatch,
  WrapHandlerPatch,
  ReplaceCallPatch,
  CreateFilePatch,
  AllowedFileCategory,
} from './types.js';
import {
  isInsertImportPatch,
  isAddHelperFunctionPatch,
  isWrapHandlerPatch,
  isReplaceCallPatch,
  isCreateFilePatch,
} from './types.js';

// ============================================================================
// Patch Engine Class
// ============================================================================

export class PatchEngine {
  private options: Required<PatchEngineOptions>;
  private fileContexts: Map<string, FileContext> = new Map();

  constructor(options: PatchEngineOptions) {
    this.options = {
      projectRoot: options.projectRoot,
      allowedNewFileCategories: options.allowedNewFileCategories ?? ['test', 'helper'],
      allowedFiles: options.allowedFiles ?? [],
      allowedFilePatterns: options.allowedFilePatterns ?? [],
      strictMode: options.strictMode ?? false,
      indentation: options.indentation ?? '  ',
      dryRun: options.dryRun ?? false,
      verbose: options.verbose ?? false,
    };
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Apply patches to files and return unified diff
   */
  applyPatches(
    patches: Patch[],
    fileContents: Map<string, string>
  ): PatchResult {
    const timestamp = new Date().toISOString();
    const patchResults: SinglePatchResult[] = [];
    const appliedPatches: Patch[] = [];
    const skippedPatches: Patch[] = [];
    const failedPatches: Array<{ patch: Patch; reason: string }> = [];

    // Initialize file contexts from provided contents
    this.initializeFileContexts(fileContents, patches);

    // Group patches by file for efficient processing
    const patchesByFile = this.groupPatchesByFile(patches);

    // Apply patches file by file
    for (const [_file, filePatches] of patchesByFile) {
      for (const patch of filePatches) {
        const result = this.applySinglePatch(patch);
        patchResults.push(result);

        if (result.success) {
          if (result.skipped) {
            skippedPatches.push(patch);
          } else {
            appliedPatches.push(patch);
          }
        } else {
          failedPatches.push({ patch, reason: result.error ?? 'Unknown error' });
        }
      }
    }

    // Collect final file contents
    const files = new Map<string, string>();
    const fileDiffs = new Map<string, string>();
    let combinedDiff = '';

    for (const [path, ctx] of this.fileContexts) {
      files.set(path, ctx.currentContent);

      if (ctx.modified) {
        const fileDiff = diff.createPatch(
          path,
          ctx.originalContent,
          ctx.currentContent,
          'original',
          'patched'
        );
        fileDiffs.set(path, fileDiff);
        combinedDiff += fileDiff + '\n';
      }
    }

    return {
      success: failedPatches.length === 0,
      files,
      patchResults,
      appliedPatches,
      skippedPatches,
      failedPatches,
      diff: combinedDiff.trim(),
      fileDiffs,
      timestamp,
    };
  }

  /**
   * Preflight check - validate patches before applying
   */
  preflight(
    patches: Patch[],
    fileContents: Map<string, string>
  ): PreflightResult {
    const filesToModify = new Set<string>();
    const filesToCreate = new Set<string>();
    const willSkip: Patch[] = [];
    const errors: Array<{ patch: Patch; error: string }> = [];
    const warnings: Array<{ patch: Patch; warning: string }> = [];

    // Initialize contexts for checking
    this.initializeFileContexts(fileContents, patches);

    for (const patch of patches) {
      // Check if file can be modified
      if (isCreateFilePatch(patch)) {
        if (!this.isAllowedNewFile(patch)) {
          errors.push({
            patch,
            error: `Cannot create file with category '${patch.category}'. Allowed: ${this.options.allowedNewFileCategories.join(', ')}`,
          });
          continue;
        }

        if (fileContents.has(patch.file) && !patch.overwrite) {
          warnings.push({
            patch,
            warning: `File '${patch.file}' already exists. Will be skipped.`,
          });
          willSkip.push(patch);
          continue;
        }

        filesToCreate.add(patch.file);
      } else {
        if (!this.isAllowedFile(patch.file)) {
          errors.push({
            patch,
            error: `File '${patch.file}' is not in the allowed files list`,
          });
          continue;
        }

        if (!fileContents.has(patch.file)) {
          errors.push({
            patch,
            error: `File '${patch.file}' does not exist`,
          });
          continue;
        }

        // Check idempotency
        const ctx = this.fileContexts.get(patch.file);
        if (ctx && this.isAlreadyApplied(patch, ctx)) {
          willSkip.push(patch);
        } else {
          filesToModify.add(patch.file);
        }
      }
    }

    return {
      ok: errors.length === 0,
      filesToModify: Array.from(filesToModify),
      filesToCreate: Array.from(filesToCreate),
      willSkip,
      errors,
      warnings,
    };
  }

  // ==========================================================================
  // Private: Patch Application
  // ==========================================================================

  private applySinglePatch(patch: Patch): SinglePatchResult {
    try {
      if (isInsertImportPatch(patch)) {
        return this.applyInsertImport(patch);
      } else if (isAddHelperFunctionPatch(patch)) {
        return this.applyAddHelperFunction(patch);
      } else if (isWrapHandlerPatch(patch)) {
        return this.applyWrapHandler(patch);
      } else if (isReplaceCallPatch(patch)) {
        return this.applyReplaceCall(patch);
      } else if (isCreateFilePatch(patch)) {
        return this.applyCreateFile(patch);
      }

      return {
        patch,
        success: false,
        skipped: false,
        error: `Unknown patch type: ${(patch as Patch).type}`,
        linesChanged: 0,
      };
    } catch (error) {
      return {
        patch,
        success: false,
        skipped: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        linesChanged: 0,
      };
    }
  }

  /**
   * Insert import statement
   * Idempotency: Skips if import already exists
   */
  private applyInsertImport(patch: InsertImportPatch): SinglePatchResult {
    // Check if file is allowed first
    if (!this.isAllowedFile(patch.file)) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File '${patch.file}' is not in the allowed files list`,
        linesChanged: 0,
      };
    }

    const ctx = this.fileContexts.get(patch.file);
    if (!ctx) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File '${patch.file}' not found`,
        linesChanged: 0,
      };
    }

    // Check if import already exists
    if (this.hasImport(ctx, patch)) {
      return {
        patch,
        success: true,
        skipped: true,
        linesChanged: 0,
      };
    }

    // Find insertion point (after existing imports or at top)
    const insertLine = this.findImportInsertionPoint(ctx);
    const importLine = patch.importStatement.trim();

    // Insert the import
    ctx.lines.splice(insertLine, 0, importLine);
    ctx.currentContent = ctx.lines.join('\n');
    ctx.modified = true;

    return {
      patch,
      success: true,
      skipped: false,
      linesChanged: 1,
    };
  }

  /**
   * Add helper function
   * Idempotency: Skips if function with same name exists
   */
  private applyAddHelperFunction(patch: AddHelperFunctionPatch): SinglePatchResult {
    // Check if file is allowed first
    if (!this.isAllowedFile(patch.file)) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File '${patch.file}' is not in the allowed files list`,
        linesChanged: 0,
      };
    }

    const ctx = this.fileContexts.get(patch.file);
    if (!ctx) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File '${patch.file}' not found`,
        linesChanged: 0,
      };
    }

    // Check if function already exists
    if (this.hasFunction(ctx, patch.functionName)) {
      return {
        patch,
        success: true,
        skipped: true,
        linesChanged: 0,
      };
    }

    let insertLine: number;
    if (typeof patch.position === 'number') {
      insertLine = patch.position - 1; // Convert to 0-indexed
    } else if (patch.position === 'top') {
      insertLine = this.findAfterImportsLine(ctx);
    } else {
      insertLine = this.findBeforeExportsLine(ctx);
    }

    // Add the function code
    const functionCode = patch.functionCode.trim();
    const functionLines = functionCode.split('\n');

    // Ensure blank line before function
    if (insertLine > 0 && ctx.lines[insertLine - 1]?.trim() !== '') {
      functionLines.unshift('');
    }

    ctx.lines.splice(insertLine, 0, ...functionLines);
    ctx.currentContent = ctx.lines.join('\n');
    ctx.modified = true;

    return {
      patch,
      success: true,
      skipped: false,
      linesChanged: functionLines.length,
    };
  }

  /**
   * Wrap handler with prefix/suffix code
   * Idempotency: Skips if wrap marker already present
   */
  private applyWrapHandler(patch: WrapHandlerPatch): SinglePatchResult {
    // Check if file is allowed first
    if (!this.isAllowedFile(patch.file)) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File '${patch.file}' is not in the allowed files list`,
        linesChanged: 0,
      };
    }

    const ctx = this.fileContexts.get(patch.file);
    if (!ctx) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File '${patch.file}' not found`,
        linesChanged: 0,
      };
    }

    // Check if already wrapped (using marker or prefix)
    const marker = patch.wrapMarker ?? patch.wrapPrefix.trim().slice(0, 50);
    if (ctx.currentContent.includes(marker)) {
      return {
        patch,
        success: true,
        skipped: true,
        linesChanged: 0,
      };
    }

    // Find the function to wrap
    const funcLocation = this.findFunctionLocation(ctx, patch.targetFunction, patch.targetPattern);
    if (!funcLocation) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `Could not find function '${patch.targetFunction}' in ${patch.file}`,
        linesChanged: 0,
      };
    }

    const { bodyStartLine, bodyEndLine, indentation } = funcLocation;
    let linesChanged = 0;

    // Insert wrap suffix first (if provided) to avoid line number shifts
    if (patch.wrapSuffix) {
      const suffixLines = this.indentCode(patch.wrapSuffix, indentation);
      ctx.lines.splice(bodyEndLine, 0, ...suffixLines.split('\n'));
      linesChanged += suffixLines.split('\n').length;
    }

    // Insert wrap prefix
    const prefixLines = this.indentCode(patch.wrapPrefix, indentation);
    ctx.lines.splice(bodyStartLine + 1, 0, ...prefixLines.split('\n'));
    linesChanged += prefixLines.split('\n').length;

    ctx.currentContent = ctx.lines.join('\n');
    ctx.modified = true;

    return {
      patch,
      success: true,
      skipped: false,
      linesChanged,
    };
  }

  /**
   * Replace a call/expression
   * Idempotency: Skips if replacement already present
   */
  private applyReplaceCall(patch: ReplaceCallPatch): SinglePatchResult {
    // Check if file is allowed first
    if (!this.isAllowedFile(patch.file)) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File '${patch.file}' is not in the allowed files list`,
        linesChanged: 0,
      };
    }

    const ctx = this.fileContexts.get(patch.file);
    if (!ctx) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `File '${patch.file}' not found`,
        linesChanged: 0,
      };
    }

    // Check if replacement already exists (idempotency)
    if (ctx.currentContent.includes(patch.replacement) && 
        !ctx.currentContent.includes(patch.original)) {
      return {
        patch,
        success: true,
        skipped: true,
        linesChanged: 0,
      };
    }

    // Check if original exists
    const pattern = patch.isRegex
      ? new RegExp(patch.original, patch.scope === 'all' ? 'g' : '')
      : patch.original;

    if (typeof pattern === 'string') {
      if (!ctx.currentContent.includes(pattern)) {
        return {
          patch,
          success: false,
          skipped: false,
          error: `Could not find '${patch.original}' in ${patch.file}`,
          linesChanged: 0,
        };
      }
    } else {
      if (!pattern.test(ctx.currentContent)) {
        return {
          patch,
          success: false,
          skipped: false,
          error: `Pattern '${patch.original}' not found in ${patch.file}`,
          linesChanged: 0,
        };
      }
    }

    // Apply replacement
    const beforeLines = ctx.currentContent.split('\n').length;

    if (patch.scope === 'all') {
      ctx.currentContent = ctx.currentContent.split(patch.original).join(patch.replacement);
    } else if (typeof patch.scope === 'number') {
      // Replace only on specific line
      const targetLine = patch.scope - 1;
      if (targetLine >= 0 && targetLine < ctx.lines.length) {
        ctx.lines[targetLine] = ctx.lines[targetLine]!.replace(patch.original, patch.replacement);
        ctx.currentContent = ctx.lines.join('\n');
      }
    } else {
      // Replace first occurrence
      ctx.currentContent = ctx.currentContent.replace(patch.original, patch.replacement);
    }

    ctx.lines = ctx.currentContent.split('\n');
    ctx.modified = true;

    const afterLines = ctx.lines.length;
    const linesChanged = Math.abs(afterLines - beforeLines) || 1;

    return {
      patch,
      success: true,
      skipped: false,
      linesChanged,
    };
  }

  /**
   * Create a new file
   * Idempotency: Skips if file exists with same content
   */
  private applyCreateFile(patch: CreateFilePatch): SinglePatchResult {
    // Check category allowance
    if (!this.isAllowedNewFile(patch)) {
      return {
        patch,
        success: false,
        skipped: false,
        error: `Cannot create file with category '${patch.category}'`,
        linesChanged: 0,
      };
    }

    const existingCtx = this.fileContexts.get(patch.file);

    // Check if file exists with same content (idempotent)
    if (existingCtx) {
      if (existingCtx.originalContent.trim() === patch.contents.trim()) {
        return {
          patch,
          success: true,
          skipped: true,
          linesChanged: 0,
        };
      }

      if (!patch.overwrite) {
        return {
          patch,
          success: true,
          skipped: true,
          linesChanged: 0,
        };
      }
    }

    // Create new file context
    const ctx: FileContext = {
      path: patch.file,
      originalContent: existingCtx?.originalContent ?? '',
      currentContent: patch.contents,
      lines: patch.contents.split('\n'),
      indentation: this.options.indentation,
      modified: true,
    };

    this.fileContexts.set(patch.file, ctx);

    return {
      patch,
      success: true,
      skipped: false,
      linesChanged: ctx.lines.length,
    };
  }

  // ==========================================================================
  // Private: Idempotency Helpers
  // ==========================================================================

  private isAlreadyApplied(patch: Patch, ctx: FileContext): boolean {
    if (isInsertImportPatch(patch)) {
      return this.hasImport(ctx, patch);
    } else if (isAddHelperFunctionPatch(patch)) {
      return this.hasFunction(ctx, patch.functionName);
    } else if (isWrapHandlerPatch(patch)) {
      const marker = patch.wrapMarker ?? patch.wrapPrefix.trim().slice(0, 50);
      return ctx.currentContent.includes(marker);
    } else if (isReplaceCallPatch(patch)) {
      return (
        ctx.currentContent.includes(patch.replacement) &&
        !ctx.currentContent.includes(patch.original)
      );
    }
    return false;
  }

  private hasImport(ctx: FileContext, patch: InsertImportPatch): boolean {
    const content = ctx.currentContent;

    // Check exact import statement
    if (content.includes(patch.importStatement.trim())) {
      return true;
    }

    // Check by module specifier if provided
    if (patch.moduleSpecifier) {
      const importRegex = new RegExp(
        `import\\s+.*?\\s+from\\s+['"]${this.escapeRegex(patch.moduleSpecifier)}['"]`,
        'm'
      );
      if (importRegex.test(content)) {
        // If we have specific names to check, verify they're imported
        if (patch.importedNames && patch.importedNames.length > 0) {
          const match = content.match(importRegex);
          if (match) {
            const importLine = match[0];
            return patch.importedNames.every((name: string) => 
              importLine.includes(name)
            );
          }
        }
        return true;
      }
    }

    return false;
  }

  private hasFunction(ctx: FileContext, functionName: string): boolean {
    // Check for function declaration patterns
    const patterns = [
      new RegExp(`function\\s+${this.escapeRegex(functionName)}\\s*\\(`),
      new RegExp(`const\\s+${this.escapeRegex(functionName)}\\s*=\\s*(?:async\\s+)?(?:function|\\()`),
      new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${this.escapeRegex(functionName)}\\s*\\(`),
      new RegExp(`(?:export\\s+)?const\\s+${this.escapeRegex(functionName)}\\s*=`),
    ];

    return patterns.some(pattern => pattern.test(ctx.currentContent));
  }

  // ==========================================================================
  // Private: Code Analysis Helpers
  // ==========================================================================

  private findImportInsertionPoint(ctx: FileContext): number {
    let lastImportLine = 0;

    for (let i = 0; i < ctx.lines.length; i++) {
      const line = ctx.lines[i]!.trim();
      if (line.startsWith('import ') || line.startsWith('import{')) {
        lastImportLine = i + 1;
      } else if (
        lastImportLine > 0 &&
        line !== '' &&
        !line.startsWith('//') &&
        !line.startsWith('/*') &&
        !line.startsWith('*')
      ) {
        // Found first non-import, non-comment line after imports
        break;
      }
    }

    return lastImportLine;
  }

  private findAfterImportsLine(ctx: FileContext): number {
    const importEnd = this.findImportInsertionPoint(ctx);

    // Skip any blank lines after imports
    let insertLine = importEnd;
    while (insertLine < ctx.lines.length && ctx.lines[insertLine]?.trim() === '') {
      insertLine++;
    }

    return insertLine;
  }

  private findBeforeExportsLine(ctx: FileContext): number {
    // Find first export statement from the bottom
    for (let i = ctx.lines.length - 1; i >= 0; i--) {
      const line = ctx.lines[i]!.trim();
      if (line.startsWith('export ') || line.startsWith('export{') || line === 'export default') {
        return i;
      }
    }

    // If no exports, insert at end
    return ctx.lines.length;
  }

  private findFunctionLocation(
    ctx: FileContext,
    functionName: string,
    pattern?: string | RegExp
  ): { bodyStartLine: number; bodyEndLine: number; indentation: string } | null {
    const searchPattern = pattern
      ? typeof pattern === 'string'
        ? new RegExp(pattern)
        : pattern
      : new RegExp(
          `(?:export\\s+)?(?:async\\s+)?function\\s+${this.escapeRegex(functionName)}\\s*\\(|` +
          `(?:export\\s+)?const\\s+${this.escapeRegex(functionName)}\\s*=\\s*(?:async\\s+)?(?:function|\\()`
        );

    let funcStartLine = -1;
    let braceCount = 0;
    let foundOpenBrace = false;
    let bodyStartLine = -1;
    let indentation = this.options.indentation;

    for (let i = 0; i < ctx.lines.length; i++) {
      const line = ctx.lines[i]!;

      if (funcStartLine === -1 && searchPattern.test(line)) {
        funcStartLine = i;
        // Detect indentation from the function line
        const indentMatch = line.match(/^(\s*)/);
        if (indentMatch) {
          indentation = indentMatch[1] + this.options.indentation;
        }
      }

      if (funcStartLine !== -1) {
        for (const char of line) {
          if (char === '{') {
            if (!foundOpenBrace) {
              foundOpenBrace = true;
              bodyStartLine = i;
            }
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (foundOpenBrace && braceCount === 0) {
              return {
                bodyStartLine,
                bodyEndLine: i,
                indentation,
              };
            }
          }
        }
      }
    }

    return null;
  }

  // ==========================================================================
  // Private: Utility Helpers
  // ==========================================================================

  private initializeFileContexts(
    fileContents: Map<string, string>,
    patches: Patch[]
  ): void {
    this.fileContexts.clear();

    // Initialize from provided contents
    for (const [path, content] of fileContents) {
      this.fileContexts.set(path, {
        path,
        originalContent: content,
        currentContent: content,
        lines: content.split('\n'),
        indentation: this.detectIndentation(content),
        modified: false,
      });
    }

    // Ensure all patch target files are tracked
    for (const patch of patches) {
      if (isCreateFilePatch(patch) && !this.fileContexts.has(patch.file)) {
        // Will be created
        continue;
      }
    }
  }

  private groupPatchesByFile(patches: Patch[]): Map<string, Patch[]> {
    const grouped = new Map<string, Patch[]>();

    for (const patch of patches) {
      const existing = grouped.get(patch.file) ?? [];
      existing.push(patch);
      grouped.set(patch.file, existing);
    }

    return grouped;
  }

  private detectIndentation(content: string): string {
    const lines = content.split('\n');
    const indentCounts = new Map<string, number>();

    for (const line of lines) {
      const match = line.match(/^(\s+)/);
      if (match) {
        const indent = match[1]!;
        // Normalize to base unit (2 or 4 spaces, or tab)
        let baseIndent = indent;
        if (indent.length > 4) {
          baseIndent = indent.slice(0, 2);
        }
        indentCounts.set(baseIndent, (indentCounts.get(baseIndent) ?? 0) + 1);
      }
    }

    let maxCount = 0;
    let mostCommon = this.options.indentation;

    for (const [indent, count] of indentCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = indent;
      }
    }

    return mostCommon;
  }

  private indentCode(code: string, indentation: string): string {
    return code
      .split('\n')
      .map(line => (line.trim() ? indentation + line : line))
      .join('\n');
  }

  private isAllowedFile(file: string): boolean {
    // If allowedFiles is empty, all files are allowed
    if (
      this.options.allowedFiles.length === 0 &&
      this.options.allowedFilePatterns.length === 0
    ) {
      return true;
    }

    // Check explicit list
    if (this.options.allowedFiles.includes(file)) {
      return true;
    }

    // Check patterns (simple glob matching)
    for (const pattern of this.options.allowedFilePatterns) {
      if (this.matchesGlob(file, pattern)) {
        return true;
      }
    }

    return false;
  }

  private isAllowedNewFile(patch: CreateFilePatch): boolean {
    const allowed = this.options.allowedNewFileCategories;
    return allowed.includes('all') || allowed.includes(patch.category as AllowedFileCategory);
  }

  private matchesGlob(file: string, pattern: string): boolean {
    // Simple glob matching (supports * and **)
    const regexPattern = pattern
      .replace(/\*\*/g, '{{DOUBLESTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{DOUBLESTAR}}/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regexPattern}$`).test(file);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Apply patches to files and return unified diff
 *
 * @param patches - Patches to apply
 * @param fileContents - Map of file path to file contents
 * @param options - Engine options
 * @returns Patch result with unified diff
 */
export function applyPatches(
  patches: Patch[],
  fileContents: Map<string, string>,
  options: PatchEngineOptions
): PatchResult {
  const engine = new PatchEngine(options);
  return engine.applyPatches(patches, fileContents);
}

/**
 * Preflight check before applying patches
 *
 * @param patches - Patches to check
 * @param fileContents - Map of file path to file contents
 * @param options - Engine options
 * @returns Preflight check result
 */
export function preflightPatches(
  patches: Patch[],
  fileContents: Map<string, string>,
  options: PatchEngineOptions
): PreflightResult {
  const engine = new PatchEngine(options);
  return engine.preflight(patches, fileContents);
}
