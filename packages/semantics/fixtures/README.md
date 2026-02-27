# Semantics Test Fixtures

This directory contains test fixtures that verify semantic consistency across ISL versions.

## Structure

```
fixtures/
├── v1/                      # V1 semantic fixtures
│   ├── binary-operators/    # Binary operator test cases
│   ├── unary-operators/     # Unary operator test cases
│   ├── quantifiers/         # Quantifier test cases
│   └── temporal/            # Temporal operator test cases
├── compatibility/           # Cross-version compatibility tests
│   └── v1-patch/            # Must behave same across 1.0.x
└── future/                  # Placeholders for v2 differences
    └── v2-draft/            # Draft v2 semantics changes
```

## Fixture Format

Each fixture is a JSON file with the following structure:

```json
{
  "name": "descriptive-test-name",
  "description": "What this test verifies",
  "version": "1.0.0",
  "cases": [
    {
      "expression": "1 + 2",
      "expected": 3,
      "description": "Optional case description"
    }
  ]
}
```

## Compatibility Requirements

### V1 Patch Compatibility (1.0.x)

All fixtures in `compatibility/v1-patch/` MUST produce identical results
across all patch versions. These are the "frozen" semantics that cannot
change without a major version bump.

### V2 Planned Changes

The `future/v2-draft/` directory contains planned semantic changes for v2.
These document intentional breaking changes for the next major version.

## Running Fixture Tests

```bash
pnpm test
```

All fixture files are automatically loaded and validated by the test suite.
