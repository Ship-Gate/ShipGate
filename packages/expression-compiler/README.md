# @isl-lang/expression-compiler

ISL Expression Compiler - Parse, normalize, and evaluate ISL expressions.

## Overview

This package provides a complete pipeline for compiling and evaluating ISL expressions:

```
AST (Parser Output) → IR (Intermediate Representation) → Evaluation Result
```

### Key Features

- **Intermediate Representation (IR)**: Normalized, canonical form for expressions
- **Deterministic Normalization**: Stable ordering for commutative operations
- **Test-Driven**: 100+ unit tests covering all patterns
- **Type-Safe**: Full TypeScript support with type-safe IR builders

## Installation

```bash
pnpm add @isl-lang/expression-compiler
```

## Quick Start

```typescript
import { 
  compileToIR, 
  evaluate, 
  createContext, 
  createEvaluationContext,
  IR 
} from '@isl-lang/expression-compiler';

// From AST (parser output)
const ir = compileToIR(astExpression, createContext({ entities: new Set(['User']) }));

// Evaluate
const result = evaluate(ir, createEvaluationContext({
  input: { email: 'test@example.com' },
  result: { id: 'usr-123' },
}));

// Or use IR builders directly for testing
const existsCheck = IR.exists(IR.variable('x'), true);
const result2 = evaluate(existsCheck, createEvaluationContext({
  variables: { x: 'some value' }
}));
```

## Supported Expression Patterns (Top 25)

### Pattern 1: Existence Checks

```
x != null        // Value is not null/undefined
x == null        // Value is null/undefined
a.b.c != null    // Nested property exists
```

### Pattern 2: String Operations

```
str.length > 0              // Non-empty string
str.matches(/regex/)        // Regex matching
str.includes("substring")   // Contains substring
str.startsWith("prefix")    // Starts with prefix
str.endsWith("suffix")      // Ends with suffix
```

### Pattern 3: Number Comparisons

```
x > 10           // Greater than
x >= 10          // Greater than or equal
x < 100          // Less than
x <= 100         // Less than or equal
between(x, 0, 100)  // Range check (inclusive)
```

### Pattern 4: Enum/Set Membership

```
status in ["active", "pending"]     // Is in set
role not in ["banned", "deleted"]   // Is not in set
```

### Pattern 5: Boolean Operations

```
a && b           // Logical AND
a || b           // Logical OR
!a               // Logical NOT
a implies b      // Implication (if a then b)
```

### Pattern 6: Property Chains

```
result.user.id       // Nested property access
input.address.city   // Input property chain
a.b.c.d.e           // Deep property access
```

### Pattern 7: Array Operations

```
items.length > 0            // Non-empty array
items.includes(x)           // Array contains element
items.every(x => x > 0)     // All elements satisfy
items.some(x => x > 0)      // At least one satisfies
items.filter(x => x > 0)    // Filter elements
```

### Pattern 8: Status Checks

```
status in ["succeeded", "paid"]    // Payment status
state in ["active", "approved"]    // Workflow state
```

### Pattern 9: Quantifiers

```
all(x in items, x > 0)      // Universal quantification
any(x in items, x > 0)      // Existential quantification
none(x in items, x < 0)     // None satisfy
count(x in items, x > 0)    // Count satisfying
```

### Pattern 10: Entity Operations

```
User.exists()                           // Any user exists
User.exists({ email: "test@example.com" })  // User with criteria exists
User.count()                            // Count all users
User.count({ status: "active" })        // Count with criteria
User.lookup({ id: "usr-123" })          // Find specific user
```

### Pattern 11: Special Expressions

```
result           // Operation result
result.id        // Result property
input.email      // Input value
old(x)           // Previous value (postconditions)
```

### Pattern 12-25: Additional Patterns

- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Conditional: `a ? b : c`
- Equality: `a == b`, `a != b`
- Deep equality for arrays and objects
- Duration literals (converted to ms)
- Regex literals with flags
- Lambda expressions (simplified)
- Map/object literals

## IR Types

### Building IR Manually

