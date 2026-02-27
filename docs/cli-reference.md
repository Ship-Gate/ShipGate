# CLI Reference

All commands use the `shipgate` binary (or `npx shipgate`).

Global options available on every command:

| Flag | Description |
|------|-------------|
| `--verbose` | Show detailed output |
| `--format <fmt>` | Output format: `pretty` (default), `json`, `quiet` |
| `--help` | Show command help |
| `--version` | Show version |

---

## shipgate init

Scaffold a new shipgate project. Creates config, specs directory, evidence directory, and CI workflow.

```bash
shipgate init                      # Interactive prompts
shipgate init --yes                # Skip prompts, use defaults
shipgate init --template full      # Full template with examples
shipgate init --from-code src/     # Generate specs from existing code
```

| Flag | Description |
|------|-------------|
| `--yes, -y` | Skip prompts, use sensible defaults |
| `--template <t>` | Template: `minimal`, `full`, `api` |
| `--directory <dir>` | Target directory |
| `--force` | Overwrite existing shipgate files |
| `--from-code <path>` | Generate ISL specs from existing source code |
| `--skip-git` | Skip git initialization |

---

## shipgate verify

Verify implementation against ISL specs. Produces detailed results with per-file scores, violation lists, and an evidence bundle.

```bash
shipgate verify src/                           # Verify all files in src/
shipgate verify . --ci                         # CI mode (exit codes, no spinners)
shipgate verify . --fail-on warning            # Fail on warnings too
shipgate verify . --format json > report.json  # JSON output
shipgate verify . --min-score 80               # Fail if score < 80
```

| Flag | Description |
|------|-------------|
| `--ci` | CI mode: deterministic output, exit codes only |
| `--fail-on <level>` | Fail on: `error` (default), `warning`, `noship` |
| `--format <fmt>` | Output: `pretty`, `json`, `github`, `gitlab`, `junit`, `sarif` |
| `--min-score <n>` | Minimum Ship Score to pass (0–100) |
| `--detailed` | Show per-file breakdown |

Exit codes:
- `0` — SHIP or WARN (depending on `--fail-on`)
- `1` — NO_SHIP

---

## shipgate gate

Binary SHIP/NO_SHIP decision. Runs verification + policy checks. Use in CI to block merges.

```bash
shipgate gate specs/auth.isl --impl src/       # Gate against a spec
shipgate gate specs/ --impl src/ --ci          # CI mode
shipgate gate specs/ --impl src/ --threshold 90  # Custom threshold
```

| Flag | Description |
|------|-------------|
| `--impl, -i <path>` | Path to implementation (required) |
| `--threshold <n>` | Minimum trust score to SHIP (default: 95) |
| `--ci` | CI mode |
| `--proof-output <path>` | Write proof bundle to path |
| `--proof-format <fmt>` | Proof format: `json`, `md` |
| `--skip-policy` | Skip policy checks |

Exit codes:
- `0` — SHIP
- `1` — NO_SHIP

---

## shipgate vibe

The full pipeline: natural language → ISL spec → code generation → verification → verdict.

```bash
shipgate vibe "build a todo API with auth"
shipgate vibe "REST API for blog posts" --framework express
shipgate vibe "payment system" --lang python
shipgate vibe --from-spec specs/auth.isl       # Skip NL→ISL
shipgate vibe "todo app" --dry-run              # Show manifest, don't write
```

| Flag | Description |
|------|-------------|
| `--lang <language>` | Target: `typescript` (default), `python`, `rust`, `go` |
| `--framework <fw>` | Backend: `nextjs` (default), `express`, `fastify` |
| `--db <db>` | Database: `sqlite` (default), `postgres`, `none` |
| `--output, -o <dir>` | Output directory |
| `--from-spec <file>` | Skip NL→ISL, use existing ISL file |
| `--dry-run` | Generate plan and manifest without writing files |
| `--provider <p>` | AI provider: `anthropic` (default), `openai` |
| `--model <m>` | AI model override |
| `--max-iterations <n>` | Max heal loop iterations (default: 3) |
| `--max-tokens <n>` | Token budget (default: 100000) |
| `--no-frontend` | Skip frontend generation |
| `--no-tests` | Skip test generation |
| `--no-parallel` | Disable parallel codegen |
| `--no-cache` | Skip cache lookup |
| `--resume` | Resume from last checkpoint |

