# ISL Corpus Test Suite

A test suite for validating AST/ISL invariants **without calling a model**. This enables deterministic testing of ISL translator infrastructure.

## Overview

The corpus test suite provides:

1. **Mock Extractor** - Generates AST fixtures from corpus entries without LLM calls
2. **Shape Validation** - Validates generated ASTs match expected structure rules
3. **Printer Determinism Tests** - Ensures same AST always produces identical output
4. **Fingerprint Stability Tests** - Ensures same normalized AST always produces same hash
5. **Round-trip Parse Equality** - Validates normalization is idempotent

## Directory Structure

```
corpus-tests/
├── README.md           # This file
├── corpus.json         # 50 prompts with expected shape rules
├── corpus.test.ts      # Test suite
└── corpusRunner.ts     # Mock extractor and utilities
```

## Corpus Format

Each corpus entry in `corpus.json` has the following structure:

```json
{
  "id": "unique-identifier",
  "prompt": "Natural language description",
  "category": "category-name",
  "expectedShape": {
    "minEntities": 1,
    "maxEntities": 5,
    "minBehaviors": 2,
    "maxBehaviors": 10,
    "requiredFields": ["id", "name"],
    "requiredKinds": ["Entity", "Behavior"],
    "domainNamePattern": "^[A-Z][a-zA-Z]+$",
    "versionPattern": "^\\d+\\.\\d+\\.\\d+$",
    "requirePreconditions": true,
    "requirePostconditions": true,
    "requireTemporal": false,
    "requireSecurity": false
  },
  "tags": ["tag1", "tag2"]
}
```

### Shape Rules

| Rule | Type | Description |
|------|------|-------------|
| `requiredKinds` | `string[]` | AST node kinds that must be present |
| `minEntities` | `number` | Minimum number of entity definitions |
| `maxEntities` | `number` | Maximum number of entity definitions |
| `minBehaviors` | `number` | Minimum number of behavior definitions |
| `maxBehaviors` | `number` | Maximum number of behavior definitions |
| `requiredFields` | `string[]` | Field names that must exist in entities |
| `domainNamePattern` | `string` | Regex pattern for domain name |
| `versionPattern` | `string` | Regex pattern for version string |
| `requirePreconditions` | `boolean` | At least one behavior must have preconditions |
| `requirePostconditions` | `boolean` | At least one behavior must have postconditions |
| `requireTemporal` | `boolean` | At least one behavior must have temporal specs |
| `requireSecurity` | `boolean` | At least one behavior must have security specs |

## Usage

### Running Tests

```bash
# From packages/core directory
pnpm test

# Run with watch mode
pnpm test:watch

# Run specific test file
pnpm vitest run src/isl-translator/corpus-tests/corpus.test.ts
```

### Using the Mock Extractor

```typescript
import { MockExtractor, type CorpusEntry } from './corpusRunner.js';

const extractor = new MockExtractor();

const entry: CorpusEntry = {
  id: 'test-001',
  prompt: 'Create a user management system',
  category: 'auth',
  expectedShape: {
    minEntities: 2,
    minBehaviors: 3,
    requirePreconditions: true,
  },
  tags: ['auth', 'users'],
};

const ast = extractor.extract(entry);
// ast is a valid Domain AST node
```

### Using the Corpus Runner

```typescript
import { CorpusRunner } from './corpusRunner.js';
import corpus from './corpus.json';

const runner = new CorpusRunner();

// Run single entry
const result = runner.run(corpus.entries[0]);
console.log(result.printerDeterministic); // true
console.log(result.fingerprintStable);    // true
console.log(result.validation.valid);     // true

// Run all entries
const results = runner.runAll(corpus.entries);
const summary = runner.getSummary(results);
console.log(`Pass rate: ${summary.passRate}%`);
```

### AST Utilities

```typescript
import {
  normalizeAST,
  printAST,
  printASTCompact,
  fingerprintAST,
  shortFingerprint,
  validateShape,
} from './corpusRunner.js';

// Normalize (remove locations)
const normalized = normalizeAST(ast);

// Print deterministically
const output = printAST(ast);

// Generate fingerprint
const hash = fingerprintAST(ast);
const shortHash = shortFingerprint(ast); // first 16 chars

// Validate shape
const validation = validateShape(ast, shapeRules);
if (!validation.valid) {
  console.error(validation.errors);
}
```

