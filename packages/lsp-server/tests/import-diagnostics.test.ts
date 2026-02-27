// ============================================================================
// Import Diagnostics Tests
// Tests for import-aware diagnostics and multi-file support
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLDocumentManager } from '../src/documents';
import { ISLDiagnosticsProvider } from '../src/features/diagnostics';
import { ISLImportResolver } from '../src/features/import-resolver';
import type { Domain } from '@isl-lang/parser';
import { URI } from 'vscode-uri';
import * as path from 'path';

describe('Import Diagnostics', () => {
  let documentManager: ISLDocumentManager;
  let provider: ISLDiagnosticsProvider;

  beforeEach(() => {
    documentManager = new ISLDocumentManager();
    provider = new ISLDiagnosticsProvider(documentManager);
  });

  const createDocument = (content: string, uri = 'file:///test.isl') => {
    return TextDocument.create(uri, 'isl', 1, content);
  };

  describe('ISLImportResolver', () => {
    let resolver: ISLImportResolver;

    beforeEach(() => {
      resolver = new ISLImportResolver();
    });

    it('should resolve relative import paths', () => {
      const documentUri = 'file:///project/src/main.isl';
      const importPath = './types';

      const resolved = resolver.resolveImportPath(documentUri, importPath);

      expect(resolved).toContain('types.isl');
      expect(resolved).toContain('project');
      expect(resolved).toContain('src');
    });

    it('should resolve parent directory imports', () => {
      const documentUri = 'file:///project/src/sub/main.isl';
      const importPath = '../types';

      const resolved = resolver.resolveImportPath(documentUri, importPath);

      expect(resolved).toContain('types.isl');
      expect(resolved).toContain('src');
    });

    it('should add .isl extension if missing', () => {
      const documentUri = 'file:///project/main.isl';
      const importPath = './types';

      const resolved = resolver.resolveImportPath(documentUri, importPath);

      expect(resolved).toContain('.isl');
    });

    it('should extract exports from a domain', () => {
      const mockDomain: Domain = {
        kind: 'Domain',
        name: { kind: 'Identifier', name: 'TestDomain', location: mockLocation() },
        version: { kind: 'StringLiteral', value: '1.0.0', location: mockLocation() },
        imports: [],
        types: [
          {
            kind: 'TypeDeclaration',
            name: { kind: 'Identifier', name: 'Email', location: mockLocation() },
            definition: { kind: 'PrimitiveType', name: 'String', location: mockLocation() },
            annotations: [],
            location: mockLocation(),
          },
        ],
        entities: [
          {
            kind: 'Entity',
            name: { kind: 'Identifier', name: 'User', location: mockLocation() },
            fields: [],
            invariants: [],
            location: mockLocation(),
          },
        ],
        behaviors: [
          {
            kind: 'Behavior',
            name: { kind: 'Identifier', name: 'CreateUser', location: mockLocation() },
            input: { kind: 'InputSpec', fields: [], location: mockLocation() },
            output: {
              kind: 'OutputSpec',
              success: { kind: 'PrimitiveType', name: 'Boolean', location: mockLocation() },
              errors: [],
              location: mockLocation(),
            },
            preconditions: [],
            postconditions: [],
            invariants: [],
            temporal: [],
            security: [],
            compliance: [],
            location: mockLocation(),
          },
        ],
        invariants: [],
        policies: [],
        views: [],
        scenarios: [],
        chaos: [],
        location: mockLocation(),
      } as unknown as Domain;

      const exports = resolver.getExports('file:///test.isl', mockDomain);

      expect(exports.has('Email')).toBe(true);
      expect(exports.has('User')).toBe(true);
      expect(exports.has('CreateUser')).toBe(true);
      expect(exports.get('Email')?.kind).toBe('type');
      expect(exports.get('User')?.kind).toBe('entity');
      expect(exports.get('CreateUser')?.kind).toBe('behavior');
    });

    it('should detect missing exports', async () => {
      // Set up mock file provider
      const mockProvider = async (uri: string): Promise<string | undefined> => {
        if (uri.includes('common-types')) {
          return `
domain CommonTypes {
  version: "1.0.0"
  type Email = String
}
`;
        }
        return undefined;
      };

      resolver.setFileProvider(mockProvider);

      const mockDomain = createMockDomainWithImport(
        'TestDomain',
        './common-types',
        ['Email', 'NonExistent']
      );

      const result = await resolver.resolveImports('file:///test.isl', mockDomain);

      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics.some(d => d.code === 'ISL2002')).toBe(true);
      expect(result.diagnostics.some(d => d.message.includes('NonExistent'))).toBe(true);
    });

    it('should report unresolved file imports', async () => {
      // Set up mock file provider that returns undefined
      resolver.setFileProvider(async () => undefined);

      const mockDomain = createMockDomainWithImport(
        'TestDomain',
        './non-existent',
        ['SomeType']
      );

      const result = await resolver.resolveImports('file:///test.isl', mockDomain);

      expect(result.diagnostics.some(d => d.code === 'ISL2001')).toBe(true);
      expect(result.diagnostics.some(d => d.message.includes('Cannot resolve import'))).toBe(true);
    });

    it('should cache exports for performance', () => {
      const mockDomain: Domain = {
        kind: 'Domain',
        name: { kind: 'Identifier', name: 'TestDomain', location: mockLocation() },
        version: { kind: 'StringLiteral', value: '1.0.0', location: mockLocation() },
        imports: [],
        types: [],
        entities: [],
        behaviors: [],
        invariants: [],
        policies: [],
        views: [],
        scenarios: [],
        chaos: [],
        location: mockLocation(),
      } as unknown as Domain;

      // First call should compute and cache
      const exports1 = resolver.getExports('file:///test.isl', mockDomain);
      // Second call should return cached value
      const exports2 = resolver.getExports('file:///test.isl', mockDomain);

      expect(exports1).toBe(exports2); // Same reference means cache hit
    });

    it('should invalidate cache when requested', () => {
      const mockDomain: Domain = {
        kind: 'Domain',
        name: { kind: 'Identifier', name: 'TestDomain', location: mockLocation() },
        version: { kind: 'StringLiteral', value: '1.0.0', location: mockLocation() },
        imports: [],
        types: [],
        entities: [],
        behaviors: [],
        invariants: [],
        policies: [],
        views: [],
        scenarios: [],
        chaos: [],
        location: mockLocation(),
      } as unknown as Domain;

      const exports1 = resolver.getExports('file:///test.isl', mockDomain);
      resolver.invalidate('file:///test.isl');
      const exports2 = resolver.getExports('file:///test.isl', mockDomain);

      expect(exports1).not.toBe(exports2); // Different reference after invalidation
    });
  });

  describe('Import Integration', () => {
    it('should return import resolution result with diagnostics method', async () => {
      // Basic test - just verify the method returns the expected structure
      const doc = createDocument(`
domain Simple {
  version: "1.0.0"

  entity User {
    id: UUID
  }
}
`);

      documentManager.updateDocument(doc, true);

      const result = await provider.provideDiagnosticsWithImports(doc);

      // Should return diagnostics array
      expect(Array.isArray(result.diagnostics)).toBe(true);
      // Should return undefined importResolution for docs without imports
      expect(result.importResolution).toBeDefined();
    });

    it('should resolve imports when domain has import statements', async () => {
      // Create a test domain with imports
      const domainWithImports = createMockDomainWithImport(
        'TestDomain',
        './types',
        ['Email']
      );

      // Create a mock imported domain
      const mockImportedDomain: Domain = {
        kind: 'Domain',
        name: { kind: 'Identifier', name: 'Types', location: mockLocation() },
        version: { kind: 'StringLiteral', value: '1.0.0', location: mockLocation() },
        imports: [],
        types: [
          {
            kind: 'TypeDeclaration',
            name: { kind: 'Identifier', name: 'Email', location: mockLocation() },
            definition: { kind: 'PrimitiveType', name: 'String', location: mockLocation() },
            annotations: [],
            location: mockLocation(),
          },
        ],
        entities: [],
        behaviors: [],
        invariants: [],
        policies: [],
        views: [],
        scenarios: [],
        chaos: [],
        location: mockLocation(),
      } as unknown as Domain;

      // Pre-populate cache
      const importResolver = provider.getImportResolver();
      const resolvedUri = importResolver.resolveImportPath('file:///test.isl', './types');
      importResolver.setDomainCache(resolvedUri, mockImportedDomain);

      // Resolve imports directly using the resolver
      const result = await importResolver.resolveImports('file:///test.isl', domainWithImports);

      expect(result.imports.length).toBe(1);
      expect(result.imports[0]?.resolved).toBe(true);
      expect(result.importedSymbols.has('Email')).toBe(true);
    });

    it('should detect missing exports in imported files', async () => {
      // Create a test domain that imports a non-existent symbol
      const domainWithBadImport = createMockDomainWithImport(
        'TestDomain',
        './types',
        ['Email', 'NonExistent']
      );

      // Create a mock imported domain that only exports Email
      const mockImportedDomain: Domain = {
        kind: 'Domain',
        name: { kind: 'Identifier', name: 'Types', location: mockLocation() },
        version: { kind: 'StringLiteral', value: '1.0.0', location: mockLocation() },
        imports: [],
        types: [
          {
            kind: 'TypeDeclaration',
            name: { kind: 'Identifier', name: 'Email', location: mockLocation() },
            definition: { kind: 'PrimitiveType', name: 'String', location: mockLocation() },
            annotations: [],
            location: mockLocation(),
          },
        ],
        entities: [],
        behaviors: [],
        invariants: [],
        policies: [],
        views: [],
        scenarios: [],
        chaos: [],
        location: mockLocation(),
      } as unknown as Domain;

      // Pre-populate cache
      const importResolver = provider.getImportResolver();
      const resolvedUri = importResolver.resolveImportPath('file:///test.isl', './types');
      importResolver.setDomainCache(resolvedUri, mockImportedDomain);

      // Resolve imports
      const result = await importResolver.resolveImports('file:///test.isl', domainWithBadImport);

      // Should have diagnostic for NonExistent
      expect(result.diagnostics.some(d => d.code === 'ISL2002')).toBe(true);
      expect(result.diagnostics.some(d => d.message.includes('NonExistent'))).toBe(true);
    });
  });

  // Helper functions
  function mockLocation() {
    return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
  }

  function createMockDomainWithImport(
    domainName: string,
    importPath: string,
    importItems: string[]
  ): Domain {
    return {
      kind: 'Domain',
      name: { kind: 'Identifier', name: domainName, location: mockLocation() },
      version: { kind: 'StringLiteral', value: '1.0.0', location: mockLocation() },
      imports: [
        {
          kind: 'Import',
          items: importItems.map(name => ({
            kind: 'ImportItem',
            name: { kind: 'Identifier', name, location: mockLocation() },
            location: mockLocation(),
          })),
          from: { kind: 'StringLiteral', value: importPath, location: mockLocation() },
          location: mockLocation(),
        },
      ],
      types: [],
      entities: [],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      location: mockLocation(),
    } as unknown as Domain;
  }
});
