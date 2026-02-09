# Typechecker Golden Test Fixtures

This directory contains golden test fixtures for the typechecker. Each fixture consists of:

1. **Spec file** (`*.isl`) - The ISL specification to typecheck
2. **Expected diagnostics** (`*.expected.json`) - Expected diagnostic output in JSON format

## Fixture Structure

```
fixtures/
├── 01-basic-types.isl
├── 01-basic-types.expected.json
├── 02-circular-import.isl
├── 02-circular-import.expected.json
└── ...
```

## Expected Diagnostics Format

The `*.expected.json` file contains an array of diagnostic objects:

```json
[
  {
    "code": "ISL_T010",
    "severity": "error",
    "message": "Type 'Foo' is not defined",
    "location": {
      "file": "test.isl",
      "line": 5,
      "column": 10,
      "endLine": 5,
      "endColumn": 13
    },
    "source": "typechecker",
    "notes": ["File: test.isl", "Range: 5:10-5:13"],
    "help": ["Did you mean 'Bar'?"]
  }
]
```

## Running Fixture Tests

```bash
pnpm test:typecheck-fixtures
```

This will:
1. Parse each `.isl` file
2. Run the typechecker
3. Compare actual diagnostics with expected diagnostics
4. Report any mismatches

## Adding New Fixtures

1. Create a new `.isl` file with the spec
2. Run the typechecker to generate diagnostics
3. Save the output as `*.expected.json`
4. Review and adjust the expected diagnostics as needed
