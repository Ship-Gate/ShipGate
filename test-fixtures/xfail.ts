/**
 * Expected Failure (XFAIL) Configuration
 * 
 * Single source of truth for test fixtures that are expected to fail.
 * 
 * SKIP: Test is not run at all (e.g., known invalid fixtures that block parsing)
 * XFAIL: Test is run, but failure is expected (e.g., known bugs, unsupported features)
 * 
 * When an XFAIL test passes, CI fails with "XFAIL FIXED: remove from xfail list"
 * This forces cleanup and keeps the list honest.
 */

export interface XFailEntry {
  /** The fixture name or path (relative to test-fixtures/) */
  fixture: string;
  /** Why this fixture is expected to fail */
  reason: string;
  /** Optional issue number for tracking */
  issue?: string;
  /** When this was added (ISO date) */
  since?: string;
}

export interface XFailConfig {
  /** Tests to skip entirely (not run) */
  skip: XFailEntry[];
  /** Tests expected to fail (run but inverted expectation) */
  xfail: XFailEntry[];
}

/**
 * Parser package xfail configuration
 * 
 * These are fixtures that the parser is expected to fail on.
 */
export const parserXFail: XFailConfig = {
  skip: [
    // Fixtures that use advanced syntax not supported by current parser
    {
      fixture: 'valid/all-features.isl',
      reason: 'Uses advanced view/policy syntax not yet implemented in parser',
      since: '2024-01-15',
    },
    {
      fixture: 'valid/complex-types.isl',
      reason: 'Uses advanced type syntax patterns not yet supported',
      since: '2024-01-15',
    },
    {
      fixture: 'valid/real-world/payment.isl',
      reason: 'Uses advanced syntax patterns',
      since: '2024-01-15',
    },
    {
      fixture: 'valid/real-world/auth.isl',
      reason: 'Uses advanced syntax patterns',
      since: '2024-01-15',
    },
    {
      fixture: 'valid/real-world/crud.isl',
      reason: 'Uses advanced syntax patterns',
      since: '2024-01-15',
    },
    {
      fixture: 'edge-cases/empty-blocks.isl',
      reason: 'Uses advanced syntax for empty blocks',
      since: '2024-01-15',
    },
    {
      fixture: 'edge-cases/deeply-nested.isl',
      reason: 'Uses advanced deeply nested syntax',
      since: '2024-01-15',
    },
    {
      fixture: 'edge-cases/max-size.isl',
      reason: 'Uses advanced syntax patterns',
      since: '2024-01-15',
    },
    {
      fixture: 'edge-cases/special-values.isl',
      reason: 'Uses advanced syntax for special values',
      since: '2024-01-15',
    },
  ],
  xfail: [
    // Parser runs but produces incorrect results or errors unexpectedly
    // Add entries here as needed
  ],
};

/**
 * Typechecker package xfail configuration
 * 
 * These are fixtures that the typechecker is expected to fail on.
 */
export const typecheckerXFail: XFailConfig = {
  skip: [
    // Fixtures that don't parse, so typechecker can't run
    // (These should mirror parser skip list for valid fixtures)
    {
      fixture: 'valid/all-features.isl',
      reason: 'Parser cannot parse this fixture (advanced syntax)',
      since: '2024-01-15',
    },
    {
      fixture: 'valid/complex-types.isl',
      reason: 'Parser cannot parse this fixture (advanced syntax)',
      since: '2024-01-15',
    },
    {
      fixture: 'valid/real-world/payment.isl',
      reason: 'Parser cannot parse this fixture (advanced syntax)',
      since: '2024-01-15',
    },
    {
      fixture: 'valid/real-world/auth.isl',
      reason: 'Parser cannot parse this fixture (advanced syntax)',
      since: '2024-01-15',
    },
    {
      fixture: 'valid/real-world/crud.isl',
      reason: 'Parser cannot parse this fixture (advanced syntax)',
      since: '2024-01-15',
    },
  ],
  xfail: [
    // Typechecker runs but produces incorrect diagnostics or doesn't detect expected errors
    {
      fixture: 'invalid/type-errors/invalid-lifecycle.isl',
      reason: 'Typechecker does not yet detect invalid lifecycle transitions',
      since: '2026-02-01',
    },
    {
      fixture: 'invalid/semantic-errors/circular-reference.isl',
      reason: 'Typechecker does not yet detect circular type references',
      since: '2026-02-01',
    },
    {
      fixture: 'invalid/semantic-errors/invalid-constraint.isl',
      reason: 'Typechecker does not yet validate constraint expressions',
      since: '2026-02-01',
    },
    {
      fixture: 'invalid/semantic-errors/missing-required.isl',
      reason: 'Typechecker does not yet detect missing required fields',
      since: '2026-02-01',
    },
    {
      fixture: 'invalid/semantic-errors/naming-convention.isl',
      reason: 'Typechecker does not enforce naming conventions (semantic lint)',
      since: '2026-02-01',
    },
  ],
};

/**
 * Get the xfail configuration for a package
 */
export function getXFailConfig(pkg: 'parser' | 'typechecker'): XFailConfig {
  switch (pkg) {
    case 'parser':
      return parserXFail;
    case 'typechecker':
      return typecheckerXFail;
    default:
      throw new Error(`Unknown package: ${pkg}`);
  }
}

/**
 * Normalize fixture path for comparison
 * Converts backslashes to forward slashes and removes leading ./
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Check if fixture matches entry
 * Supports exact match and path suffix matching (e.g., 'path/to/file.isl' matches 'file.isl')
 */
function matchesFixture(fixture: string, entryFixture: string): boolean {
  const normalizedFixture = normalizePath(fixture);
  const normalizedEntry = normalizePath(entryFixture);
  
  // Exact match
  if (normalizedFixture === normalizedEntry) {
    return true;
  }
  
  // Fixture ends with entry (e.g., 'test-fixtures/valid/foo.isl' matches 'valid/foo.isl')
  if (normalizedFixture.endsWith('/' + normalizedEntry)) {
    return true;
  }
  
  // Entry ends with fixture (e.g., 'valid/foo.isl' matches 'foo.isl' in entry)
  if (normalizedEntry.endsWith('/' + normalizedFixture)) {
    return true;
  }
  
  return false;
}

/**
 * Check if a fixture should be skipped
 */
export function shouldSkip(config: XFailConfig, fixture: string): XFailEntry | undefined {
  return config.skip.find(entry => matchesFixture(fixture, entry.fixture));
}

/**
 * Check if a fixture is expected to fail
 */
export function isXFail(config: XFailConfig, fixture: string): XFailEntry | undefined {
  return config.xfail.find(entry => matchesFixture(fixture, entry.fixture));
}
