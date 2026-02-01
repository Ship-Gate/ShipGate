/**
 * Formatting Provider
 * 
 * Provides document formatting for ISL documents.
 */

import { TextEdit, Range, FormattingOptions } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLLanguageService } from '../services/language-service.js';

export class FormattingProvider {
  private languageService: ISLLanguageService;

  constructor(languageService: ISLLanguageService) {
    this.languageService = languageService;
  }

  formatDocument(document: TextDocument, options: FormattingOptions): TextEdit[] {
    const content = document.getText();
    const formatted = this.format(content, options);
    
    if (formatted === content) return [];

    return [{
      range: {
        start: { line: 0, character: 0 },
        end: document.positionAt(content.length),
      },
      newText: formatted,
    }];
  }

  formatRange(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[] {
    const content = document.getText(range);
    const formatted = this.format(content, options);
    
    if (formatted === content) return [];

    return [{
      range,
      newText: formatted,
    }];
  }

  private format(content: string, options: FormattingOptions): string {
    const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
    const lines = content.split('\n');
    const result: string[] = [];
    let depth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '') {
        result.push('');
        continue;
      }

      // Decrease indent before closing brace
      if (trimmed.startsWith('}')) {
        depth = Math.max(0, depth - 1);
      }

      // Add indented line
      result.push(indent.repeat(depth) + trimmed);

      // Increase indent after opening brace
      if (trimmed.endsWith('{') && !trimmed.includes('}')) {
        depth++;
      }
    }

    return result.join('\n');
  }
}
