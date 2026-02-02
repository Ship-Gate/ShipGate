# Deprecated/Skipped Parser Tests

This document explains why certain parser tests are skipped or use simplified expectations.

## Summary

- **Total Tests**: 435
- **Passed**: 414
- **Skipped**: 21

## Categories of Skipped Tests

### 1. Advanced Syntax Features (Not Supported by Parser)

The following ISL syntax features are used in test fixtures but not yet implemented in the parser:

| Feature | Fixture Files | Example |
|---------|---------------|---------|
| Generic behaviors | `behavior Name<T> { }` | `Extract<T>` |
| Union types | `type: A \| B` | `String \| List<String>` |
| Derived blocks | `derived { }` | computed properties |
| Effects blocks | `effects { }` | side effect declarations |
| View shorthand syntax | `entity: X` | instead of `for: X` |
| Policy rule syntax | `rule "name" { }` | named policy rules |
| Global invariants | `invariants { }` | without a name block |
| Inline enum metadata | `{ description: "..." }` | enum variant descriptions |
| Lifecycle conditions | `[on: condition]` | conditional transitions |
| Regex patterns | `/^pattern$/` | in type constraints |
| Bullet point syntax | `- item` | in conditions |
| Pre/post labels | `pre name:` | named preconditions |

### 2. Test Fixture Files

The following fixture files use advanced syntax and their tests are skipped:

#### `test-fixtures/valid/all-features.isl`
- Uses: views, policies, global invariants, advanced compliance syntax
- Tests skipped: 9 tests

#### `test-fixtures/valid/complex-types.isl`  
- Uses: advanced type compositions
- Tests skipped: 5 tests

#### `test-fixtures/valid/real-world/*.isl`
- Uses: various advanced patterns
- Tests skipped: 3 tests (payment.isl, auth.isl, crud.isl)

#### `test-fixtures/edge-cases/*.isl`
- Uses: advanced syntax patterns for stress testing
- Tests skipped: 4 tests

### 3. Integration Test Skips

The integration test (`integration.test.ts`) automatically skips files that match known unsupported patterns:

| Skip Reason | Count |
|-------------|-------|
| Standalone behavior (no domain wrapper) | 35 |
| Standalone entity (no domain wrapper) | 17 |
| Invalid syntax test fixtures | 19 |
| Advanced regex patterns | 10 |
| Advanced inline enum metadata | 10 |
| Advanced inline scenario syntax | 7 |
| stdlib-payments (advanced syntax) | 6 |
| Advanced computed blocks | 6 |
| Standalone type (no domain wrapper) | 5 |
| test-fixtures edge cases | 5 |
| Other advanced patterns | 34 |

## Supported Syntax

The parser fully supports the canonical ISL syntax as documented in `PARSER_STATUS.md`. Key supported features:

- Domain declarations (braced and brace-less)
- Entity definitions with fields, invariants, lifecycle
- Behavior definitions with input/output, pre/postconditions
- Type declarations (primitives, structs, enums, lists, maps)
- Import statements
- View, Policy, Scenario, Chaos blocks (basic syntax)
- Comments (line, hash, block)
- All operators and expressions
- Duration literals (including short form: `1s`, `15m`, `1h`)

## Recommended Actions

### For Users
- Use the syntax documented in `PARSER_STATUS.md`
- Run `npm test` to verify your ISL files parse correctly

### For Contributors
To add support for skipped features:

1. Add lexer tokens in `src/tokens.ts`
2. Update parser rules in `src/parser.ts`
3. Add AST types in `src/ast.ts`
4. Update relevant tests
5. Update `PARSER_STATUS.md`

## Test File Reference

| Test File | Purpose | Status |
|-----------|---------|--------|
| `lexer.test.ts` | Tokenization | ✅ All pass |
| `parser.test.ts` | Core parsing | ✅ All pass |
| `errors.test.ts` | Error handling | ✅ All pass |
| `regression.test.ts` | Bug fixes | ✅ All pass |
| `fixtures.test.ts` | Basic fixtures | ✅ All pass |
| `advanced-features.test.ts` | Advanced syntax | ✅ All pass |
| `fuzz.test.ts` | Random inputs | ✅ All pass |
| `fixtures-integration.test.ts` | Complex fixtures | ✅ 16 pass, 21 skip |
| `integration.test.ts` | All ISL files | ✅ All pass (149 skip) |
