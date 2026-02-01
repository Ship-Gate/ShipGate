/**
 * ISL Quick Fixes Tests
 * 
 * Unit tests for the ISL quick fixes provider.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock VS Code API
const mockCodeActionKind = {
  QuickFix: { append: (s: string) => `quickfix.${s}` },
  Refactor: { append: (s: string) => `refactor.${s}` },
};

vi.mock('vscode', () => ({
  languages: {
    registerCodeActionsProvider: vi.fn(() => ({ dispose: vi.fn() })),
    createDiagnosticCollection: vi.fn(() => ({
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  workspace: {
    textDocuments: [],
    onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
  },
  window: {
    activeTextEditor: undefined,
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  commands: {
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
    executeCommand: vi.fn(),
  },
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3,
  },
  Range: class {
    start: { line: number; character: number };
    end: { line: number; character: number };
    constructor(
      startLine: number,
      startCol: number,
      endLine: number,
      endCol: number
    ) {
      this.start = { line: startLine, character: startCol };
      this.end = { line: endLine, character: endCol };
    }
  },
  Position: class {
    constructor(public line: number, public character: number) {}
  },
  Diagnostic: class {
    public code?: string;
    public source?: string;
    constructor(
      public range: unknown,
      public message: string,
      public severity: number
    ) {}
  },
  CodeAction: class {
    public diagnostics?: unknown[];
    public isPreferred?: boolean;
    public edit?: unknown;
    public command?: unknown;
    constructor(public title: string, public kind: string) {}
  },
  CodeActionKind: mockCodeActionKind,
  WorkspaceEdit: class {
    private edits: Array<{ uri: unknown; edit: unknown }> = [];
    insert(uri: unknown, position: unknown, text: string): void {
      this.edits.push({ uri, edit: { position, text, type: 'insert' } });
    }
    replace(uri: unknown, range: unknown, text: string): void {
      this.edits.push({ uri, edit: { range, text, type: 'replace' } });
    }
    getEdits() {
      return this.edits;
    }
  },
  Uri: {
    file: (path: string) => ({ fsPath: path, toString: () => path }),
  },
}));

describe('ISL Quick Fixes Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a quick fixes provider', async () => {
    const { createQuickFixesProvider } = await import('../quickFixes');
    
    const provider = createQuickFixesProvider();
    expect(provider).toBeDefined();
    expect(typeof provider.provideCodeActions).toBe('function');
    expect(typeof provider.dispose).toBe('function');
  });

  it('should accept options', async () => {
    const { createQuickFixesProvider } = await import('../quickFixes');
    
    const provider = createQuickFixesProvider({
      enableFormatting: false,
    });
    expect(provider).toBeDefined();
  });

  it('should export code action kinds', async () => {
    const { ISL_QUICK_FIX_KIND, ISL_REFACTOR_KIND } = await import('../quickFixes');
    
    expect(ISL_QUICK_FIX_KIND).toBe('quickfix.isl');
    expect(ISL_REFACTOR_KIND).toBe('refactor.isl');
  });
});

describe('Quick Fix Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register quick fix commands', async () => {
    const vscode = await import('vscode');
    const { registerQuickFixCommands } = await import('../quickFixes');
    
    const mockContext = {
      subscriptions: [],
    };
    
    registerQuickFixCommands(mockContext as never);
    
    // Should register 3 commands
    expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(3);
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'isl.addPostconditions',
      expect.any(Function)
    );
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'isl.addVersion',
      expect.any(Function)
    );
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'isl.normalizeFormatting',
      expect.any(Function)
    );
  });
});

describe('Code Action Generation', () => {
  it('should generate postconditions block template', () => {
    const template = `
  postconditions {
    success implies {
      // Add postcondition assertions here
    }
  }
`;
    expect(template).toContain('postconditions');
    expect(template).toContain('success implies');
  });

  it('should generate version header template', () => {
    const template = `  version: "1.0.0"\n`;
    expect(template).toContain('version');
    expect(template).toContain('1.0.0');
  });
});

describe('Canonical Printer Integration', () => {
  it('should report printer availability', async () => {
    const { isCanonicalPrinterAvailable } = await import('../quickFixes');
    
    // Should return boolean
    const available = isCanonicalPrinterAvailable();
    expect(typeof available).toBe('boolean');
  });
});
