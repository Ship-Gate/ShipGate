# ISL Expression Evaluator v1 - Design Document

## Overview

The ISL Expression Evaluator is a **tri-state evaluation engine** for Intent Specification Language (ISL) postconditions, invariants, and preconditions. It evaluates expressions against runtime trace data and returns one of three results: `TRUE`, `FALSE`, or `UNKNOWN`.

### Design Philosophy

1. **Sound over Complete**: We prefer returning `UNKNOWN` over making incorrect assertions
2. **Deterministic**: Same inputs always produce the same outputs (no network calls, no randomness)
3. **Fail-Closed**: In strict mode, `UNKNOWN` evaluates to `false` for safety-critical checks
4. **Debuggable**: Rich provenance tracking explains why evaluations produced their results

---

## AST Nodes Supported

The evaluator supports the following AST node types from `@isl-lang/parser`:

### Literals

| Node Kind | Description | Example | Tri-State Result |
|-----------|-------------|---------|------------------|
| `BooleanLiteral` | Boolean constants | `true`, `false` | `true` or `false` |
| `StringLiteral` | String constants | `"hello"` | `true` (non-null) |
| `NumberLiteral` | Numeric constants | `42`, `3.14` | `true` (non-null) |
| `NullLiteral` | Null constant | `null` | `false` (falsy) |
| `ListExpr` | List literals | `[1, 2, 3]` | `true` (non-null) |

### Identifiers

| Node Kind | Description | Example | Tri-State Result |
|-----------|-------------|---------|------------------|
| `Identifier` | Variable reference | `x`, `userId` | Based on bound value or `unknown` |

**Special Identifiers:**
- `result` - Return value (postconditions)
- `input` - Behavior inputs
- `true`, `false`, `null` - Literal aliases

### Binary Expressions

| Node Kind | Operators | Example |
|-----------|-----------|---------|
| `BinaryExpr` | `==`, `!=`, `<`, `<=`, `>`, `>=` | `x == 5` |
| `BinaryExpr` | `and`, `or`, `implies` | `x and y` |

### Unary Expressions

| Node Kind | Operators | Example |
|-----------|-----------|---------|
| `UnaryExpr` | `not`, `-` | `not x`, `-5` |

### Member Expressions

| Node Kind | Description | Example |
|-----------|-------------|---------|
| `MemberExpr` | Property access | `user.name`, `foo.bar.baz` |

### Call Expressions

| Node Kind | Description | Example |
|-----------|-------------|---------|
| `CallExpr` | Function calls | `is_valid(x)`, `length(s)` |
| `CallExpr` | Method calls | `User.exists({id: x})` |

### Quantifier Expressions

| Node Kind | Quantifiers | Example |
|-----------|-------------|---------|
| `QuantifierExpr` | `all`, `any` | `all item in items: item > 0` |

---

## Truth Tables

### AND (`&&`, `and`)

| A | B | A AND B |
|---|---|---------|
| `true` | `true` | `true` |
| `true` | `false` | `false` |
| `true` | `unknown` | `unknown` |
| `false` | `true` | `false` |
| `false` | `false` | `false` |
| `false` | `unknown` | **`false`** ← short-circuits |
| `unknown` | `true` | `unknown` |
| `unknown` | `false` | **`false`** ← known false wins |
| `unknown` | `unknown` | `unknown` |

**Key Insight**: `false AND unknown = false` because the result is false regardless of the unknown value.

### OR (`||`, `or`)

| A | B | A OR B |
|---|---|--------|
| `true` | `true` | `true` |
| `true` | `false` | `true` |
| `true` | `unknown` | **`true`** ← known true wins |
| `false` | `true` | `true` |
| `false` | `false` | `false` |
| `false` | `unknown` | `unknown` |
| `unknown` | `true` | **`true`** ← known true wins |
| `unknown` | `false` | `unknown` |
| `unknown` | `unknown` | `unknown` |

**Key Insight**: `true OR unknown = true` because the result is true regardless of the unknown value.

### NOT (`!`, `not`)

| A | NOT A |
|---|-------|
| `true` | `false` |
| `false` | `true` |
| `unknown` | `unknown` |

### IMPLIES (`implies`)

| A | B | A IMPLIES B |
|---|---|-------------|
| `true` | `true` | `true` |
| `true` | `false` | `false` |
| `true` | `unknown` | `unknown` |
| `false` | `true` | **`true`** ← false implies anything |
| `false` | `false` | **`true`** ← false implies anything |
| `false` | `unknown` | **`true`** ← false implies anything |
| `unknown` | `true` | `unknown` |
| `unknown` | `false` | `unknown` |
| `unknown` | `unknown` | `unknown` |

**Key Insight**: Implication is equivalent to `NOT A OR B`. When antecedent is false, the implication is vacuously true.

### Comparison Operators (`==`, `!=`, `<`, `<=`, `>`, `>=`)

| Operand State | Result |
|---------------|--------|
| Both known | Comparison result (`true`/`false`) |
| Either unknown | `unknown` |

---

## UNKNOWN Propagation Rules

### Value Sources That Produce UNKNOWN

1. **Undefined variable**: Identifier not in context
2. **Missing property**: `user.foo` where `foo` doesn't exist
3. **Adapter returns unknown**: `exists()`, `lookup()` can't determine
4. **Type mismatch**: Comparing incompatible types
5. **Evaluation limit**: Max depth exceeded returns `unknown`

### Propagation Through Operators

```
UNKNOWN propagates upward through the AST unless:
├─ AND: false && unknown = false (false dominates)
├─ OR: true || unknown = true (true dominates)
├─ IMPLIES: false implies unknown = true (vacuous truth)
└─ Quantifiers: see below
```

### Quantifier Propagation

