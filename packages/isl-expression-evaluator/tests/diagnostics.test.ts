// ============================================================================
// ISL Expression Evaluator - Diagnostic Snapshot Tests
// ============================================================================
//
// Golden snapshot tests for 10 common evaluator errors.
// These tests ensure consistent, user-friendly error formatting.
//
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type { SourceLocation, Expression, Identifier, MemberExpr, BinaryExpr, CallExpr, UnaryExpr, QuantifierExpr } from '@isl-lang/parser';
import {
  diagnostic,
  unknownIdentifier,
  typeMismatch,
  nullAccess,
  oldWithoutSnapshot,
  maxDepthExceeded,
  unknownMethod,
  unknownProperty,
  notIterable,
  indexOutOfBounds,
  divisionByZero,
  unsupportedOperator,
  EvaluatorDiagnosticCode,
  type EvaluatorDiagnostic,
} from '../src/diagnostics.js';
import {
  formatDiagnostic,
  formatDiagnostics,
  registerSource,
  clearSourceCache,
  prettyPrintExpression,
  diagnosticToLine,
  diagnosticToJson,
} from '../src/pretty-printer.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Create a mock source location
 */
function loc(
  file: string,
  line: number,
  column: number,
  endColumn?: number,
  endLine?: number
): SourceLocation {
  return {
    file,
    line,
    column,
    endLine: endLine ?? line,
    endColumn: endColumn ?? column + 1,
  };
}

/**
 * Create a mock identifier expression
 */
function identifier(name: string, location: SourceLocation): Identifier {
  return {
    kind: 'Identifier',
    name,
    location,
  };
}

/**
 * Create a mock member expression
 */
function member(obj: Expression, prop: string, location: SourceLocation): MemberExpr {
  return {
    kind: 'MemberExpr',
    object: obj,
    property: identifier(prop, location),
    location,
  };
}

/**
 * Sample ISL source code for testing
 */
const SAMPLE_SOURCE = `domain Banking {
  version: "1.0"
  
  entity Account {
    id: UUID
    balance: Decimal
    owner: User
  }
  
  behavior Transfer {
    input {
      fromAccount: Account
      toAccount: Account
      amount: Decimal
    }
    
    preconditions {
      fromAccount.balance >= amount
    }
    
    postconditions {
      fromAccount.balance == old(fromAccount.balance) - ammount
      toAccount.balance == old(toAccount.balance) + amount
    }
  }
}`;

// ============================================================================
// SNAPSHOT TESTS FOR 10 COMMON ERRORS
// ============================================================================

