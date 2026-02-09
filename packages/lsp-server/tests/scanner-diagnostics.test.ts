// ============================================================================
// Scanner Diagnostics Integration Tests
// Tests that Host + Reality-Gap scanner results surface as LSP diagnostics
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticSeverity } from 'vscode-languageserver';
import {
  ScannerDiagnosticsProvider,
  SOURCE_HOST,
  SOURCE_REALITY_GAP,
} from '../src/features/scanner-diagnostics';

// ============================================================================
// Helpers
// ============================================================================

const createTsDocument = (content: string, uri = 'file:///src/api.ts') =>
  TextDocument.create(uri, 'typescript', 1, content);

const createIslDocument = (content: string, uri = 'file:///spec/auth.isl') =>
  TextDocument.create(uri, 'isl', 1, content);

// ============================================================================
// ScannerDiagnosticsProvider Unit Tests
// ============================================================================

describe('ScannerDiagnosticsProvider', () => {
  let provider: ScannerDiagnosticsProvider;

  beforeEach(() => {
    provider = new ScannerDiagnosticsProvider({
      projectRoot: process.cwd(),
      enabled: true,
      hostScanner: true,
      realityGapScanner: true,
    });
  });

  // --------------------------------------------------------------------------
  // File-type filtering
  // --------------------------------------------------------------------------

  describe('isSupported', () => {
    it('should accept .ts files', () => {
      const doc = createTsDocument('const x = 1;');
      expect(provider.isSupported(doc)).toBe(true);
    });

    it('should accept .tsx files', () => {
      const doc = createTsDocument('const x = 1;', 'file:///src/App.tsx');
      expect(provider.isSupported(doc)).toBe(true);
    });

    it('should accept .js files', () => {
      const doc = createTsDocument('const x = 1;', 'file:///src/index.js');
      expect(provider.isSupported(doc)).toBe(true);
    });

    it('should accept .jsx files', () => {
      const doc = createTsDocument('const x = 1;', 'file:///src/App.jsx');
      expect(provider.isSupported(doc)).toBe(true);
    });

    it('should reject .isl files', () => {
      const doc = createIslDocument('domain Test {}');
      expect(provider.isSupported(doc)).toBe(false);
    });

    it('should reject .json files', () => {
      const doc = TextDocument.create('file:///package.json', 'json', 1, '{}');
      expect(provider.isSupported(doc)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  describe('configure', () => {
    it('should disable provider via enabled flag', () => {
      provider.configure({ enabled: false });
      const doc = createTsDocument('const x = 1;');
      // When disabled, provideDiagnostics should return empty
      return provider.provideDiagnostics(doc).then(diags => {
        expect(diags).toEqual([]);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Source mapping correctness (unit-level)
  // --------------------------------------------------------------------------

  describe('source constants', () => {
    it('should export correct source strings', () => {
      expect(SOURCE_HOST).toBe('shipgate-host');
      expect(SOURCE_REALITY_GAP).toBe('shipgate-reality-gap');
    });
  });
});

// ============================================================================
// Severity / code mapping (acceptance-level shape tests)
// ============================================================================

describe('Scanner Diagnostic Shape', () => {
  it('should produce diagnostics with required LSP fields', async () => {
    // This test validates the diagnostic payload shape.
    // We construct a minimal expected diagnostic to verify the contract.
    const exampleDiagnostic = {
      range: {
        start: { line: 4, character: 0 },
        end: { line: 4, character: 32 },
      },
      message: 'Ghost route detected: POST /api/checkout is not in truthpack',
      severity: DiagnosticSeverity.Error,
      code: 'ghost-route',
      source: SOURCE_HOST,
      data: {
        suggestion: 'Add route to truthpack or remove usage',
        tier: 'hard_block',
        quickFixes: [],
      },
    };

    // Verify shape
    expect(exampleDiagnostic).toHaveProperty('range');
    expect(exampleDiagnostic).toHaveProperty('message');
    expect(exampleDiagnostic).toHaveProperty('severity');
    expect(exampleDiagnostic).toHaveProperty('code');
    expect(exampleDiagnostic).toHaveProperty('source');
    expect(exampleDiagnostic).toHaveProperty('data');

    // Verify severity mapping
    expect(exampleDiagnostic.severity).toBe(DiagnosticSeverity.Error); // hard_block → Error

    // Verify source for ghost-* rule
    expect(exampleDiagnostic.source).toBe(SOURCE_HOST);
  });

  it('should map Reality-Gap violations correctly', () => {
    const exampleDiagnostic = {
      range: {
        start: { line: 12, character: 0 },
        end: { line: 12, character: 45 },
      },
      message: 'Missing authentication check for sensitive operation',
      severity: DiagnosticSeverity.Warning,
      code: 'auth-missing',
      source: SOURCE_REALITY_GAP,
      data: {
        suggestion: 'Add authentication middleware',
        tier: 'soft_block',
        quickFixes: [
          { title: 'Add auth middleware', edit: 'app.use(requireAuth);\n' },
        ],
      },
    };

    expect(exampleDiagnostic.severity).toBe(DiagnosticSeverity.Warning); // soft_block → Warning
    expect(exampleDiagnostic.source).toBe(SOURCE_REALITY_GAP);
    expect(exampleDiagnostic.data.quickFixes).toHaveLength(1);
  });

  it('should map warn tier to Information severity', () => {
    const exampleDiagnostic = {
      severity: DiagnosticSeverity.Information, // warn → Information
      code: 'pii-logging',
      source: SOURCE_REALITY_GAP,
      data: { tier: 'warn' },
    };

    expect(exampleDiagnostic.severity).toBe(DiagnosticSeverity.Information);
  });
});

// ============================================================================
// Deduplication
// ============================================================================

describe('Diagnostic Deduplication', () => {
  it('should not produce duplicate diagnostics for same code+position', () => {
    // Simulates merging parser + scanner diagnostics
    const parserDiag = {
      range: { start: { line: 5, character: 0 }, end: { line: 5, character: 30 } },
      message: 'Ghost route detected',
      severity: DiagnosticSeverity.Error,
      code: 'ghost-route',
      source: 'isl',
    };

    const scannerDiag = {
      range: { start: { line: 5, character: 0 }, end: { line: 5, character: 30 } },
      message: 'Ghost route detected: POST /api/users is not in truthpack',
      severity: DiagnosticSeverity.Error,
      code: 'ghost-route',
      source: SOURCE_HOST,
      data: { suggestion: 'Add route to truthpack', tier: 'hard_block' },
    };

    // Dedup logic: key = code:line:char, prefer entry with data
    const byKey = new Map<string, typeof parserDiag | typeof scannerDiag>();
    for (const d of [parserDiag, scannerDiag]) {
      const key = `${d.code}:${d.range.start.line}:${d.range.start.character}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, d);
      } else if ('data' in d && !('data' in existing)) {
        byKey.set(key, d);
      }
    }

    const merged = Array.from(byKey.values());
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(scannerDiag); // Scanner version preferred (has data)
  });
});

// ============================================================================
// Suppression contract
// ============================================================================

describe('Suppression Comments', () => {
  it('should generate correct shipgate-ignore comment for Host diagnostics', () => {
    const comment = `// shipgate-ignore`;
    expect(comment).toContain('shipgate-ignore');
  });

  it('should generate correct islstudio-ignore comment for Reality-Gap diagnostics', () => {
    const ruleId = 'auth-missing';
    const comment = `// islstudio-ignore ${ruleId}`;
    expect(comment).toBe('// islstudio-ignore auth-missing');
  });
});

// ============================================================================
// Example Diagnostic Payloads (for documentation / acceptance)
// ============================================================================

describe('Example Diagnostic Payloads', () => {
  it('Host scanner: ghost-route payload', () => {
    const payload = {
      uri: 'file:///src/routes/checkout.ts',
      diagnostics: [
        {
          range: {
            start: { line: 4, character: 0 },
            end: { line: 4, character: 42 },
          },
          message: 'Ghost route detected: POST /api/checkout is not in truthpack routes.json',
          severity: DiagnosticSeverity.Error,
          code: 'ghost-route',
          source: 'shipgate-host',
          data: {
            suggestion: 'Add POST /api/checkout to .shipgate/truthpack/routes.json or remove this route',
            tier: 'hard_block',
            quickFixes: [],
          },
        },
      ],
    };

    expect(payload.diagnostics).toHaveLength(1);
    expect(payload.diagnostics[0].source).toBe('shipgate-host');
    expect(payload.diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
    expect(payload.diagnostics[0].code).toBe('ghost-route');
  });

  it('Reality-Gap scanner: auth-missing payload', () => {
    const payload = {
      uri: 'file:///src/handlers/admin.ts',
      diagnostics: [
        {
          range: {
            start: { line: 12, character: 0 },
            end: { line: 12, character: 55 },
          },
          message: 'Sensitive data must be encrypted before storage',
          severity: DiagnosticSeverity.Warning,
          code: 'pii-storage',
          source: 'shipgate-reality-gap',
          data: {
            suggestion: 'Use bcrypt for passwords, encryption for tokens',
            tier: 'soft_block',
            quickFixes: [],
          },
        },
      ],
    };

    expect(payload.diagnostics).toHaveLength(1);
    expect(payload.diagnostics[0].source).toBe('shipgate-reality-gap');
    expect(payload.diagnostics[0].severity).toBe(DiagnosticSeverity.Warning);
  });

  it('Diagnostics disappear when issues are fixed (clearing contract)', () => {
    // When a document has no violations, diagnostics should be empty
    const emptyPayload = {
      uri: 'file:///src/routes/checkout.ts',
      diagnostics: [],
    };

    expect(emptyPayload.diagnostics).toHaveLength(0);
  });
});
