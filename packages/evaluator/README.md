# @isl-lang/evaluator

Expression evaluator for ISL - runtime evaluation and verification of contracts.

## Installation

```bash
npm install @isl-lang/evaluator
# or
pnpm add @isl-lang/evaluator
```

## Usage

```typescript
import { Evaluator, createContext } from '@isl-lang/evaluator';

// Create evaluation context with bindings
const context = createContext({
  user: {
    name: 'Alice',
    age: 25,
    email: 'alice@example.com'
  },
  config: {
    maxUsers: 100
  }
});

// Evaluate expressions
const evaluator = new Evaluator(context);

// Simple expressions
evaluator.evaluate('user.age >= 18'); // true
evaluator.evaluate('user.name.length > 0'); // true
evaluator.evaluate('config.maxUsers'); // 100

// Contract validation
const precondition = 'user.age >= 18 && user.email.contains("@")';
const isValid = evaluator.evaluate(precondition);
```

## API

### `Evaluator`

Main evaluator class.

```typescript
const evaluator = new Evaluator(context);

// Evaluate expression to value
const result = evaluator.evaluate(expression);

// Evaluate with type checking
const typed = evaluator.evaluateTyped(expression);
```

### `createContext(bindings: object): EvalContext`

Create an evaluation context with variable bindings.

### `validateContract(contract: Contract, context: EvalContext): ValidationResult`

Validate a contract (precondition/postcondition) against a context.

```typescript
import { validateContract } from '@isl-lang/evaluator';

const result = validateContract(
  { expression: 'input.amount > 0', type: 'precondition' },
  context
);

if (!result.valid) {
  console.error('Contract violation:', result.message);
}
```

## Expression Language

Supported operators and functions:

### Comparison
- `==`, `!=`, `<`, `>`, `<=`, `>=`

### Logical
- `&&`, `||`, `!`

### Arithmetic
- `+`, `-`, `*`, `/`, `%`

### String
- `.length`, `.contains()`, `.startsWith()`, `.endsWith()`

### Collection
- `.includes()`, `.every()`, `.some()`, `.filter()`, `.map()`

### Type checking
- `.isNull()`, `.isValid()`, `.typeof()`

## Documentation

Full documentation: https://isl-lang.dev/docs/evaluator

## Related Packages

- [@isl-lang/parser](https://npm.im/@isl-lang/parser) - ISL parser
- [@isl-lang/typechecker](https://npm.im/@isl-lang/typechecker) - Type checker

## License

MIT