describe('Evaluator Diagnostic Snapshots', () => {
  beforeEach(() => {
    clearSourceCache();
    registerSource('specs/banking.isl', SAMPLE_SOURCE);
  });

  // -------------------------------------------------------------------------
  // 1. Unknown Identifier (typo in variable name)
  // -------------------------------------------------------------------------
  it('1. EVAL_UNKNOWN_IDENTIFIER - typo in variable name', () => {
    const diag = unknownIdentifier(
      'ammount',
      loc('specs/banking.isl', 21, 55, 62),
      ['amount', 'account']
    );

    const formatted = formatDiagnostic(diag, { colors: false });
    expect(formatted).toMatchSnapshot('unknown-identifier-typo');
  });

  // -------------------------------------------------------------------------
  // 2. Type Mismatch (comparing string to number)
  // -------------------------------------------------------------------------
  it('2. EVAL_TYPE_MISMATCH - comparing incompatible types', () => {
    const diag = typeMismatch(
      'Number',
      'String',
      loc('specs/banking.isl', 18, 7, 35),
      'Ensure both sides of the comparison have the same type'
    );

    const formatted = formatDiagnostic(diag, { colors: false });
    expect(formatted).toMatchSnapshot('type-mismatch-comparison');
  });

  // -------------------------------------------------------------------------
  // 3. Null Access (accessing property on null)
  // -------------------------------------------------------------------------
  it('3. EVAL_NULL_ACCESS - property access on null value', () => {
    const diag = nullAccess(
      'balance',
      loc('specs/banking.isl', 18, 7, 28)
    );

    const formatted = formatDiagnostic(diag, { colors: false });
    expect(formatted).toMatchSnapshot('null-access-property');
  });

  // -------------------------------------------------------------------------
  // 4. old() Without Snapshot (used outside postcondition)
  // -------------------------------------------------------------------------
  it('4. EVAL_OLD_WITHOUT_SNAPSHOT - old() used outside postcondition', () => {
    const diag = oldWithoutSnapshot(
      loc('specs/banking.isl', 18, 27, 54)
    );

    const formatted = formatDiagnostic(diag, { colors: false });
    expect(formatted).toMatchSnapshot('old-without-snapshot');
  });

  // -------------------------------------------------------------------------
  // 5. Max Depth Exceeded (possible infinite recursion)
  // -------------------------------------------------------------------------
  it('5. EVAL_MAX_DEPTH_EXCEEDED - infinite recursion detected', () => {
    const diag = maxDepthExceeded(
      1000,
      loc('specs/banking.isl', 21, 7, 62)
    );

    const formatted = formatDiagnostic(diag, { colors: false });
    expect(formatted).toMatchSnapshot('max-depth-exceeded');
  });

  // -------------------------------------------------------------------------
  // 6. Unknown Method (calling non-existent method)
  // -------------------------------------------------------------------------
  it('6. EVAL_UNKNOWN_METHOD - calling undefined method', () => {
    const diag = unknownMethod(
      'tranfer',
      'Account',
      loc('specs/banking.isl', 18, 7, 25),
      ['transfer', 'deposit', 'withdraw']
    );

    const formatted = formatDiagnostic(diag, { colors: false });
    expect(formatted).toMatchSnapshot('unknown-method');
  });

  // -------------------------------------------------------------------------
  // 7. Unknown Property (accessing non-existent field)
  // -------------------------------------------------------------------------
  it('7. EVAL_UNKNOWN_PROPERTY - accessing undefined property', () => {
    const diag = unknownProperty(
      'balace',
      'Account',
      loc('specs/banking.isl', 18, 19, 25),
      ['balance', 'owner', 'id']
    );

    const formatted = formatDiagnostic(diag, { colors: false });
    expect(formatted).toMatchSnapshot('unknown-property');
  });

  // -------------------------------------------------------------------------
  // 8. Not Iterable (quantifier on non-array)
  // -------------------------------------------------------------------------
  it('8. EVAL_NOT_ITERABLE - quantifier on non-iterable type', () => {
    const diag = notIterable(
      'String',
      loc('specs/banking.isl', 18, 7, 30)
    );

    const formatted = formatDiagnostic(diag, { colors: false });
    expect(formatted).toMatchSnapshot('not-iterable');
  });

  // -------------------------------------------------------------------------
  // 9. Index Out of Bounds (array access beyond length)
  // -------------------------------------------------------------------------
  it('9. EVAL_INDEX_OUT_OF_BOUNDS - array index exceeds bounds', () => {
    const diag = indexOutOfBounds(
      5,
      3,
      loc('specs/banking.isl', 18, 7, 20)
    );

    const formatted = formatDiagnostic(diag, { colors: false });
    expect(formatted).toMatchSnapshot('index-out-of-bounds');
  });

  // -------------------------------------------------------------------------
  // 10. Division By Zero
  // -------------------------------------------------------------------------
  it('10. EVAL_DIVISION_BY_ZERO - division by zero', () => {
    const diag = divisionByZero(
      loc('specs/banking.isl', 18, 7, 25)
    );

    const formatted = formatDiagnostic(diag, { colors: false });
    expect(formatted).toMatchSnapshot('division-by-zero');
  });
});

// ============================================================================
// ADDITIONAL DIAGNOSTIC TESTS
// ============================================================================

