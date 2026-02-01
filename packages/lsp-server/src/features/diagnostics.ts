// ============================================================================
// ISL Diagnostics Provider
// Provides diagnostics from the analyzer
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Diagnostic, Range } from 'vscode-languageserver';
import type { ISLDocumentManager } from '../documents';
import { ISLDocumentManager as DocManager } from '../documents';
import type { ISLDiagnostic } from '@isl-lang/lsp-core';

export class ISLDiagnosticsProvider {
  constructor(private documentManager: ISLDocumentManager) {}

  /**
   * Get diagnostics for a document
   * This method returns LSP-compatible diagnostics
   */
  provideDiagnostics(document: TextDocument): Diagnostic[] {
    // Ensure document is parsed
    this.documentManager.updateDocument(document, true);

    // Get diagnostics from the analyzer
    const islDiagnostics = this.documentManager.getDiagnostics(document.uri);

    // Convert to LSP diagnostics
    return islDiagnostics.map(d => this.convertDiagnostic(d));
  }

  private convertDiagnostic(d: ISLDiagnostic): Diagnostic {
    return {
      range: DocManager.toRange(d.location),
      message: d.message,
      severity: d.severity as 1 | 2 | 3 | 4,
      code: d.code,
      source: d.source,
      relatedInformation: d.relatedInfo?.map(r => ({
        location: {
          uri: d.location.file,
          range: DocManager.toRange(r.location),
        },
        message: r.message,
      })),
    };
  }
}
