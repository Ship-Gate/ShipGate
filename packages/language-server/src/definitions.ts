/**
 * ISL Go to Definition
 */

import {
  Definition,
  Location,
  Position,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLAnalyzer } from './analyzer';

/**
 * Get definition location for symbol at position
 */
export function getDefinition(
  document: TextDocument,
  position: Position,
  analyzer: ISLAnalyzer
): Definition | null {
  const text = document.getText();
  const offset = document.offsetAt(position);
  const word = getWordAtPosition(text, offset);

  if (!word) return null;

  // Find symbol definition
  const symbol = analyzer.findDefinition(word);
  
  if (symbol) {
    return {
      uri: symbol.uri,
      range: symbol.range,
    };
  }

  // Check for local definitions within the same document
  const localDef = findLocalDefinition(document, word, position);
  if (localDef) {
    return localDef;
  }

  return null;
}

function getWordAtPosition(text: string, offset: number): string | null {
  let start = offset;
  let end = offset;

  while (start > 0) {
    const char = text[start - 1];
    if (!char || !/\w/.test(char)) break;
    start--;
  }

  while (end < text.length) {
    const char = text[end];
    if (!char || !/\w/.test(char)) break;
    end++;
  }

  if (start === end) return null;

  return text.substring(start, end);
}

function findLocalDefinition(
  document: TextDocument,
  word: string,
  _position: Position
): Location | null {
  const text = document.getText();
  const lines = text.split('\n');

  // Patterns for definitions
  const patterns = [
    new RegExp(`^\\s*type\\s+${word}\\s*=`, 'm'),
    new RegExp(`^\\s*entity\\s+${word}\\s*{`, 'm'),
    new RegExp(`^\\s*behavior\\s+${word}\\s*{`, 'm'),
    new RegExp(`^\\s*enum\\s+${word}\\s*{`, 'm'),
    new RegExp(`^\\s*domain\\s+${word}\\s*{`, 'm'),
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    for (const pattern of patterns) {
      if (pattern.test(line)) {
        const charIndex = line.indexOf(word);
        return {
          uri: document.uri,
          range: {
            start: { line: i, character: charIndex },
            end: { line: i, character: charIndex + word.length },
          },
        };
      }
    }
  }

  return null;
}
