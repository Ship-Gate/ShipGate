// ============================================================================
// Auto-Fix Generator
// ============================================================================

import type { Finding, ASTFix, SourceLocation } from '../types.js';

/**
 * Text edit representing a change to source code
 */
export interface TextEdit {
  /** Start offset in source */
  startOffset: number;
  /** End offset in source */
  endOffset: number;
  /** Replacement text */
  newText: string;
}

/**
 * Auto-fix result
 */
export interface AutofixResult {
  finding: Finding;
  edits: TextEdit[];
  preview: string;
}

/**
 * Auto-Fix Generator
 * 
 * Converts AST patches from findings into concrete text edits
 * that can be applied to source files.
 */
export class AutofixGenerator {
  /**
   * Generate text edits from a finding's autofix
   */
  generateEdits(finding: Finding, sourceText: string): AutofixResult | null {
    if (!finding.autofix) {
      return null;
    }

    const edits = this.astPatchToEdits(finding.autofix, sourceText);
    const preview = this.generatePreview(finding.autofix);

    return {
      finding,
      edits,
      preview,
    };
  }

  /**
   * Apply edits to source text
   */
  applyEdits(sourceText: string, edits: TextEdit[]): string {
    // Sort edits by position (reverse order to avoid offset issues)
    const sortedEdits = [...edits].sort((a, b) => b.startOffset - a.startOffset);

    let result = sourceText;
    for (const edit of sortedEdits) {
      result = 
        result.slice(0, edit.startOffset) + 
        edit.newText + 
        result.slice(edit.endOffset);
    }

    return result;
  }

  /**
   * Generate all fixes for a set of findings
   */
  generateAllFixes(findings: Finding[], sourceText: string): AutofixResult[] {
    const results: AutofixResult[] = [];

    for (const finding of findings) {
      const result = this.generateEdits(finding, sourceText);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Format autofix as ISL code suggestion
   */
  formatAsSuggestion(autofix: ASTFix): string {
    const lines: string[] = [];
    
    lines.push(`// ${autofix.description}`);
    
    if (autofix.patch.text) {
      lines.push(autofix.patch.text.trim());
    }

    return lines.join('\n');
  }

  // Private methods

  private astPatchToEdits(fix: ASTFix, sourceText: string): TextEdit[] {
    const edits: TextEdit[] = [];
    const location = fix.location;

    switch (fix.operation) {
      case 'add':
        edits.push(this.generateAddEdit(fix, sourceText, location));
        break;
      case 'remove':
        edits.push(this.generateRemoveEdit(fix, sourceText, location));
        break;
      case 'modify':
        edits.push(this.generateModifyEdit(fix, sourceText, location));
        break;
      case 'wrap':
        edits.push(...this.generateWrapEdits(fix, sourceText, location));
        break;
    }

    return edits;
  }

  private generateAddEdit(fix: ASTFix, sourceText: string, location: SourceLocation): TextEdit {
    const patch = fix.patch;
    let offset: number;

    // Calculate offset based on position
    if (patch.position === 'before') {
      offset = this.locationToOffset(sourceText, location.line, location.column);
    } else if (patch.position === 'after') {
      offset = this.locationToOffset(sourceText, location.endLine, location.endColumn);
    } else {
      // 'inside' - find the closing brace of the block
      offset = this.findInsertionPoint(sourceText, location);
    }

    return {
      startOffset: offset,
      endOffset: offset,
      newText: patch.text || '',
    };
  }

  private generateRemoveEdit(_fix: ASTFix, sourceText: string, location: SourceLocation): TextEdit {
    const startOffset = this.locationToOffset(sourceText, location.line, location.column);
    const endOffset = this.locationToOffset(sourceText, location.endLine, location.endColumn);

    return {
      startOffset,
      endOffset,
      newText: '',
    };
  }

  private generateModifyEdit(fix: ASTFix, sourceText: string, location: SourceLocation): TextEdit {
    const startOffset = this.locationToOffset(sourceText, location.line, location.column);
    const endOffset = this.locationToOffset(sourceText, location.endLine, location.endColumn);

    return {
      startOffset,
      endOffset,
      newText: fix.patch.text || '',
    };
  }

  private generateWrapEdits(fix: ASTFix, sourceText: string, location: SourceLocation): TextEdit[] {
    const startOffset = this.locationToOffset(sourceText, location.line, location.column);
    const endOffset = this.locationToOffset(sourceText, location.endLine, location.endColumn);
    const wrapperKind = fix.patch.wrapperKind || 'block';

    return [
      {
        startOffset,
        endOffset: startOffset,
        newText: `${wrapperKind} {\n  `,
      },
      {
        startOffset: endOffset,
        endOffset: endOffset,
        newText: '\n}',
      },
    ];
  }

  private locationToOffset(source: string, line: number, column: number): number {
    const lines = source.split('\n');
    let offset = 0;

    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }

    return offset + column - 1;
  }

  private findInsertionPoint(source: string, location: SourceLocation): number {
    // Find the closing brace of the block at the given location
    const startOffset = this.locationToOffset(source, location.line, location.column);
    let braceCount = 0;
    let foundStart = false;

    for (let i = startOffset; i < source.length; i++) {
      const char = source[i];
      
      if (char === '{') {
        braceCount++;
        foundStart = true;
      } else if (char === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          // Insert before the closing brace
          return i;
        }
      }
    }

    // Fallback to end of location
    return this.locationToOffset(source, location.endLine, location.endColumn);
  }

  private generatePreview(fix: ASTFix): string {
    const lines: string[] = [];
    
    lines.push(`Operation: ${fix.operation}`);
    lines.push(`Target: ${fix.targetKind}`);
    lines.push('');
    
    if (fix.patch.text) {
      lines.push('Patch:');
      lines.push('```');
      lines.push(fix.patch.text.trim());
      lines.push('```');
    }

    return lines.join('\n');
  }
}

/**
 * Create an autofix generator
 */
export function createAutofixGenerator(): AutofixGenerator {
  return new AutofixGenerator();
}

/**
 * Quick fix generation
 */
export function generateFix(finding: Finding, sourceText: string): AutofixResult | null {
  return new AutofixGenerator().generateEdits(finding, sourceText);
}

/**
 * Apply all fixes to source
 */
export function applyAllFixes(findings: Finding[], sourceText: string): string {
  const generator = new AutofixGenerator();
  const results = generator.generateAllFixes(findings, sourceText);
  
  // Collect all edits
  const allEdits: TextEdit[] = [];
  for (const result of results) {
    allEdits.push(...result.edits);
  }

  return generator.applyEdits(sourceText, allEdits);
}