---

## shipgate scan

Scan an existing codebase. Walks source files, generates ISL specs via AI, runs Truthpack extraction, cross-references coverage, and gates.

```bash
shipgate scan .                              # Scan current directory
shipgate scan ./my-project                   # Scan specific path
shipgate scan . --min-coverage 80            # Fail if coverage < 80%
shipgate scan . --include ts,py              # Only TypeScript and Python
shipgate scan . --format json                # JSON output
```

| Flag | Description |
|------|-------------|
| `--include <exts>` | Comma-separated extensions to include (e.g., `ts,py,go`) |
| `--min-coverage <n>` | Minimum spec coverage (0–100). NO_SHIP if below |
| `--provider <p>` | AI provider for spec generation |
| `--model <m>` | AI model override |

Output: `.shipgate/specs/auto-generated.isl`, updated Truthpack, coverage report, verdict.

---

## shipgate policy list

Show all registered policy rules with severity, description, and remediation hints.

```bash
shipgate policy list                    # Show all rules
shipgate policy list --category auth    # Filter by category
shipgate policy list --json             # JSON output
```

| Flag | Description |
|------|-------------|
| `--category <cat>` | Filter: `auth`, `secrets`, `pii`, `truthpack`, `rate-limit`, `cors`, `validation`, `errors`, `contract` |
| `--json` | Output as JSON |

---

## shipgate open

Open the most recent evidence report in your default browser.

```bash
shipgate open                           # Opens latest report
shipgate open --dir .shipgate/evidence  # Custom evidence directory
```

---

## shipgate check

Parse and type-check ISL files.

```bash
shipgate check src/**/*.isl             # Check all ISL files
shipgate check --strict src/            # Strict mode (warnings → errors)
shipgate check --format json src/       # JSON output
```

| Flag | Description |
|------|-------------|
| `--strict` | Warnings become errors |
| `--format <fmt>` | Output: `pretty`, `json`, `quiet` |

---

## shipgate generate

Generate code from ISL specs (without the full vibe pipeline).

```bash
shipgate generate --target typescript src/
shipgate generate --target python --output ./gen src/
shipgate generate --target openapi src/api.isl
```

| Flag | Description |
|------|-------------|
| `--target, -t <lang>` | Target: `typescript`, `python`, `rust`, `go`, `openapi`, `graphql` |
| `--output, -o <dir>` | Output directory |
| `--watch` | Watch for changes and regenerate |

---

## shipgate parse

Parse an ISL file and display the AST. Useful for debugging specs.

```bash
shipgate parse specs/auth.isl
shipgate parse specs/auth.isl --format json
```

---

## shipgate repl

Interactive ISL shell. Write and validate ISL interactively.

```bash
shipgate repl
```

---

## shipgate watch

Watch for file changes and re-run verification automatically.

```bash
shipgate watch src/
shipgate watch src/ --changed-only
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key for Anthropic Claude (vibe pipeline, scan) |
| `OPENAI_API_KEY` | API key for OpenAI (alternative provider) |
| `SHIPGATE_FAIL_ON` | Default fail-on level for CI (`error`, `warning`) |
| `ISL_DEBUG` | Enable debug output |
| `ISL_NO_COLOR` | Disable colored output |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success (SHIP) |
| `1` | Verification failure (NO_SHIP) |
| `2` | Usage error (bad flags, missing files) |
| `3` | Internal error |
| `4` | Warning (when using `--fail-on warning`) |
