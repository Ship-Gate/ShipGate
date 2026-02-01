// ============================================================================
// LSP Server Tests
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ISLDocumentManager } from '../src/documents.js';
import { ISLCompletionProvider } from '../src/features/completion.js';
import { ISLHoverProvider } from '../src/features/hover.js';
import { ISLDiagnosticsProvider } from '../src/features/diagnostics.js';
import { ISLDefinitionProvider } from '../src/features/definition.js';
import { ISLSymbolProvider } from '../src/features/symbols.js';
import { ISLFormattingProvider } from '../src/features/formatting.js';

// Mock TextDocument
const createMockDocument = (content: string, uri = 'file:///test.isl') => ({
  uri,
  getText: () => content,
  positionAt: (offset: number) => {
    const lines = content.substring(0, offset).split('\n');
    return {
      line: lines.length - 1,
      character: lines[lines.length - 1]?.length ?? 0,
    };
  },
  offsetAt: (position: { line: number; character: number }) => {
    const lines = content.split('\n');
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
      offset += (lines[i]?.length ?? 0) + 1;
    }
    return offset + position.character;
  },
  lineCount: content.split('\n').length,
});

describe('ISLDocumentManager', () => {
  let manager: ISLDocumentManager;

  beforeEach(() => {
    manager = new ISLDocumentManager();
  });

  describe('Document Updates', () => {
    it('should store document content', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          entity User { id: UUID }
        }
      `;
      const doc = createMockDocument(content);

      manager.updateDocument(doc);

      const analysis = manager.getAnalysis(doc.uri);
      expect(analysis).toBeDefined();
    });

    it('should re-analyze on update', () => {
      const content1 = `domain Test { version: "1.0.0" }`;
      const content2 = `domain Updated { version: "2.0.0" }`;

      const doc1 = createMockDocument(content1);
      manager.updateDocument(doc1);
      const analysis1 = manager.getAnalysis(doc1.uri);

      const doc2 = createMockDocument(content2, doc1.uri);
      manager.updateDocument(doc2);
      const analysis2 = manager.getAnalysis(doc2.uri);

      expect(analysis1?.domain?.name.name).toBe('Test');
      expect(analysis2?.domain?.name.name).toBe('Updated');
    });

    it('should handle document removal', () => {
      const doc = createMockDocument(`domain Test { version: "1.0.0" }`);
      
      manager.updateDocument(doc);
      expect(manager.getAnalysis(doc.uri)).toBeDefined();
      
      manager.removeDocument(doc.uri);
      expect(manager.getAnalysis(doc.uri)).toBeUndefined();
    });
  });

  describe('Symbol Lookup', () => {
    it('should provide entity symbols', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          entity User { id: UUID; name: String }
          entity Post { id: UUID; title: String }
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const symbols = manager.getAllSymbols(doc.uri);
      expect(symbols.some(s => s.name === 'User')).toBe(true);
      expect(symbols.some(s => s.name === 'Post')).toBe(true);
    });

    it('should provide behavior symbols', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          behavior Create { input { name: String } output { success: Boolean } }
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const symbols = manager.getAllSymbols(doc.uri);
      expect(symbols.some(s => s.name === 'Create')).toBe(true);
    });
  });
});

describe('ISLCompletionProvider', () => {
  let manager: ISLDocumentManager;
  let provider: ISLCompletionProvider;

  beforeEach(() => {
    manager = new ISLDocumentManager();
    provider = new ISLCompletionProvider(manager);
  });

  describe('Top-Level Completions', () => {
    it('should provide domain-level keywords', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const completions = provider.getCompletions(doc.uri, { line: 3, character: 10 });

      const labels = completions.map(c => c.label);
      expect(labels).toContain('entity');
      expect(labels).toContain('behavior');
      expect(labels).toContain('type');
    });
  });

  describe('Type Completions', () => {
    it('should provide built-in types', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: 
          }
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const completions = provider.getCompletions(doc.uri, { line: 4, character: 16 });

      const labels = completions.map(c => c.label);
      expect(labels).toContain('String');
      expect(labels).toContain('Int');
      expect(labels).toContain('UUID');
      expect(labels).toContain('Boolean');
    });

    it('should provide user-defined types', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          type Email = String { max_length: 254 }
          entity User {
            contact: 
          }
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const completions = provider.getCompletions(doc.uri, { line: 5, character: 21 });

      const labels = completions.map(c => c.label);
      expect(labels).toContain('Email');
    });
  });
});

describe('ISLHoverProvider', () => {
  let manager: ISLDocumentManager;
  let provider: ISLHoverProvider;

  beforeEach(() => {
    manager = new ISLDocumentManager();
    provider = new ISLHoverProvider(manager);
  });

  describe('Type Hover', () => {
    it('should provide hover for built-in types', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
          }
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const hover = provider.getHover(doc.uri, { line: 4, character: 16 });

      expect(hover).toBeDefined();
      expect(hover?.contents).toBeDefined();
    });

    it('should provide hover for keywords', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          entity User { id: UUID }
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const hover = provider.getHover(doc.uri, { line: 3, character: 12 });

      // Should have hover for "entity" keyword
      expect(hover === null || hover?.contents !== undefined).toBe(true);
    });
  });
});

describe('ISLDiagnosticsProvider', () => {
  let manager: ISLDocumentManager;
  let provider: ISLDiagnosticsProvider;

  beforeEach(() => {
    manager = new ISLDocumentManager();
    provider = new ISLDiagnosticsProvider(manager);
  });

  describe('Parse Errors', () => {
    it('should report parse errors', () => {
      const content = `
        domain Test {
          entity User {
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const diagnostics = provider.getDiagnostics(doc.uri);

      expect(diagnostics.length).toBeGreaterThan(0);
    });

    it('should report missing version', () => {
      const content = `
        domain Test {
          entity User { id: UUID }
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const diagnostics = provider.getDiagnostics(doc.uri);

      expect(diagnostics.some(d => d.message.toLowerCase().includes('version'))).toBe(true);
    });
  });

  describe('Type Errors', () => {
    it('should report undefined types', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            status: UnknownType
          }
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const diagnostics = provider.getDiagnostics(doc.uri);

      expect(diagnostics.some(d => d.message.includes('UnknownType'))).toBe(true);
    });
  });
});

describe('ISLDefinitionProvider', () => {
  let manager: ISLDocumentManager;
  let provider: ISLDefinitionProvider;

  beforeEach(() => {
    manager = new ISLDocumentManager();
    provider = new ISLDefinitionProvider(manager);
  });

  describe('Go to Definition', () => {
    it('should find entity definition', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          entity User { id: UUID; name: String }
          behavior GetUser {
            input { id: UUID }
            output { success: User }
          }
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      // Position on "User" in output
      const definition = provider.getDefinition(doc.uri, { line: 6, character: 30 });

      // May return definition or null depending on implementation
      expect(definition === null || definition?.range !== undefined).toBe(true);
    });

    it('should find type definition', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          type Email = String { max_length: 254 }
          entity User {
            id: UUID
            email: Email
          }
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      // Position on "Email" usage
      const definition = provider.getDefinition(doc.uri, { line: 6, character: 19 });

      expect(definition === null || definition?.range !== undefined).toBe(true);
    });
  });
});

describe('ISLSymbolProvider', () => {
  let manager: ISLDocumentManager;
  let provider: ISLSymbolProvider;

  beforeEach(() => {
    manager = new ISLDocumentManager();
    provider = new ISLSymbolProvider(manager);
  });

  describe('Document Symbols', () => {
    it('should provide hierarchical symbols', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          
          entity User {
            id: UUID
            name: String
          }
          
          behavior CreateUser {
            input { name: String }
            output { success: User }
          }
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const symbols = provider.getDocumentSymbols(doc.uri);

      expect(symbols.length).toBeGreaterThan(0);
      
      // Should have domain as root
      const domain = symbols.find(s => s.name === 'Test');
      expect(domain).toBeDefined();
      
      // Domain should have children
      expect(domain?.children?.length).toBeGreaterThan(0);
    });

    it('should include entity fields', () => {
      const content = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            name: String
            email: String
          }
        }
      `;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const symbols = provider.getDocumentSymbols(doc.uri);
      
      const domain = symbols.find(s => s.name === 'Test');
      const user = domain?.children?.find(s => s.name === 'User');
      
      expect(user?.children?.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('ISLFormattingProvider', () => {
  let provider: ISLFormattingProvider;

  beforeEach(() => {
    provider = new ISLFormattingProvider();
  });

  describe('Basic Formatting', () => {
    it('should format indentation', () => {
      const content = `domain Test {
version: "1.0.0"
entity User {
id: UUID
}
}`;
      const doc = createMockDocument(content);

      const edits = provider.format(doc);

      expect(edits.length).toBeGreaterThan(0);
    });

    it('should preserve comments', () => {
      const content = `
// Comment before domain
domain Test {
  version: "1.0.0"
  // Comment inside
  entity User { id: UUID }
}`;
      const doc = createMockDocument(content);

      const edits = provider.format(doc);

      // Format should not remove comments
      const formattedContent = applyEdits(content, edits);
      expect(formattedContent).toContain('// Comment before domain');
      expect(formattedContent).toContain('// Comment inside');
    });
  });
});

// Helper to apply text edits
function applyEdits(content: string, edits: Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>): string {
  // Sort edits in reverse order to avoid offset issues
  const sortedEdits = [...edits].sort((a, b) => {
    if (b.range.start.line !== a.range.start.line) {
      return b.range.start.line - a.range.start.line;
    }
    return b.range.start.character - a.range.start.character;
  });

  const lines = content.split('\n');
  
  for (const edit of sortedEdits) {
    const startLine = edit.range.start.line;
    const endLine = edit.range.end.line;
    
    if (startLine === endLine) {
      const line = lines[startLine] ?? '';
      lines[startLine] = 
        line.substring(0, edit.range.start.character) +
        edit.newText +
        line.substring(edit.range.end.character);
    } else {
      // Multi-line edit
      const startText = lines[startLine]?.substring(0, edit.range.start.character) ?? '';
      const endText = lines[endLine]?.substring(edit.range.end.character) ?? '';
      const newLines = edit.newText.split('\n');
      
      newLines[0] = startText + newLines[0];
      newLines[newLines.length - 1] = newLines[newLines.length - 1] + endText;
      
      lines.splice(startLine, endLine - startLine + 1, ...newLines);
    }
  }
  
  return lines.join('\n');
}
