/**
 * Code Patcher
 * 
 * Applies patches to source code to fix verification failures.
 */

import * as diff from 'diff';

// ============================================================================
// Types
// ============================================================================

export interface Patch {
  type: 'insert' | 'replace' | 'delete';
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  content?: string;
  original?: string;
  replacement?: string;
  description: string;
  confidence: number;
}

export interface PatchContext {
  implementation: string;
  indentation?: string;
  useCustomErrors?: boolean;
  preserveComments?: boolean;
}

export interface PatchResult {
  success: boolean;
  patchedCode: string;
  appliedPatches: Patch[];
  failedPatches: Array<{ patch: Patch; reason: string }>;
  diff: string;
}

// ============================================================================
// Patcher Class
// ============================================================================

export class CodePatcher {
  private implementation: string;
  private lines: string[];
  private context: PatchContext;

  constructor(implementation: string, context?: Partial<PatchContext>) {
    this.implementation = implementation;
    this.lines = implementation.split('\n');
    this.context = {
      implementation,
      indentation: this.detectIndentation(),
      useCustomErrors: false,
      preserveComments: true,
      ...context,
    };
  }

  /**
   * Apply a single patch
   */
  applyPatch(patch: Patch): { success: boolean; result?: string; error?: string } {
    try {
      switch (patch.type) {
        case 'insert':
          return this.applyInsert(patch);
        case 'replace':
          return this.applyReplace(patch);
        case 'delete':
          return this.applyDelete(patch);
        default:
          return { success: false, error: `Unknown patch type: ${patch.type}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Apply multiple patches in order
   */
  applyPatches(patches: Patch[]): PatchResult {
    const appliedPatches: Patch[] = [];
    const failedPatches: Array<{ patch: Patch; reason: string }> = [];
    
    // Sort patches by line number in reverse order (apply from bottom to top)
    // This prevents line number shifts from affecting subsequent patches
    const sortedPatches = [...patches].sort((a, b) => b.line - a.line);

    for (const patch of sortedPatches) {
      const result = this.applyPatch(patch);
      
      if (result.success && result.result) {
        this.implementation = result.result;
        this.lines = this.implementation.split('\n');
        appliedPatches.push(patch);
      } else {
        failedPatches.push({ 
          patch, 
          reason: result.error ?? 'Unknown failure' 
        });
      }
    }

    // Generate diff
    const patchDiff = diff.createPatch(
      'implementation',
      this.context.implementation,
      this.implementation,
      'original',
      'patched'
    );

    return {
      success: failedPatches.length === 0,
      patchedCode: this.implementation,
      appliedPatches: appliedPatches.reverse(), // Restore original order
      failedPatches,
      diff: patchDiff,
    };
  }

  /**
   * Preview patches without applying
   */
  previewPatches(patches: Patch[]): string {
    const tempPatcher = new CodePatcher(this.implementation, this.context);
    const result = tempPatcher.applyPatches(patches);
    return result.diff;
  }

  /**
   * Get the current patched code
   */
  getCode(): string {
    return this.implementation;
  }

  /**
   * Get patch context
   */
  getContext(): PatchContext {
    return this.context;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private applyInsert(patch: Patch): { success: boolean; result?: string; error?: string } {
    if (!patch.content) {
      return { success: false, error: 'Insert patch requires content' };
    }

    const lineIndex = patch.line - 1; // Convert to 0-based

    if (lineIndex < 0 || lineIndex > this.lines.length) {
      return { success: false, error: `Line ${patch.line} out of range` };
    }

    // Handle column-specific insertion
    if (patch.column !== undefined && patch.column > 0 && lineIndex < this.lines.length) {
      const line = this.lines[lineIndex]!;
      const col = patch.column - 1;
      const newLine = line.slice(0, col) + patch.content + line.slice(col);
      this.lines[lineIndex] = newLine;
    } else {
      // Insert as new line(s)
      const newLines = patch.content.split('\n');
      this.lines.splice(lineIndex, 0, ...newLines);
    }

    return { success: true, result: this.lines.join('\n') };
  }

  private applyReplace(patch: Patch): { success: boolean; result?: string; error?: string } {
    if (!patch.original || patch.replacement === undefined) {
      return { success: false, error: 'Replace patch requires original and replacement' };
    }

    const lineIndex = patch.line - 1;

    if (lineIndex < 0 || lineIndex >= this.lines.length) {
      return { success: false, error: `Line ${patch.line} out of range` };
    }

    // Try to find and replace in the specific line first
    const line = this.lines[lineIndex]!;
    
    if (line.includes(patch.original)) {
      this.lines[lineIndex] = line.replace(patch.original, patch.replacement);
      return { success: true, result: this.lines.join('\n') };
    }

    // Try fuzzy matching (ignoring whitespace differences)
    const normalizedOriginal = patch.original.trim();
    const normalizedLine = line.trim();
    
    if (normalizedLine.includes(normalizedOriginal)) {
      const startIdx = line.indexOf(normalizedOriginal);
      if (startIdx >= 0) {
        this.lines[lineIndex] = 
          line.slice(0, startIdx) + 
          patch.replacement + 
          line.slice(startIdx + normalizedOriginal.length);
        return { success: true, result: this.lines.join('\n') };
      }
    }

    // Search nearby lines (within 3 lines)
    for (let offset = -3; offset <= 3; offset++) {
      const idx = lineIndex + offset;
      if (idx >= 0 && idx < this.lines.length && idx !== lineIndex) {
        const nearbyLine = this.lines[idx]!;
        if (nearbyLine.includes(patch.original)) {
          this.lines[idx] = nearbyLine.replace(patch.original, patch.replacement);
          return { success: true, result: this.lines.join('\n') };
        }
      }
    }

    // Try whole-file search as last resort
    const fullContent = this.lines.join('\n');
    if (fullContent.includes(patch.original)) {
      return { 
        success: true, 
        result: fullContent.replace(patch.original, patch.replacement) 
      };
    }

    return { 
      success: false, 
      error: `Could not find "${patch.original.slice(0, 50)}..." in implementation` 
    };
  }

  private applyDelete(patch: Patch): { success: boolean; result?: string; error?: string } {
    const startLine = patch.line - 1;
    const endLine = (patch.endLine ?? patch.line) - 1;

    if (startLine < 0 || endLine >= this.lines.length) {
      return { success: false, error: `Lines ${patch.line}-${patch.endLine ?? patch.line} out of range` };
    }

    this.lines.splice(startLine, endLine - startLine + 1);
    return { success: true, result: this.lines.join('\n') };
  }

  private detectIndentation(): string {
    // Find the most common indentation
    const indentCounts = new Map<string, number>();

    for (const line of this.lines) {
      const match = line.match(/^(\s+)/);
      if (match) {
        const indent = match[1]!;
        const baseIndent = indent.length <= 4 ? indent : indent.slice(0, 2);
        indentCounts.set(baseIndent, (indentCounts.get(baseIndent) ?? 0) + 1);
      }
    }

    // Return most common or default to 2 spaces
    let maxCount = 0;
    let mostCommon = '  ';

    for (const [indent, count] of indentCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = indent;
      }
    }

    return mostCommon;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a simple patch
 */
export function createPatch(
  type: Patch['type'],
  line: number,
  options: Partial<Omit<Patch, 'type' | 'line'>>
): Patch {
  return {
    type,
    file: options.file ?? 'implementation',
    line,
    description: options.description ?? `${type} at line ${line}`,
    confidence: options.confidence ?? 0.8,
    ...options,
  };
}

/**
 * Create an insertion patch
 */
export function insertPatch(
  line: number,
  content: string,
  description: string,
  confidence: number = 0.8
): Patch {
  return createPatch('insert', line, { content, description, confidence });
}

/**
 * Create a replacement patch
 */
export function replacePatch(
  line: number,
  original: string,
  replacement: string,
  description: string,
  confidence: number = 0.8
): Patch {
  return createPatch('replace', line, { original, replacement, description, confidence });
}

/**
 * Create a deletion patch
 */
export function deletePatch(
  line: number,
  endLine: number | undefined,
  description: string,
  confidence: number = 0.8
): Patch {
  return createPatch('delete', line, { endLine, description, confidence });
}

/**
 * Merge overlapping patches (prefer higher confidence)
 */
export function mergePatches(patches: Patch[]): Patch[] {
  // Sort by line and confidence
  const sorted = [...patches].sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return b.confidence - a.confidence;
  });

  const merged: Patch[] = [];
  const usedLines = new Set<number>();

  for (const patch of sorted) {
    // Check for overlap
    let hasOverlap = false;
    const startLine = patch.line;
    const endLine = patch.endLine ?? patch.line;

    for (let l = startLine; l <= endLine; l++) {
      if (usedLines.has(l)) {
        hasOverlap = true;
        break;
      }
    }

    if (!hasOverlap) {
      merged.push(patch);
      for (let l = startLine; l <= endLine; l++) {
        usedLines.add(l);
      }
    }
  }

  return merged;
}

/**
 * Format patch for display
 */
export function formatPatch(patch: Patch): string {
  const lines: string[] = [];
  
  lines.push(`[${patch.type.toUpperCase()}] ${patch.description}`);
  lines.push(`  File: ${patch.file}, Line: ${patch.line}`);
  lines.push(`  Confidence: ${(patch.confidence * 100).toFixed(0)}%`);

  if (patch.original) {
    lines.push(`  Original: ${patch.original.slice(0, 60)}${patch.original.length > 60 ? '...' : ''}`);
  }
  if (patch.replacement !== undefined) {
    lines.push(`  Replacement: ${patch.replacement.slice(0, 60)}${patch.replacement.length > 60 ? '...' : ''}`);
  }
  if (patch.content) {
    const contentPreview = patch.content.split('\n')[0] ?? '';
    lines.push(`  Content: ${contentPreview.slice(0, 60)}${contentPreview.length > 60 ? '...' : ''}`);
  }

  return lines.join('\n');
}
