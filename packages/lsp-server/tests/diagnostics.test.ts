// ============================================================================
// Diagnostics Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLDocumentManager } from '../src/documents';
import { ISLDiagnosticsProvider } from '../src/features/diagnostics';

describe('ISLDiagnosticsProvider', () => {
  let documentManager: ISLDocumentManager;
  let provider: ISLDiagnosticsProvider;

  beforeEach(() => {
    documentManager = new ISLDocumentManager();
    provider = new ISLDiagnosticsProvider(documentManager);
  });

  const createDocument = (content: string, uri = 'file:///test.isl') => {
    return TextDocument.create(uri, 'isl', 1, content);
  };

  describe('parse errors', () => {
    it('should report missing domain declaration', () => {
      const doc = createDocument('entity User {}');
      const diagnostics = provider.provideDiagnostics(doc);

      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]?.message).toContain("Expected 'domain'");
    });

    it('should report unclosed braces', () => {
      const doc = createDocument(`
domain Test {
  version: "1.0.0"
  
  entity User {
    id: UUID
`);
      const diagnostics = provider.provideDiagnostics(doc);

      expect(diagnostics.some(d => d.message.includes("Expected '}'"))).toBe(true);
    });

    it('should report missing version', () => {
      const doc = createDocument(`
domain Test {
  entity User {
    id: UUID
  }
}
`);
      const diagnostics = provider.provideDiagnostics(doc);

      expect(diagnostics.some(d => d.message.includes('version'))).toBe(true);
    });
  });

  describe('type errors', () => {
    it('should report undefined type references', () => {
      const doc = createDocument(`
domain Test {
  version: "1.0.0"
  
  entity User {
    id: UUID
    role: UnknownType
  }
}
`);
      const diagnostics = provider.provideDiagnostics(doc);

      expect(diagnostics.some(d => d.message.includes('UnknownType'))).toBe(true);
    });
  });

  describe('warnings', () => {
    it('should warn about behaviors without postconditions', () => {
      const doc = createDocument(`
domain Test {
  version: "1.0.0"
  
  behavior DoSomething {
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
}
`);
      const diagnostics = provider.provideDiagnostics(doc);

      const warning = diagnostics.find(d => d.message.includes('postcondition'));
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe(2); // Warning
    });
  });

  describe('valid documents', () => {
    it('should have no errors for valid ISL', () => {
      const doc = createDocument(`
domain UserAuth {
  version: "1.0.0"
  
  type Email = String { format: "email" }
  
  entity User {
    id: UUID
    email: Email
  }
  
  behavior CreateUser {
    input {
      email: Email
    }
    
    output {
      success: User
    }
    
    preconditions {
      email != null
    }
    
    postconditions {
      success implies {
        result.id != null
      }
    }
  }
}
`);
      const diagnostics = provider.provideDiagnostics(doc);
      const errors = diagnostics.filter(d => d.severity === 1);

      expect(errors.length).toBe(0);
    });
  });
});
