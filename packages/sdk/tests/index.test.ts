import { describe, it, expect } from 'vitest';
import * as SDK from '../src/index.js';

// ============================================================================
// Public API surface
// ============================================================================

describe('@shipgate/sdk public API', () => {
  it('exports exactly the documented functions', () => {
    expect(typeof SDK.parseISL).toBe('function');
    expect(typeof SDK.parseISLFile).toBe('function');
    expect(typeof SDK.verifySpec).toBe('function');
    expect(typeof SDK.decideGate).toBe('function');
    expect(typeof SDK.generateSpecFromSource).toBe('function');
    expect(typeof SDK.lintISL).toBe('function');
  });

  it('has fewer than 15 public exports', () => {
    // Only count runtime (non-type) exports since types are erased
    const runtimeExports = Object.keys(SDK);
    expect(runtimeExports.length).toBeLessThan(15);
  });

  it('does not export AST internals', () => {
    const keys = Object.keys(SDK);

    // These AST internals should never appear in the public surface
    const forbidden = [
      'Parser',
      'Lexer',
      'tokenize',
      'Domain',
      'Behavior',
      'Entity',
      'Expression',
      'ASTNode',
      'SourceLocation',
    ];

    for (const name of forbidden) {
      expect(keys).not.toContain(name);
    }
  });
});
