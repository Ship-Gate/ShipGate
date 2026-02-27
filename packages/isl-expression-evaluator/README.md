# ISL Static Analyzer

A static analysis engine for ISL (Intent Specification Language) that proves or disproves conditions **without executing code**. Uses tri-state logic (true/false/unknown) with type-constraint propagation to determine postcondition/invariant satisfaction at compile time.

## How It Works

The static analyzer runs **before** the runtime evaluator:

1. **Static analysis** (this package) evaluates each expression using type constraints alone
2. Expressions proven `true` or `false` are resolved immediately (no execution needed)
3. Only expressions marked `unknown` are passed to the runtime evaluator

This two-phase approach minimizes runtime overhead: the gate only executes what it can't prove statically.

## Features

- **Tri-State Logic**: `true` (provably satisfied), `false` (provably violated), `unknown` (needs runtime)
- **Type-Constraint Propagation**: Uses ISL type constraints (min, max, min_length, enum, etc.) to prove conditions
- **Range Analysis**: Proves numeric comparisons from type range constraints
- **Tautology/Contradiction Detection**: Detects `x == x`, `x != x`, and similar patterns
- **Type Mismatch Detection**: Catches incompatible comparisons like `number == string`
- **Field Existence Checking**: Proves required fields exist on entities
- **Logical Simplification**: Short-circuit evaluation for `and`/`or`/`implies`
- **Quantifier Optimization**: Vacuous truth for empty collections
- **Runtime Evaluator**: Full expression evaluator for runtime-dependent conditions (v1 API)

## Installation

```bash
pnpm add @isl-lang/static-analyzer
```

## Quick Start

### Static Analysis (compile-time)

```typescript
import {
  analyzeStatically,
  createTypeContext,
  typeInfo,
  fieldInfo,
  entityInfo,
} from '@isl-lang/static-analyzer';
import { parseExpression } from '@isl-lang/parser';

// Define type constraints from ISL declarations
const ctx = createTypeContext({
  types: new Map([
    ['Email', typeInfo('string', { minLength: 1, format: 'email' })],
    ['Age', typeInfo('integer', { min: 0, max: 150 })],
  ]),
  resultEntity: entityInfo('User', [
    fieldInfo('email', typeInfo('string', { minLength: 1 }), true),
    fieldInfo('age', typeInfo('integer', { min: 0, max: 150 }), true),
    fieldInfo('nickname', typeInfo('string'), false),
  ]),
});

// Statically prove: result.email exists (required field)
const expr1 = parseExpression('result.email');
const result1 = analyzeStatically(expr1, ctx);
// { verdict: 'true', reason: 'Field "email" is required...', confidence: 0.9 }

// Statically disprove: type mismatch
const expr2 = parseExpression('result.age == "hello"');
const result2 = analyzeStatically(expr2, ctx);
// { verdict: 'false', reason: 'Type mismatch: integer == string...', confidence: 1.0 }

// Unknown: needs runtime
const expr3 = parseExpression('result.age > 18');
const result3 = analyzeStatically(expr3, ctx);
// { verdict: 'unknown', reason: 'Cannot statically determine...', confidence: 0 }
```

### Runtime Evaluation (for unknowns)

```typescript
import { evaluateV1 as evaluate, createEvalContext } from '@isl-lang/static-analyzer';

const ctx = createEvalContext({
  result: { age: 25, email: 'user@example.com' },
});

const result = evaluate(expr, ctx);
// { kind: 'true', reason: '25 > 18' }
```

## Static Analysis Result

```typescript
interface StaticAnalysisResult {
  expression: string;           // Source expression text
  verdict: 'true' | 'false' | 'unknown';
  reason: string;               // Human-readable explanation
  confidence: number;           // 0.0 - 1.0
  category?: AnalysisCategory;  // What analysis produced this
}
```

## Analysis Categories

| Category | Description | Example |
|----------|-------------|---------|
| `literal` | Direct literal evaluation | `5 > 3` → true |
| `type-constraint` | Type constraint propagation | `Email.length > 0` → true |
| `type-mismatch` | Incompatible type comparison | `number == string` → false |
| `tautology` | Always-true pattern | `x == x` → true |
| `contradiction` | Always-false pattern | `x != x` → false |
| `field-existence` | Required field check | `user.email` (required) → true |
| `range-analysis` | Numeric range comparison | `Age >= 0` → true |
| `enum-analysis` | Enum membership check | `status == "invalid"` → false |
| `logical-simplification` | Boolean logic simplification | `false and X` → false |
| `runtime-dependent` | Needs runtime data | `exists(User, ...)` → unknown |

## Type Context

The `TypeContext` provides type information from ISL declarations:

```typescript
interface TypeContext {
  types: Map<string, TypeConstraintInfo>;      // Type aliases
  entities: Map<string, EntityInfo>;           // Entity declarations
  bindings: Map<string, TypeConstraintInfo>;   // Variable types
  resultType?: TypeConstraintInfo;             // Return type
  resultEntity?: EntityInfo;                   // Return entity type
  inputTypes?: Map<string, TypeConstraintInfo>; // Input param types
}
```

## API Reference

### `analyzeStatically(expr, typeContext): StaticAnalysisResult`

Analyze a single expression statically.

### `analyzeAll(exprs, typeContext): StaticAnalysisResult[]`

Batch-analyze multiple expressions.

### `summarizeResults(results): Summary`

Get counts of provably-true, provably-false, and unknown results.

### `createTypeContext(partial?): TypeContext`

Create a TypeContext (empty or from partial data).

### `typeInfo(baseType, constraints?): TypeConstraintInfo`

Create type constraint info for a base type.

### `fieldInfo(name, type, required?): FieldInfo`

Create entity field info.

### `entityInfo(name, fields): EntityInfo`

Create entity info from field list.

## Performance

Static analysis is designed to be fast (no I/O, no execution):

- **1000 expressions**: < 10ms
- **Complex type-constraint propagation**: < 1ms per expression

## License

MIT
