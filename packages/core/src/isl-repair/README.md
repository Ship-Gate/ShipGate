# ISL Repair Engine

A deterministic AST repair system for fixing common structural and schema issues in ISL (Intent Specification Language) ASTs.

## Features

- **Missing Field Repairs**: Adds required fields with sensible defaults
- **Schema Fix Repairs**: Corrects type names, operators, and quantifiers
- **Duplicate Removal**: Removes duplicate fields and type declarations
- **Order Normalization**: Sorts entities, behaviors, and types alphabetically
- **Confidence Levels**: Each repair has high/medium/low confidence
- **Detailed Reports**: Full repair report with diffs and statistics

## Installation

The repair engine is part of `@isl-lang/core`:

```typescript
import { repairAst, formatRepairReport } from '@isl-lang/core/isl-repair';
```

## Usage

### Basic Usage

```typescript
import { repairAst } from '@isl-lang/core/isl-repair';

// Repair a broken AST
const result = repairAst(brokenAst);

console.log(`Applied ${result.repairs.length} repairs`);
console.log(`${result.remainingErrors.length} errors could not be fixed`);

// Use the repaired AST
const fixedAst = result.ast;
```

### With Validation Errors

```typescript
import { repairAst } from '@isl-lang/core/isl-repair';
import { validate } from '@isl-lang/typechecker';

// Parse and validate
const ast = parse(source);
const errors = validate(ast);

// Repair based on validation errors
const result = repairAst(ast, errors);

// Check remaining issues
if (result.remainingErrors.length > 0) {
  console.log('Some errors could not be automatically fixed:');
  for (const error of result.remainingErrors) {
    console.log(`  - ${error.path}: ${error.message}`);
  }
}
```

### Chaining with Validator

```typescript
import { repairAst } from '@isl-lang/core/isl-repair';
import { runValidateStep } from '@isl-lang/core/pipeline';

async function repairAndValidate(ast: Domain) {
  // First repair attempt
  const repairResult = repairAst(ast);

  // Validate repaired AST
  const validationResult = await runValidateStep({
    ast: repairResult.ast,
    // ... other state
  });

  return {
    ast: repairResult.ast,
    repairs: repairResult.repairs,
    valid: validationResult.data?.valid ?? false,
    issues: validationResult.data?.issues ?? [],
  };
}
```

### Repair Options

```typescript
import { repairAst } from '@isl-lang/core/isl-repair';

const result = repairAst(ast, errors, {
  // Only apply high-confidence repairs
  minConfidence: 'high',

  // Only apply specific categories
  categories: ['missing-field', 'schema-mismatch'],

  // Disable ordering normalization
  normalizeOrdering: false,

  // Limit number of repairs
  maxRepairs: 10,
});
```

### Custom Repair Pipeline

```typescript
import {
  createRepairPipeline,
  missingFieldsStrategy,
  schemaFixStrategy,
} from '@isl-lang/core/isl-repair';

// Create a custom pipeline without ordering normalization
const quickRepair = createRepairPipeline([
  missingFieldsStrategy,
  schemaFixStrategy,
]);

const result = quickRepair(ast, errors);
```

### Formatting Repair Reports

```typescript
import { repairAst, formatRepairReport } from '@isl-lang/core/isl-repair';

const result = repairAst(brokenAst);
const report = formatRepairReport(result);

console.log(report);
// Output:
// ═══════════════════════════════════════════════════════════════
//                      ISL REPAIR REPORT
// ═══════════════════════════════════════════════════════════════
//
// Total repairs applied: 15
// Remaining errors: 1
// Duration: 2.34ms
//
// Repairs by category:
//   missing-field: 10
//   schema-mismatch: 3
//   normalize-order: 2
//
// ...
```

## Repair Categories

| Category | Description | Example |
|----------|-------------|---------|
| `missing-field` | Required field was missing | Added empty `fields` array to entity |
| `normalize-order` | Array/field ordering normalized | Sorted entities A-Z |
| `schema-mismatch` | Type or schema structure fixed | `string` → `String` |
| `invalid-value` | Value corrected to valid form | `===` → `==` |
| `duplicate-removal` | Duplicate entries removed | Removed duplicate field `email` |
| `location-fix` | Source location repaired | Fixed missing location data |

## Repair Confidence Levels

| Level | Description | Example |
|-------|-------------|---------|
| `high` | Unambiguous fix | Adding required empty array |
| `medium` | Likely correct | Auto-generated default name |
| `low` | Best-effort, may need review | Guessed field type |

## Repair Strategies

### Missing Fields Strategy

Adds missing required fields with sensible defaults:

- Domain name → `"UnnamedDomain"`
- Domain version → `"0.1.0"`
- Missing arrays → `[]`
- Entity/behavior names → `"Entity1"`, `"Behavior1"`
- Field type → `String` (when missing)
- Field optional → `false`

### Schema Fix Strategy

Corrects common schema mismatches:

**Type Name Corrections:**
- `string` → `String`
- `number` → `Int`
- `boolean` → `Boolean`
- `Date` → `Timestamp`
- `VARCHAR` → `String`
- `INTEGER` → `Int`

**Operator Corrections:**
- `===` → `==`
- `!==` → `!=`
- `&&` → `and`
- `||` → `or`

**Quantifier Corrections:**
- `every` → `all`
- `some` → `any`
- `exists` → `any`
- `forEach` → `all`

### Normalize Order Strategy

Sorts AST elements alphabetically:

- Type declarations
- Entities
- Behaviors
- Imports (by source path)
- Invariant blocks
- Policies
- Views

## API Reference

### `repairAst(ast, errors?, options?)`

Main repair function.

**Parameters:**
- `ast: Domain` - The ISL Domain AST to repair
- `errors?: ValidationError[]` - Validation errors to consider
- `options?: RepairOptions` - Repair options

**Returns:** `RepairResult`

### `RepairResult`

```typescript
interface RepairResult {
  ast: Domain;              // Repaired AST (deep clone)
  repairs: Repair[];        // List of repairs performed
  remainingErrors: UnrepairedError[];  // Errors that couldn't be fixed
  stats: RepairStats;       // Statistics
}
```

### `Repair`

```typescript
interface Repair {
  id: string;               // Unique ID
  category: RepairCategory; // Category of repair
  path: string;             // JSON path to repaired node
  reason: string;           // Human-readable reason
  diffSummary: string;      // Summary of change
  originalValue?: unknown;  // Value before repair
  repairedValue?: unknown;  // Value after repair
  confidence: RepairConfidence;
  location?: SourceLocation;
}
```

### `RepairOptions`

```typescript
interface RepairOptions {
  minConfidence?: RepairConfidence;  // Filter by confidence
  categories?: RepairCategory[];     // Filter by category
  normalizeOrdering?: boolean;       // Enable ordering (default: true)
  addOptionalDefaults?: boolean;     // Add optional fields (default: false)
  maxRepairs?: number;               // Limit repairs
}
```

## Testing

```bash
# Run repair engine tests
pnpm test packages/core/src/isl-repair

# Run with coverage
pnpm test:coverage packages/core/src/isl-repair
```

## Related

- [ISL Parser](../../parser/) - Parses ISL source to AST
- [ISL Typechecker](../../typechecker/) - Validates AST types
- [Pipeline Validation Step](../pipeline/steps/validateStep.ts) - Pipeline integration