```typescript
import { IR } from '@isl-lang/expression-compiler';

// Literals
IR.null()
IR.bool(true)
IR.number(42)
IR.string("hello")
IR.regex("^\\d+$", "i")
IR.list([IR.number(1), IR.number(2)])
IR.map([{ key: "a", value: IR.number(1) }])

// Variables & Access
IR.variable("x")
IR.prop(IR.variable("user"), "name")
IR.index(IR.variable("arr"), IR.number(0))

// Existence
IR.exists(IR.variable("x"), true)   // x != null
IR.exists(IR.variable("x"), false)  // x == null

// Comparisons
IR.compare("<", IR.variable("x"), IR.number(10))
IR.compare(">=", IR.variable("x"), IR.number(0))
IR.between(IR.variable("x"), IR.number(0), IR.number(100), true)

// Boolean
IR.and([IR.variable("a"), IR.variable("b")])
IR.or([IR.variable("a"), IR.variable("b")])
IR.not(IR.variable("a"))
IR.implies(IR.variable("a"), IR.variable("b"))

// String
IR.strLen(IR.variable("s"))
IR.strMatches(IR.variable("s"), IR.regex("^\\d+$"))
IR.strIncludes(IR.variable("s"), IR.string("world"))

// Set membership
IR.inSet(IR.variable("x"), [IR.string("a"), IR.string("b")], false)

// Arrays
IR.arrayLen(IR.variable("arr"))
IR.arrayIncludes(IR.variable("arr"), IR.number(5))
IR.arrayEvery(IR.variable("arr"), "x", IR.compare(">", IR.variable("x"), IR.number(0)))

// Quantifiers
IR.quantAll(IR.variable("xs"), "x", IR.compare(">", IR.variable("x"), IR.number(0)))
IR.quantAny(IR.variable("xs"), "x", IR.compare(">", IR.variable("x"), IR.number(0)))

// Entities
IR.entityExists("User", IR.map([{ key: "id", value: IR.string("123") }]))
IR.entityCount("User")

// Special
IR.result("id")
IR.input("email")
IR.old(IR.variable("balance"))
```

## Normalization

The IR is automatically normalized for deterministic representation:

```typescript
import { normalizeIR, serializeIR } from '@isl-lang/expression-compiler';

// Flattens nested ANDs
const ir = IR.and([IR.and([IR.variable("a"), IR.variable("b")]), IR.variable("c")]);
const normalized = normalizeIR(ir);
console.log(serializeIR(normalized)); // (a && b && c)

// Sorts operands for stable ordering
const unsorted = IR.and([IR.variable("z"), IR.variable("a"), IR.variable("m")]);
console.log(serializeIR(normalizeIR(unsorted))); // (a && m && z)

// Removes duplicates
const dups = IR.and([IR.variable("x"), IR.variable("x")]);
console.log(serializeIR(normalizeIR(dups))); // x
```

## Evaluation Context

```typescript
import { createEvaluationContext, InMemoryEntityStore } from '@isl-lang/expression-compiler';

const ctx = createEvaluationContext({
  // Input values (from operation input)
  input: {
    email: "user@example.com",
    amount: 100,
  },
  
  // Result value (for postconditions)
  result: {
    id: "usr-123",
    status: "created",
  },
  
  // Variables in scope
  variables: {
    threshold: 50,
    maxItems: 10,
  },
  
  // Entity data
  entities: {
    User: [
      { id: "u1", email: "alice@example.com", status: "active" },
      { id: "u2", email: "bob@example.com", status: "pending" },
    ],
  },
  
  // Current timestamp
  now: new Date(),
});
```

## Unsupported Expressions

The following patterns are not currently supported. Use the `openQuestions` pattern to flag them:

### Currently Unsupported

| Pattern | Reason | Workaround |
|---------|--------|------------|
| `typeof x` | Runtime type checks not in ISL | Use existence checks |
| `x instanceof Type` | Runtime type checks | Use entity operations |
| `async/await` | Expressions are synchronous | N/A |
| `try/catch` | Error handling is behavioral | Use error postconditions |
| `delete x` | Mutation operations | Use entity operations |
| `new X()` | Object construction | Use entity creation |

### Open Questions

If you encounter an unsupported expression in your ISL spec, document it:

```isl
behavior MyBehavior {
  // ...
  
  openQuestions {
    "How to handle complex aggregations across entities?"
    "Support for temporal expressions like 'within 5 minutes'?"
  }
}
```

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## Fixture-Based Testing

Test fixtures are in `fixtures/contexts.json`. Add new test cases:

```json
{
  "id": "my-test",
  "description": "Test description",
  "context": {
    "input": { "email": "test@example.com" },
    "variables": { "x": 42 }
  },
  "tests": [
    { "ir": "Existence(input.email, true)", "expected": true },
    { "ir": "Compare(>, x, 0)", "expected": true }
  ]
}
```

## Architecture

```
src/
├── index.ts           # Main exports
├── ir/
│   ├── types.ts       # IR type definitions
│   ├── normalize.ts   # Normalization & serialization
│   └── index.ts
├── compiler/
│   ├── ast-to-ir.ts   # AST to IR compiler
│   └── index.ts
└── evaluator/
    ├── context.ts     # Evaluation context types
    ├── evaluate.ts    # IR evaluator
    └── index.ts

tests/
├── ir.test.ts         # IR builder and normalization tests
├── compiler.test.ts   # AST to IR compiler tests
├── evaluator.test.ts  # Evaluator tests (100+ cases)
└── fixtures.test.ts   # Fixture-based tests

fixtures/
├── contexts.json      # 20 test contexts
└── schema.json        # JSON schema for fixtures
```

## License

MIT
