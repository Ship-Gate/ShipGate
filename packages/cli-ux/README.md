# @isl-lang/cli-ux

CLI UX components for ISL verification output - pretty rendering and JSON mode.

## Features

- **Pretty Renderer**: Beautiful terminal output with summary banner, failures, fixes, and repro commands
- **JSON Mode**: Stable, schema-validated JSON output for CI/CD integration
- **Type-Safe**: Full TypeScript support with Zod schema validation

## Installation

```bash
pnpm add @isl-lang/cli-ux
```

## Usage

### Pretty Output

```typescript
import { render, print } from '@isl-lang/cli-ux';

// Render to string
const output = render(verificationResult, {
  colors: true,
  maxFailures: 5,
  showFixes: true,
  showRepro: true,
  showBreakdown: true,
});
console.log(output);

// Or print directly
print(verificationResult);
```

### JSON Output

```typescript
import { formatJson, parseJson, validateJsonOutput } from '@isl-lang/cli-ux';

// Format as JSON
const result = formatJson(verificationResult, {
  pretty: true,
  validate: true,
});

if (result.valid) {
  console.log(result.output);
} else {
  console.error('Validation errors:', result.errors);
}

// Parse JSON input
const parsed = parseJson(jsonString);
if (parsed.success) {
  console.log('Decision:', parsed.data.decision);
}
```

### Schema Validation

```typescript
import { validateVerificationResult, JsonOutputSchema } from '@isl-lang/cli-ux';

// Validate verification result
const validation = validateVerificationResult(data);
if (!validation.success) {
  console.error('Invalid result:', validation.errors);
}

// Use Zod schema directly
const result = JsonOutputSchema.safeParse(data);
```

## Output Example

### Pretty Output

```
╭──────────────────────────────────────────────────────────╮
│            ISL Verification Result                       │
├──────────────────────────────────────────────────────────┤
│ Score: 100/100                               SHIP        │
│ Confidence: 95%                                          │
│ Recommendation: Production Ready                         │
╰──────────────────────────────────────────────────────────╯

📊 Category Breakdown
────────────────────────────────────
Postconditions  ████████████████████ 100%  2/2
Invariants      ████████████████████ 100%  1/1
Scenarios       ████████████████████ 100%  1/1
Temporal        ████████████████████ 100%  1/1
```

### JSON Output

```json
{
  "schemaVersion": "1.0",
  "decision": "SHIP",
  "result": {
    "success": true,
    "score": 100,
    "confidence": 95,
    "recommendation": "production_ready",
    "specFile": "specs/payment.isl",
    "implFile": "src/payment.ts",
    "clauses": [...],
    "breakdown": {...},
    "duration": 93,
    "timestamp": "2026-02-01T12:00:00.000Z"
  },
  "meta": {
    "cliVersion": "0.1.0",
    "nodeVersion": "v20.0.0",
    "platform": "linux",
    "timestamp": "2026-02-01T12:00:00.000Z"
  }
}
```

## API Reference

### Pretty Renderer

| Function | Description |
|----------|-------------|
| `render(result, options?)` | Render complete verification output |
| `print(result, options?)` | Print to stdout |
| `renderBanner(result, options?)` | Render summary banner |
| `renderFailures(result, options?)` | Render failure details |
| `renderHowToFix(result, options?)` | Render fix suggestions |
| `renderReproCommands(result, options?)` | Render repro commands |
| `renderBreakdown(result, options?)` | Render category breakdown |

### JSON Mode

| Function | Description |
|----------|-------------|
| `formatJson(result, options?)` | Format result as JSON string |
| `printJson(result, options?)` | Print JSON to stdout |
| `parseJson(input)` | Parse JSON string |
| `createJsonOutput(result, options?)` | Create JSON output object |
| `getDecision(result)` | Get SHIP/NO_SHIP decision |
| `getKeyMetrics(result)` | Extract key metrics |

### Schema Validation

| Function | Description |
|----------|-------------|
| `validateJsonOutput(data)` | Validate JSON output structure |
| `validateVerificationResult(data)` | Validate verification result |
| `formatValidationErrors(errors)` | Format Zod errors as strings |

### Types

- `VerificationResult` - Full verification result
- `ClauseResult` - Individual clause/test result
- `CategoryScore` - Category score breakdown
- `JsonOutput` - Complete JSON output structure
- `RenderOptions` - Pretty renderer options
- `JsonOutputOptions` - JSON formatter options

## Render Options

```typescript
interface RenderOptions {
  colors?: boolean;        // Enable/disable colors (default: true)
  maxFailures?: number;    // Max failures to show (default: 5)
  showFixes?: boolean;     // Show fix suggestions (default: true)
  showRepro?: boolean;     // Show repro commands (default: true)
  showBreakdown?: boolean; // Show category breakdown (default: true)
  terminalWidth?: number;  // Terminal width (default: 80)
}
```

## JSON Schema

The JSON output follows a stable schema (version 1.0):

- `schemaVersion`: Always "1.0"
- `decision`: "SHIP" or "NO_SHIP"
- `result`: Full verification result
- `meta`: Runtime metadata (CLI version, Node version, platform, timestamp)

### SHIP Decision Criteria

- `success` must be `true`
- `score` must be >= 95
- No clauses with `impact: 'critical'` and `status: 'failed'`

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with watch
pnpm test:watch

# Update snapshots
pnpm test:update

# Build
pnpm build

# Type check
pnpm typecheck
```

## License

MIT
