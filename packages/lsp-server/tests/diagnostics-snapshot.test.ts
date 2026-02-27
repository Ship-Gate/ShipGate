// ============================================================================
// Diagnostics Snapshot Tests
// Ensures diagnostic output remains stable across changes
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLDocumentManager } from '../src/documents';
import { ISLDiagnosticsProvider } from '../src/features/diagnostics';

describe('Diagnostics Snapshots', () => {
  let documentManager: ISLDocumentManager;
  let provider: ISLDiagnosticsProvider;

  beforeEach(() => {
    documentManager = new ISLDocumentManager();
    provider = new ISLDiagnosticsProvider(documentManager);
  });

  const createDocument = (content: string, uri = 'file:///test.isl') => {
    return TextDocument.create(uri, 'isl', 1, content);
  };

  /**
   * Normalize diagnostics for snapshot comparison
   * Removes line numbers and focuses on essential info
   */
  const normalizeDiagnostics = (diagnostics: ReturnType<typeof provider.provideDiagnostics>) => {
    return diagnostics
      .map(d => ({
        code: d.code,
        message: d.message,
        severity: d.severity,
        source: d.source,
        dataType: (d.data as { type?: string })?.type,
      }))
      .sort((a, b) => {
        // Sort by code, then by message for stable ordering
        if (a.code !== b.code) return (a.code || '').localeCompare(b.code || '');
        return a.message.localeCompare(b.message);
      });
  };

  describe('Valid ISL - No Errors', () => {
    it('should produce no errors for well-formed ISL', () => {
      // Minimal valid ISL that should have no parse or type errors
      const doc = createDocument(`
domain Minimal {
  version: "1.0.0"

  entity User {
    id: UUID
    name: String
  }
}
`);
      const diagnostics = provider.provideDiagnostics(doc);
      const errors = diagnostics.filter(d => d.severity === 1);

      // Should have no errors (severity 1)
      // May have warnings (severity 2) or hints (severity 4)
      expect(errors).toHaveLength(0);
    });
  });

  describe('Parse Error Snapshots', () => {
    it('should produce stable errors for missing domain', () => {
      const doc = createDocument('entity User {}');
      const diagnostics = normalizeDiagnostics(provider.provideDiagnostics(doc));

      // Should have at least one error about domain
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some(d => 
        d.severity === 1 && d.message.toLowerCase().includes('domain')
      )).toBe(true);
    });

    it('should produce stable errors for unclosed braces', () => {
      const doc = createDocument(`
domain Test {
  version: "1.0.0"

  entity User {
    id: UUID
`);
      const diagnostics = normalizeDiagnostics(provider.provideDiagnostics(doc));
      const errors = diagnostics.filter(d => d.severity === 1);

      // Should have at least one error about unclosed brace
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(d => d.message.includes('}'))).toBe(true);
    });

    it('should produce stable errors for missing version', () => {
      const doc = createDocument(`
domain Test {
  entity User {
    id: UUID
  }
}
`);
      const diagnostics = normalizeDiagnostics(provider.provideDiagnostics(doc));

      expect(diagnostics.some(d => 
        d.message.toLowerCase().includes('version') && d.severity === 1
      )).toBe(true);
    });
  });

  describe('Semantic Warning Snapshots', () => {
    it('should produce stable warnings for behavior without postconditions', () => {
      const doc = createDocument(`
domain Test {
  version: "1.0.0"

  behavior NoPost {
    input {
      value: String
    }

    output {
      success: Boolean
    }
  }
}
`);
      const diagnostics = normalizeDiagnostics(provider.provideDiagnostics(doc));
      const warnings = diagnostics.filter(d => d.code === 'ISL1001');

      expect(warnings.length).toBe(1);
      expect(warnings[0]?.code).toBe('ISL1001');
      expect(warnings[0]?.dataType).toBe('missing-postcondition');
      expect(warnings[0]?.message).toContain('NoPost');
      expect(warnings[0]?.severity).toBe(2);
    });

    it('should produce stable warnings for entity without id', () => {
      const doc = createDocument(`
domain Test {
  version: "1.0.0"

  entity NoId {
    name: String
  }
}
`);
      const diagnostics = normalizeDiagnostics(provider.provideDiagnostics(doc));
      const warnings = diagnostics.filter(d => d.code === 'ISL1011');

      expect(warnings.length).toBe(1);
      expect(warnings[0]?.code).toBe('ISL1011');
      expect(warnings[0]?.dataType).toBe('entity-without-id');
      expect(warnings[0]?.message).toContain('NoId');
    });

    it('should produce stable hints for unused type', () => {
      const doc = createDocument(`
domain Test {
  version: "1.0.0"

  type UnusedType = String

  entity User {
    id: UUID
    name: String
  }
}
`);
      const diagnostics = normalizeDiagnostics(provider.provideDiagnostics(doc));
      const hints = diagnostics.filter(d => d.code === 'ISL1003');

      expect(hints.length).toBe(1);
      expect(hints[0]?.code).toBe('ISL1003');
      expect(hints[0]?.dataType).toBe('unused-type');
      expect(hints[0]?.message).toContain('UnusedType');
    });

    it('should produce stable warnings for sensitive fields', () => {
      const doc = createDocument(`
domain Test {
  version: "1.0.0"

  entity User {
    id: UUID
    password: String
    apiKey: String
  }
}
`);
      const diagnostics = normalizeDiagnostics(provider.provideDiagnostics(doc));
      const sensitiveWarnings = diagnostics.filter(d => d.code === 'ISL1020');

      expect(sensitiveWarnings.length).toBe(2);
      expect(sensitiveWarnings.some(w => w.message.includes('password'))).toBe(true);
      expect(sensitiveWarnings.some(w => w.message.includes('apiKey'))).toBe(true);
    });
  });

  describe('Multiple Issues Snapshot', () => {
    it('should produce stable output for document with multiple issues', () => {
      const doc = createDocument(`
domain MultipleIssues {
  version: "1.0.0"

  type Unused = String

  entity NoId {
    password: String
  }

  behavior CreateSomething {
    input {
      value: String
    }

    output {
      success: Boolean
    }

    preconditions {
      value != null
    }
  }

  scenarios NonExistent {
    scenario "Test" {
      when {
        result = NonExistent()
      }

      then {
        result != null
      }
    }
  }
}
`);
      const diagnostics = normalizeDiagnostics(provider.provideDiagnostics(doc));

      // Should have multiple different issue types
      const codes = new Set(diagnostics.map(d => d.code));
      expect(codes.size).toBeGreaterThan(3);

      // Check for expected issue types
      expect(diagnostics.some(d => d.code === 'ISL1001')).toBe(true); // Missing postcondition
      expect(diagnostics.some(d => d.code === 'ISL1003')).toBe(true); // Unused type
      expect(diagnostics.some(d => d.code === 'ISL1004')).toBe(true); // Undefined behavior
      expect(diagnostics.some(d => d.code === 'ISL1011')).toBe(true); // No id
      expect(diagnostics.some(d => d.code === 'ISL1020')).toBe(true); // Sensitive field
    });
  });

  describe('Diagnostic Counts', () => {
    it('should count errors vs warnings vs hints correctly', () => {
      const doc = createDocument(`
domain DiagnosticCounts {
  version: "1.0.0"

  type Unused = String

  entity NoId {
    name: String
  }

  behavior Create {
    input {
      value: String
    }

    output {
      success: Boolean
    }

    preconditions {
      value != null
    }
  }

  scenarios NonExistent {
    scenario "Test" {
      when {
        result = NonExistent()
      }

      then {
        result != null
      }
    }
  }
}
`);
      const diagnostics = provider.provideDiagnostics(doc);

      const errors = diagnostics.filter(d => d.severity === 1);
      const warnings = diagnostics.filter(d => d.severity === 2);
      const hints = diagnostics.filter(d => d.severity === 4);

      // ISL1004 (undefined behavior) should be an error
      expect(errors.some(d => d.code === 'ISL1004')).toBe(true);

      // ISL1001, ISL1011 should be warnings
      expect(warnings.some(d => d.code === 'ISL1001')).toBe(true);
      expect(warnings.some(d => d.code === 'ISL1011')).toBe(true);

      // ISL1003, ISL1010 should be hints
      expect(hints.some(d => d.code === 'ISL1003')).toBe(true);
    });
  });
});
