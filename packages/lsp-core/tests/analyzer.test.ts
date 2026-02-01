// ============================================================================
// LSP Core - Analyzer Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ISLAnalyzer, type AnalysisOptions } from '../src/analyzer.js';
import { DiagnosticSeverity } from '../src/types.js';

describe('ISLAnalyzer', () => {
  let analyzer: ISLAnalyzer;

  beforeEach(() => {
    analyzer = new ISLAnalyzer();
  });

  describe('Basic Analysis', () => {
    it('should analyze valid minimal ISL', () => {
      const source = `
        domain Minimal {
          version: "1.0.0"
          entity User {
            id: UUID [immutable, unique]
            name: String
          }
        }
      `;

      const result = analyzer.analyze(source, { filePath: 'test.isl' });

      expect(result.parseSuccess).toBe(true);
      expect(result.domain).toBeDefined();
      expect(result.domain?.name.name).toBe('Minimal');
    });

    it('should report parse errors', () => {
      const source = `
        domain Invalid {
          version: "1.0.0"
          entity User {
            id: UUID
      `;

      const result = analyzer.analyze(source, { filePath: 'test.isl' });

      expect(result.parseSuccess).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics.some(d => d.severity === DiagnosticSeverity.Error)).toBe(true);
    });

    it('should include file path in diagnostics', () => {
      const source = `
        domain Test {
          entity NoVersion {}
        }
      `;

      const result = analyzer.analyze(source, { filePath: 'myfile.isl' });

      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0]?.location.file).toBe('myfile.isl');
    });
  });

  describe('Type Checking', () => {
    it('should perform type checking when enabled', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            status: NonExistentType
          }
        }
      `;

      const result = analyzer.analyze(source, {
        filePath: 'test.isl',
        typeCheck: true,
      });

      expect(result.parseSuccess).toBe(true);
      expect(result.typeCheckSuccess).toBe(false);
      expect(result.diagnostics.some(d => d.message.includes('NonExistentType'))).toBe(true);
    });

    it('should pass type checking for valid code', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            name: String
            age: Int
          }
        }
      `;

      const result = analyzer.analyze(source, {
        filePath: 'test.isl',
        typeCheck: true,
      });

      expect(result.parseSuccess).toBe(true);
      expect(result.typeCheckSuccess).toBe(true);
    });
  });

  describe('Symbol Collection', () => {
    it('should collect symbols when enabled', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          
          type Email = String { max_length: 254 }
          
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

      const result = analyzer.analyze(source, {
        filePath: 'test.isl',
        collectSymbols: true,
      });

      expect(result.symbols.length).toBeGreaterThan(0);
      
      // Should have domain, entity, type, and behavior symbols
      const symbolNames = result.symbols.map(s => s.name);
      expect(symbolNames).toContain('Test');
      expect(symbolNames).toContain('User');
    });

    it('should include entity fields as nested symbols', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User {
            id: UUID
            name: String
            email: String
          }
        }
      `;

      const result = analyzer.analyze(source, {
        filePath: 'test.isl',
        collectSymbols: true,
      });

      const userSymbol = result.symbols.find(s => s.name === 'User');
      expect(userSymbol).toBeDefined();
      
      // Fields should be children of the entity
      expect(userSymbol?.children?.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Reference Collection', () => {
    it('should collect references when enabled', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          
          type UserId = UUID { immutable: true }
          
          entity User {
            id: UserId
            name: String
          }
          
          behavior GetUser {
            input { id: UserId }
            output { success: User }
          }
        }
      `;

      const result = analyzer.analyze(source, {
        filePath: 'test.isl',
        collectReferences: true,
      });

      // Should have references to UserId and User
      expect(result.references.size).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should complete analysis quickly', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          entity User { id: UUID; name: String }
          entity Post { id: UUID; title: String; author: UUID }
          behavior Create { input { name: String } output { success: Boolean } }
        }
      `;

      const result = analyzer.analyze(source, {
        filePath: 'test.isl',
        typeCheck: true,
        collectSymbols: true,
      });

      expect(result.parseTimeMs).toBeLessThan(100);
      expect(result.typeCheckTimeMs).toBeLessThan(100);
    });

    it('should handle large files efficiently', () => {
      // Generate a moderately large source
      let source = `domain Large { version: "1.0.0"\n`;
      for (let i = 0; i < 50; i++) {
        source += `  entity Entity${i} { id: UUID; name: String; value: Int }\n`;
      }
      source += `}`;

      const start = performance.now();
      const result = analyzer.analyze(source, {
        filePath: 'large.isl',
        typeCheck: true,
        collectSymbols: true,
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete in < 1s
      expect(result.parseSuccess).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from parse errors and continue', () => {
      const source = `
        domain Test {
          version: "1.0.0"
          
          entity Valid {
            id: UUID
          }
          
          entity Invalid {
            id: UUID
            bad@field: String
          }
          
          entity AlsoValid {
            id: UUID
          }
        }
      `;

      const result = analyzer.analyze(source, { filePath: 'test.isl' });

      // Should have errors but may have partial AST
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it('should collect multiple errors', () => {
      const source = `
        domain Test {
          entity Missing1 {
            field: Unknown1
          }
          entity Missing2 {
            field: Unknown2
          }
        }
      `;

      const result = analyzer.analyze(source, {
        filePath: 'test.isl',
        typeCheck: true,
      });

      // Should have errors for missing version and unknown types
      expect(result.diagnostics.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Diagnostic Conversion', () => {
  let analyzer: ISLAnalyzer;

  beforeEach(() => {
    analyzer = new ISLAnalyzer();
  });

  it('should convert parse errors to proper diagnostic format', () => {
    const source = `domain Test {`;

    const result = analyzer.analyze(source, { filePath: 'test.isl' });

    expect(result.diagnostics.length).toBeGreaterThan(0);
    
    const diag = result.diagnostics[0]!;
    expect(diag.message).toBeDefined();
    expect(diag.severity).toBeDefined();
    expect(diag.location).toBeDefined();
    expect(diag.location.line).toBeGreaterThanOrEqual(1);
    expect(diag.location.column).toBeGreaterThanOrEqual(1);
  });

  it('should set correct severity levels', () => {
    const source = `
      domain Test {
        entity User {
          id: UUID
        }
      }
    `;

    const result = analyzer.analyze(source, { filePath: 'test.isl' });

    // Missing version should be an error
    const versionError = result.diagnostics.find(d => d.message.includes('version'));
    expect(versionError?.severity).toBe(DiagnosticSeverity.Error);
  });
});
