# SARIF Output for ISL Clause Failures

Convert ISL Evidence Reports to [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) format for integration with GitHub Code Scanning, VS Code SARIF Viewer, and other static analysis tools.

## Installation

```typescript
import { toSarif, toSarifString } from '@intentos/core/formatters/sarif-isl';
```

## Usage

### Basic Conversion

```typescript
import { toSarif, toSarifString } from '@intentos/core/formatters/sarif-isl';
import type { EvidenceReport } from '@intentos/core/evidence';

// From verification
const report: EvidenceReport = await verify(spec);

// Convert to SARIF object
const sarif = toSarif(report);

// Convert to JSON string
const sarifJson = toSarifString(report);
fs.writeFileSync('results.sarif', sarifJson);
```

### Options

```typescript
const sarif = toSarif(report, {
  // Only include FAIL results (default: false)
  failuresOnly: true,
  
  // Include PARTIAL results (default: true)
  includePartial: true,
  
  // Include rule definitions (default: true)
  includeRules: true,
  
  // Base URI for file paths
  baseUri: 'file:///workspace/',
  
  // Tool version override
  toolVersion: '2.0.0',
  
  // Include artifact information (default: false)
  includeArtifacts: true,
  
  // Pretty print JSON (default: true)
  prettyPrint: true,
});
```

### Single Clause Failure

```typescript
import { createClauseFailureResult } from '@intentos/core/formatters/sarif-isl';

const result = createClauseFailureResult(
  'user-auth-check',
  'User authentication required but not verified',
  'precondition',
  { file: 'src/auth.ts', line: 42, column: 5 }
);
```

### Merging Multiple Reports

```typescript
import { toSarif, mergeSarifLogs } from '@intentos/core/formatters/sarif-isl';

const sarif1 = toSarif(report1);
const sarif2 = toSarif(report2);
const merged = mergeSarifLogs(sarif1, sarif2);
```

## SARIF Mapping

### Rule ID Format

ISL clause failures are mapped to SARIF rules with the format:

```
ISL/<clauseType>/<clauseId>
```

Examples:
- `ISL/precondition/user-authenticated`
- `ISL/postcondition/balance-updated`
- `ISL/invariant/positive-balance`

### Severity Mapping

| ISL State | SARIF Level |
|-----------|-------------|
| FAIL      | error       |
| PARTIAL   | warning     |
| PASS      | note        |

### Location Mapping

Locations are extracted from clause bindings when available:

```typescript
// ISL binding location
{
  file: 'src/service.ts',
  line: 42,
  column: 5,
  endLine: 42,
  endColumn: 50,
  functionName: 'processPayment',
  className: 'PaymentService'
}

// Maps to SARIF location
{
  physicalLocation: {
    artifactLocation: { uri: 'src/service.ts' },
    region: {
      startLine: 42,
      startColumn: 5,
      endLine: 42,
      endColumn: 50
    }
  },
  logicalLocations: [
    {
      name: 'processPayment',
      kind: 'function',
      fullyQualifiedName: 'PaymentService.processPayment'
    }
  ]
}
```

## GitHub Code Scanning Integration

Upload SARIF to GitHub Code Scanning:

```yaml
# .github/workflows/isl-verify.yml
name: ISL Verification

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run ISL verification
        run: npx isl verify --sarif results.sarif
      
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
```

## VS Code SARIF Viewer

1. Install the [SARIF Viewer extension](https://marketplace.visualstudio.com/items?itemName=MS-SarifVSCode.sarif-viewer)
2. Generate SARIF output: `npx isl verify --sarif results.sarif`
3. Open `results.sarif` in VS Code

## Output Example

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "ISL Verifier",
          "version": "1.0.0",
          "informationUri": "https://github.com/intentos/isl",
          "rules": [
            {
              "id": "ISL/precondition/user-authenticated",
              "name": "Precondition:user-authenticated",
              "shortDescription": {
                "text": "Precondition Violation"
              }
            }
          ]
        }
      },
      "results": [
        {
          "ruleId": "ISL/precondition/user-authenticated",
          "level": "error",
          "message": {
            "text": "[FAIL] Precondition Violation | Clause: user-authenticated | User must be authenticated"
          },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": { "uri": "src/auth.ts" },
                "region": { "startLine": 42 }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## API Reference

### Functions

| Function | Description |
|----------|-------------|
| `toSarif(report, options?)` | Convert EvidenceReport to SARIF object |
| `toSarifString(report, options?)` | Convert EvidenceReport to SARIF JSON string |
| `createClauseFailureResult(...)` | Create a single SARIF result |
| `mergeSarifLogs(...logs)` | Merge multiple SARIF logs |

### Types

| Type | Description |
|------|-------------|
| `SarifLog` | Top-level SARIF document |
| `SarifResult` | Single analysis finding |
| `ToSarifOptions` | Conversion options |
| `IslClauseType` | ISL clause type enum |
| `IslBindingLocation` | Location from bindings |

## See Also

- [SARIF Specification](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html)
- [GitHub Code Scanning](https://docs.github.com/en/code-security/code-scanning)
- [ISL Evidence Types](../../evidence/evidenceTypes.ts)
