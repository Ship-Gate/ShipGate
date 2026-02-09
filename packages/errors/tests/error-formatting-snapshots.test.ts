// ============================================================================
// Golden Snapshot Tests for Error Formatting
// ============================================================================
//
// These tests ensure error messages are formatted consistently with:
// - Code snippets with caret indicators
// - "Why" explanations (notes)
// - "How to fix" suggestions (help)
// - Stable error codes
// - "Did you mean?" typo suggestions
//
// To update snapshots: npx vitest run -u
//
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  formatDiagnostic,
  formatDiagnostics,
  registerSource,
  clearSourceCache,
  errorDiag,
  createLocation,
  type Diagnostic,
  type ErrorCategory,
} from '../src/index.js';

// Helper: build a Diagnostic object literal quickly
function diag(fields: {
  code: string;
  category: ErrorCategory;
  severity?: Diagnostic['severity'];
  message: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  source?: Diagnostic['source'];
  relatedInformation?: Diagnostic['relatedInformation'];
  notes?: string[];
  help?: string[];
}): Diagnostic {
  return {
    code: fields.code,
    category: fields.category,
    severity: fields.severity ?? 'error',
    message: fields.message,
    location: createLocation(
      fields.file,
      fields.line,
      fields.column,
      fields.endLine ?? fields.line,
      fields.endColumn ?? fields.column
    ),
    source: fields.source ?? 'parser',
    relatedInformation: fields.relatedInformation,
    notes: fields.notes,
    help: fields.help,
  };
}

