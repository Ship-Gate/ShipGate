# Shipgate ISL

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/shipgate.shipgate-isl?label=Marketplace&logo=visual-studio-code&logoColor=white&color=0066b8)](https://marketplace.visualstudio.com/items?itemName=shipgate.shipgate-isl)
[![Open VSX](https://img.shields.io/open-vsx/v/shipgate/shipgate-isl?label=Open%20VSX&color=a60ee5)](https://open-vsx.org/extension/shipgate/shipgate-isl)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**Write what your code must do. Shipgate enforces it.**

AI writes the code. You define the contracts. Shipgate verifies every function, entity, and invariant — catching violations before they reach production, right inside VS Code.

> Design-by-contract for the AI era. No manual test-writing. No runtime surprises.

---

## How It Works

Write a `.isl` spec describing what your code must do. Shipgate verifies the running implementation against it — automatically, on every save.

```isl
domain UserService {
  entity User {
    id: UUID [immutable, unique]
    email: Email [indexed]
    passwordHash: String [secret]

    invariants {
      email.contains("@")
      passwordHash.length >= 60
    }
  }

  behavior RegisterUser {
    input { email: Email, name: String, password: String }
    output {
      success: { user: User }
      errors { EMAIL_EXISTS, WEAK_PASSWORD }
    }

    preconditions {
      not User.exists(email)
      input.password.length >= 8
    }

    postconditions {
      success implies User.exists({ id: result.user.id, email: input.email })
    }

    temporal {
      response within 500ms (p99)
    }
  }
}
```

Shipgate runs this against your TypeScript implementation and produces:

```
✓ SHIP  Trust Score: 94%  Confidence: 100%
  ✓ Preconditions      3/3 passing
  ✓ Postconditions     2/2 passing
  ✓ Invariants         2/2 holding
  ✓ Error cases        2/2 correct
```

If something breaks, violations appear as inline diagnostics — exactly like TypeScript errors.

---

## Features

### ISL Language Support

Full language server integration for `.isl` files — everything you'd expect from a first-class language:

| Capability | Details |
|------------|---------|
| **Syntax Highlighting** | Full TextMate grammar — keywords, types, annotations, temporal expressions, constraints |
| **Diagnostics** | Real-time squiggles as you type — syntax errors, type mismatches, undefined references |
| **Autocomplete** | Keywords, types, entity names, behavior names, field access |
| **Hover Documentation** | Type info and constraint details on hover |
| **Go to Definition** | Jump to any entity or behavior declaration |
| **Document Outline** | Full symbol tree in the VS Code Outline panel |
| **Auto-format on Save** | Consistent ISL formatting, configurable |
| **Code Snippets** | `domain`, `entity`, `behavior`, `scenario` starter templates |

### Verification Dashboard

The Shipgate sidebar panel gives you a live view of your verification state:

- **Trust Score ring** — 0–100 score with SHIP / WARN / NO-SHIP verdict
- **File-level breakdown** — per-file pass/fail status with violation counts
- **Evidence trail** — which spec clauses passed, which failed, and why
- **Pipeline status** — live indicator while verification runs
- **Action buttons** — Verify, Heal, Coverage, Export Report — all one click

### Inline CodeLens

Action buttons appear directly above every `behavior` and `entity` in source files after verification:

```
🚢 ShipGate: EMAIL_EXISTS not triggered (post-condition violation)
behavior RegisterUser { ... }
```

### Status Bar

Always-visible status at the bottom of the editor. Click to re-verify:

- `$(shield) ShipGate` — idle, ready to scan
- `$(loading~spin) ShipGate: Scanning...` — verification in progress
- `$(pass) ShipGate: SHIP (94)` — green, all contracts passing
- `$(error) ShipGate: NO-SHIP (61)` — red, violations found

### Coverage Decorations

File Explorer decorations show spec coverage at a glance — no need to open each file.

### Generate ISL from Source

Right-click any TypeScript or JavaScript file → **"Shipgate: Generate ISL Spec"** — scaffolds a behavioral spec from your existing function signatures, types, and JSDoc.

---

## Quick Start

**1. Install**

```bash
code --install-extension shipgate.shipgate-isl
```

Or search **"Shipgate ISL"** in the Extensions panel.

**2. Create a spec** — save as `specs/user-service.isl` in your project.

**3. Verify** — open the Command Palette (`Ctrl+Shift+P`) and run:

```
Shipgate: Verify Workspace
```

Violations appear in the **Problems panel**. The **Shipgate sidebar** shows your trust score.

**4. Fix or Heal** — click **Heal** in the sidebar for AI-powered automatic fixes.

---

## Commands

All available via `Ctrl+Shift+P` / `Cmd+Shift+P`:

| Command | What It Does |
|---------|-------------|
| **Shipgate: Verify Workspace** | Run full verification across all `.isl` specs |
| **Shipgate: Verify Current File** | Verify only the active file's spec |
| **Shipgate: Generate ISL Spec** | Scaffold a spec from the active source file |
| **Shipgate: Heal (AI Autofix)** | AI-powered fix for violations in current file |
| **Shipgate: Heal All** | Fix violations across the entire workspace |
| **Shipgate: Trust Score** | Print current trust score to terminal |
| **Shipgate: Coverage** | Show spec coverage report |
| **Shipgate: Open Report** | View full verification report |
| **Shipgate: Export Report** | Export verification report as PDF |
| **Shipgate: Init** | Initialize Shipgate config in current workspace |
| **ISL: Restart Language Server** | Restart the LSP if it gets stuck |

---

## Configuration

```jsonc
{
  // Core
  "shipgate.languageServer.enabled": true,    // Enable LSP (diagnostics, completions, hover)
  "shipgate.formatOnSave": true,              // Auto-format .isl files on save
  "shipgate.lintOnSave": true,               // Lint .isl files on save
  "shipgate.scanOnSave": false,              // Run full verification on every save (expensive)
  "shipgate.trace.server": "off",            // LSP trace: "off" | "messages" | "verbose"

  // Verification
  "shipgate.defaultTarget": "typescript",    // Codegen target: "typescript" | "rust" | "go"
  "shipgate.validation.enabled": true,       // Real-time ISL validation

  // Firewall (lightweight on-save checks)
  "shipgate.firewall.enabled": true,
  "shipgate.firewall.runOnSave": true,       // Run on .ts/.js save (fast, < 100ms)

  // Compliance
  "shipgate.compliance.frameworks": ["soc2"],
  "shipgate.severity.minimum": "medium"
}
```

---

## ISL in 90 Seconds

ISL (Intent Specification Language) is a declarative language for describing what your code must do — not how.

**Entities** — typed data models with invariants:
```isl
entity Payment {
  id: UUID [immutable, unique]
  amount: Decimal [positive]
  status: PaymentStatus

  invariants {
    amount > 0
    status in ["pending", "completed", "failed"]
  }
}
```

**Behaviors** — functions with contracts:
```isl
behavior ChargeCard {
  input { cardToken: String, amount: Decimal, currency: String }
  output {
    success: { paymentId: UUID, chargedAt: DateTime }
    errors { CARD_DECLINED, INSUFFICIENT_FUNDS, INVALID_AMOUNT }
  }

  preconditions {
    input.amount > 0
    input.currency.length == 3          // ISO 4217
  }

  postconditions {
    success implies Payment.exists({ id: result.paymentId, status: "completed" })
  }

  temporal {
    response within 3s (p99)
  }
}
```

Shipgate generates and runs verification tests from this spec against your actual implementation — no boilerplate, no manual mocks.

---

## Requirements

- **VS Code** 1.85.0+ (also works in **Cursor** and **VSCodium** via Open VSX)
- **Node.js** 18+
- The `shipgate` CLI — install with `npm install -g shipgate` for full verification. The LSP server works standalone for syntax highlighting, diagnostics, and completions without the CLI.

---

## Supported Editors

| Editor | Source |
|--------|--------|
| VS Code | [Marketplace](https://marketplace.visualstudio.com/items?itemName=shipgate.shipgate-isl) |
| Cursor | [Open VSX](https://open-vsx.org/extension/shipgate/shipgate-isl) |
| VSCodium | [Open VSX](https://open-vsx.org/extension/shipgate/shipgate-isl) |

---

## Development

```bash
git clone https://github.com/shipgate/shipgate.git
cd shipgate && pnpm install

# Run extension in debug mode
cd packages/vscode && code .
# Press F5

# Build .vsix
pnpm run build && pnpm run package
```

Enable LSP tracing to debug language server issues:
```json
"shipgate.trace.server": "verbose"
```

---

## License

MIT — see [LICENSE](../../LICENSE).

---

**[Changelog](CHANGELOG.md)** · **[Issues](https://github.com/shipgate/shipgate/issues)** · **[shipgate.dev](https://shipgate.dev)**

> *Define what your code must do. We enforce it.*