describe('Diagnostic Code Registry', () => {
  it('all diagnostic codes have unique IDs', () => {
    const ids = Object.values(EvaluatorDiagnosticCode).map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all diagnostic codes have unique catalog codes', () => {
    const codes = Object.values(EvaluatorDiagnosticCode).map(c => c.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it('all catalog codes are in E04xx range', () => {
    for (const codeDef of Object.values(EvaluatorDiagnosticCode)) {
      expect(codeDef.code).toMatch(/^E04\d{2}$/);
    }
  });
});

describe('Diagnostic Builder', () => {
  it('builds a complete diagnostic', () => {
    const location = loc('test.isl', 10, 5, 15);
    const diag = diagnostic('EVAL_UNKNOWN_IDENTIFIER', location)
      .values({ name: 'foo' })
      .suggest('Did you mean: bar?')
      .severity('error')
      .context({ availableSuggestions: ['bar', 'baz'] })
      .build();

    expect(diag.code).toBe('EVAL_UNKNOWN_IDENTIFIER');
    expect(diag.catalogCode).toBe('E0420');
    expect(diag.message).toContain('foo');
    expect(diag.suggestion).toBe('Did you mean: bar?');
    expect(diag.severity).toBe('error');
    expect(diag.span.line).toBe(10);
    expect(diag.span.col).toBe(5);
  });

  it('supports child diagnostics', () => {
    const parentLoc = loc('test.isl', 10, 5, 15);
    const childLoc = loc('test.isl', 10, 8, 12);
    
    const childDiag = diagnostic('EVAL_TYPE_MISMATCH', childLoc)
      .values({ expected: 'Number', actual: 'String' })
      .build();

    const parentDiag = diagnostic('EVAL_UNSUPPORTED_OP', parentLoc)
      .values({ operator: '+' })
      .children([childDiag])
      .build();

    expect(parentDiag.children).toHaveLength(1);
    expect(parentDiag.children![0].code).toBe('EVAL_TYPE_MISMATCH');
  });
});

describe('Pretty Printer', () => {
  beforeEach(() => {
    clearSourceCache();
  });

  it('formats diagnostic without source', () => {
    const diag = unknownIdentifier('foo', loc('unknown.isl', 1, 1, 4));
    const formatted = formatDiagnostic(diag, { colors: false });
    
    expect(formatted).toContain('error[EVAL_UNKNOWN_IDENTIFIER]');
    expect(formatted).toContain('unknown.isl:1:1');
  });

  it('formats multiple diagnostics with summary', () => {
    const diags: EvaluatorDiagnostic[] = [
      unknownIdentifier('foo', loc('test.isl', 1, 1, 4)),
      typeMismatch('Number', 'String', loc('test.isl', 2, 1, 10)),
    ];

    const formatted = formatDiagnostics(diags, { colors: false });
    
    expect(formatted).toContain('EVAL_UNKNOWN_IDENTIFIER');
    expect(formatted).toContain('EVAL_TYPE_MISMATCH');
    expect(formatted).toContain('2 evaluation errors');
  });

  it('converts diagnostic to single line', () => {
    const diag = unknownIdentifier('foo', loc('test.isl', 5, 10, 13));
    const line = diagnosticToLine(diag);
    
    expect(line).toBe("error[EVAL_UNKNOWN_IDENTIFIER]: Identifier 'foo' is not defined in the current scope at test.isl:5:10");
  });

  it('converts diagnostic to JSON', () => {
    const diag = unknownIdentifier('foo', loc('test.isl', 5, 10, 13));
    const json = diagnosticToJson(diag);
    
    expect(json).toMatchObject({
      code: 'EVAL_UNKNOWN_IDENTIFIER',
      catalogCode: 'E0420',
      severity: 'error',
      span: {
        file: 'test.isl',
        line: 5,
        col: 10,
      },
    });
  });
});

describe('Expression Pretty Printer', () => {
  it('prints identifier', () => {
    const expr = identifier('foo', loc('test.isl', 1, 1, 4));
    expect(prettyPrintExpression(expr)).toBe('foo');
  });

  it('prints member expression', () => {
    const obj = identifier('account', loc('test.isl', 1, 1, 8));
    const expr = member(obj, 'balance', loc('test.isl', 1, 1, 16));
    expect(prettyPrintExpression(expr)).toBe('account.balance');
  });

  it('prints binary expression', () => {
    const left = identifier('a', loc('test.isl', 1, 1, 2));
    const right = identifier('b', loc('test.isl', 1, 5, 6));
    const expr: BinaryExpr = {
      kind: 'BinaryExpr',
      operator: '==',
      left,
      right,
      location: loc('test.isl', 1, 1, 6),
    };
    expect(prettyPrintExpression(expr)).toBe('a == b');
  });

  it('prints call expression', () => {
    const callee = identifier('exists', loc('test.isl', 1, 1, 7));
    const arg = identifier('id', loc('test.isl', 1, 8, 10));
    const expr: CallExpr = {
      kind: 'CallExpr',
      callee,
      arguments: [arg],
      location: loc('test.isl', 1, 1, 11),
    };
    expect(prettyPrintExpression(expr)).toBe('exists(id)');
  });

  it('prints quantifier expression', () => {
    const collection = identifier('accounts', loc('test.isl', 1, 8, 16));
    const variable = identifier('a', loc('test.isl', 1, 5, 6));
    const predicate: BinaryExpr = {
      kind: 'BinaryExpr',
      operator: '>',
      left: member(identifier('a', loc('test.isl', 1, 18, 19)), 'balance', loc('test.isl', 1, 18, 28)),
      right: { kind: 'NumberLiteral', value: 0, location: loc('test.isl', 1, 31, 32) },
      location: loc('test.isl', 1, 18, 32),
    };
    const expr: QuantifierExpr = {
      kind: 'QuantifierExpr',
      quantifier: 'all',
      variable,
      collection,
      predicate,
      location: loc('test.isl', 1, 1, 32),
    };
    expect(prettyPrintExpression(expr)).toBe('all a in accounts: a.balance > 0');
  });
});

// ============================================================================
// UNSUPPORTED OPERATOR TEST
// ============================================================================

describe('Unsupported Operator Diagnostic', () => {
  it('creates unsupported operator diagnostic', () => {
    const diag = unsupportedOperator(
      '**',
      loc('test.isl', 5, 10, 12),
      'Use Math.pow() instead of ** operator'
    );

    expect(diag.code).toBe('EVAL_UNSUPPORTED_OP');
    expect(diag.message).toContain("'**'");
    expect(diag.suggestion).toContain('Math.pow');
  });

  beforeEach(() => {
    clearSourceCache();
    registerSource('test.isl', 'let result = base ** exponent');
  });

  it('formats unsupported operator with source', () => {
    const diag = unsupportedOperator('**', loc('test.isl', 1, 19, 21));
    const formatted = formatDiagnostic(diag, { colors: false });
    
    expect(formatted).toMatchSnapshot('unsupported-operator');
  });
});
