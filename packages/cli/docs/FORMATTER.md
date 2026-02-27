# ISL Formatter

The ISL formatter (`isl fmt`) provides stable, idempotent, and semantics-preserving code formatting for ISL files.

## Features

- **AST-based formatting**: Works directly on the parsed AST, not regex patterns
- **Comment preservation**: Preserves all comments (line, block, and hash comments)
- **Idempotent**: Running the formatter multiple times produces identical output
- **Semantics-preserving**: Formatting preserves the semantic meaning of the code

## Usage

### Format a file

```bash
isl fmt path/to/file.isl
```

### Check formatting without writing

```bash
isl fmt path/to/file.isl --check
```

### Print formatted output without writing

```bash
isl fmt path/to/file.isl --no-write
```

## Formatting Rules

### Indentation

- Uses 2 spaces for indentation
- Indentation increases for nested blocks

### Blank Lines

- One blank line between top-level declarations (entities, behaviors, types)
- No blank lines within blocks

### Comments

- Line comments (`//`) are preserved at their original positions
- Hash comments (`#`) are preserved at their original positions  
- Block comments (`/* */`) are preserved

### Spacing

- Single space around operators
- Single space after keywords
- No trailing whitespace

## Idempotency

The formatter is idempotent, meaning:

```bash
isl fmt file.isl > formatted.isl
isl fmt formatted.isl > formatted2.isl
# formatted.isl and formatted2.isl are identical
```

## AST Equivalence

Formatting preserves semantic meaning:

```bash
isl fmt file.isl > formatted.isl
isl parse file.isl > ast1.json
isl parse formatted.isl > ast2.json
# ast1.json and ast2.json are semantically equivalent
```

## Implementation

The formatter consists of:

1. **Comment Extractor** (`fmt/comments.ts`): Extracts comments from source code
2. **Formatter** (`fmt/formatter.ts`): Formats AST nodes back to source code
3. **CLI Command** (`commands/fmt.ts`): Command-line interface

## Testing

Tests ensure:

- **Idempotency**: `fmt(fmt(x)) == fmt(x)`
- **AST equivalence**: `parse(fmt(x))` produces equivalent AST to `parse(x)`
- **Comment preservation**: All comments are preserved in formatted output

Run tests:

```bash
pnpm test packages/cli/tests/fmt.test.ts
```

## Acceptance Criteria

✅ Formatter works over AST (not regex)  
✅ Formatting preserves comments/docstrings  
✅ Snapshot tests for idempotency  
✅ AST equivalence tests  
✅ CLI flags: `--check` and `--write`  
✅ `isl fmt --check` passes on repo specs and fails on misformatted ones with clear diffs
