# ISL Expression Evaluator

A deterministic expression evaluator for ISL (Intent Specification Language) postconditions and invariants, featuring tri-state logic (true/false/unknown) and rich diagnostics.

## Features

- **Tri-State Logic**: Supports `true`, `false`, and `unknown` values for evaluating expressions against runtime traces or symbolic values
- **Rich Diagnostics**: Provides source spans and detailed failure reasons
- **Adapter Interface**: Pluggable adapters for domain primitives (`is_valid`, `length`, `exists`, `lookup`)
- **Operators**: Full support for `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`, `implies`
- **Quantifiers**: Optional support for `any()` and `all()` on arrays
- **Performance**: Evaluates 1000 expressions in < 100ms
- **Deterministic**: No network calls, pure functional evaluation

## Installation

```bash
pnpm add @isl-lang/expression-evaluator
```

## Usage

### Basic Evaluation

```typescript
import { evaluate, createContext } from '@isl-lang/expression-evaluator';
import { parseExpression } from '@isl-lang/parser';

// Parse an expression (you'll need to use the parser)
const expression = parseExpression('x > 5 && y < 10');

// Create evaluation context
const context = createContext({
  variables: new Map([
    ['x', 7],
    ['y', 8],
  ]),
});

// Evaluate
const result = evaluate(expression, context);
console.log(result.value); // 'true' | 'false' | 'unknown'
console.log(result.location); // Source location
console.log(result.reason); // Why it succeeded/failed/unknown
```

### Tri-State Logic

The evaluator supports three states:

- **`true`**: Expression definitely evaluates to true
- **`false`**: Expression definitely evaluates to false  
- **`unknown`**: Expression cannot be determined (e.g., missing variable, symbolic value)

```typescript
// Unknown propagates through operators
const result1 = evaluate(parseExpression('x > 5'), createContext());
// result1.value === 'unknown' (x is not in context)

const result2 = evaluate(parseExpression('unknown && true'), createContext());
// result2.value === 'unknown' (unknown && true = unknown)

const result3 = evaluate(parseExpression('unknown && false'), createContext());
// result3.value === 'false' (unknown && false = false)
```

### Custom Adapter

Implement domain-specific primitives:

```typescript
import { createAdapter, createContext } from '@isl-lang/expression-evaluator';

const adapter = createAdapter({
  is_valid: (value) => {
    if (typeof value === 'string') {
      return value.length > 0 ? 'true' : 'false';
    }
    return value !== null && value !== undefined ? 'true' : 'false';
  },
  
  length: (value) => {
    if (typeof value === 'string') return value.length;
    if (Array.isArray(value)) return value.length;
    return 'unknown';
  },
  
  exists: (entityName, criteria) => {
    // Your domain logic here
    if (entityName === 'User' && criteria?.id === '123') {
      return 'true';
    }
    return 'false';
  },
  
  lookup: (entityName, criteria) => {
    // Your domain logic here
    if (entityName === 'User' && criteria?.id === '123') {
      return { id: '123', name: 'Alice' };
    }
    return 'unknown';
  },
  
  getProperty: (object, property) => {
    if (object && typeof object === 'object') {
      return (object as Record<string, unknown>)[property] ?? 'unknown';
    }
    return 'unknown';
  },
});

const context = createContext({ adapter });
```

### Quantifiers

Evaluate quantifiers on arrays:

```typescript
// all() - all elements must satisfy predicate
const allExpr = parseExpression('all item in items: item > 0');
const context = createContext({
  variables: new Map([['items', [1, 2, 3]]]),
});
const result = evaluate(allExpr, context);
// result.value === 'true'

// any() - at least one element must satisfy predicate
const anyExpr = parseExpression('any item in items: item < 0');
const result2 = evaluate(anyExpr, context);
// result2.value === 'false'
```

### Property Access

Access nested properties:

```typescript
const expr = parseExpression('user.name');
const context = createContext({
  variables: new Map([
    ['user', { name: 'Alice', age: 30 }],
  ]),
});
const result = evaluate(expr, context);
// result.value === 'true'
```

## Supported Expressions

### Operators

- **Comparison**: `==`, `!=`, `<`, `<=`, `>`, `>=`
- **Logical**: `&&` (and), `||` (or), `!` (not), `implies`
- **Arithmetic**: `+`, `-`, `*`, `/`, `%` (basic support)

### Literals

- **String**: `"hello"`
- **Number**: `42`, `3.14`
- **Boolean**: `true`, `false`
- **Null**: `null`

### Property Access

- **Member**: `foo.bar.baz`
- **Index**: `array[0]` (basic support)

### Function Predicates

- **`is_valid(value)`**: Check if value is valid
- **`length(value)`**: Get length of string/array
- **`exists(entityName, criteria?)`**: Check if entity exists
- **`lookup(entityName, criteria?)`**: Lookup entity

### Quantifiers (Optional v1)

- **`all variable in collection: predicate`**: All elements satisfy predicate
- **`any variable in collection: predicate`**: At least one element satisfies predicate

## API Reference

### `evaluate(expression, context): EvaluationResult`

Evaluate an ISL expression.

**Parameters:**
- `expression`: Parsed ISL expression AST
- `context`: Evaluation context

**Returns:**
```typescript
interface EvaluationResult {
  value: 'true' | 'false' | 'unknown';
  location: SourceLocation;
  reason?: string;
  diagnostics?: Diagnostic[];
  metrics?: {
    evaluationTime: number;
    subExpressionCount: number;
  };
}
```

### `createContext(options?): EvaluationContext`

Create an evaluation context.

**Options:**
- `variables`: Map of variable names to values
- `input`: Input values for behavior
- `result`: Result value (for postconditions)
- `oldState`: Old state snapshot (for `old()` expressions)
- `adapter`: Custom adapter implementation
- `strict`: Enable strict mode (unknown → false)
- `maxDepth`: Maximum evaluation depth

### `createAdapter(overrides): ExpressionAdapter`

Create a custom adapter from partial implementation.

## Performance

The evaluator is optimized for performance:

- **1000 simple expressions**: < 100ms
- **1000 complex expressions**: < 100ms
- **100 quantifiers (100 items each)**: < 100ms

Run benchmarks:

```bash
pnpm bench
```

## Examples

### Postcondition Evaluation

```typescript
import { evaluate, createContext } from '@isl-lang/expression-evaluator';

// Postcondition: result.success == true
const postcondition = parseExpression('result.success == true');

const context = createContext({
  result: { success: true, data: { id: '123' } },
});

const result = evaluate(postcondition, context);
if (result.value === 'false') {
  console.error(`Postcondition failed: ${result.reason}`);
  console.error(`Location: ${result.location.file}:${result.location.line}`);
}
```

### Invariant Evaluation

```typescript
// Invariant: user.age >= 0
const invariant = parseExpression('user.age >= 0');

const context = createContext({
  variables: new Map([
    ['user', { name: 'Alice', age: 30 }],
  ]),
});

const result = evaluate(invariant, context);
if (result.value === 'false') {
  console.error(`Invariant violated: ${result.reason}`);
}
```

## Error Handling

The evaluator provides rich error information:

```typescript
import { EvaluationError } from '@isl-lang/expression-evaluator';

try {
  const result = evaluate(expression, context);
} catch (error) {
  if (error instanceof EvaluationError) {
    console.error(error.format()); // Includes source location
    console.error(error.diagnostics); // Detailed diagnostics
  }
}
```

## License

MIT
