// ============================================================================
// ISL Import Resolver
// Resolves imports across multiple ISL files
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceLocation, Domain, Import, ImportItem } from '@isl-lang/parser';
import type { ISLDiagnostic } from '@isl-lang/lsp-core';
import { DiagnosticSeverity } from '@isl-lang/lsp-core';
import { URI } from 'vscode-uri';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export interface ResolvedImport {
  /** The import statement in the source file */
  importStatement: Import;
  /** The resolved URI of the imported file */
  resolvedUri: string;
  /** Whether the import was successfully resolved */
  resolved: boolean;
  /** The imported items with their resolution status */
  items: ResolvedImportItem[];
  /** Diagnostics related to this import */
  diagnostics: ISLDiagnostic[];
}

export interface ResolvedImportItem {
  /** The import item from the AST */
  item: ImportItem;
  /** Whether the item exists in the imported file */
  exists: boolean;
  /** The kind of the exported symbol (entity, type, behavior, etc.) */
  kind?: string;
  /** Location of the definition in the source file */
  definitionLocation?: SourceLocation;
}

export interface ExportedSymbol {
  name: string;
  kind: 'entity' | 'type' | 'behavior' | 'invariant' | 'policy' | 'view' | 'enum';
  location: SourceLocation;
  uri: string;
}

export interface ImportResolutionResult {
  /** All resolved imports for a document */
  imports: ResolvedImport[];
  /** All diagnostics from import resolution */
  diagnostics: ISLDiagnostic[];
  /** Map of imported names to their source definitions */
  importedSymbols: Map<string, ExportedSymbol>;
}

// ============================================================================
// Import Resolver
// ============================================================================

export class ISLImportResolver {
  /** Cache of exported symbols per file URI */
  private exportCache = new Map<string, Map<string, ExportedSymbol>>();

  /** File content provider - allows testing without filesystem */
  private fileProvider: (uri: string) => Promise<string | undefined>;

  /** Domain cache for resolved files */
  private domainCache = new Map<string, Domain | undefined>();

  constructor(fileProvider?: (uri: string) => Promise<string | undefined>) {
    this.fileProvider = fileProvider || this.defaultFileProvider;
  }

  /**
   * Resolve all imports in a document
   */
  async resolveImports(
    documentUri: string,
    domain: Domain
  ): Promise<ImportResolutionResult> {
    const result: ImportResolutionResult = {
      imports: [],
      diagnostics: [],
      importedSymbols: new Map(),
    };

    if (!domain.imports || domain.imports.length === 0) {
      return result;
    }

    for (const importStmt of domain.imports) {
      const resolvedImport = await this.resolveImport(documentUri, importStmt);
      result.imports.push(resolvedImport);
      result.diagnostics.push(...resolvedImport.diagnostics);

      // Add successfully imported symbols to the map
      for (const item of resolvedImport.items) {
        if (item.exists && item.definitionLocation) {
          const name = item.item.alias?.name || item.item.name.name;
          result.importedSymbols.set(name, {
            name: item.item.name.name,
            kind: item.kind as ExportedSymbol['kind'],
            location: item.definitionLocation,
            uri: resolvedImport.resolvedUri,
          });
        }
      }
    }

    return result;
  }

  /**
   * Resolve a single import statement
   */
  private async resolveImport(
    documentUri: string,
    importStmt: Import
  ): Promise<ResolvedImport> {
    const diagnostics: ISLDiagnostic[] = [];
    const resolvedUri = this.resolveImportPath(documentUri, importStmt.from.value);

    const result: ResolvedImport = {
      importStatement: importStmt,
      resolvedUri,
      resolved: false,
      items: [],
      diagnostics,
    };

    // Try to load the imported file
    const importedDomain = await this.loadDomain(resolvedUri);

    if (!importedDomain) {
      // File not found or parse error
      diagnostics.push({
        message: `Cannot resolve import '${importStmt.from.value}'`,
        severity: DiagnosticSeverity.Error,
        location: importStmt.from.location,
        code: 'ISL2001',
        source: 'isl-import-resolver',
        data: {
          type: 'unresolved-import',
          importPath: importStmt.from.value,
          resolvedUri,
        },
      });
      return result;
    }

    result.resolved = true;

    // Get exported symbols from the imported file
    const exports = this.getExports(resolvedUri, importedDomain);

    // Resolve each imported item
    for (const item of importStmt.items) {
      const exportedSymbol = exports.get(item.name.name);

      if (!exportedSymbol) {
        // Symbol not found in imported file
        diagnostics.push({
          message: `'${item.name.name}' is not exported from '${importStmt.from.value}'`,
          severity: DiagnosticSeverity.Error,
          location: item.name.location,
          code: 'ISL2002',
          source: 'isl-import-resolver',
          relatedInfo: [
            {
              message: `File '${importStmt.from.value}' exports: ${Array.from(exports.keys()).join(', ') || 'nothing'}`,
              location: importStmt.from.location,
            },
          ],
          data: {
            type: 'unknown-export',
            symbolName: item.name.name,
            availableExports: Array.from(exports.keys()),
          },
        });

        result.items.push({
          item,
          exists: false,
        });
      } else {
        result.items.push({
          item,
          exists: true,
          kind: exportedSymbol.kind,
          definitionLocation: exportedSymbol.location,
        });
      }
    }

    return result;
  }