## Test Categories

The corpus covers 10 main categories with 5 entries each:

| Category | Description | Entry IDs |
|----------|-------------|-----------|
| `authentication` | Auth flows, sessions, OAuth | auth-001 to auth-005 |
| `crud` | Basic CRUD operations | crud-001 to crud-005 |
| `payments` | Payment processing, billing | payment-001 to payment-005 |
| `orders` | Order management, carts | order-001 to order-005 |
| `notifications` | Email, SMS, push, webhooks | notification-001 to notification-005 |
| `inventory` | Stock management, warehouse | inventory-001 to inventory-005 |
| `analytics` | Tracking, metrics, reporting | analytics-001 to analytics-005 |
| `workflow` | Approval flows, state machines | workflow-001 to workflow-005 |
| `content` | CMS, media, versioning | content-001 to content-005 |
| `search` | Full-text, faceted, autocomplete | search-001 to search-005 |

## Invariants Tested

### 1. Printer Determinism

The `printAST` function must produce **identical output** for the same AST across multiple calls:

```typescript
const output1 = printAST(ast);
const output2 = printAST(ast);
assert(output1 === output2); // Always true
```

### 2. Round-trip Equality

Normalization must be idempotent:

```typescript
const n1 = normalizeAST(ast);
const n2 = normalizeAST(n1);
assert(JSON.stringify(n1) === JSON.stringify(n2)); // Always true
```

### 3. Fingerprint Stability

Same normalized AST must produce same fingerprint:

```typescript
const fp1 = fingerprintAST(ast);
const fp2 = fingerprintAST(ast);
assert(fp1 === fp2); // Always true

// Structurally equivalent ASTs have same fingerprint
const astA = createDomain('Test', '1.0.0');
const astB = createDomain('Test', '1.0.0');
assert(fingerprintAST(astA) === fingerprintAST(astB)); // Always true
```

## Adding New Corpus Entries

1. Add entry to `corpus.json`:

```json
{
  "id": "category-XXX",
  "prompt": "Description of what to generate",
  "category": "category-name",
  "expectedShape": {
    "minEntities": 1,
    "minBehaviors": 1
  },
  "tags": ["relevant", "tags"]
}
```

2. Run tests to verify the new entry passes:

```bash
pnpm test
```

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌────────────────┐
│  Corpus Entry   │────▶│ MockExtractor│────▶│   Domain AST   │
│   (corpus.json) │     │              │     │                │
└─────────────────┘     └──────────────┘     └───────┬────────┘
                                                     │
                        ┌────────────────────────────┼────────────────────────────┐
                        │                            │                            │
                        ▼                            ▼                            ▼
               ┌────────────────┐          ┌────────────────┐          ┌─────────────────┐
               │  normalizeAST  │          │    printAST    │          │  fingerprintAST │
               │                │          │                │          │                 │
               └───────┬────────┘          └───────┬────────┘          └────────┬────────┘
                       │                           │                            │
                       ▼                           ▼                            ▼
               ┌────────────────┐          ┌────────────────┐          ┌─────────────────┐
               │  Idempotent    │          │  Deterministic │          │     Stable      │
               │  Normalization │          │    Output      │          │   Fingerprint   │
               └────────────────┘          └────────────────┘          └─────────────────┘
```

## Troubleshooting

### Test Failures

1. **Printer determinism failure**: Check for non-deterministic key ordering or floating-point issues
2. **Fingerprint instability**: Ensure normalization removes all location data
3. **Shape validation errors**: Check that MockExtractor generates required elements

### Common Issues

- **Missing required kinds**: Add the kind to the mock extractor's generation logic
- **Insufficient entities/behaviors**: Adjust minEntities/minBehaviors in shape rules
- **Pattern mismatches**: Update domainNamePattern or versionPattern regex

## Contributing

When adding new functionality:

1. Add tests first (TDD)
2. Ensure all invariants are maintained
3. Update this README if adding new features
4. Verify 100% pass rate before committing
