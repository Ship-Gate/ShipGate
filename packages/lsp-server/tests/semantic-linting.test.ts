// ============================================================================
// Semantic Linting Tests
// Tests for semantic lint rules and quickfix payloads
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLDocumentManager } from '../src/documents';
import { ISLDiagnosticsProvider } from '../src/features/diagnostics';
import { ISLSemanticLinter, LINT_RULES } from '../src/features/semantic-linter';
import { ISLCodeActionProvider } from '../src/features/actions';
import type { Domain } from '@isl-lang/parser';

describe('Semantic Linting', () => {
  let documentManager: ISLDocumentManager;
  let provider: ISLDiagnosticsProvider;
  let codeActionProvider: ISLCodeActionProvider;
  let linter: ISLSemanticLinter;

  beforeEach(() => {
    documentManager = new ISLDocumentManager();
    provider = new ISLDiagnosticsProvider(documentManager);
    codeActionProvider = new ISLCodeActionProvider(documentManager);
    linter = new ISLSemanticLinter();
  });

  const createDocument = (content: string, uri = 'file:///test.isl') => {
    return TextDocument.create(uri, 'isl', 1, content);
  };

  describe('Lint Rules', () => {
    describe('ISL1001: Missing postcondition', () => {
      it('should warn when behavior has no postconditions', () => {
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
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        const warning = diagnostics.find(d => d.code === 'ISL1001');
        expect(warning).toBeDefined();
        expect(warning?.message).toContain('postcondition');
        expect(warning?.data?.type).toBe('missing-postcondition');
      });

      it('should not warn when behavior has postconditions', () => {
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

    postconditions {
      success implies {
        result == true
      }
    }
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        const warning = diagnostics.find(d => d.code === 'ISL1001');
        expect(warning).toBeUndefined();
      });
    });

    describe('ISL1002: Precondition without error', () => {
      it('should hint when behavior has preconditions but no errors', () => {
        const doc = createDocument(`
domain Test {
  version: "1.0.0"

  behavior Validate {
    input {
      value: Int
    }

    output {
      success: Boolean
    }

    preconditions {
      value > 0
    }

    postconditions {
      success implies { result == true }
    }
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        const hint = diagnostics.find(d => d.code === 'ISL1002');
        expect(hint).toBeDefined();
        expect(hint?.data?.type).toBe('precondition-without-error');
      });
    });

    describe('ISL1003: Unused type', () => {
      it('should hint when type is defined but never used', () => {
        const doc = createDocument(`
domain Test {
  version: "1.0.0"

  type UnusedEmail = String { format: "email" }

  entity User {
    id: UUID
    name: String
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        const hint = diagnostics.find(d => d.code === 'ISL1003');
        expect(hint).toBeDefined();
        expect(hint?.message).toContain('UnusedEmail');
        expect(hint?.data?.type).toBe('unused-type');
      });

      it('should not warn when type is used', () => {
        const doc = createDocument(`
domain Test {
  version: "1.0.0"

  type Email = String { format: "email" }

  entity User {
    id: UUID
    email: Email
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        const hint = diagnostics.find(d => 
          d.code === 'ISL1003' && d.message.includes('Email')
        );
        expect(hint).toBeUndefined();
      });
    });

    describe('ISL1004: Undefined behavior reference', () => {
      it('should error when scenarios reference non-existent behavior', () => {
        const doc = createDocument(`
domain Test {
  version: "1.0.0"

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

        const error = diagnostics.find(d => d.code === 'ISL1004');
        expect(error).toBeDefined();
        expect(error?.data?.type).toBe('undefined-behavior-reference');
      });
    });

    describe('ISL1010: Missing description', () => {
      it('should hint when behavior has no description', () => {
        const doc = createDocument(`
domain Test {
  version: "1.0.0"

  behavior NoDescription {
    input {
      value: String
    }

    output {
      success: Boolean
    }

    postconditions {
      success implies { result == true }
    }
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        const hint = diagnostics.find(d => d.code === 'ISL1010');
        expect(hint).toBeDefined();
        expect(hint?.data?.type).toBe('missing-description');
      });
    });

    describe('ISL1011: Entity without id', () => {
      it('should warn when entity has no id field', () => {
        const doc = createDocument(`
domain Test {
  version: "1.0.0"

  entity NoId {
    name: String
    email: String
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        const warning = diagnostics.find(d => d.code === 'ISL1011');
        expect(warning).toBeDefined();
        expect(warning?.data?.type).toBe('entity-without-id');
      });

      it('should not warn when entity has id field', () => {
        const doc = createDocument(`
domain Test {
  version: "1.0.0"

  entity WithId {
    id: UUID
    name: String
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        const warning = diagnostics.find(d => 
          d.code === 'ISL1011' && d.message.includes('WithId')
        );
        expect(warning).toBeUndefined();
      });
    });

    describe('ISL1012: State-modifying behavior without temporal', () => {
      it('should hint when Create behavior has no temporal constraints', () => {
        const doc = createDocument(`
domain Test {
  version: "1.0.0"

  behavior CreateUser {
    description: "Create a user"

    input {
      name: String
    }

    output {
      success: Boolean
    }

    postconditions {
      success implies { result == true }
    }
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        const hint = diagnostics.find(d => d.code === 'ISL1012');
        expect(hint).toBeDefined();
        expect(hint?.data?.type).toBe('mutable-behavior-no-temporal');
      });
    });

    describe('ISL1020: Sensitive field unprotected', () => {
      it('should warn when password field has no constraints', () => {
        const doc = createDocument(`
domain Test {
  version: "1.0.0"

  entity User {
    id: UUID
    password: String
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        const warning = diagnostics.find(d => d.code === 'ISL1020');
        expect(warning).toBeDefined();
        expect(warning?.data?.type).toBe('sensitive-field-unprotected');
        expect(warning?.data?.suggestedConstraints).toContain('min_length: 8');
      });
    });

    describe('ISL1021: No authentication', () => {
      it('should hint when state-modifying behavior has no security', () => {
        const doc = createDocument(`
domain Test {
  version: "1.0.0"

  behavior CreateUser {
    description: "Create a user"

    input {
      name: String
    }

    output {
      success: Boolean
    }

    postconditions {
      success implies { result == true }
    }
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        // Should have ISL1021 warning for CreateUser without security
        const hint = diagnostics.find(d => d.code === 'ISL1021');
        expect(hint).toBeDefined();
        expect(hint?.data?.type).toBe('no-authentication');
      });
    });

    describe('ISL1031: Missing pagination', () => {
      it('should hint when list-returning behavior has no pagination', () => {
        const doc = createDocument(`
domain Test {
  version: "1.0.0"

  behavior ListUsers {
    description: "List all users"

    input {
      filter: String?
    }

    output {
      success: List<String>
    }

    postconditions {
      success implies { result != null }
    }
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        const hint = diagnostics.find(d => d.code === 'ISL1031');
        expect(hint).toBeDefined();
        expect(hint?.data?.type).toBe('missing-pagination');
      });

      it('should not hint when behavior has pagination', () => {
        const doc = createDocument(`
domain Test {
  version: "1.0.0"

  behavior ListUsers {
    description: "List all users with pagination"

    input {
      filter: String?
      page: Int
      limit: Int
    }

    output {
      success: List<String>
    }

    postconditions {
      success implies { result != null }
    }
  }
}
`);
        const diagnostics = provider.provideDiagnostics(doc);

        const hint = diagnostics.find(d => 
          d.code === 'ISL1031' && d.message.includes('ListUsers')
        );
        expect(hint).toBeUndefined();
      });
    });
  });

  describe('Rule Configuration', () => {
    it('should allow disabling specific rules', () => {
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

      // Disable ISL1001
      provider.configure({ disabledRules: ['ISL1001'] });
      const diagnostics = provider.provideDiagnostics(doc);

      const warning = diagnostics.find(d => d.code === 'ISL1001');
      expect(warning).toBeUndefined();
    });
  });

  describe('Quickfix Data', () => {
    it('should provide quickfix data for missing postcondition', () => {
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
  }
}
`);
      const diagnostics = provider.provideDiagnostics(doc);

      const warning = diagnostics.find(d => d.code === 'ISL1001');
      expect(warning?.data).toBeDefined();
      expect(warning?.data?.type).toBe('missing-postcondition');
      expect(warning?.data?.behaviorName).toBe('DoSomething');
    });

    it('should provide quickfix data for entity without id', () => {
      const doc = createDocument(`
domain Test {
  version: "1.0.0"

  entity NoId {
    name: String
  }
}
`);
      const diagnostics = provider.provideDiagnostics(doc);

      const warning = diagnostics.find(d => d.code === 'ISL1011');
      expect(warning?.data).toBeDefined();
      expect(warning?.data?.type).toBe('entity-without-id');
      expect(warning?.data?.entityName).toBe('NoId');
    });
  });

  describe('Code Actions', () => {
    it('should generate add postcondition action', () => {
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
  }
}
`);
      documentManager.updateDocument(doc, true);
      const diagnostics = provider.provideDiagnostics(doc);
      const warning = diagnostics.find(d => d.code === 'ISL1001');

      if (warning) {
        const actions = codeActionProvider.provideCodeActions(
          doc,
          warning.range,
          { diagnostics: [warning] }
        );

        const addPostAction = actions.find(a => a.title.includes('postcondition'));
        expect(addPostAction).toBeDefined();
        expect(addPostAction?.kind).toBe('quickfix');
      }
    });

    it('should generate add id field action', () => {
      const doc = createDocument(`
domain Test {
  version: "1.0.0"

  entity NoId {
    name: String
  }
}
`);
      documentManager.updateDocument(doc, true);
      const diagnostics = provider.provideDiagnostics(doc);
      const warning = diagnostics.find(d => d.code === 'ISL1011');

      if (warning) {
        const actions = codeActionProvider.provideCodeActions(
          doc,
          warning.range,
          { diagnostics: [warning] }
        );

        const addIdAction = actions.find(a => a.title.includes("'id'"));
        expect(addIdAction).toBeDefined();
        expect(addIdAction?.edit?.changes?.[doc.uri]).toBeDefined();
      }
    });

    it('should generate add security action', () => {
      const doc = createDocument(`
domain Test {
  version: "1.0.0"

  behavior DeleteUser {
    description: "Delete a user"

    input {
      id: UUID
    }

    output {
      success: Boolean
    }

    postconditions {
      success implies { result == true }
    }

    temporal {
      response within 500.ms
    }
  }
}
`);
      documentManager.updateDocument(doc, true);
      const diagnostics = provider.provideDiagnostics(doc);
      const hint = diagnostics.find(d => d.code === 'ISL1021');

      if (hint) {
        const actions = codeActionProvider.provideCodeActions(
          doc,
          hint.range,
          { diagnostics: [hint] }
        );

        const securityAction = actions.find(a => a.title.includes('security'));
        expect(securityAction).toBeDefined();
      }
    });
  });
});
