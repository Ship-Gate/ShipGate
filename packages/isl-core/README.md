# @isl-lang/isl-core

The "thin waist" API for the Intent Specification Language (ISL). This package provides the essential compiler flow for parsing, checking, formatting, linting, and verifying ISL specifications.

## What's Included

### Core APIs (Stable)

| Module | Export | Description |
|--------|--------|-------------|
| **Parse** | `parseISL()` | Parse ISL source code into an AST |
| **Check** | `check()` | Type check and semantic analysis |
| **Format** | `format()`, `fmt()` | Pretty-print AST back to source |
| **Lint** | `lint()` | Style and best-practice checks |
| **Compile** | `compile()` | Full compilation pipeline |

### Additional APIs (Stable)

| Module | Export | Description |
|--------|--------|-------------|
| **Imports** | `resolveImports()` | Import resolution between ISL files |
| **Verification** | `verification.*` | Verify implementations against specs |

### Experimental APIs

| Module | Export | Description |
|--------|--------|-------------|
| **TestGen** | `testgen.*` | Generate tests from specifications |

> **Note**: Experimental APIs may change in minor versions. Stable APIs follow semver.

## Installation

```bash
npm install @isl-lang/isl-core
# or
pnpm add @isl-lang/isl-core
```

## Quick Usage

### Parse ISL Source

```typescript
import { parseISL } from '@isl-lang/isl-core';

const source = `
domain MyDomain {
  entity User {
    id: UUID
    email: String
  }
}
`;

const result = parseISL(source);

if (result.errors.length > 0) {
  console.error('Parse errors:', result.errors);
} else {
  console.log('AST:', result.ast);
}
```

### Full Compilation Pipeline

```typescript
import { compile } from '@isl-lang/isl-core';

const result = compile(source, {
  check: { strict: true },
  lint: { rules: { 'naming/entity-pascal-case': true } },
});

console.log('Success:', result.success);
console.log('Diagnostics:', result.check?.diagnostics);
console.log('Lint messages:', result.lint?.messages);
console.log('Formatted:\n', result.formatted);
```

### Type Checking Only

```typescript
import { parseISL, check } from '@isl-lang/isl-core';

const { ast } = parseISL(source);
if (ast) {
  const checkResult = check(ast, { strict: true });
  
  for (const diag of checkResult.diagnostics) {
    console.log(`${diag.severity}: ${diag.message}`);
  }
}
```

### Formatting

```typescript
import { parseISL, format } from '@isl-lang/isl-core';

const { ast } = parseISL(source);
if (ast) {
  const formatted = format(ast, {
    indent: '  ',
    maxWidth: 80,
    sortDeclarations: true,
  });
  console.log(formatted);
}
```

### Linting

```typescript
import { parseISL, lint, getRules } from '@isl-lang/isl-core';

// See available rules
console.log(getRules());

const { ast } = parseISL(source);
if (ast) {
  const result = lint(ast, {
    rules: {
      'best-practice/require-description': true,
      'naming/field-camel-case': true,
    },
  });
  
  for (const msg of result.messages) {
    console.log(`[${msg.ruleId}] ${msg.message}`);
  }
}
```

### Verification

```typescript
import { verification } from '@isl-lang/isl-core';

const sourceCode = `
// @isl-bindings
// CreateUser.pre.1 -> guard at L15
// @end-isl-bindings

function createUser(input) {
  if (!input.email.includes('@')) {  // L15
    throw new Error('Invalid email');
  }
  // ...
}
`;

const result = verification.verify(sourceCode, {
  clauses: [
    { id: 'CreateUser.pre.1', type: 'precondition', expression: 'email.contains("@")' },
  ],
});

console.log(verification.formatVerificationSummary(result));
```

### Test Generation (Experimental)

```typescript
import { parseISL, testgen } from '@isl-lang/isl-core';

const { ast } = parseISL(source);
if (ast) {
  const suite = testgen.generateTests(ast, {
    framework: 'vitest',
    includeBoundary: true,
    includeErrors: true,
  });
  
  for (const test of suite.tests) {
    console.log(`${test.category}: ${test.name}`);
  }
}
```

## Subpath Exports

For tree-shaking, you can import specific modules:

```typescript
import { check } from '@isl-lang/isl-core/check';
import { format } from '@isl-lang/isl-core/fmt';
import { lint } from '@isl-lang/isl-core/lint';
import { resolveImports } from '@isl-lang/isl-core/imports';
import { verify } from '@isl-lang/isl-core/verification';
import { generateTests } from '@isl-lang/isl-core/testgen';
```

## API Reference

### `parseISL(source: string, filename?: string): ParseResult`

Parse ISL source code into an AST.

### `compile(source: string, options?): CompileResult`

Run the full compilation pipeline (parse → check → lint → format).

### `check(ast: DomainDeclaration, options?): CheckResult`

Type check and semantic analysis.

Options:
- `allowUndefinedTypes`: Allow undefined type references
- `strict`: Treat warnings as errors

### `format(ast: DomainDeclaration, options?): string`

Format AST back to source code.

Options:
- `indent`: Indentation string (default: 2 spaces)
- `maxWidth`: Maximum line width (default: 80)
- `sortDeclarations`: Sort declarations alphabetically

### `lint(ast: DomainDeclaration, options?): LintResult`

Check for style and best-practice issues.

Options:
- `rules`: Enable/disable specific rules
- `severities`: Override rule severities

### `verification.verify(sourceCode: string, spec: SpecInfo, options?): VerificationResult`

Verify implementation code against ISL specification.

### `testgen.generateTests(ast: DomainDeclaration, options?): TestSuite`

Generate test cases from behavior specifications.

## Version Information

```typescript
import { VERSION, API_VERSION } from '@isl-lang/isl-core';

console.log(`Version: ${VERSION}`);  // "0.1.0"
console.log(`API Version: ${API_VERSION}`);  // 1
```

## License

MIT
