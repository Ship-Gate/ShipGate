// ============================================================================
// ISL Formatting Provider
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TextEdit, Range } from 'vscode-languageserver';

export class ISLFormattingProvider {
  provideFormatting(document: TextDocument): TextEdit[] {
    const text = document.getText();
    const formatted = this.formatISL(text);
    
    if (formatted === text) return [];

    return [{
      range: {
        start: { line: 0, character: 0 },
        end: { line: document.lineCount, character: 0 },
      },
      newText: formatted,
    }];
  }

  private formatISL(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let indentLevel = 0;
    const indentStr = '  '; // 2 spaces

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Skip empty lines (but preserve one)
      if (line === '') {
        if (result.length > 0 && result[result.length - 1] !== '') {
          result.push('');
        }
        continue;
      }

      // Decrease indent before closing brace
      if (line.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Apply indentation
      const indented = indentStr.repeat(indentLevel) + line;
      result.push(indented);

      // Increase indent after opening brace
      if (line.endsWith('{')) {
        indentLevel++;
      }

      // Add blank line after closing major blocks
      if (line === '}' && indentLevel === 1) {
        result.push('');
      }
    }

    // Ensure file ends with newline
    if (result[result.length - 1] !== '') {
      result.push('');
    }

    return result.join('\n');
  }
}
