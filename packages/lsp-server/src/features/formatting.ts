// ============================================================================
// ISL Document Formatting Provider
// Consistent formatting for ISL files
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { FormattingOptions } from 'vscode-languageserver';
import { TextEdit } from 'vscode-languageserver';

export class ISLFormattingProvider {
  format(document: TextDocument, options: FormattingOptions): TextEdit[] {
    const text = document.getText();
    const formatted = this.formatSource(text, options);

    // Only return edit if there are changes
    if (formatted === text) {
      return [];
    }

    return [
      TextEdit.replace(
        {
          start: { line: 0, character: 0 },
          end: document.positionAt(text.length),
        },
        formatted
      ),
    ];
  }

  private formatSource(source: string, options: FormattingOptions): string {
    const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
    const lines = source.split('\n');
    const result: string[] = [];

    let indentLevel = 0;
    let inComment = false;
    let prevLineWasEmpty = false;
    let prevLineWasOpenBrace = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const trimmed = line.trim();

      // Skip empty lines at start
      if (result.length === 0 && trimmed === '') {
        continue;
      }

      // Handle multi-line comments (if ISL supports them)
      if (trimmed.startsWith('/*')) inComment = true;
      if (trimmed.endsWith('*/')) inComment = false;

      // Handle comments
      if (trimmed.startsWith('#') || trimmed.startsWith('//') || inComment) {
        result.push(indent.repeat(indentLevel) + trimmed);
        prevLineWasEmpty = false;
        prevLineWasOpenBrace = false;
        continue;
      }

      // Decrease indent before closing brace
      if (trimmed.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Handle empty lines - max 1 consecutive
      if (trimmed === '') {
        if (!prevLineWasEmpty && !prevLineWasOpenBrace && result.length > 0) {
          result.push('');
          prevLineWasEmpty = true;
        }
        continue;
      }

      // Add blank line before top-level declarations (except first)
      const isTopLevel = this.isTopLevelDeclaration(trimmed);
      if (isTopLevel && result.length > 0 && !prevLineWasEmpty && indentLevel <= 1) {
        const prevLine = result[result.length - 1]?.trim() || '';
        if (prevLine !== '' && prevLine !== '{' && !prevLine.startsWith('#')) {
          result.push('');
        }
      }

      // Format the line
      const formattedLine = this.formatLine(trimmed, indentLevel, indent);
      result.push(formattedLine);

      // Increase indent after opening brace
      if (trimmed.endsWith('{')) {
        indentLevel++;
        prevLineWasOpenBrace = true;
      } else {
        prevLineWasOpenBrace = false;
      }

      prevLineWasEmpty = false;
    }

    // Remove trailing empty lines
    while (result.length > 0 && result[result.length - 1]?.trim() === '') {
      result.pop();
    }

    // Ensure file ends with newline
    return result.join('\n') + '\n';
  }

  private isTopLevelDeclaration(line: string): boolean {
    return (
      line.startsWith('entity ') ||
      line.startsWith('behavior ') ||
      line.startsWith('type ') ||
      line.startsWith('enum ') ||
      line.startsWith('invariants ') ||
      line.startsWith('invariant ') ||
      line.startsWith('policy ') ||
      line.startsWith('view ') ||
      line.startsWith('scenarios ') ||
      line.startsWith('chaos ')
    );
  }

  private formatLine(line: string, indentLevel: number, indent: string): string {
    // Apply base indentation
    let formatted = indent.repeat(indentLevel) + line;

    // Normalize whitespace around operators
    formatted = this.normalizeOperators(formatted);

    // Normalize colons (field: Type, not field :Type)
    formatted = this.normalizeColons(formatted);

    // Normalize braces
    formatted = this.normalizeBraces(formatted);

    // Normalize annotations
    formatted = this.normalizeAnnotations(formatted);

    return formatted;
  }

  private normalizeOperators(line: string): string {
    // Preserve indentation
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1] : '';
    let content = line.trim();

    // Normalize comparison operators
    content = content.replace(/\s*==\s*/g, ' == ');
    content = content.replace(/\s*!=\s*/g, ' != ');
    content = content.replace(/\s*<=\s*/g, ' <= ');
    content = content.replace(/\s*>=\s*/g, ' >= ');
    content = content.replace(/\s*<\s*/g, ' < ');
    content = content.replace(/\s*>\s*/g, ' > ');

    // Normalize logical operators
    content = content.replace(/\s+and\s+/g, ' and ');
    content = content.replace(/\s+or\s+/g, ' or ');
    content = content.replace(/\s+implies\s+/g, ' implies ');

    // Normalize arithmetic operators
    content = content.replace(/\s*\+\s*/g, ' + ');
    content = content.replace(/\s*-\s*/g, ' - ');
    content = content.replace(/\s*\*\s*/g, ' * ');
    content = content.replace(/\s*\/\s*/g, ' / ');

    // Fix generic types (no spaces in <T>)
    content = content.replace(/< /g, '<');
    content = content.replace(/ >/g, '>');
    content = content.replace(/, /g, ', ');

    // Fix negative numbers and arrows
    content = content.replace(/ - > /g, ' -> ');
    content = content.replace(/ - (\d)/g, ' -$1');

    return indent + content;
  }

  private normalizeColons(line: string): string {
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1] : '';
    let content = line.trim();

    // Field declarations: name: Type
    content = content.replace(/(\w+)\s*:\s*/g, '$1: ');

    // Version/description strings: key: "value"
    // Already handled by above

    return indent + content;
  }

  private normalizeBraces(line: string): string {
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1] : '';
    let content = line.trim();

    // Opening brace on same line as declaration
    content = content.replace(/\s*\{\s*$/, ' {');

    // Space before opening brace
    content = content.replace(/(\S)\{/g, '$1 {');

    return indent + content;
  }

  private normalizeAnnotations(line: string): string {
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1] : '';
    let content = line.trim();

    // Normalize annotation brackets
    content = content.replace(/\[\s+/g, '[');
    content = content.replace(/\s+\]/g, ']');

    // Normalize comma-separated annotations
    content = content.replace(/,\s*/g, ', ');
    content = content.replace(/,\s+\]/g, ']');

    return indent + content;
  }
}
