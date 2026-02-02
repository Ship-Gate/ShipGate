# @isl-lang/parser

ISL parser - transforms ISL (Intent Specification Language) source code into an Abstract Syntax Tree.

## Installation

```bash
npm install @isl-lang/parser
# or
pnpm add @isl-lang/parser
# or
yarn add @isl-lang/parser
```

## Usage

```typescript
import { parse, parseFile } from '@isl-lang/parser';

// Parse ISL source code
const ast = parse(`
  domain UserManagement {
    intent CreateUser {
      input {
        name: string
        email: email
      }
      output {
        id: uuid
        createdAt: timestamp
      }
      preconditions {
        name.length > 0
        email.isValid()
      }
      postconditions {
        result.id != null
      }
    }
  }
`);

// Parse from file
const astFromFile = parseFile('./specs/user.isl');
```

## API

### `parse(source: string, options?: ParseOptions): AST`

Parse ISL source code into an AST.

**Parameters:**
- `source` - ISL source code string
- `options` - Optional parsing configuration
  - `filename` - Source filename for error messages
  - `startRule` - Starting grammar rule (default: 'program')

**Returns:** Abstract Syntax Tree

### `parseFile(path: string, options?: ParseOptions): AST`

Parse an ISL file from the filesystem.

**Parameters:**
- `path` - Path to the ISL file
- `options` - Optional parsing configuration

**Returns:** Abstract Syntax Tree

### `tokenize(source: string): Token[]`

Tokenize ISL source code into a stream of tokens.

### AST Node Types

The parser produces nodes conforming to the ISL AST specification:

- `Program` - Root node containing all declarations
- `Domain` - Domain definition with intents and types
- `Intent` - Intent definition with I/O and contracts
- `Type` - Type definitions (entity, value, enum)
- `Expression` - Contract expressions

## Error Handling

```typescript
import { parse, ParseError } from '@isl-lang/parser';

try {
  const ast = parse(source);
} catch (error) {
  if (error instanceof ParseError) {
    console.error(`Parse error at ${error.location}:`);
    console.error(error.message);
  }
}
```

## Documentation

Full documentation: https://isl-lang.dev/docs/parser

## Related Packages

- [@isl-lang/typechecker](https://npm.im/@isl-lang/typechecker) - Semantic analysis
- [@isl-lang/evaluator](https://npm.im/@isl-lang/evaluator) - Expression evaluation
- [@isl-lang/cli](https://npm.im/@isl-lang/cli) - Command-line interface

## License

MIT
