# @isl-lang/codegen-core

Core utilities for deterministic ISL code generation.

## Features

- **Deterministic Import Sorting** - Stable import ordering by group and alphabetically
- **Topological Type Sorting** - Sort types by dependencies, then alphabetically
- **Code Printer** - Build generated code with consistent indentation
- **Content Hashing** - Detect changes with deterministic hashes
- **Formatting Utilities** - Consistent string transformations

## Installation

```bash
pnpm add @isl-lang/codegen-core
```

## Usage

### Import Sorting

```typescript
import { sortImports, formatImports } from '@isl-lang/codegen-core';

const imports = [
  { moduleSpecifier: './utils.js', namedImports: [{ name: 'helper' }] },
  { moduleSpecifier: 'zod', namedImports: [{ name: 'z' }] },
  { moduleSpecifier: '@isl-lang/runtime', namedImports: [{ name: 'Result' }] },
];

const sorted = sortImports(imports);
const code = formatImports(sorted, { singleQuote: true, semi: true });

// Output (grouped and sorted):
// import { z } from 'zod';
//
// import { Result } from '@isl-lang/runtime';
//
// import { helper } from './utils.js';
```

### Type Sorting

```typescript
import { topologicalSortTypes } from '@isl-lang/codegen-core';

const types = [
  { name: 'UserResponse', dependencies: ['User'], kind: 'interface', declarationOrder: 1 },
  { name: 'User', dependencies: ['UUID'], kind: 'interface', declarationOrder: 0 },
  { name: 'UUID', dependencies: [], kind: 'utility', declarationOrder: 2 },
];

const sorted = topologicalSortTypes(types, { groupByKind: true });
// Result: ['UUID', 'User', 'UserResponse'] (dependencies first)
```

### Code Printer

```typescript
import { createPrinter, generateHeader } from '@isl-lang/codegen-core';

const printer = createPrinter();

// Add header
printer.writeLine(generateHeader({
  generator: '@isl-lang/codegen-types',
  version: '1.0.0',
  sourcePath: 'domain/auth.isl',
}));
printer.blankLine();

// Generate code
printer.writeLine('export interface User {');
printer.indent();
printer.writeLine('id: string;');
printer.writeLine('email: string;');
printer.dedent();
printer.writeLine('}');

console.log(printer.toString());
```

### Content Hashing

```typescript
import { hashContent } from '@isl-lang/codegen-core';

const hash = hashContent('export interface User { id: string; }');
// => "a1b2c3d4"
```

### String Utilities

```typescript
import {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toScreamingSnakeCase,
} from '@isl-lang/codegen-core';

toPascalCase('user_profile');       // => 'UserProfile'
toCamelCase('user_profile');        // => 'userProfile'
toKebabCase('UserProfile');         // => 'user-profile'
toSnakeCase('UserProfile');         // => 'user_profile'
toScreamingSnakeCase('userProfile'); // => 'USER_PROFILE'
```

## Design Principles

### 1. Determinism First

Every function produces identical output for identical input:
- No timestamps in output
- No random identifiers
- Sorted collections
- Consistent formatting

### 2. Stable Ordering

All collections follow deterministic ordering:
- Imports: grouped by type, then alphabetical
- Types: topological sort, then alphabetical
- Properties: id first, required before optional, then alphabetical

### 3. Minimal Diffs

Regenerating code produces zero diff:
- Same input = same output
- Input order doesn't affect output order
- Content hashes for change detection

## API Reference

### Sorting

- `sortImports(imports, config?)` - Sort imports by group and alphabetically
- `topologicalSortTypes(types, config?)` - Sort types by dependencies
- `sortProperties(props, options?)` - Sort object properties
- `deduplicateImports(imports)` - Merge duplicate imports

### Formatting

- `formatCode(code, language, config?)` - Format code with Prettier
- `formatCodeSync(code, language, config?)` - Synchronous formatting
- `formatImports(imports, options?)` - Format imports to code string
- `generateHeader(config)` - Generate file header
- `generateSectionComment(title)` - Generate section divider

### Utilities

- `createPrinter(config?)` - Create code printer
- `hashContent(content, length?)` - Generate content hash
- `classifyImport(specifier, config?)` - Classify import group

## Testing

```bash
# Run tests
pnpm test

# Update snapshots
pnpm test:snapshot
```

## License

MIT
