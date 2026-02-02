# Expected Failure (XFAIL) Test System

This document describes the XFAIL (expected failure) harness for parser and typechecker fixture-based tests.

## Overview

The XFAIL system provides a deterministic way to handle test fixtures that are known to fail. This keeps CI honest by:

1. **Tracking known failures** - Instead of skipping tests silently, we explicitly document why they fail
2. **Forcing cleanup** - When a previously-failing test starts passing, CI fails until you remove it from the xfail list
3. **Clear visibility** - Test summaries show exactly what's skipped, what's expected to fail, and what needs attention

## Key Concepts

### SKIP
Tests that are **not run at all**. Use for:
- Fixtures that block the parser completely (syntax too advanced)
- Tests that would crash or hang
- Known invalid fixtures that can't be processed

### XFAIL
Tests that **run but are expected to fail**. Use for:
- Known bugs that haven't been fixed yet
- Features that are partially implemented
- Regressions that are being investigated

When an XFAIL test **fails**: ✅ This is expected, test passes
When an XFAIL test **passes**: ❌ CI fails with "XFAIL FIXED" - remove from list!

## Configuration

All expected failures are configured in `test-fixtures/xfail.ts`:

```typescript
// test-fixtures/xfail.ts
export const parserXFail: XFailConfig = {
  skip: [
    {
      fixture: 'valid/all-features.isl',
      reason: 'Uses advanced view/policy syntax not yet implemented',
      since: '2024-01-15',
      issue: '#123',  // optional
    },
  ],
  xfail: [
    {
      fixture: 'edge-cases/unicode.isl',
      reason: 'Unicode handling incomplete',
      since: '2024-01-20',
    },
  ],
};
```

## Usage in Tests

### Basic Usage

```typescript
import { createXFailHarness } from '../../../test-fixtures/xfail-harness.js';

describe('Parser Fixtures', () => {
  const harness = createXFailHarness('parser');
  
  // Run a fixture test with xfail handling
  harness.runFixtureTest('valid/minimal.isl', () => {
    const result = parse(loadFixture('valid/minimal.isl'));
    expect(result.success).toBe(true);
  });
  
  // At end of suite - prints summary and enforces CI rules
  describe('XFAIL Summary', () => {
    it('should print summary', () => harness.printSummary());
    it('should have no xfail-fixed tests', () => harness.assertNoXFailFixed());
  });
});
```

### Checking Fixture Status

```typescript
const harness = createXFailHarness('parser');

// Check if a fixture should be skipped
const skipEntry = harness.shouldSkip('valid/all-features.isl');
if (skipEntry) {
  console.log(`Skipping: ${skipEntry.reason}`);
}

// Check if a fixture is expected to fail
const xfailEntry = harness.isXFail('edge-cases/unicode.isl');
if (xfailEntry) {
  console.log(`Expected to fail: ${xfailEntry.reason}`);
}
```

## CI Behavior

The xfail harness enforces the following in CI:

| Scenario | CI Result | Action Required |
|----------|-----------|-----------------|
| Normal test passes | ✅ Pass | None |
| Normal test fails | ❌ Fail | Fix the test |
| SKIP test | ⏭️ Skipped | None (documented) |
| XFAIL test fails | ✅ Pass | None (expected) |
| XFAIL test passes | ❌ Fail | Remove from xfail list |

## Test Summary

At the end of each test suite, a summary is printed:

```
============================================================
XFAIL Summary for parser
============================================================
Total:          25
Passed:         18
Failed:         0
Skipped:        5
XFAIL Passed:   2 (expected failures that failed)
XFAIL Fixed:    0 (expected failures that passed - NEED CLEANUP)
============================================================
```

## Adding New Expected Failures

1. **Identify the failing test** - Note the fixture path and why it fails
2. **Choose SKIP or XFAIL**:
   - SKIP if the test can't run at all (crashes, hangs, blocks parser)
   - XFAIL if the test runs but produces wrong results
3. **Add to `test-fixtures/xfail.ts`**:

```typescript
export const parserXFail: XFailConfig = {
  skip: [
    // Add here if test can't run
    {
      fixture: 'path/to/fixture.isl',
      reason: 'Why this fixture is skipped',
      since: '2024-01-25',
      issue: '#456',  // optional: link to issue
    },
  ],
  xfail: [
    // Add here if test runs but fails
    {
      fixture: 'path/to/fixture.isl',
      reason: 'Why this fixture is expected to fail',
      since: '2024-01-25',
    },
  ],
};
```

4. **Run tests** - Verify the xfail is recognized

## Removing Fixed Failures

When an xfail test starts passing (because you fixed the bug!):

1. CI will fail with: `XFAIL FIXED: "fixture.isl" passed but was expected to fail`
2. Remove the entry from `test-fixtures/xfail.ts`
3. Re-run tests to verify
4. Commit the removal

## File Structure

```
test-fixtures/
├── xfail.ts           # Configuration: which fixtures to skip/xfail
├── xfail-harness.ts   # Harness implementation
├── xfail-harness.test.ts  # Harness unit tests
├── index.ts           # Re-exports xfail utilities
├── valid/             # Valid fixture files
├── invalid/           # Invalid fixture files
└── edge-cases/        # Edge case fixture files

packages/parser/tests/
└── xfail-fixtures.test.ts  # Parser tests using xfail harness

packages/typechecker/tests/
└── xfail-fixtures.test.ts  # Typechecker tests using xfail harness
```

## Best Practices

1. **Always document the reason** - Future you will thank you
2. **Add the `since` date** - Helps track how long failures have existed
3. **Link issues when possible** - Makes it easy to find related work
4. **Prefer XFAIL over SKIP** - Running the test (even expecting failure) catches regressions
5. **Clean up promptly** - When CI reports XFAIL FIXED, remove it immediately
6. **Review periodically** - Old xfail entries might indicate forgotten bugs

## Running Tests

```bash
# Run parser xfail fixture tests
pnpm --filter @isl-lang/parser test xfail-fixtures

# Run typechecker xfail fixture tests
pnpm --filter @isl-lang/typechecker test xfail-fixtures

# Run xfail harness unit tests
pnpm test test-fixtures/xfail-harness.test.ts
```
