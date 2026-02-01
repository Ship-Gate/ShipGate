// ============================================================================
// ISL Semantic Tokens Provider
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { ISLDocumentManager } from '../documents';
import type { SemanticToken, SemanticTokenType, SemanticTokenModifier } from '../types';

export const TOKEN_TYPES: SemanticTokenType[] = [
  'namespace',
  'type',
  'class',
  'enum',
  'interface',
  'struct',
  'typeParameter',
  'parameter',
  'variable',
  'property',
  'enumMember',
  'function',
  'method',
  'keyword',
  'modifier',
  'comment',
  'string',
  'number',
  'regexp',
  'operator',
  'decorator',
];

export const TOKEN_MODIFIERS: SemanticTokenModifier[] = [
  'declaration',
  'definition',
  'readonly',
  'static',
  'deprecated',
  'abstract',
  'async',
  'modification',
  'documentation',
  'defaultLibrary',
];

const KEYWORDS = new Set([
  'domain', 'entity', 'behavior', 'type', 'invariant', 'policy', 'view', 'scenario',
  'input', 'output', 'pre', 'post', 'error', 'lifecycle', 'temporal', 'security',
  'version', 'description', 'forall', 'exists', 'implies', 'and', 'or', 'not',
  'old', 'result', 'true', 'false', 'null', 'given', 'when', 'then',
]);

const BUILTIN_TYPES = new Set([
  'String', 'Int', 'Boolean', 'UUID', 'Timestamp', 'Decimal', 'Duration',
  'Date', 'Time', 'List', 'Map', 'Set', 'Optional',
]);

export class ISLSemanticTokensProvider {
  constructor(private documentManager: ISLDocumentManager) {}

  provideTokens(document: TextDocument): SemanticToken[] {
    const tokens: SemanticToken[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      this.tokenizeLine(line, lineNum, tokens);
    }

    return tokens;
  }

  private tokenizeLine(line: string, lineNum: number, tokens: SemanticToken[]): void {
    // Comments
    const commentMatch = line.match(/\/\/.*/);
    if (commentMatch) {
      const start = line.indexOf('//');
      tokens.push({
        line: lineNum,
        startChar: start,
        length: line.length - start,
        tokenType: 'comment',
        tokenModifiers: [],
      });
      return; // Don't process rest of line
    }

    // Strings
    const stringRegex = /"[^"]*"/g;
    let stringMatch;
    while ((stringMatch = stringRegex.exec(line)) !== null) {
      tokens.push({
        line: lineNum,
        startChar: stringMatch.index,
        length: stringMatch[0].length,
        tokenType: 'string',
        tokenModifiers: [],
      });
    }

    // Numbers
    const numberRegex = /\b\d+(\.\d+)?\b/g;
    let numberMatch;
    while ((numberMatch = numberRegex.exec(line)) !== null) {
      tokens.push({
        line: lineNum,
        startChar: numberMatch.index,
        length: numberMatch[0].length,
        tokenType: 'number',
        tokenModifiers: [],
      });
    }

    // Annotations
    const annotationRegex = /@\w+/g;
    let annotationMatch;
    while ((annotationMatch = annotationRegex.exec(line)) !== null) {
      tokens.push({
        line: lineNum,
        startChar: annotationMatch.index,
        length: annotationMatch[0].length,
        tokenType: 'decorator',
        tokenModifiers: [],
      });
    }

    // Keywords and identifiers
    const wordRegex = /\b[a-zA-Z_]\w*\b/g;
    let wordMatch;
    while ((wordMatch = wordRegex.exec(line)) !== null) {
      const word = wordMatch[0];
      const startChar = wordMatch.index;

      // Skip if already tokenized (in string)
      if (this.isInString(line, startChar)) continue;

      if (KEYWORDS.has(word)) {
        tokens.push({
          line: lineNum,
          startChar,
          length: word.length,
          tokenType: 'keyword',
          tokenModifiers: [],
        });
      } else if (BUILTIN_TYPES.has(word)) {
        tokens.push({
          line: lineNum,
          startChar,
          length: word.length,
          tokenType: 'type',
          tokenModifiers: ['defaultLibrary'],
        });
      } else if (/^[A-Z]/.test(word)) {
        // Check context for type vs class
        const beforeWord = line.substring(0, startChar).trim();
        if (beforeWord.endsWith('entity') || beforeWord.endsWith('type')) {
          tokens.push({
            line: lineNum,
            startChar,
            length: word.length,
            tokenType: 'class',
            tokenModifiers: ['declaration'],
          });
        } else if (beforeWord.endsWith('behavior')) {
          tokens.push({
            line: lineNum,
            startChar,
            length: word.length,
            tokenType: 'function',
            tokenModifiers: ['declaration'],
          });
        } else if (beforeWord.endsWith(':') || beforeWord.endsWith('<') || beforeWord.endsWith(',')) {
          tokens.push({
            line: lineNum,
            startChar,
            length: word.length,
            tokenType: 'type',
            tokenModifiers: [],
          });
        } else {
          tokens.push({
            line: lineNum,
            startChar,
            length: word.length,
            tokenType: 'class',
            tokenModifiers: [],
          });
        }
      } else if (line.includes(':') && startChar < line.indexOf(':')) {
        // Field name (before colon)
        tokens.push({
          line: lineNum,
          startChar,
          length: word.length,
          tokenType: 'property',
          tokenModifiers: [],
        });
      }
    }
  }

  private isInString(line: string, position: number): boolean {
    let inString = false;
    for (let i = 0; i < position; i++) {
      if (line[i] === '"' && (i === 0 || line[i - 1] !== '\\')) {
        inString = !inString;
      }
    }
    return inString;
  }
}