  /**
   * Get all exported symbols from a domain
   */
  getExports(uri: string, domain: Domain): Map<string, ExportedSymbol> {
    // Check cache first
    const cached = this.exportCache.get(uri);
    if (cached) return cached;

    const exports = new Map<string, ExportedSymbol>();

    // Export entities
    for (const entity of domain.entities) {
      exports.set(entity.name.name, {
        name: entity.name.name,
        kind: 'entity',
        location: entity.name.location,
        uri,
      });
    }

    // Export types
    for (const type of domain.types) {
      const kind = type.definition.kind === 'EnumType' ? 'enum' : 'type';
      exports.set(type.name.name, {
        name: type.name.name,
        kind,
        location: type.name.location,
        uri,
      });
    }

    // Export behaviors
    for (const behavior of domain.behaviors) {
      exports.set(behavior.name.name, {
        name: behavior.name.name,
        kind: 'behavior',
        location: behavior.name.location,
        uri,
      });
    }

    // Export invariants
    for (const invariant of domain.invariants) {
      exports.set(invariant.name.name, {
        name: invariant.name.name,
        kind: 'invariant',
        location: invariant.name.location,
        uri,
      });
    }

    // Export policies
    for (const policy of domain.policies) {
      exports.set(policy.name.name, {
        name: policy.name.name,
        kind: 'policy',
        location: policy.name.location,
        uri,
      });
    }

    // Export views
    for (const view of domain.views) {
      exports.set(view.name.name, {
        name: view.name.name,
        kind: 'view',
        location: view.name.location,
        uri,
      });
    }

    // Cache the exports
    this.exportCache.set(uri, exports);

    return exports;
  }

  /**
   * Resolve an import path relative to the importing file
   */
  resolveImportPath(documentUri: string, importPath: string): string {
    // Handle different import path formats
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Relative import
      const documentPath = URI.parse(documentUri).fsPath;
      const documentDir = path.dirname(documentPath);
      const resolved = path.resolve(documentDir, importPath);

      // Add .isl extension if not present
      const withExtension = resolved.endsWith('.isl') ? resolved : `${resolved}.isl`;
      return URI.file(withExtension).toString();
    }

    // Absolute or package import - for now just treat as relative to workspace
    // In a real implementation, this would look up in node_modules or similar
    const withExtension = importPath.endsWith('.isl') ? importPath : `${importPath}.isl`;
    return URI.file(withExtension).toString();
  }

  /**
   * Load and parse a domain from a URI
   */
  private async loadDomain(uri: string): Promise<Domain | undefined> {
    // Check cache
    const cached = this.domainCache.get(uri);
    if (cached !== undefined) return cached;

    try {
      const content = await this.fileProvider(uri);
      if (!content) {
        this.domainCache.set(uri, undefined);
        return undefined;
      }

      // Use dynamic import to avoid circular dependencies
      const { parse } = await import('@isl-lang/parser');
      const result = parse(content, URI.parse(uri).fsPath);

      if (result.success && result.domain) {
        this.domainCache.set(uri, result.domain);
        return result.domain;
      }

      this.domainCache.set(uri, undefined);
      return undefined;
    } catch {
      this.domainCache.set(uri, undefined);
      return undefined;
    }
  }

  /**
   * Default file provider using filesystem
   */
  private async defaultFileProvider(uri: string): Promise<string | undefined> {
    try {
      const fs = await import('fs/promises');
      const filePath = URI.parse(uri).fsPath;
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  /**
   * Clear caches for a specific URI or all URIs
   */
  invalidate(uri?: string): void {
    if (uri) {
      this.exportCache.delete(uri);
      this.domainCache.delete(uri);
    } else {
      this.exportCache.clear();
      this.domainCache.clear();
    }
  }

  /**
   * Set a custom file provider (useful for testing)
   */
  setFileProvider(provider: (uri: string) => Promise<string | undefined>): void {
    this.fileProvider = provider;
    // Clear caches when provider changes
    this.invalidate();
  }

  /**
   * Pre-populate domain cache (useful for testing)
   */
  setDomainCache(uri: string, domain: Domain | undefined): void {
    this.domainCache.set(uri, domain);
    if (domain) {
      this.getExports(uri, domain); // Populate export cache too
    }
  }
}
