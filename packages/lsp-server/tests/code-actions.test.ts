// ============================================================================
// ISL Code Action Provider Tests
// Validates quick fixes, refactoring actions, and skeleton generation
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ISLDocumentManager } from '../src/documents.js';
import { ISLCodeActionProvider } from '../src/features/actions.js';
import { CodeActionKind } from 'vscode-languageserver';

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

describe('ISLCodeActionProvider', () => {
  let manager: ISLDocumentManager;
  let provider: ISLCodeActionProvider;

  beforeEach(() => {
    manager = new ISLDocumentManager();
    provider = new ISLCodeActionProvider(manager);
  });

  describe('Generate Skeleton Code Action', () => {
    it('should offer skeleton generation when cursor is inside a domain', () => {
      const content = `domain Payments {
  version: "1.0.0"

  entity Invoice {
    id: UUID
    amount: Decimal
  }

  behavior CreateInvoice {
    input { amount: Decimal }
    output { success: Invoice }
  }
}`;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const actions = provider.provideCodeActions(
        doc as any,
        { start: { line: 3, character: 0 }, end: { line: 3, character: 0 } },
        { diagnostics: [] } as any
      );

      const skeletonAction = actions.find((a) =>
        a.title.includes('Generate implementation skeleton')
      );
      expect(skeletonAction).toBeDefined();
      expect(skeletonAction?.title).toContain('Payments');
      expect(skeletonAction?.kind).toBe(CodeActionKind.Source);
      expect(skeletonAction?.command?.command).toBe('shipgate.isl.generateSkeleton');
    });

    it('should pass document URI and domain name as command arguments', () => {
      const content = `domain Auth {
  version: "1.0.0"
  entity User { id: UUID }
}`;
      const doc = createMockDocument(content, 'file:///workspace/auth.isl');
      manager.updateDocument(doc);

      const actions = provider.provideCodeActions(
        doc as any,
        { start: { line: 2, character: 0 }, end: { line: 2, character: 0 } },
        { diagnostics: [] } as any
      );

      const skeletonAction = actions.find((a) =>
        a.title.includes('Generate implementation skeleton')
      );
      expect(skeletonAction?.command?.arguments).toEqual([
        'file:///workspace/auth.isl',
        'Auth',
      ]);
    });

    it('should NOT offer skeleton generation outside a domain', () => {
      const content = `// Just a comment\n// No domain here`;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const actions = provider.provideCodeActions(
        doc as any,
        { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        { diagnostics: [] } as any
      );

      const skeletonAction = actions.find((a) =>
        a.title.includes('Generate implementation skeleton')
      );
      expect(skeletonAction).toBeUndefined();
    });
  });

  describe('CRUD Behaviors Code Action', () => {
    it('should offer CRUD generation on entity line', () => {
      const content = `domain Test {
  version: "1.0.0"
  entity Product {
    id: UUID
    name: String
  }
}`;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const actions = provider.provideCodeActions(
        doc as any,
        { start: { line: 2, character: 2 }, end: { line: 2, character: 2 } },
        { diagnostics: [] } as any
      );

      const crudAction = actions.find((a) =>
        a.title.includes('Generate CRUD behaviors')
      );
      expect(crudAction).toBeDefined();
      expect(crudAction?.title).toContain('Product');
    });
  });

  describe('Quick Fix: Missing Postconditions', () => {
    it('should offer postcondition insertion for ISL1001', () => {
      const content = `domain Test {
  version: "1.0.0"
  behavior Create {
    input { name: String }
    output { success: Boolean }
  }
}`;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const diagnostic = {
        code: 'ISL1001',
        message: 'Behavior lacks postconditions',
        range: { start: { line: 2, character: 2 }, end: { line: 2, character: 20 } },
        severity: 1 as const,
      };

      const actions = provider.provideCodeActions(
        doc as any,
        { start: { line: 2, character: 2 }, end: { line: 2, character: 2 } },
        { diagnostics: [diagnostic] } as any
      );

      const fix = actions.find((a) => a.title === 'Add postconditions block');
      expect(fix).toBeDefined();
      expect(fix?.kind).toBe(CodeActionKind.QuickFix);
    });
  });

  describe('Quick Fix: Define Type', () => {
    it('should offer type creation for unknown type errors', () => {
      const content = `domain Test {
  version: "1.0.0"
  entity User {
    id: UUID
    status: UserStatus
  }
}`;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const diagnostic = {
        code: 'ISL002',
        message: "Unknown type 'UserStatus'",
        range: { start: { line: 4, character: 12 }, end: { line: 4, character: 22 } },
        severity: 1 as const,
      };

      const actions = provider.provideCodeActions(
        doc as any,
        { start: { line: 4, character: 12 }, end: { line: 4, character: 22 } },
        { diagnostics: [diagnostic] } as any
      );

      const fix = actions.find((a) => a.title.includes("Define type 'UserStatus'"));
      expect(fix).toBeDefined();
    });
  });

  describe('Scenario Generation', () => {
    it('should offer scenario generation inside a behavior', () => {
      const content = `domain Test {
  version: "1.0.0"
  behavior Login {
    input { email: String }
    output { success: Boolean }
  }
}`;
      const doc = createMockDocument(content);
      manager.updateDocument(doc);

      const actions = provider.provideCodeActions(
        doc as any,
        { start: { line: 3, character: 4 }, end: { line: 3, character: 4 } },
        { diagnostics: [] } as any
      );

      const scenarioAction = actions.find((a) =>
        a.title.includes('Generate test scenarios')
      );
      expect(scenarioAction).toBeDefined();
      expect(scenarioAction?.title).toContain('Login');
    });
  });
});
