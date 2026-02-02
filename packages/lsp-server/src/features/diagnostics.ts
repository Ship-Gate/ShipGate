// ============================================================================
// ISL Diagnostics Provider
// Provides diagnostics from the analyzer with import-aware and semantic lint support
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Diagnostic, Range, DiagnosticRelatedInformation } from 'vscode-languageserver';
import { DiagnosticSeverity as LSPDiagnosticSeverity } from 'vscode-languageserver';
import type { ISLDocumentManager } from '../documents';
import { ISLDocumentManager as DocManager } from '../documents';
import type { ISLDiagnostic, SourceLocation } from '@isl-lang/lsp-core';
import { ISLImportResolver, type ImportResolutionResult, type ExportedSymbol } from './import-resolver';
import { ISLSemanticLinter } from './semantic-linter';

// ============================================================================
// Types
// ============================================================================

export interface DiagnosticsResult {
  /** Standard diagnostics from parser and type checker */
  diagnostics: Diagnostic[];
  /** Import resolution result with imported symbols */
  importResolution?: ImportResolutionResult;
}

export interface DiagnosticsOptions {
  /** Enable import-aware diagnostics */
  resolveImports?: boolean;
  /** Enable semantic lint warnings */
  semanticLinting?: boolean;
  /** Disabled lint rules */
  disabledRules?: string[];
}

// ============================================================================
// Diagnostics Provider
// ============================================================================

export class ISLDiagnosticsProvider {
  private importResolver: ISLImportResolver;
  private semanticLinter: ISLSemanticLinter;
  private options: DiagnosticsOptions = {
    resolveImports: true,
    semanticLinting: true,
    disabledRules: [],
  };

  constructor(private documentManager: ISLDocumentManager) {
    this.importResolver = new ISLImportResolver();
    this.semanticLinter = new ISLSemanticLinter();
  }

  /**
   * Configure diagnostics options
   */
  configure(options: Partial<DiagnosticsOptions>): void {
    this.options = { ...this.options, ...options };
    if (options.disabledRules) {
      this.semanticLinter.configureRules([], options.disabledRules);
    }
  }

  /**
   * Get disabled rules
   */
  getDisabledRules(): string[] {
    return this.options.disabledRules || [];
  }

  /**
   * Get the import resolver (for testing)
   */
  getImportResolver(): ISLImportResolver {
    return this.importResolver;
  }

  /**
   * Get the semantic linter (for testing)
   */
  getSemanticLinter(): ISLSemanticLinter {
    return this.semanticLinter;
  }

  /**
   * Get diagnostics for a document
   * This method returns LSP-compatible diagnostics
   */
  provideDiagnostics(document: TextDocument): Diagnostic[] {
    // Ensure document is parsed
    this.documentManager.updateDocument(document, true);

    // Get diagnostics from the analyzer (lsp-core)
    const islDiagnostics = this.documentManager.getDiagnostics(document.uri);

    // Convert to LSP diagnostics
    let diagnostics = islDiagnostics.map(d => this.convertDiagnostic(d, document.uri));

    // Add semantic lint diagnostics if enabled
    if (this.options.semanticLinting) {
      const parsed = this.documentManager.getDocument(document.uri);
      if (parsed?.domain) {
        const lintDiagnostics = this.semanticLinter.lint(parsed.domain, document.uri);
        const lintConverted = lintDiagnostics.map(d => this.convertDiagnostic(d, document.uri));
        
        // Merge diagnostics, preferring ones with data (from our linter)
        diagnostics = this.deduplicateDiagnostics([...diagnostics, ...lintConverted]);
      }
    }

    // Filter out disabled rules (applies to both lsp-core and our linter)
    const disabledRules = this.options.disabledRules || [];
    if (disabledRules.length > 0) {
      diagnostics = diagnostics.filter(d => 
        !d.code || !disabledRules.includes(String(d.code))
      );
    }

    return diagnostics;
  }

  /**
   * Deduplicate diagnostics, preferring ones with data field
   */
  private deduplicateDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
    const byKey = new Map<string, Diagnostic>();
    
