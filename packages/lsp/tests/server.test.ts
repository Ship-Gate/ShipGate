/**
 * ISL Language Server Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../src/documents.js';
import { getCompletions } from '../src/completions.js';
import { getHoverInfo } from '../src/hover.js';
import { getDefinition } from '../src/definitions.js';
import { validateDocument } from '../src/diagnostics.js';
import { formatISL } from '../src/formatting.js';

describe('DocumentManager', () => {
  let manager: DocumentManager;

  beforeEach(() => {
    manager = new DocumentManager();
  });

  it('should parse a valid ISL document', () => {
    const source = `
domain TestDomain {
  entity User {
    id: UUID [immutable, unique]
    email: String
  }
}
`;
    const doc = manager.updateDocument('file:///test.isl', source, 1);
    
    expect(doc.errors).toHaveLength(0);
    expect(doc.ast).not.toBeNull();
    expect(doc.ast?.name.name).toBe('TestDomain');
    expect(doc.ast?.entities).toHaveLength(1);
  });

  it('should capture parse errors', () => {
    const source = `
domain TestDomain {
  entity User {
    id: UUID [immutable
  }
}
`;
    const doc = manager.updateDocument('file:///test.isl', source, 1);
    
    expect(doc.errors.length).toBeGreaterThan(0);
  });

  it('should get all symbols from a document', () => {
    const source = `
domain TestDomain {
  enum Status {
    ACTIVE
    INACTIVE
  }

  entity User {
    id: UUID [immutable]
    status: Status
  }

  behavior CreateUser {
    input {
      email: String
    }
    output {
      success: User
    }
  }
}
`;
    manager.updateDocument('file:///test.isl', source, 1);
    const symbols = manager.getSymbols('file:///test.isl');
    
    expect(symbols.length).toBeGreaterThan(0);
    expect(symbols.some(s => s.name === 'TestDomain' && s.kind === 'domain')).toBe(true);
    expect(symbols.some(s => s.name === 'User' && s.kind === 'entity')).toBe(true);
    expect(symbols.some(s => s.name === 'Status' && s.kind === 'enum')).toBe(true);
    expect(symbols.some(s => s.name === 'CreateUser' && s.kind === 'behavior')).toBe(true);
  });

  it('should find entity fields', () => {
    const source = `
domain TestDomain {
  entity User {
    id: UUID
    email: String
    name: String
  }
}
`;
    manager.updateDocument('file:///test.isl', source, 1);
    const fields = manager.getEntityFields('file:///test.isl', 'User');
    
    expect(fields).toHaveLength(3);
    expect(fields.map(f => f.name.name)).toContain('email');
  });
});

describe('Completions', () => {
  let manager: DocumentManager;

  beforeEach(() => {
    manager = new DocumentManager();
  });

  it('should provide top-level completions', () => {
    const source = `
domain TestDomain {
  |
}
`;
    const doc = manager.updateDocument('file:///test.isl', source.replace('|', ''), 1);
    const textDoc = TextDocument.create('file:///test.isl', 'isl', 1, source.replace('|', ''));
    
    const completions = getCompletions(doc, textDoc, { line: 2, character: 2 });
    
    expect(completions.length).toBeGreaterThan(0);
    expect(completions.some(c => c.label === 'entity')).toBe(true);
    expect(completions.some(c => c.label === 'behavior')).toBe(true);
  });

  it('should provide type completions after colon', () => {
    const source = `
domain TestDomain {
  entity User {
    id: 
  }
}
`;
    const doc = manager.updateDocument('file:///test.isl', source, 1);
    const textDoc = TextDocument.create('file:///test.isl', 'isl', 1, source);
    
    // Position after "id: "
    const completions = getCompletions(doc, textDoc, { line: 3, character: 8 });
    
    expect(completions.length).toBeGreaterThan(0);
    expect(completions.some(c => c.label === 'String')).toBe(true);
    expect(completions.some(c => c.label === 'UUID')).toBe(true);
    expect(completions.some(c => c.label === 'Int')).toBe(true);
  });
});

describe('Hover', () => {
  let manager: DocumentManager;

  beforeEach(() => {
    manager = new DocumentManager();
  });

  it('should provide hover info for entities', () => {
    const source = `
domain TestDomain {
  entity User {
    id: UUID
    email: String
  }
}
`;
    const doc = manager.updateDocument('file:///test.isl', source, 1);
    const textDoc = TextDocument.create('file:///test.isl', 'isl', 1, source);
    
    // Hover over "User"
    const hover = getHoverInfo(doc, textDoc, { line: 2, character: 10 });
    
    expect(hover).not.toBeNull();
    expect(hover?.contents).toBeDefined();
  });

  it('should provide hover info for keywords', () => {
    const source = `
domain TestDomain {
  behavior Login {
    preconditions {
    }
  }
}
`;
    const doc = manager.updateDocument('file:///test.isl', source, 1);
    const textDoc = TextDocument.create('file:///test.isl', 'isl', 1, source);
    
    // Hover over "preconditions"
    const hover = getHoverInfo(doc, textDoc, { line: 3, character: 8 });
    
    expect(hover).not.toBeNull();
  });
});

describe('Go to Definition', () => {
  let manager: DocumentManager;

  beforeEach(() => {
    manager = new DocumentManager();
  });

  it('should find entity definition', () => {
    const source = `
domain TestDomain {
  entity User {
    id: UUID
  }

  behavior CreateUser {
    output {
      success: User
    }
  }
}
`;
    const doc = manager.updateDocument('file:///test.isl', source, 1);
    const textDoc = TextDocument.create('file:///test.isl', 'isl', 1, source);
    
    // Find definition of "User" in output
    const location = getDefinition(doc, textDoc, { line: 8, character: 15 });
    
    expect(location).not.toBeNull();
    expect(location?.uri).toBe('file:///test.isl');
    // Should point to the entity declaration
    expect(location?.range.start.line).toBe(1); // Line 2 in 0-based
  });

  it('should find behavior definition', () => {
    const source = `
domain TestDomain {
  behavior Login {
    input {
      email: String
    }
  }
}
`;
    const doc = manager.updateDocument('file:///test.isl', source, 1);
    const textDoc = TextDocument.create('file:///test.isl', 'isl', 1, source);
    
    // Find definition of "Login"
    const location = getDefinition(doc, textDoc, { line: 2, character: 12 });
    
    expect(location).not.toBeNull();
  });
});

describe('Diagnostics', () => {
  let manager: DocumentManager;

  beforeEach(() => {
    manager = new DocumentManager();
  });

  it('should report unknown types', () => {
    const source = `
domain TestDomain {
  entity User {
    id: UUID
    status: UnknownType
  }
}
`;
    const doc = manager.updateDocument('file:///test.isl', source, 1);
    const diagnostics = validateDocument(doc);
    
    expect(diagnostics.some(d => d.message.includes('Unknown type'))).toBe(true);
  });

  it('should report duplicate field names', () => {
    const source = `
domain TestDomain {
  entity User {
    id: UUID
    email: String
    email: String
  }
}
`;
    const doc = manager.updateDocument('file:///test.isl', source, 1);
    const diagnostics = validateDocument(doc);
    
    expect(diagnostics.some(d => d.message.includes('Duplicate field'))).toBe(true);
  });

  it('should warn about missing id field', () => {
    const source = `
domain TestDomain {
  entity User {
    email: String
    name: String
  }
}
`;
    const doc = manager.updateDocument('file:///test.isl', source, 1);
    const diagnostics = validateDocument(doc);
    
    expect(diagnostics.some(d => d.message.includes("should have an 'id' field"))).toBe(true);
  });
});

describe('Formatting', () => {
  it('should format indentation correctly', () => {
    const source = `domain TestDomain {
entity User {
id: UUID
email: String
}
}`;

    const formatted = formatISL(source, { tabSize: 2, insertSpaces: true });
    const lines = formatted.split('\n');
    
    expect(lines[0]).toBe('domain TestDomain {');
    expect(lines[1]).toBe('  entity User {');
    expect(lines[2]).toBe('    id: UUID');
    expect(lines[3]).toBe('    email: String');
    expect(lines[4]).toBe('  }');
    expect(lines[5]).toBe('}');
  });

  it('should format annotations', () => {
    const source = `domain Test {
entity User {
id: UUID[immutable,unique]
}
}`;

    const formatted = formatISL(source, { tabSize: 2, insertSpaces: true });
    
    expect(formatted).toContain('[immutable, unique]');
  });

  it('should preserve comments', () => {
    const source = `# This is a comment
domain Test {
# Another comment
entity User {
id: UUID
}
}`;

    const formatted = formatISL(source, { tabSize: 2, insertSpaces: true });
    
    expect(formatted).toContain('# This is a comment');
    expect(formatted).toContain('# Another comment');
  });

  it('should format list items with dash', () => {
    const source = `domain Test {
invariants Safety {
-condition1
-condition2
}
}`;

    const formatted = formatISL(source, { tabSize: 2, insertSpaces: true });
    
    expect(formatted).toContain('- condition1');
    expect(formatted).toContain('- condition2');
  });
});
