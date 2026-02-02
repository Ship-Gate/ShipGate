# @isl-lang/typechecker

Semantic analyzer for ISL - validates AST, resolves types, and builds symbol tables.

## Installation

```bash
npm install @isl-lang/typechecker
# or
pnpm add @isl-lang/typechecker
```

## Usage

```typescript
import { parse } from '@isl-lang/parser';
import { typecheck, TypeChecker } from '@isl-lang/typechecker';

const ast = parse(`
  domain UserManagement {
    type User {
      id: uuid
      name: string
      email: email
    }

    intent CreateUser {
      input { name: string, email: email }
      output { user: User }
    }
  }
`);

// Quick validation
const result = typecheck(ast);

if (result.errors.length > 0) {
  result.errors.forEach(err => console.error(err.message));
} else {
  console.log('Type checking passed!');
  console.log('Symbol table:', result.symbolTable);
}

// Or use the TypeChecker class for more control
const checker = new TypeChecker();
const checked = checker.check(ast);
```

## API

### `typecheck(ast: AST): TypeCheckResult`

Perform type checking on an AST.

**Returns:**
- `errors` - Array of type errors found
- `warnings` - Array of type warnings
- `symbolTable` - Resolved symbol table
- `typeMap` - Map of nodes to their resolved types

### `TypeChecker`

Class for incremental type checking with caching.

```typescript
const checker = new TypeChecker();

// Check multiple files
checker.addFile('user.isl', userAst);
checker.addFile('order.isl', orderAst);

// Get all errors
const errors = checker.getAllErrors();

// Get type for a specific node
const type = checker.getType(node);
```

## Features

- **Type inference** - Infers types for expressions
- **Contract validation** - Validates pre/postconditions
- **Cross-reference resolution** - Resolves type references across domains
- **Import validation** - Validates imports and exports
- **Incremental checking** - Efficient re-checking of modified files

## Error Types

```typescript
import { TypeError, TypeErrorCode } from '@isl-lang/typechecker';

// Error codes
TypeErrorCode.UNDEFINED_TYPE
TypeErrorCode.TYPE_MISMATCH
TypeErrorCode.DUPLICATE_DEFINITION
TypeErrorCode.INVALID_CONTRACT
```

## Documentation

Full documentation: https://isl-lang.dev/docs/typechecker

## Related Packages

- [@isl-lang/parser](https://npm.im/@isl-lang/parser) - ISL parser
- [@isl-lang/evaluator](https://npm.im/@isl-lang/evaluator) - Expression evaluator

## License

MIT
