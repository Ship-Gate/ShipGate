/**
 * AST Utility Functions
 */

import * as ts from 'typescript';

/**
 * Get source text for a node
 */
export function getSourceText(
  node: ts.Node,
  sourceFile: ts.SourceFile
): string {
  return node.getText(sourceFile);
}

/**
 * Get line and column from position
 */
export function getLineAndColumn(
  position: number,
  sourceFile: ts.SourceFile
): { line: number; column: number } {
  const lineAndChar = sourceFile.getLineAndCharacterOfPosition(position);
  return {
    line: lineAndChar.line + 1, // 1-indexed
    column: lineAndChar.character + 1, // 1-indexed
  };
}

/**
 * Create TypeScript source file from content
 */
export function createSourceFile(
  content: string,
  filePath: string
): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
}