    for (const d of diagnostics) {
      // Create a key based on code and start position
      const key = `${d.code}:${d.range.start.line}:${d.range.start.character}`;
      
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, d);
      } else {
        // Prefer the one with data (more context for quick fixes)
        if (d.data && !existing.data) {
          byKey.set(key, d);
        }
      }
    }
    
    return Array.from(byKey.values());
  }

  /**
   * Get diagnostics with import resolution (async)
   * Returns both diagnostics and import resolution info
   */
  async provideDiagnosticsWithImports(document: TextDocument): Promise<DiagnosticsResult> {
    // Get base diagnostics
    const diagnostics = this.provideDiagnostics(document);

    // Skip import resolution if disabled or no domain
    if (!this.options.resolveImports) {
      return { diagnostics };
    }

    const parsed = this.documentManager.getDocument(document.uri);
    if (!parsed?.domain) {
      return { diagnostics };
    }

    // Resolve imports
    const importResolution = await this.importResolver.resolveImports(
      document.uri,
      parsed.domain
    );

    // Add import diagnostics
    for (const importDiag of importResolution.diagnostics) {
      diagnostics.push(this.convertDiagnostic(importDiag, document.uri));
    }

    return {
      diagnostics,
      importResolution,
    };
  }

  /**
   * Validate type references against imported symbols
   * Returns diagnostics for types that reference imported symbols
   */
  validateImportedReferences(
    document: TextDocument,
    importedSymbols: Map<string, ExportedSymbol>
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const parsed = this.documentManager.getDocument(document.uri);
    if (!parsed?.domain) return diagnostics;

    // Track which imported symbols are actually used
    const usedImports = new Set<string>();

    // Check type references in entities
    for (const entity of parsed.domain.entities) {
      for (const field of entity.fields) {
        this.checkTypeReference(field.type, importedSymbols, usedImports, diagnostics, document.uri);
      }
    }

    // Check type references in behaviors
    for (const behavior of parsed.domain.behaviors) {
      for (const field of behavior.input.fields) {
        this.checkTypeReference(field.type, importedSymbols, usedImports, diagnostics, document.uri);
      }
      this.checkTypeReference(behavior.output.success, importedSymbols, usedImports, diagnostics, document.uri);
    }

    // Warn about unused imports
    for (const [name, symbol] of importedSymbols) {
      if (!usedImports.has(name)) {
        // Find the import location for this symbol
        const importLocation = this.findImportLocation(parsed.domain, name);
        if (importLocation) {
          diagnostics.push({
            range: DocManager.toRange(importLocation),
            message: `Imported '${name}' is never used`,
            severity: LSPDiagnosticSeverity.Hint,
            code: 'ISL2003',
            source: 'isl-import-resolver',
            data: {
              type: 'unused-import',
              symbolName: name,
              originalName: symbol.name,
            },
          });
        }
      }
    }

    return diagnostics;
  }

  /**
   * Check a type reference for imported symbol usage
   */
  private checkTypeReference(
    typeDef: unknown,
    importedSymbols: Map<string, ExportedSymbol>,
    usedImports: Set<string>,
    _diagnostics: Diagnostic[],
    _uri: string
  ): void {
    if (!typeDef || typeof typeDef !== 'object') return;
    const t = typeDef as Record<string, unknown>;

    if (t.kind === 'ReferenceType' && t.name && typeof t.name === 'object') {
      const name = t.name as { parts?: Array<{ name: string; location: SourceLocation }> };
      if (name.parts && name.parts.length > 0) {
        const part = name.parts[0];
        if (part && importedSymbols.has(part.name)) {
          usedImports.add(part.name);
        }
      }
    }

    // Recurse into container types
    if (t.element) this.checkTypeReference(t.element, importedSymbols, usedImports, _diagnostics, _uri);
    if (t.key) this.checkTypeReference(t.key, importedSymbols, usedImports, _diagnostics, _uri);
    if (t.value) this.checkTypeReference(t.value, importedSymbols, usedImports, _diagnostics, _uri);
    if (t.inner) this.checkTypeReference(t.inner, importedSymbols, usedImports, _diagnostics, _uri);
    if (t.base) this.checkTypeReference(t.base, importedSymbols, usedImports, _diagnostics, _uri);
  }

  /**
   * Find the import location for a symbol name
   */
  private findImportLocation(domain: { imports: Array<{ items: Array<{ name: { name: string; location: SourceLocation }; alias?: { name: string; location: SourceLocation } }> }> }, name: string): SourceLocation | undefined {
    for (const imp of domain.imports) {
      for (const item of imp.items) {
        const importedName = item.alias?.name || item.name.name;
        if (importedName === name) {
          return item.alias?.location || item.name.location;
        }
      }
    }
    return undefined;
  }

  /**
   * Convert ISL diagnostic to LSP diagnostic
   */
  private convertDiagnostic(d: ISLDiagnostic, documentUri: string): Diagnostic {
    const relatedInfo: DiagnosticRelatedInformation[] | undefined = d.relatedInfo?.map(r => ({
      location: {
        uri: r.location.file !== d.location.file ? this.toFileUri(r.location.file) : documentUri,
        range: DocManager.toRange(r.location),
      },
      message: r.message,
    }));

    return {
      range: DocManager.toRange(d.location),
      message: d.message,
      severity: d.severity as 1 | 2 | 3 | 4,
      code: d.code,
      source: d.source,
      relatedInformation: relatedInfo,
      data: d.data,
    };
  }

  /**
   * Convert file path to URI if needed
   */
  private toFileUri(filePath: string): string {
    if (filePath.startsWith('file://')) {
      return filePath;
    }
    // Simple conversion - in production would use vscode-uri
    return `file://${filePath.replace(/\\/g, '/')}`;
  }
}
