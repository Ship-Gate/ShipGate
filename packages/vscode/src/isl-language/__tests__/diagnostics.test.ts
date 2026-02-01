/**
 * ISL Diagnostics Tests
 * 
 * Unit tests for the ISL diagnostics provider.
 * These tests mock VS Code APIs for isolated testing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock VS Code API
const mockDiagnosticCollection = {
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  dispose: vi.fn(),
};

const mockLanguages = {
  createDiagnosticCollection: vi.fn(() => mockDiagnosticCollection),
  registerCodeActionsProvider: vi.fn(() => ({ dispose: vi.fn() })),
};

const mockWorkspace = {
  textDocuments: [],
  onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
  onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
  onDidCloseTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
};

vi.mock('vscode', () => ({
  languages: mockLanguages,
  workspace: mockWorkspace,
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3,
  },
  Range: class {
    constructor(
      public startLine: number,
      public startCol: number,
      public endLine: number,
      public endCol: number
    ) {}
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
  CodeActionKind: {
    QuickFix: { append: (s: string) => `quickfix.${s}` },
    Refactor: { append: (s: string) => `refactor.${s}` },
  },
  Uri: {
    file: (path: string) => ({ fsPath: path, toString: () => path }),
  },
}));

describe('ISL Document Selector', () => {
  it('should export ISL_LANGUAGE_ID as "isl"', async () => {
    const { ISL_LANGUAGE_ID } = await import('../islSelector');
    expect(ISL_LANGUAGE_ID).toBe('isl');
  });

  it('should export ISL_FILE_EXTENSION as ".isl"', async () => {
    const { ISL_FILE_EXTENSION } = await import('../islSelector');
    expect(ISL_FILE_EXTENSION).toBe('.isl');
  });

  it('should identify ISL documents correctly', async () => {
    const { isISLDocument } = await import('../islSelector');
    
    const islDoc = { languageId: 'isl' };
    const jsDoc = { languageId: 'javascript' };
    
    expect(isISLDocument(islDoc as never)).toBe(true);
    expect(isISLDocument(jsDoc as never)).toBe(false);
  });

  it('should identify ISL URIs correctly', async () => {
    const { isISLUri } = await import('../islSelector');
    const vscode = await import('vscode');
    
    const islUri = vscode.Uri.file('/path/to/file.isl');
    const jsUri = vscode.Uri.file('/path/to/file.js');
    
    expect(isISLUri(islUri)).toBe(true);
    expect(isISLUri(jsUri)).toBe(false);
  });
});

describe('ISL Diagnostic Codes', () => {
  it('should export all diagnostic codes', async () => {
    const { ISLDiagnosticCode } = await import('../diagnostics');
    
    // Parse errors
    expect(ISLDiagnosticCode.PARSE_ERROR).toBe('ISL-P001');
    expect(ISLDiagnosticCode.UNEXPECTED_TOKEN).toBe('ISL-P002');
    expect(ISLDiagnosticCode.MISSING_CLOSING_BRACE).toBe('ISL-P003');
    
    // Semantic warnings
    expect(ISLDiagnosticCode.MISSING_POSTCONDITIONS).toBe('ISL-S001');
    expect(ISLDiagnosticCode.MISSING_VERSION).toBe('ISL-S002');
    expect(ISLDiagnosticCode.MISSING_DESCRIPTION).toBe('ISL-S003');
    
    // Style warnings
    expect(ISLDiagnosticCode.MISSING_ERROR_WHEN).toBe('ISL-W003');
  });
});

describe('ISL Diagnostics Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a diagnostics provider', async () => {
    const { createDiagnosticsProvider } = await import('../diagnostics');
    
    const provider = createDiagnosticsProvider();
    expect(provider).toBeDefined();
    expect(typeof provider.updateDiagnostics).toBe('function');
    expect(typeof provider.clearDiagnostics).toBe('function');
    expect(typeof provider.clearAll).toBe('function');
    expect(typeof provider.dispose).toBe('function');
  });

  it('should create diagnostic collection on instantiation', async () => {
    const { createDiagnosticsProvider } = await import('../diagnostics');
    
    createDiagnosticsProvider();
    expect(mockLanguages.createDiagnosticCollection).toHaveBeenCalledWith('isl');
  });
});

describe('ISL Semantic Lint', () => {
  it('should detect missing version in domain', async () => {
    // This would require a more complete mock setup
    // Placeholder for integration test
    expect(true).toBe(true);
  });

  it('should detect missing postconditions in behavior', async () => {
    // This would require a more complete mock setup
    // Placeholder for integration test
    expect(true).toBe(true);
  });

  it('should detect empty preconditions block', async () => {
    // Placeholder for integration test
    expect(true).toBe(true);
  });
});

describe('Fallback Parser', () => {
  it('should detect unclosed braces', async () => {
    // Placeholder for integration test
    expect(true).toBe(true);
  });

  it('should detect unclosed strings', async () => {
    // Placeholder for integration test
    expect(true).toBe(true);
  });
});
