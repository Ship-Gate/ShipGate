---
title: "CLI: check"
description: Parse and type-check ISL files with semantic analysis.
---

The `check` command parses and type-checks ISL specification files. It validates syntax, resolves types and imports, and runs semantic passes (symbol resolution, purity constraints, import graph). Use it after writing or editing specs to catch errors before generating code or running verification.

## Usage

```bash
shipgate check [files...] [options]
```

If no files are given, the CLI uses your config (e.g. from `.shipgate.yml`) or default globs to find ISL files.

## Options

| Flag | Description |
| ---- | ----------- |
| `-w, --watch` | Watch for changes and re-run check |
| `--debug` | Print resolved imports debug info |
| `--config <path>` | Path to config file (default: auto-detect `.shipgate.yml`) |
| `--verbose` | Verbose output |
| `--format <format>` | Output format: `pretty`, `json`, `quiet` |

## Examples

### Check one or more files

```bash
# Single file
shipgate check user-service.isl

# Multiple files
shipgate check specs/auth.isl specs/payment.isl

# All specs in a directory
shipgate check specs/
```

### Watch mode

```bash
shipgate check specs/ --watch
```

### JSON output

```bash
shipgate check user-service.isl --format json
```

## Output

### Success (pretty)

```
✓ Parsed successfully
✓ Type checking passed
✓ 1 domain, 1 entity, 1 behavior found
```

### Errors

When type or semantic errors are found, the command prints diagnostics and exits with code `1`. Fix the reported issues and run `check` again.

## Exit codes

| Code | Meaning |
| ---- | ------- |
| `0` | Success — all files passed |
| `1` | ISL errors — parse or type-check failed |
| `2` | Usage error |
| `3` | Internal error |

## See also

- [Quick Start](/getting-started/quickstart/) — uses `shipgate check` in step 3
- [CLI: gate](/cli/gate/) — SHIP/NO_SHIP verdict after verification
- [CLI: verify](/cli/verify/) — verify implementation against specs
