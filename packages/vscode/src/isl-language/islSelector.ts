/**
 * ISL Document Selector
 * 
 * Provides document selectors and language identifiers for ISL files.
 * Used by diagnostics, quick fixes, and other language features.
 */

import type * as vscode from 'vscode';

// ============================================================================
// Constants
// ============================================================================

/** Language identifier for ISL files */
export const ISL_LANGUAGE_ID = 'isl';

/** File extension for ISL files */
export const ISL_FILE_EXTENSION = '.isl';

// ============================================================================
// Document Selectors
// ============================================================================

/**
 * Document selector for ISL files.
 * Use this when registering VS Code language features.
 */
export const ISL_SELECTOR: vscode.DocumentSelector = {
  language: ISL_LANGUAGE_ID,
  scheme: 'file',
};

/**
 * Document selector that includes untitled ISL documents.
 */
export const ISL_SELECTOR_ALL: vscode.DocumentSelector = [
  { language: ISL_LANGUAGE_ID, scheme: 'file' },
  { language: ISL_LANGUAGE_ID, scheme: 'untitled' },
];

/**
 * Document filter for ISL files (single filter).
 */
export const ISL_FILTER: vscode.DocumentFilter = {
  language: ISL_LANGUAGE_ID,
  scheme: 'file',
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a document is an ISL file.
 * @param document - The document to check
 * @returns true if the document is an ISL file
 */
export function isISLDocument(document: vscode.TextDocument): boolean {
  return document.languageId === ISL_LANGUAGE_ID;
}

/**
 * Check if a URI points to an ISL file.
 * @param uri - The URI to check
 * @returns true if the URI is for an ISL file
 */
export function isISLUri(uri: vscode.Uri): boolean {
  return uri.fsPath.endsWith(ISL_FILE_EXTENSION);
}

/**
 * Get the document selector for ISL files.
 * @param includeUntitled - Whether to include untitled documents
 * @returns Document selector
 */
export function getISLSelector(includeUntitled = false): vscode.DocumentSelector {
  return includeUntitled ? ISL_SELECTOR_ALL : ISL_SELECTOR;
}

/**
 * Create a custom document selector with additional schemes.
 * @param schemes - Additional URI schemes to include
 * @returns Document selector array
 */
export function createISLSelector(
  schemes: string[] = ['file', 'untitled']
): vscode.DocumentSelector {
  return schemes.map((scheme) => ({
    language: ISL_LANGUAGE_ID,
    scheme,
  }));
}