**`all x in collection: predicate`**
```
For each element:
├─ If any predicate = false → RESULT: false (immediate)
├─ If all predicates = true → RESULT: true
├─ If any predicate = unknown (and none false) → RESULT: unknown
└─ Empty collection → RESULT: true (vacuous truth)
```

**`any x in collection: predicate`**
```
For each element:
├─ If any predicate = true → RESULT: true (immediate)
├─ If all predicates = false → RESULT: false
├─ If any predicate = unknown (and none true) → RESULT: unknown
└─ Empty collection → RESULT: false
```

---

## Built-in Functions

### `is_valid(value)`

Checks if a value is "valid" (non-null, non-empty).

```typescript
function is_valid(value: unknown): TriState {
  if (value === null || value === undefined) return 'false';
  if (value === 'unknown') return 'unknown';
  if (typeof value === 'string') return value.length > 0 ? 'true' : 'false';
  if (Array.isArray(value)) return value.length > 0 ? 'true' : 'false';
  return 'true'; // Objects, numbers, booleans
}
```

### `length(value)`

Returns the length of a string or array.

```typescript
function length(value: unknown): number | 'unknown' {
  if (value === 'unknown') return 'unknown';
  if (typeof value === 'string') return value.length;
  if (Array.isArray(value)) return value.length;
  return 'unknown'; // Type mismatch
}
```

### `exists(entityName, criteria?)`

Checks if an entity exists in the domain.

```typescript
function exists(entityName: string, criteria?: Record<string, unknown>): TriState {
  // Delegates to adapter - requires domain-specific implementation
  // Returns 'unknown' if cannot be determined
}
```

### `regex(value, pattern)`

Tests if a string matches a regular expression.

```typescript
function regex(value: unknown, pattern: string): TriState {
  if (value === 'unknown') return 'unknown';
  if (typeof value !== 'string') return 'unknown';
  try {
    const re = new RegExp(pattern);
    return re.test(value) ? 'true' : 'false';
  } catch {
    return 'unknown'; // Invalid pattern
  }
}
```

---

## Error Handling

### Error Categories

1. **Syntax Errors**: Invalid expression structure (caught by parser)
2. **Evaluation Errors**: Runtime issues during evaluation
3. **Depth Limit Errors**: Infinite recursion protection
4. **Type Errors**: Incompatible operand types

### Error Format

```typescript
class EvaluationError extends Error {
  constructor(
    message: string,
    public readonly location: SourceLocation,
    public readonly diagnostics: Diagnostic[] = [],
    public readonly expression?: Expression
  ) {
    super(message);
    this.name = 'EvaluationError';
  }
}
```

### Source Span Information

Every error includes:
- `file`: Source file path
- `line`: Line number (1-indexed)
- `column`: Column number (1-indexed)
- `endLine`: End line for multi-line spans
- `endColumn`: End column

### Friendly Explanations

| Error Type | Example Message |
|------------|-----------------|
| Undefined variable | `Variable 'foo' is not defined. Did you mean 'for'?` |
| Type mismatch | `Cannot compare string with number at line 5:10` |
| Missing property | `Property 'email' not found on object 'user' at line 3:5` |
| Depth exceeded | `Expression too deeply nested (max: 1000). Check for circular references.` |

---

## Provenance Tracking

Every evaluation result includes provenance information:

```typescript
interface EvaluationResult {
  value: TriState;
  location: SourceLocation;
  reason?: string;           // Human-readable explanation
  provenance?: Provenance;   // Detailed tracking
  diagnostics?: Diagnostic[];
  metrics?: {
    evaluationTime: number;
    subExpressionCount: number;
  };
}

interface Provenance {
  source: 'literal' | 'variable' | 'input' | 'result' | 'computed' | 'adapter';
  binding?: string;          // Variable name if applicable
  adapterCall?: string;      // Adapter method if applicable
  children?: Provenance[];   // Sub-expression provenance
}
```

### Example Provenance

For expression `user.age > 18`:
```json
{
  "value": "true",
  "provenance": {
    "source": "computed",
    "children": [
      {
        "source": "variable",
        "binding": "user",
        "children": [
          { "source": "adapter", "adapterCall": "getProperty(user, age)" }
        ]
      },
      { "source": "literal" }
    ]
  }
}
```

---

## Performance Characteristics

| Operation | Time Complexity | Space Complexity |
|-----------|-----------------|------------------|
| Literal evaluation | O(1) | O(1) |
| Variable lookup | O(1) | O(1) |
| Binary operation | O(1) + children | O(d) depth |
| Member access | O(k) key lookup | O(1) |
| Quantifier (all/any) | O(n) × predicate | O(d + n) |

**Safeguards:**
- Max depth limit (default: 1000)
- No network calls
- No file I/O
- Deterministic execution

---

## Integration Points

### With Proof Verification

```typescript
import { evaluate, createContext } from '@isl-lang/evaluator';

const result = evaluate(postcondition, createContext({
  result: traceEvent.output,
  input: traceEvent.input,
  adapter: proofAdapter
}));

if (result.value === 'unknown') {
  return { status: 'NOT_PROVEN', reason: result.reason };
}
```

### With Runtime Verification

```typescript
const result = evaluate(invariant, createContext({
  variables: new Map([['entity', entityInstance]]),
  adapter: runtimeAdapter,
  strict: true  // unknown → false
}));
```

---

## Future Extensions (v2+)

- **Arithmetic**: `+`, `-`, `*`, `/`, `%`
- **String ops**: `contains()`, `startsWith()`, `endsWith()`
- **Temporal**: `old()`, `eventually`, `always`
- **Lambda**: `filter()`, `map()`, `reduce()`
- **Pattern matching**: `match x { ... }`
