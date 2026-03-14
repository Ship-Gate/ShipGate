# ShipGate Error Catalog

> Auto-generated reference for all ShipGate error codes.
> When you see an error code (e.g. `E0100`), find it here for the explanation, causes, and fix.

## Error Code Ranges

| Range | Category | Description |
|-------|----------|-------------|
| E0001-E0099 | Lexer | Tokenization errors in ISL files |
| E0100-E0199 | Parser | Syntax errors in ISL specs |
| E0200-E0299 | Type System | Type checking errors |
| E0300-E0399 | Semantic | Semantic analysis errors |
| E0400-E0499 | Evaluator | Runtime evaluation errors |
| E0500-E0599 | Verifier | Verification pipeline errors |
| E0600-E0699 | Config | Configuration and setup errors |
| E0700-E0712 | I/O | File system and module resolution errors |

---

## Lexer Errors (E0001-E0099)

### E0001 — Unexpected character

**What it means:** The ISL lexer encountered a character it doesn't recognize.

**Common causes:**
- Using unsupported Unicode characters in identifiers
- Copy-pasting code from a rich text editor (smart quotes, em dashes)
- Encoding issues in the .isl file

**Fix:** Check the file encoding (should be UTF-8) and remove any non-ASCII characters from identifiers.

### E0002 — Unterminated string literal

**What it means:** A string was opened with `"` but never closed.

**Fix:** Add the closing `"` to the string literal. Check for line breaks inside the string.

---

## Parser Errors (E0100-E0199)

### E0100 — Expected keyword

**What it means:** The parser expected a keyword (like `domain`, `behavior`, `preconditions`) but found something else.

**Common causes:**
- Misspelled keyword
- Missing `{` before a block
- Incorrect indentation (ISL is not indentation-sensitive, but it's a common confusion)

**Fix:** Check spelling and ensure the block structure follows ISL syntax:

```isl
domain MyService {
  behavior MyAction {
    preconditions { ... }
    postconditions { ... }
  }
}
```

### E0101 — Unexpected token

**What it means:** The parser found a token that doesn't belong in its current context.

### E0102 — Missing closing brace

**What it means:** A `{` was opened but never closed with `}`.

**Fix:** Count your braces. Use an editor with bracket matching. The VS Code extension highlights matching braces.

### E0103 — Invalid type annotation

**What it means:** A type annotation in a behavior, entity, or parameter is not valid.

---

## Type Errors (E0200-E0299)

### E0200 — Type mismatch

**What it means:** An expression's type doesn't match what's expected.

**Example:**
```isl
preconditions { input.amount > "hello" }  // E0200: cannot compare number with string
```

### E0201 — Unknown type

**What it means:** A type referenced in the spec doesn't exist.

**Fix:** Define the type or import it from the standard library.

### E0202 — Property not found

**What it means:** Accessing a property that doesn't exist on the given type.

### E0203 — Incompatible return type

**What it means:** A behavior's postcondition references a return type that doesn't match.

---

## Semantic Errors (E0300-E0399)

### E0300 — Duplicate identifier

**What it means:** Two domains, behaviors, or entities have the same name in the same scope.

### E0301 — Undefined reference

**What it means:** A reference to a domain, behavior, or entity that hasn't been defined.

### E0302 — Circular dependency

**What it means:** Two or more specs reference each other in a cycle.

### E0303 — Invalid precondition

**What it means:** A precondition expression is not a valid boolean constraint.

### E0304 — Invalid postcondition

**What it means:** A postcondition expression references variables or functions that don't exist.

---

## Evaluator Errors (E0400-E0499)

### E0400 — Evaluation failed

**What it means:** A postcondition or invariant could not be evaluated against the implementation.

**Common causes:**
- The implementation function doesn't exist
- The function signature doesn't match the spec
- Runtime error during evaluation

### E0401 — Postcondition violation

**What it means:** The implementation returned a result that violates a postcondition.

### E0402 — Precondition violation

**What it means:** A precondition check failed — the input doesn't satisfy the required constraints.

### E0403 — Invariant violation

**What it means:** A class or module invariant was violated.

---

## Verifier Errors (E0500-E0599)

### E0500 — Verification timeout

**What it means:** The verifier took too long to check a spec. Default timeout is 30 seconds.

**Fix:** Use `--timeout <ms>` to increase, or simplify complex postconditions.

### E0501 — Spec-impl mismatch

**What it means:** The ISL spec describes a behavior that can't be matched to any implementation function.

### E0502 — Missing implementation

**What it means:** A behavior defined in the spec has no matching implementation file.

### E0503 — Gate blocked

**What it means:** The gate produced a NO_SHIP verdict. Check the violations list for details.

---

## Config Errors (E0600-E0699)

### E0600 — Invalid configuration

**What it means:** The `.shipgate.yml` file has invalid syntax or unknown fields.

**Fix:** Validate against the JSON Schema: `shipgate.schema.json` at the repo root.

### E0601 — Missing required field

**What it means:** A required configuration field is missing.

### E0602 — Invalid threshold

**What it means:** The trust score threshold is outside the valid range (0-100).

---

## I/O Errors (E0700-E0712)

### E0700 — File not found

**What it means:** A referenced file doesn't exist.

### E0701 — Permission denied

**What it means:** ShipGate doesn't have permission to read a file.

### E0702 — Module resolution failed

**What it means:** An import in the implementation couldn't be resolved.

**Common causes:**
- Missing `node_modules` (run `npm install`)
- Wrong import path
- Package not in `package.json`

### E0703 — Binary file skipped

**What it means:** ShipGate skipped a binary file during scanning. This is expected.

---

## Getting Help

If you encounter an error not listed here:

```bash
shipgate --help
```

Or file an issue at [github.com/Ship-Gate/ShipGate/issues](https://github.com/Ship-Gate/ShipGate/issues).
