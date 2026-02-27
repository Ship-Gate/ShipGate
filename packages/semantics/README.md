# @isl-lang/semantics

Versioned semantics for ISL (Intent Specification Language) operators and clauses. This package ensures semantic consistency across ISL versions and prevents meaning drift.

## Why Versioned Semantics?

ISL expressions like `a implies b` or `all x in C: P(x)` have precise mathematical meanings. As the language evolves, these meanings must remain stable within a major version to ensure:

1. **Contracts don't silently change meaning** - A spec written for v1.0.0 behaves identically on v1.5.0
2. **Evaluators stay consistent** - Different tools interpret the same expression identically
3. **Breaking changes are explicit** - Only major versions can change semantic behavior

## Installation

```bash
pnpm add @isl-lang/semantics
```

## Quick Start

```typescript
import { getSemantics, createEvaluatorAdapter } from '@isl-lang/semantics';

// Get semantics for a specific version
const v1 = getSemantics('1.0.0');

// Or use the evaluator adapter for expression evaluation
const adapter = createEvaluatorAdapter({ version: '1.0.0' });

// Evaluate expressions using versioned semantics
const result = adapter.evaluateBinary('==', [1, 2], [1, 2]); // true (deep equality)
const implies = adapter.evaluateBinary('implies', false, true); // true (vacuous truth)
```

## API Reference

### Version Registry

```typescript
import {
  getSemantics,           // Get semantics for a version string
  getSemanticsForVersion, // Get semantics for a parsed version
  getLatestSemantics,     // Get latest semantics for a major version
  getAvailableVersions,   // List all available versions
  isVersionSupported,     // Check if a version is supported
  getDefaultSemantics,    // Get default (latest stable) semantics
} from '@isl-lang/semantics';

// Examples
const v1 = getSemantics('1.0.0');
const latest = getLatestSemantics(1);
const supported = isVersionSupported('1.5.0'); // true
```

### Evaluator Adapter

For runtime evaluation of ISL expressions:

```typescript
import { createEvaluatorAdapter } from '@isl-lang/semantics/adapter';

const adapter = createEvaluatorAdapter({ version: '1.0.0' });

// Binary operators
adapter.evaluateBinary('+', 1, 2);        // 3
adapter.evaluateBinary('==', [1], [1]);   // true
adapter.evaluateBinary('implies', false, x); // true (vacuous)

// Unary operators
adapter.evaluateUnary('not', true);       // false
adapter.evaluateUnary('-', 5);            // -5

// Quantifiers
adapter.evaluateQuantifier('all', items, predicate);
adapter.evaluateQuantifier('count', items, predicate);

// Operator properties
adapter.isShortCircuit('and');            // true
adapter.getPrecedence('*');               // 6
```

### Compiler Adapter

For code generators needing operator metadata:

```typescript
import { createCompilerAdapter } from '@isl-lang/semantics/adapter';

const compiler = createCompilerAdapter({ version: '1.0.0' });

// Get operator information
const plusInfo = compiler.getBinaryOperatorInfo('+');
// { operator: '+', precedence: 5, associative: true, ... }

// List all operators
compiler.getAllBinaryOperators();  // ['==', '!=', '<', '>', ...]
compiler.getAllQuantifiers();      // ['all', 'any', 'none', ...]
compiler.getAllTemporalOperators(); // ['eventually', 'always', ...]
```

### Type Check Adapter

For type checkers validating expressions:

```typescript
import { createTypeCheckAdapter } from '@isl-lang/semantics/adapter';

const types = createTypeCheckAdapter('1.0.0');

// Check operand types
types.checkBinaryOperandTypes('+', 'number', 'number'); 
// { valid: true }

types.checkBinaryOperandTypes('<', 'string', 'number');
// { valid: false, error: "..." }

// Get result types
types.getBinaryResultType('==');     // 'boolean'
types.getQuantifierResultType('sum'); // 'number'
```

## V1 Semantics Reference

### Binary Operators

| Operator | Description | Precedence | Short-Circuit |
|----------|-------------|------------|---------------|
| `==`     | Deep structural equality | 3 | No |
| `!=`     | Deep structural inequality | 3 | No |
| `<` `>` `<=` `>=` | Numeric comparison | 4 | No |
| `+`      | Addition / String concatenation | 5 | No |
| `-` `*` `/` `%` | Arithmetic | 5-6 | No |
| `and`    | Logical AND | 2 | Yes |
| `or`     | Logical OR | 1 | Yes |
| `implies`| Logical implication (A → B) | 2 | Yes |
| `iff`    | Biconditional (A ↔ B) | 2 | No |
| `in`     | Membership test | 4 | No |

### Unary Operators

| Operator | Description |
|----------|-------------|
| `not`    | Logical negation |
| `-`      | Numeric negation |

### Quantifiers

| Quantifier | Result Type | Description |
|------------|-------------|-------------|
| `all`      | boolean | Universal: ∀x ∈ C: P(x) |
| `any`      | boolean | Existential: ∃x ∈ C: P(x) |
| `none`     | boolean | Negated existential |
| `count`    | number | Count satisfying predicate |
| `sum`      | number | Sum of predicate results |
| `filter`   | array | Elements satisfying predicate |

### Temporal Operators

| Operator | Requires Duration | Description |
|----------|-------------------|-------------|
| `eventually` | Yes | Becomes true within duration |
| `always` | Yes | Remains true throughout duration |
| `within` | Yes | Completes within duration |
| `never` | No | Never becomes true |
| `immediately` | No | True immediately after operation |
| `response` | Yes | Stimulus-response pattern |

## Version Compatibility

### Semver Rules

- **Patch versions (1.0.x)**: Semantics are FROZEN. All `1.0.x` versions have identical behavior.
- **Minor versions (1.x.0)**: May add new operators but cannot change existing behavior.
- **Major versions (x.0.0)**: May change semantic behavior (breaking change).

### Compatibility Testing

The package includes compatibility test fixtures in `fixtures/compatibility/` that verify behavior remains identical across patch versions:

```bash
pnpm test
```

## Integrating with Your Evaluator

To integrate versioned semantics into an existing evaluator:

```typescript
import { createEvaluatorAdapter } from '@isl-lang/semantics/adapter';

class MyEvaluator {
  private semantics = createEvaluatorAdapter({ version: '1.0.0' });

  evaluateBinaryExpr(expr: BinaryExpr, ctx: Context): Value {
    // Check for short-circuit operators first
    if (this.semantics.isShortCircuit(expr.operator)) {
      const left = this.evaluate(expr.left, ctx);
      if (expr.operator === 'and' && !left) return false;
      if (expr.operator === 'or' && left) return true;
      if (expr.operator === 'implies' && !left) return true;
    }

    // Evaluate both operands
    const left = this.evaluate(expr.left, ctx);
    const right = this.evaluate(expr.right, ctx);

    // Use versioned semantics
    return this.semantics.evaluateBinary(expr.operator, left, right);
  }
}
```

## Future Versions

Planned changes for v2 are documented in `fixtures/future/v2-draft/`. This provides transparency about intentional breaking changes in the next major version.

## License

MIT