describe('Error Formatting - Golden Snapshots', () => {
  beforeEach(() => {
    clearSourceCache();
  });

  afterEach(() => {
    clearSourceCache();
  });

  // ========================================================================
  // LEXER ERRORS (E0001-E0099) — 3 tests
  // ========================================================================
  describe('Lexer Errors', () => {
    it('E0001: Unexpected character', () => {
      const source = `domain Test {\n  name: \u201cString\u201d\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0001',
        category: 'lexer',
        message: "Unexpected character '\u201c'",
        file: 'test.isl',
        line: 2,
        column: 9,
        endColumn: 10,
        source: 'lexer',
        help: ['Replace curly quotes \u201c\u201d with straight quotes ""'],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0002: Unterminated string literal', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  description: "This string never ends\n}`;
      registerSource('test.isl', source);

      const d = errorDiag(
        'E0002',
        'Unterminated string literal',
        createLocation('test.isl', 3, 20, 3, 20),
        'lexer'
      );

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0006: Unterminated block comment', () => {
      const source = `/* This comment\nnever ends\n\nentity Account {\n  id: UUID\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0006',
        category: 'lexer',
        message: 'Unterminated block comment',
        file: 'test.isl',
        line: 1,
        column: 1,
        endColumn: 15,
        source: 'lexer',
        help: ['Add the missing */ at the end of the comment'],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });
  });

  // ========================================================================
  // PARSER ERRORS (E0100-E0199) — 8 tests
  // ========================================================================
  describe('Parser Errors', () => {
    it('E0100: Unexpected token', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity User {\n    id: UUID\n    @invalid\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0100',
        category: 'parser',
        message: "Unexpected token '@invalid'",
        file: 'test.isl',
        line: 5,
        column: 5,
        endColumn: 12,
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0101: Expected token (missing colon)', () => {
      const source = `domain Auth {\n  version: "1.0.0"\n  entity User {\n    id UUID\n  }\n}`;
      registerSource('auth.isl', source);

      const d = diag({
        code: 'E0101',
        category: 'parser',
        message: "Expected ':', got 'UUID'",
        file: 'auth.isl',
        line: 4,
        column: 8,
        endColumn: 12,
        help: ["Entity fields use 'name: Type' syntax", "Fix: id: UUID"],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0102: Expected identifier', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity {\n    id: UUID\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0102',
        category: 'parser',
        message: "Expected identifier, got '{'",
        file: 'test.isl',
        line: 3,
        column: 10,
        endColumn: 11,
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0105: Missing closing brace', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity User {\n    id: UUID\n    name: String\n`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0105',
        category: 'parser',
        message: "Expected '}' to close block",
        file: 'test.isl',
        line: 6,
        column: 1,
        relatedInformation: [
          {
            message: 'Block opened here',
            location: createLocation('test.isl', 3, 15, 3, 16),
          },
        ],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0105: Missing closing brace (multi-line span)', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity User {\n    id: UUID\n    name: String\n    email: String\n`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0105',
        category: 'parser',
        message: "Expected '}' to close block",
        file: 'test.isl',
        line: 3,
        column: 15,
        endLine: 7,
        endColumn: 1,
        relatedInformation: [
          {
            message: 'Block opened here',
            location: createLocation('test.isl', 3, 15, 3, 16),
          },
        ],
      });

      expect(formatDiagnostic(d, { colors: false, contextLines: 1 })).toMatchSnapshot();
    });

    it('E0109: Duplicate entity', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity User {\n    id: UUID\n  }\n  entity User {\n    name: String\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0109',
        category: 'parser',
        message: "Entity 'User' is already defined",
        file: 'test.isl',
        line: 6,
        column: 3,
        endColumn: 14,
        relatedInformation: [
          {
            message: 'Previously defined here',
            location: createLocation('test.isl', 3, 3, 3, 14),
          },
        ],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0118: Unclosed block', () => {
      const source = `domain Auth {\n  version: "1.0.0"\n  behavior Login {\n    input { email: String }\n`;
      registerSource('auth.isl', source);

      const d = diag({
        code: 'E0118',
        category: 'parser',
        message: "Unclosed 'behavior Login' block",
        file: 'auth.isl',
        line: 5,
        column: 1,
        relatedInformation: [
          {
            message: 'Block opened here',
            location: createLocation('auth.isl', 3, 19, 3, 20),
          },
        ],
        help: ["Add a closing '}' to close the behavior Login block"],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0119: Unknown keyword (behaviour -> behavior)', () => {
      const source = `domain Auth {\n  version: "1.0.0"\n  behaviour Login {\n    input { email: String }\n  }\n}`;
      registerSource('auth.isl', source);

      const d = diag({
        code: 'E0119',
        category: 'parser',
        message: "Unexpected keyword 'behaviour' in this context",
        file: 'auth.isl',
        line: 3,
        column: 3,
        endColumn: 12,
        help: ["Did you mean 'behavior'? (American spelling)"],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });
  });

  // ========================================================================
  // TYPE ERRORS (E0200-E0299) — 5 tests
  // ========================================================================
  describe('Type Errors', () => {
    it('E0200: Type mismatch', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity Account {\n    balance: Decimal\n  }\n  behavior Transfer {\n    postconditions {\n      sender.balance == "100.00"\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0200',
        category: 'type',
        message: "Type mismatch: expected 'Decimal', got 'String'",
        file: 'test.isl',
        line: 8,
        column: 24,
        endColumn: 32,
        source: 'typechecker',
        notes: ["The expression has type 'String' but 'Decimal' was expected"],
        help: ['Use a Decimal literal instead: 100.00'],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0201: Undefined type (typo)', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity User {\n    email: Emal\n  }\n}`;
      registerSource('users.isl', source);

      const d = diag({
        code: 'E0201',
        category: 'type',
        message: "Type 'Emal' is not defined",
        file: 'users.isl',
        line: 4,
        column: 12,
        endColumn: 16,
        source: 'typechecker',
        notes: ['Available types: Email, String, Number, Boolean, UUID'],
        help: ["Did you mean 'Email'?"],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0201: Undefined type (case sensitivity)', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity User {\n    id: uuid\n    age: Intger\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0201',
        category: 'type',
        message: "Type 'uuid' is not defined",
        file: 'test.isl',
        line: 4,
        column: 9,
        endColumn: 13,
        source: 'typechecker',
        help: ["Did you mean 'UUID'?", "Type names are case-sensitive"],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0202: Undefined field (typo)', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity Account {\n    balance: Decimal\n  }\n  behavior Check {\n    preconditions {\n      account.balace > 0\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0202',
        category: 'type',
        message: "Field 'balace' does not exist on type 'Account'",
        file: 'test.isl',
        line: 8,
        column: 15,
        endColumn: 21,
        source: 'typechecker',
        help: ["Did you mean 'balance'?", 'Available fields: balance'],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0210: Incompatible comparison', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity User {\n    name: String\n    age: Int\n  }\n  behavior Check {\n    postconditions {\n      user.name == user.age\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0210',
        category: 'type',
        message: "Cannot compare 'String' with 'Int'",
        file: 'test.isl',
        line: 9,
        column: 7,
        endColumn: 27,
        source: 'typechecker',
        notes: ["'name' is String but 'age' is Int - these types are not comparable"],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });
  });

  // ========================================================================
  // SEMANTIC ERRORS (E0300-E0399) — 6 tests
  // ========================================================================
  describe('Semantic Errors', () => {
    it('E0300: Undefined variable (typo)', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  behavior Transfer {\n    input {\n      amount: Decimal\n    }\n    preconditions {\n      ammount > 0\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0300',
        category: 'semantic',
        message: "Variable 'ammount' is not defined",
        file: 'test.isl',
        line: 8,
        column: 7,
        endColumn: 14,
        source: 'typechecker',
        help: ["Did you mean 'amount'?"],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0301: Undefined entity', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  behavior Transfer {\n    preconditions {\n      Account.exists(senderId)\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0301',
        category: 'semantic',
        message: "Entity 'Account' is not defined",
        file: 'test.isl',
        line: 5,
        column: 7,
        endColumn: 14,
        source: 'typechecker',
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0302: Undefined behavior', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  scenario "test" {\n    given {\n      Transfer(amount: 100)\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0302',
        category: 'semantic',
        message: "Behavior 'Transfer' is not defined",
        file: 'test.isl',
        line: 5,
        column: 7,
        endColumn: 15,
        source: 'typechecker',
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0304: old() outside postcondition', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  behavior Transfer {\n    preconditions {\n      old(sender.balance) >= amount\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0304',
        category: 'semantic',
        message: "'old()' can only be used in postconditions",
        file: 'test.isl',
        line: 5,
        column: 7,
        endColumn: 26,
        source: 'typechecker',
        notes: ['old() captures the value of an expression before a behavior executes'],
        help: ['In preconditions, reference values directly without old()'],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0305: result outside postcondition', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  behavior CalculateTotal {\n    preconditions {\n      result > 0\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0305',
        category: 'semantic',
        message: "'result' can only be used in postconditions",
        file: 'test.isl',
        line: 5,
        column: 7,
        endColumn: 13,
        source: 'typechecker',
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0309: Duplicate definition', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity Account {\n    balance: Decimal\n    balance: Int\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0309',
        category: 'semantic',
        message: "Field 'balance' is already defined",
        file: 'test.isl',
        line: 5,
        column: 5,
        endColumn: 17,
        source: 'typechecker',
        relatedInformation: [
          {
            message: 'Previously defined here',
            location: createLocation('test.isl', 4, 5, 4, 21),
          },
        ],
        help: ['Remove the duplicate field or rename one of them'],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });
  });

  // ========================================================================
  // EVALUATION ERRORS (E0400-E0499) — 5 tests
  // ========================================================================
  describe('Evaluation Errors', () => {
    it('E0400: Division by zero', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  behavior Calculate {\n    postconditions {\n      average == total / count\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0400',
        category: 'eval',
        message: 'Division by zero',
        file: 'test.isl',
        line: 5,
        column: 25,
        endColumn: 30,
        source: 'evaluator',
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0401: Null reference', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  behavior Check {\n    postconditions {\n      account.balance > 0\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0401',
        category: 'eval',
        message: "Cannot read property 'balance' of null",
        file: 'test.isl',
        line: 5,
        column: 7,
        endColumn: 22,
        source: 'evaluator',
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0403: Undefined property', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity Account {\n    balance: Decimal\n  }\n  behavior Check {\n    postconditions {\n      account.balace > 0\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0403',
        category: 'eval',
        message: "Property 'balace' is undefined",
        file: 'test.isl',
        line: 8,
        column: 13,
        endColumn: 19,
        source: 'evaluator',
        help: ["Did you mean 'balance'?"],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0404: Invalid operation', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  behavior Check {\n    postconditions {\n      "hello".length()\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0404',
        category: 'eval',
        message: 'Invalid operation: strings do not have length() method',
        file: 'test.isl',
        line: 5,
        column: 7,
        endColumn: 23,
        source: 'evaluator',
        help: ['Use .length property instead of .length() method'],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0408: Type coercion failed', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  behavior Parse {\n    postconditions {\n      parseInt("not a number")\n    }\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0408',
        category: 'eval',
        message: "Cannot coerce 'String' to 'Int'",
        file: 'test.isl',
        line: 5,
        column: 7,
        endColumn: 31,
        source: 'evaluator',
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });
  });

  // ========================================================================
  // VERIFICATION ERRORS (E0500-E0599) — 4 tests
  // ========================================================================
  describe('Verification Errors', () => {
    it('E0500: Precondition failed', () => {
      const source = `domain Banking {\n  version: "1.0.0"\n  behavior Transfer {\n    preconditions {\n      amount > 0\n      sender.balance >= amount\n    }\n  }\n}`;
      registerSource('banking.isl', source);

      const d = diag({
        code: 'E0500',
        category: 'verify',
        message: 'Precondition failed: amount > 0',
        file: 'banking.isl',
        line: 5,
        column: 7,
        endColumn: 17,
        source: 'verifier',
        notes: ['The caller passed amount = -50, which violates this precondition'],
        help: ['Validate inputs before invoking Transfer'],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0501: Postcondition failed', () => {
      const source = `domain Banking {\n  version: "1.0.0"\n  behavior Transfer {\n    postconditions {\n      sender.balance == old(sender.balance) - amount\n      receiver.balance == old(receiver.balance) + amount\n    }\n  }\n}`;
      registerSource('banking.isl', source);

      const d = diag({
        code: 'E0501',
        category: 'verify',
        message: 'Postcondition failed: sender.balance == old(sender.balance) - amount',
        file: 'banking.isl',
        line: 5,
        column: 7,
        endColumn: 54,
        source: 'verifier',
        notes: [
          'Expected sender.balance = 950.00 but got 1000.00',
          'The sender balance was not debited',
        ],
        help: ['Ensure the implementation debits the sender account'],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0502: Invariant violated', () => {
      const source = `domain Banking {\n  version: "1.0.0"\n  invariant "non-negative balance" {\n    all a in Account: a.balance >= 0\n  }\n}`;
      registerSource('banking.isl', source);

      const d = diag({
        code: 'E0502',
        category: 'verify',
        message: 'Invariant violated: all a in Account: a.balance >= 0',
        file: 'banking.isl',
        line: 4,
        column: 5,
        endColumn: 38,
        source: 'verifier',
        notes: ['After Transfer, account "acc-123" has balance = -50.00'],
        help: ['Add a precondition to Transfer: sender.balance >= amount'],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0506: Security policy violation', () => {
      const source = `domain Auth {\n  version: "1.0.0"\n  behavior Login {\n    security {\n      must "return identical error for wrong email or password"\n    }\n  }\n}`;
      registerSource('auth.isl', source);

      const d = diag({
        code: 'E0506',
        category: 'verify',
        message: 'Security policy violated: identical error messages for auth failures',
        file: 'auth.isl',
        line: 5,
        column: 7,
        endColumn: 62,
        source: 'verifier',
        notes: [
          'Invalid email returns 404 "User not found"',
          'Invalid password returns 401 "Wrong password"',
          'Different error messages let attackers enumerate valid email addresses',
        ],
        help: [
          'Return the same 401 status and message for both cases',
          'Fix: return res.status(401).json({ error: "Invalid credentials" })',
        ],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });
  });

  // ========================================================================
  // CONFIGURATION ERRORS (E0600-E0699) — 2 tests
  // ========================================================================
  describe('Configuration Errors', () => {
    it('E0600: Invalid configuration file', () => {
      const source = `{\n  "version": 1\n  "strict": true\n}`;
      registerSource('isl.config.json', source);

      const d = diag({
        code: 'E0600',
        category: 'config',
        message: 'Invalid configuration file: Unexpected string at position 20',
        file: 'isl.config.json',
        line: 3,
        column: 3,
        endColumn: 11,
        source: 'cli',
        help: ['Missing comma after "version": 1'],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0601: Missing configuration', () => {
      const d = diag({
        code: 'E0601',
        category: 'config',
        message: "Missing required configuration: 'specDir'",
        file: 'isl.config.json',
        line: 1,
        column: 1,
        source: 'cli',
        help: ['Add "specDir": "./specs" to your isl.config.json'],
      });

      // No source registered — tests graceful degradation
      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });
  });

  // ========================================================================
  // I/O ERRORS (E0700-E0799) — 2 tests
  // ========================================================================
  describe('I/O Errors', () => {
    it('E0700: File not found', () => {
      const d = diag({
        code: 'E0700',
        category: 'io',
        message: 'File not found: specs/payment.isl',
        file: 'specs/payment.isl',
        line: 1,
        column: 1,
        source: 'cli',
        help: [
          'Verify the file path is correct',
          'Check the current working directory',
        ],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('E0705: Import not found', () => {
      const source = `import { Auth } from "@isl-lang/stdlib/auht"`;
      registerSource('login.isl', source);

      const d = diag({
        code: 'E0705',
        category: 'io',
        message: "Cannot find module '@isl-lang/stdlib/auht'",
        file: 'login.isl',
        line: 1,
        column: 22,
        endColumn: 45,
        source: 'parser',
        help: ["Did you mean '@isl-lang/stdlib/auth'?"],
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });
  });

  // ========================================================================
  // MULTIPLE DIAGNOSTICS — 1 test
  // ========================================================================
  describe('Multiple Diagnostics', () => {
    it('formats multiple errors with summary', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity User {\n    id uuid\n    emial: Strng\n  }\n}`;
      registerSource('test.isl', source);

      const errors: Diagnostic[] = [
        diag({
          code: 'E0101',
          category: 'parser',
          message: "Expected ':', got 'uuid'",
          file: 'test.isl',
          line: 4,
          column: 8,
          endColumn: 12,
          help: ["Use 'name: Type' syntax"],
        }),
        diag({
          code: 'E0201',
          category: 'type',
          severity: 'error',
          message: "Type 'Strng' is not defined",
          file: 'test.isl',
          line: 5,
          column: 12,
          endColumn: 17,
          source: 'typechecker',
          help: ["Did you mean 'String'?"],
        }),
        diag({
          code: 'E0311',
          category: 'semantic',
          severity: 'warning',
          message: "Variable 'emial' is declared but never used",
          file: 'test.isl',
          line: 5,
          column: 5,
          endColumn: 10,
          source: 'typechecker',
        }),
      ];

      expect(formatDiagnostics(errors, { colors: false })).toMatchSnapshot();
    });
  });

  // ========================================================================
  // EDGE CASES — 2 tests
  // ========================================================================
  describe('Edge Cases', () => {
    it('handles error without source file gracefully', () => {
      const d = diag({
        code: 'E0100',
        category: 'parser',
        message: "Unexpected token 'foo'",
        file: 'unknown.isl',
        line: 42,
        column: 10,
        endColumn: 13,
      });

      // No source registered
      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });

    it('handles warning severity', () => {
      const source = `domain Test {\n  version: "1.0.0"\n  entity OldUser {\n    id: UUID\n  }\n}`;
      registerSource('test.isl', source);

      const d = diag({
        code: 'E0312',
        category: 'semantic',
        severity: 'warning',
        message: "Entity 'OldUser' is declared but never used",
        file: 'test.isl',
        line: 3,
        column: 3,
        endColumn: 10,
        source: 'typechecker',
      });

      expect(formatDiagnostic(d, { colors: false })).toMatchSnapshot();
    });
  });
});
