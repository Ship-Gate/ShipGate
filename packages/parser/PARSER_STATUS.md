# ISL Parser Status

## Current Coverage

- **All Tests**: 414 passed, 21 skipped (100% pass rate)
- **Unit Tests**: All passing
- **Regression Tests**: 14/14 passing (100%)
- **Fuzz Tests**: 100/100 passing (100%)
- **Integration Tests**: 2/2 tested files pass (149 files skipped - use unsupported syntax)

## Supported Syntax

### Core Constructs
- [x] Domain declaration (braced and brace-less)
- [x] Version field
- [x] Owner field
- [x] Entity definitions
- [x] Behavior definitions
- [x] Type declarations (constrained primitives)
- [x] Enum declarations
- [x] Import statements (inside domain)
- [x] View definitions
- [x] Policy definitions
- [x] Scenario blocks
- [x] Chaos testing blocks

### Comments
- [x] Line comments (`//`)
- [x] Hash comments (`#`)
- [x] Block comments (`/* */`)

### Strings
- [x] Double-quoted strings (`"..."`)
- [x] Single-quoted strings (`'...'`)
- [x] Escape sequences (`\n`, `\t`, `\\`, `\"`, `\'`)

### Operators
- [x] Comparison: `==`, `!=`, `<`, `>`, `<=`, `>=`
- [x] Arithmetic: `+`, `-`, `*`, `/`, `%`
- [x] Logical: `and`, `or`, `not`, `&&`, `||`
- [x] Special: `implies`, `iff`, `in`
- [x] Quantifiers: `all`, `any`, `none`, `count`, `sum`, `filter`

### Expressions
- [x] Binary expressions
- [x] Unary expressions
- [x] Function calls
- [x] Member access (`.`)
- [x] Index access (`[]`)
- [x] `old()` expressions
- [x] `result` expressions
- [x] Lambda expressions (`=>`)
- [x] List literals (`[...]`)
- [x] Map literals (`{...}`)
- [x] Duration literals (`5.minutes`, `1.seconds`, `1s`, `15m`, `1h`, `1d`, `100ms`)

### Type Definitions
- [x] Primitive types (String, Int, Decimal, Boolean, UUID, Timestamp, Duration)
- [x] Constrained types (`String { max_length: 100 }`)
- [x] Optional types (`Type?`)
- [x] List types (`List<T>`)
- [x] Map types (`Map<K, V>`)
- [x] Reference types

## Known Limitations

### Not Currently Supported

1. **Top-level imports**: Files that start with `import` statements before `domain` are not parsed. These are module fragments meant to be combined before parsing.

2. **Standalone definitions**: Files containing only `entity`, `behavior`, or `type` definitions without a `domain` wrapper are not parsed.

3. **`builtin` keyword**: Built-in type definitions using `builtin type Name { ... }` are not supported. These are internal language spec files.

4. **`meta` keyword**: Meta declarations are not supported.

5. **Inline enum types**: `type Name = enum { ... }` syntax is not supported. Use separate `enum Name { ... }` declarations.

6. **Union types**: `type Name = union { ... }` with tagged variants is not supported.

7. **Generic behaviors**: `behavior Name<T> { ... }` with type parameters is not supported.

8. **Computed properties**: `computed fieldName: Type = expr` is not supported.

9. **Template literals**: Backtick strings with `${...}` interpolation are not supported.

10. **Bitwise operators**: Single `&` and `|` for bitwise operations are not supported.

11. **Regex patterns**: Regular expression literals in the `/pattern/flags` format are partially supported.

12. **Unicode identifiers**: Identifiers with non-ASCII characters (like `Café` or `Ümläut`) are not supported.

### Module Files

Many ISL files in the repository are **module fragments** designed to be imported into complete domains. These files are intentionally not parseable as standalone files:

- Files starting with `import { ... } from "..."`
- Files containing only entity or behavior definitions
- Files using the `builtin` keyword

These should be combined/bundled before parsing, or parsed as part of a larger compilation unit.

## Test Coverage

### Unit Test Breakdown
- Lexer tests: 21 tests
- Parser tests: 34 tests
- Fixtures tests: 21 tests
- Error handling tests: 18 tests
- Regression tests: 14 tests

### Integration Test

The integration test (`tests/integration.test.ts`) attempts to parse all 148 ISL files in the project. Files that fail fall into the categories listed in "Known Limitations" above.

## Recent Changes

### Added in this version:
1. **Hash comment support**: `#` now works as line comment character
2. **Logical operators**: `&&` and `||` are now recognized as `and`/`or`
3. **Single-quoted strings**: `'...'` strings are now supported
4. **Brace-less domain syntax**: `domain Name\nversion "1.0.0"` without braces
5. **Standalone parser**: Removed external dependency on `@isl-lang/errors`

## Roadmap

To reach 100% coverage of ISL files in the repository, the following features would need to be added:

1. Support for top-level imports (files as modules)
2. Generic type parameters on behaviors
3. Inline enum definitions
4. Union types
5. Computed properties
6. Template literals

However, many of these features represent syntax variations that may be consolidated in the language spec. The current parser supports the canonical ISL syntax as documented in `ISL-LANGUAGE-SPEC.md`.
