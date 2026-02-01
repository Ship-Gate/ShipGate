// ============================================================================
// Completion Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLDocumentManager } from '../src/documents';
import { ISLCompletionProvider } from '../src/features/completion';

describe('ISLCompletionProvider', () => {
  let documentManager: ISLDocumentManager;
  let provider: ISLCompletionProvider;

  beforeEach(() => {
    documentManager = new ISLDocumentManager();
    provider = new ISLCompletionProvider(documentManager);
  });

  const createDocument = (content: string, uri = 'file:///test.isl') => {
    return TextDocument.create(uri, 'isl', 1, content);
  };

  const getCompletions = (content: string, line: number, character: number) => {
    const doc = createDocument(content);
    // First update the document to ensure it's parsed
    documentManager.updateDocument(doc, true);
    return provider.provideCompletions(doc, { line, character });
  };

  describe('top-level completions', () => {
    it('should suggest domain at empty file', () => {
      const completions = getCompletions('', 0, 0);

      expect(completions.some(c => c.label === 'domain')).toBe(true);
    });
  });

  describe('domain-level completions', () => {
    it('should suggest entity, behavior, type inside domain', () => {
      const content = `
domain Test {
  version: "1.0.0"
  
}`;
      const completions = getCompletions(content, 4, 2);

      expect(completions.some(c => c.label === 'entity')).toBe(true);
      expect(completions.some(c => c.label === 'behavior')).toBe(true);
      expect(completions.some(c => c.label === 'type')).toBe(true);
    });
  });

  describe('behavior-level completions', () => {
    it('should suggest input, output, pre, post inside behavior', () => {
      const content = `
domain Test {
  version: "1.0.0"
  
  behavior DoSomething {
    
  }
}`;
      const completions = getCompletions(content, 5, 4);

      expect(completions.some(c => c.label === 'input')).toBe(true);
      expect(completions.some(c => c.label === 'output')).toBe(true);
      expect(completions.some(c => c.label === 'preconditions')).toBe(true);
      expect(completions.some(c => c.label === 'postconditions')).toBe(true);
    });
  });

  describe('type completions', () => {
    it('should suggest built-in types after colon', () => {
      const content = `
domain Test {
  version: "1.0.0"
  
  entity User {
    id: 
  }
}`;
      const completions = getCompletions(content, 5, 8);

      expect(completions.some(c => c.label === 'String')).toBe(true);
      expect(completions.some(c => c.label === 'Int')).toBe(true);
      expect(completions.some(c => c.label === 'Boolean')).toBe(true);
      expect(completions.some(c => c.label === 'UUID')).toBe(true);
      expect(completions.some(c => c.label === 'Timestamp')).toBe(true);
    });

    it('should suggest List, Map, Set generic types', () => {
      const content = `
domain Test {
  version: "1.0.0"
  
  entity User {
    tags: 
  }
}`;
      const completions = getCompletions(content, 5, 10);

      expect(completions.some(c => c.label === 'List')).toBe(true);
      expect(completions.some(c => c.label === 'Map')).toBe(true);
      expect(completions.some(c => c.label === 'Set')).toBe(true);
    });
  });

  describe('postcondition completions', () => {
    it('should suggest old() and result in postconditions', () => {
      const content = `
domain Test {
  version: "1.0.0"
  
  behavior Update {
    postconditions {
      success implies {
        
      }
    }
  }
}`;
      const completions = getCompletions(content, 7, 8);

      expect(completions.some(c => c.label === 'old')).toBe(true);
      expect(completions.some(c => c.label === 'result')).toBe(true);
    });
  });

  describe('expression completions', () => {
    it('should suggest quantifiers and logical operators', () => {
      const content = `
domain Test {
  version: "1.0.0"
  
  invariants Check {
    always {
      
    }
  }
}`;
      const completions = getCompletions(content, 6, 6);

      expect(completions.some(c => c.label === 'forall')).toBe(true);
      expect(completions.some(c => c.label === 'exists')).toBe(true);
      expect(completions.some(c => c.label === 'implies')).toBe(true);
      expect(completions.some(c => c.label === 'and')).toBe(true);
      expect(completions.some(c => c.label === 'or')).toBe(true);
      expect(completions.some(c => c.label === 'not')).toBe(true);
    });
  });

  describe('user-defined type completions', () => {
    it('should suggest custom types defined in the document', () => {
      const content = `
domain Test {
  version: "1.0.0"
  
  type Email = String { format: "email" }
  type Money = Decimal { min: 0 }
  
  entity User {
    email: 
  }
}`;
      // Parse the document first
      const doc = createDocument(content);
      documentManager.updateDocument(doc, true);

      const completions = getCompletions(content, 8, 11);

      expect(completions.some(c => c.label === 'Email')).toBe(true);
      expect(completions.some(c => c.label === 'Money')).toBe(true);
    });
  });
});
