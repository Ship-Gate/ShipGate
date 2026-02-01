/**
 * ISL Go to Definition Provider
 * 
 * Provides navigation to definitions of types, entities, and behaviors.
 */

import { Location, Position, Range } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLDocument } from './documents.js';
import type { SourceSpan } from '@intentos/isl-core';

export function getDefinition(
  islDoc: ISLDocument,
  document: TextDocument,
  position: Position
): Location | null {
  const word = getWordAtPosition(document, position);
  if (!word) return null;

  const ast = islDoc.ast;
  if (!ast) return null;

  // Look for entity definition
  const entity = ast.entities.find((e) => e.name.name === word);
  if (entity) {
    return {
      uri: islDoc.uri,
      range: spanToRange(entity.name.span),
    };
  }

  // Look for behavior definition
  const behavior = ast.behaviors.find((b) => b.name.name === word);
  if (behavior) {
    return {
      uri: islDoc.uri,
      range: spanToRange(behavior.name.span),
    };
  }

  // Look for enum definition
  const enumDecl = ast.enums.find((e) => e.name.name === word);
  if (enumDecl) {
    return {
      uri: islDoc.uri,
      range: spanToRange(enumDecl.name.span),
    };
  }

  // Look for type definition
  const typeDecl = ast.types.find((t) => t.name.name === word);
  if (typeDecl) {
    return {
      uri: islDoc.uri,
      range: spanToRange(typeDecl.name.span),
    };
  }

  // Look for field definition within entities
  for (const entity of ast.entities) {
    const field = entity.fields.find((f) => f.name.name === word);
    if (field) {
      return {
        uri: islDoc.uri,
        range: spanToRange(field.name.span),
      };
    }
  }

  // Look for field definition within behavior inputs
  for (const behavior of ast.behaviors) {
    if (behavior.input) {
      const field = behavior.input.fields.find((f) => f.name.name === word);
      if (field) {
        return {
          uri: islDoc.uri,
          range: spanToRange(field.name.span),
        };
      }
    }
  }

  // Look for error definition
  for (const behavior of ast.behaviors) {
    if (behavior.output) {
      const error = behavior.output.errors.find((e) => e.name.name === word);
      if (error) {
        return {
          uri: islDoc.uri,
          range: spanToRange(error.name.span),
        };
      }
    }
  }

  // Look for enum variant
  for (const enumDecl of ast.enums) {
    const variantIndex = enumDecl.variants.findIndex((v) => v.name === word);
    if (variantIndex !== -1) {
      const variant = enumDecl.variants[variantIndex];
      if (variant) {
        return {
          uri: islDoc.uri,
          range: spanToRange(variant.span),
        };
      }
    }
  }

  // Look for invariant block definition
  for (const invariant of ast.invariants) {
    if (invariant.name.name === word) {
      return {
        uri: islDoc.uri,
        range: spanToRange(invariant.name.span),
      };
    }
  }

  return null;
}

/**
 * Find all references to a symbol
 */
export function findReferences(
  islDoc: ISLDocument,
  document: TextDocument,
  position: Position
): Location[] {
  const word = getWordAtPosition(document, position);
  if (!word) return [];

  const locations: Location[] = [];
  const text = document.getText();
  
  // Find all occurrences of the word
  const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g');
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const startPos = document.positionAt(match.index);
    const endPos = document.positionAt(match.index + word.length);
    
    locations.push({
      uri: islDoc.uri,
      range: {
        start: startPos,
        end: endPos,
      },
    });
  }

  return locations;
}

/**
 * Get the word at the given position
 */
function getWordAtPosition(document: TextDocument, position: Position): string | null {
  const text = document.getText();
  const offset = document.offsetAt(position);
  
  // Find word boundaries
  let start = offset;
  let end = offset;
  
  while (start > 0 && isWordChar(text[start - 1]!)) {
    start--;
  }
  
  while (end < text.length && isWordChar(text[end]!)) {
    end++;
  }
  
  if (start === end) return null;
  
  return text.substring(start, end);
}

function isWordChar(char: string): boolean {
  return /[a-zA-Z0-9_]/.test(char);
}

/**
 * Convert ISL SourceSpan to LSP Range
 */
function spanToRange(span: SourceSpan): Range {
  return {
    start: {
      line: span.start.line - 1, // LSP is 0-based, ISL is 1-based
      character: span.start.column - 1,
    },
    end: {
      line: span.end.line - 1,
      character: span.end.column - 1,
    },
  };
}

/**
 * Escape special regex characters
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
