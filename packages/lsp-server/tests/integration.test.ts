// ============================================================================
// Integration Tests
// Tests the full LSP flow with simulated messages
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLDocumentManager } from '../src/documents';
import { ISLDiagnosticsProvider } from '../src/features/diagnostics';
import { ISLCompletionProvider } from '../src/features/completion';
import { ISLHoverProvider } from '../src/features/hover';
import { ISLDefinitionProvider } from '../src/features/definition';
import { ISLSymbolProvider } from '../src/features/symbols';
import { ISLCodeActionProvider } from '../src/features/actions';
import { ISLFormattingProvider } from '../src/features/formatting';

describe('LSP Integration', () => {
  let documentManager: ISLDocumentManager;
  let diagnosticsProvider: ISLDiagnosticsProvider;
  let completionProvider: ISLCompletionProvider;
  let hoverProvider: ISLHoverProvider;
  let definitionProvider: ISLDefinitionProvider;
  let symbolProvider: ISLSymbolProvider;
  let codeActionProvider: ISLCodeActionProvider;
  let formattingProvider: ISLFormattingProvider;

  const createDocument = (content: string, uri = 'file:///test.isl') => {
    return TextDocument.create(uri, 'isl', 1, content);
  };

  beforeEach(() => {
    documentManager = new ISLDocumentManager();
    diagnosticsProvider = new ISLDiagnosticsProvider(documentManager);
    completionProvider = new ISLCompletionProvider(documentManager);
    hoverProvider = new ISLHoverProvider(documentManager);
    definitionProvider = new ISLDefinitionProvider(documentManager);
    symbolProvider = new ISLSymbolProvider(documentManager);
    codeActionProvider = new ISLCodeActionProvider(documentManager);
    formattingProvider = new ISLFormattingProvider();
  });

  describe('Full Document Lifecycle', () => {
    const validISL = `
domain UserManagement {
  version: "1.0.0"

  type Email = String { format: "email", max_length: 254 }
  type UserId = UUID { immutable: true }

  enum UserStatus {
    ACTIVE
    INACTIVE
    SUSPENDED
  }

  entity User {
    id: UserId
    email: Email
    status: UserStatus
    createdAt: Timestamp
  }

  behavior CreateUser {
    description: "Create a new user account"

    input {
      email: Email
    }

    output {
      success: User

      errors {
        EMAIL_EXISTS {
          when: "Email already registered"
          retriable: false
        }
      }
    }

    preconditions {
      email != null
      not User.exists_by_email(email)
    }

    postconditions {
      success implies {
        User.exists(result.id)
        result.email == input.email
        result.status == ACTIVE
      }
    }

    temporal {
      response within 500.ms (p99)
    }
  }

  invariants UserConstraints {
    description: "User invariants"
    scope: global

    always {
      forall user: User => user.email.is_valid()
    }
  }
}
`;

    it('should parse valid ISL without errors', () => {
      const doc = createDocument(validISL);
      documentManager.updateDocument(doc, true);

      const diagnostics = diagnosticsProvider.provideDiagnostics(doc);
      const errors = diagnostics.filter(d => d.severity === 1);

      expect(errors.length).toBe(0);
    });

    it('should provide document symbols', () => {
      const doc = createDocument(validISL);
      documentManager.updateDocument(doc, true);

      const symbols = symbolProvider.provideSymbols(doc);

      expect(symbols.length).toBe(1);
      expect(symbols[0]?.name).toBe('UserManagement');
      expect(symbols[0]?.kind).toBe('domain');

      // Check children
      const children = symbols[0]?.children || [];
      expect(children.some(c => c.name === 'Email' && c.kind === 'type')).toBe(true);
      expect(children.some(c => c.name === 'User' && c.kind === 'entity')).toBe(true);
      expect(children.some(c => c.name === 'CreateUser' && c.kind === 'behavior')).toBe(true);
      expect(children.some(c => c.name === 'UserConstraints' && c.kind === 'invariant')).toBe(true);
    });

    it('should provide hover information for entities', () => {
      const doc = createDocument(validISL);
      documentManager.updateDocument(doc, true);

      // Find line with "entity User"
      const lines = validISL.split('\n');
      const userLine = lines.findIndex(l => l.includes('entity User'));

      const hover = hoverProvider.provideHover(doc, { line: userLine, character: 10 });

      expect(hover).not.toBeNull();
      expect(hover?.contents).toContain('User');
    });

    it('should provide go-to-definition for custom types', () => {
      const doc = createDocument(validISL);
      documentManager.updateDocument(doc, true);

      // Find line with "email: Email" in entity
      const lines = validISL.split('\n');
      const emailFieldLine = lines.findIndex(l => l.includes('email: Email') && !l.includes('type Email'));

      const definition = definitionProvider.provideDefinition(doc, {
        line: emailFieldLine,
        character: 12, // Position on "Email" type
      });

      // Should point to the type definition
      expect(definition).not.toBeNull();
      if (definition && 'range' in definition) {
        expect(definition.range.start.line).toBeLessThan(emailFieldLine);
      }
    });

    it('should provide completions in context', () => {
      const doc = createDocument(validISL);
      documentManager.updateDocument(doc, true);

      // Find postconditions block
      const lines = validISL.split('\n');
      const postLine = lines.findIndex(l => l.includes('postconditions {'));

      const completions = completionProvider.provideCompletions(doc, {
        line: postLine + 2,
        character: 8,
      });

      // Should include postcondition-specific completions
      expect(completions.some(c => c.label === 'old')).toBe(true);
      expect(completions.some(c => c.label === 'result')).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should handle malformed ISL gracefully', () => {
      const malformedISL = `
domain Test {
  version: "1.0.0"
  
  entity User {
    id: UUID
    // Missing closing brace
  
  behavior CreateUser {
    input {
      name: String
    }
  }
}
`;
      const doc = createDocument(malformedISL);

      // Should not throw
      expect(() => {
        documentManager.updateDocument(doc, true);
      }).not.toThrow();

      // Should still provide some symbols even with errors
      const symbols = symbolProvider.provideSymbols(doc);
      expect(symbols.length).toBeGreaterThan(0);
    });

    it('should provide completions even with parse errors', () => {
      const incompleteISL = `
domain Test {
  version: "1.0.0"
  
  entity User {
    id: 
`;
      const doc = createDocument(incompleteISL);
      documentManager.updateDocument(doc, true);

      const completions = completionProvider.provideCompletions(doc, {
        line: 5,
        character: 8,
      });

      // Should still suggest types
      expect(completions.some(c => c.label === 'UUID')).toBe(true);
      expect(completions.some(c => c.label === 'String')).toBe(true);
    });
  });

  describe('Formatting', () => {
    it('should format ISL code consistently', () => {
      const messyISL = `
domain   Test{
version:"1.0.0"
entity User{
id:UUID
name:String
}
}
`;
      const doc = createDocument(messyISL);
      const edits = formattingProvider.format(doc, { tabSize: 2, insertSpaces: true });

      expect(edits.length).toBe(1);
      const formatted = edits[0]?.newText || '';

      // Check formatting
      expect(formatted).toContain('domain Test {');
      expect(formatted).toContain('version: "1.0.0"');
      expect(formatted).toContain('entity User {');
      expect(formatted).toContain('id: UUID');
    });

    it('should normalize operators', () => {
      const messyExpr = `
domain Test {
  version: "1.0.0"
  
  behavior Check {
    preconditions {
      value>0
      value!=null
      a==b
    }
  }
}
`;
      const doc = createDocument(messyExpr);
      const edits = formattingProvider.format(doc, { tabSize: 2, insertSpaces: true });

      const formatted = edits[0]?.newText || '';
      expect(formatted).toContain('value > 0');
      expect(formatted).toContain('value != null');
      expect(formatted).toContain('a == b');
    });
  });

  describe('Code Actions', () => {
    it('should suggest adding postcondition for behavior without one', () => {
      const isl = `
domain Test {
  version: "1.0.0"
  
  behavior DoSomething {
    input {
      value: String
    }
    
    output {
      success: Boolean
    }
  }
}
`;
      const doc = createDocument(isl);
      documentManager.updateDocument(doc, true);

      const diagnostics = diagnosticsProvider.provideDiagnostics(doc);
      const postWarning = diagnostics.find(d => d.message.includes('postcondition'));

      expect(postWarning).toBeDefined();

      if (postWarning) {
        const actions = codeActionProvider.provideCodeActions(doc, postWarning.range, {
          diagnostics: [postWarning],
        });

        expect(actions.some(a => a.title.includes('postcondition'))).toBe(true);
      }
    });
  });

  describe('Multi-document Support', () => {
    it('should track symbols across multiple documents', () => {
      const doc1 = createDocument(`
domain Types {
  version: "1.0.0"
  
  type Email = String { format: "email" }
}
`, 'file:///types.isl');

      const doc2 = createDocument(`
domain Users {
  version: "1.0.0"
  
  entity User {
    email: String
  }
}
`, 'file:///users.isl');

      documentManager.updateDocument(doc1, true);
      documentManager.updateDocument(doc2, true);

      // Both documents should have their symbols indexed
      const typeNames = documentManager.getTypeNames();
      expect(typeNames).toContain('Email');

      const entityNames = documentManager.getEntityNames();
      expect(entityNames).toContain('User');
    });
  });
});
