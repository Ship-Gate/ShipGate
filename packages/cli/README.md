# ShipGate CLI v3.0.0

[![npm version](https://badge.fury.io/js/shipgate.svg)](https://badge.fury.io/js/shipgate)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/shipgate)](https://www.npmjs.com/package/shipgate)

> **Stop AI from shipping fake features. Define what your code must do. We enforce it.**

ShipGate is a behavioral CI gate for AI-generated code. It uses ISL (Intent Specification Language) to define what your code *must* do — preconditions, postconditions, invariants — and verifies the implementation matches.

```
Your intent (NL or ISL)  →  Behavioral contract  →  SHIP or NO_SHIP
                                                      with evidence
```

---

## Quick Start

```bash
npm install -g shipgate

# One command — detect, init, infer ISL, verify, gate:
shipgate go

# Or from natural language to verified code:
shipgate vibe "build a todo API with auth and JWT"
```

---

## Commands

### Core Workflows

| Command | What it does |
|---------|-------------|
| `shipgate go [path]` | **One command to rule them all.** Detect project, init ShipGate, infer ISL specs, verify, gate. |
| `shipgate go --fix` | Go + auto-heal violations |
| `shipgate go --deep` | Go with thorough scan and higher coverage target |
| `shipgate vibe "<prompt>"` | NL prompt → ISL spec → full-stack code → verify → SHIP/NO_SHIP |
| `shipgate vibe "<prompt>" --lang python` | Vibe in Python (also: `rust`, `go`, `typescript`) |
| `shipgate scan <path>` | Scan any codebase, AI-generate ISL specs, produce coverage report + gate verdict |

### Verification

| Command | What it does |
|---------|-------------|
| `shipgate verify <path>` | Verify implementation against ISL specs. Detailed results + evidence bundle |
| `shipgate gate <spec> --impl <path>` | Binary SHIP/NO_SHIP verdict. Use in CI with `--ci` |
| `shipgate check <files...>` | Parse and type-check ISL files |
| `shipgate heal <path>` | AI-powered auto-fix for spec violations |

### Code Generation

| Command | Target |
|---------|--------|
| `shipgate gen ts <file.isl>` | TypeScript types, interfaces, validators |
| `shipgate gen python <file.isl>` | Python Pydantic models, pytest tests |
| `shipgate gen rust <file.isl>` | Rust structs, traits, Serde derives |
| `shipgate gen go <file.isl>` | Go structs, interfaces |
| `shipgate gen graphql <file.isl>` | GraphQL schema |
| `shipgate gen openapi <file.isl>` | OpenAPI 3.0 specification |

### Analysis & Compliance

| Command | What it does |
|---------|-------------|
| `shipgate policy list` | Show all 27 policy rules with severity and remediation |
| `shipgate trust-score` | Detailed trust breakdown |
| `shipgate coverage` | Spec coverage per file |
| `shipgate drift` | Code vs spec divergence detection |
| `shipgate security-report` | Secrets, auth gaps, injection risks |
| `shipgate compliance soc2` | SOC 2 compliance audit |

### Utilities

| Command | What it does |
|---------|-------------|
| `shipgate init [name]` | Scaffold `.shipgate.yml`, specs dir, CI workflow |
| `shipgate fmt <path>` | Auto-format ISL files |
| `shipgate lint <path>` | Lint ISL files for errors |
| `shipgate repl` | Interactive ISL shell |
| `shipgate proof badge <bundle>` | Generate SHIP/NO_SHIP badge SVG |
| `shipgate proof attest <bundle>` | SLSA-style attestation JSON |
| `shipgate proof comment <bundle>` | GitHub PR comment from proof bundle |

---

## The `go` Command

The fastest way to gate any project. One command, zero configuration:

```bash
shipgate go
```

**Pipeline:**

```
detect → init → infer ISL → truthpack → verify → gate → report
```

1. **Detect** — identifies your stack (TypeScript, Python, Rust, Go, or mixed)
2. **Init** — creates `.shipgate.yml` and directory structure if missing
3. **Infer** — AI-generates ISL specs from your source code using `spec-assist`
4. **Truthpack** — extracts routes, env vars, auth rules from your codebase
5. **Verify** — checks code against the inferred specs
6. **Gate** — SHIP / WARN / NO_SHIP with a coverage score
7. **Report** — formatted output with next steps

```bash
shipgate go .              # Scan current dir
shipgate go ./my-project   # Scan target dir
shipgate go --fix          # Auto-heal violations after scan
shipgate go --deep         # Thorough scan, higher coverage target
shipgate go --provider openai --model gpt-4o  # Custom AI provider
```

---

## The Vibe Pipeline

Go from an English description to verified, production-ready code:

```bash
shipgate vibe "build a todo app with auth and Stripe payments"
```

**Pipeline:**

```
NL prompt → ISL spec → validate → generate code → verify → heal → SHIP
```

Supports multiple languages:

```bash
shipgate vibe "REST API for user management" --lang typescript  # default
shipgate vibe "REST API for user management" --lang python      # FastAPI + pytest
shipgate vibe "REST API for user management" --lang rust        # Axum + cargo
shipgate vibe "REST API for user management" --lang go          # Gin + go test
```

---

## Multi-Language Codegen

Generate code from ISL specs in 6 languages:

```bash
shipgate gen ts auth.isl         # TypeScript
shipgate gen python auth.isl     # Python (Pydantic, pytest, type stubs)
shipgate gen rust auth.isl       # Rust (Serde, traits, validation)
shipgate gen go auth.isl         # Go (structs, interfaces)
shipgate gen graphql auth.isl    # GraphQL schema
shipgate gen openapi auth.isl    # OpenAPI 3.0 YAML
```

---

## ISL in 60 Seconds

ISL (Intent Specification Language) defines *what your code must do* — not how:

```isl
domain PaymentService {
  entity Payment {
    id: UUID [immutable, unique]
    amount: Decimal [positive]
    status: PaymentStatus

    invariants {
      amount > 0
      status in ["pending", "completed", "failed"]
    }
  }

  behavior ChargeCard {
    input { cardToken: String, amount: Decimal, currency: String }
    output {
      success: { paymentId: UUID }
      errors { CARD_DECLINED, INSUFFICIENT_FUNDS }
    }

    preconditions {
      input.amount > 0
      input.currency.length == 3
    }

    postconditions {
      success implies Payment.exists({ id: result.paymentId, status: "completed" })
    }
  }
}
```

---

## CI Integration

Add to any GitHub Actions workflow:

```yaml
- name: ShipGate
  run: |
    npx shipgate go . --ci
```

Or the full workflow:

```yaml
- name: ShipGate Verify
  run: |
    npx shipgate verify . --ci --format github
    npx shipgate gate specs/ --impl src/ --ci
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key for AI features (spec inference, vibe, heal) |
| `OPENAI_API_KEY` | OpenAI API key (alternative to Anthropic) |
| `ISL_CONFIG` | Path to config file |
| `ISL_DEBUG` | Enable debug output |
| `ISL_NO_COLOR` | Disable colored output |

The CLI auto-detects which AI provider to use based on available API keys. Anthropic is preferred when both are set.

---

## Project Structure

```
.shipgate.yml            # Config: thresholds, ignore patterns, AI provider
.shipgate/
  specs/                 # ISL specifications
  evidence/              # Evidence bundles per verification run
  truthpack/             # Auto-extracted routes, env vars, auth rules
```

---

## Links

- [Documentation](https://shipgate.dev/docs)
- [ISL Reference](https://shipgate.dev/docs/isl)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=shipgate.shipgate-isl)
- [GitHub](https://github.com/Ship-Gate/ShipGate)
- [npm](https://www.npmjs.com/package/shipgate)

## License

MIT
