<p align="center">
  <img src="https://raw.githubusercontent.com/Ship-Gate/ShipGate/main/docs/assets/shipgate-banner.png" alt="ShipGate" width="600" />
</p>

<h1 align="center">ShipGate for VS Code</h1>

<p align="center">
  <strong>Stop AI from shipping fake features.</strong><br />
  Define what your code must do. ShipGate enforces it.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=shipgate.shipgate-isl"><img src="https://img.shields.io/visual-studio-marketplace/v/shipgate.shipgate-isl?label=Marketplace&logo=visual-studio-code&logoColor=white&color=0066b8" alt="VS Code Marketplace" /></a>
  <a href="https://open-vsx.org/extension/shipgate/shipgate-isl"><img src="https://img.shields.io/open-vsx/v/shipgate/shipgate-isl?label=Open%20VSX&color=a60ee5" alt="Open VSX" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/visual-studio-marketplace/i/shipgate.shipgate-isl?label=Installs&color=00e68a" alt="Installs" />
</p>

---

AI writes the code. You define the behavioral contracts. ShipGate verifies every function, entity, and invariant — catching violations before they reach production, right inside your editor.

> Design-by-contract for the AI era. No manual test-writing. No runtime surprises.

---

## What's New in 2.0

**This is a major release.** The sidebar has been completely rebuilt with an enterprise-grade design system, and 14 new commands bring the full power of the ShipGate CLI into your editor.

- **Actions Panel** — New sidebar tab with one-click access to every ShipGate workflow
- **`shipgate go`** — One command: detect project, infer ISL specs, verify, gate (Cmd+Shift+Enter)
- **Vibe -> Ship** — Describe what you want in English, get verified code (Cmd+Shift+V)
- **Multi-language codegen** — Generate TypeScript, Python, Rust, Go, GraphQL, or OpenAPI from ISL
- **AI spec inference** — Auto-generate behavioral specs from existing code
- **Deep Scan** — Thorough analysis mode with higher coverage targets
- **Auto-Heal** — One-click AI-powered violation fixes
- **Enterprise UI** — Glassmorphism cards, animated transitions, refined typography, custom scrollbar

---

## Quick Start

### 1. Install

```bash
code --install-extension shipgate.shipgate-isl
```

Or search **"ShipGate"** in the Extensions panel.

### 2. Open the sidebar

Click the ShipGate icon in the Activity Bar. You'll see the onboarding screen with three steps.

### 3. Run `shipgate go`

Click the **Get started** button — or press **Cmd+Shift+Enter** (Ctrl+Shift+Enter on Windows/Linux). ShipGate will:

1. Detect your project type (TypeScript, Python, Rust, Go)
2. Initialize a `.shipgate.yml` config
3. AI-generate ISL specs from your code
4. Verify your code against those specs
5. Return a **SHIP / WARN / NO_SHIP** verdict

That's it. You're gated.

### 4. Write a spec (optional)

For precise control, write `.isl` specs by hand:

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
      success: { paymentId: UUID, chargedAt: DateTime }
      errors { CARD_DECLINED, INSUFFICIENT_FUNDS }
    }

    preconditions {
      input.amount > 0
      input.currency.length == 3
    }

    postconditions {
      success implies Payment.exists({ id: result.paymentId, status: "completed" })
    }

    temporal {
      response within 3s (p99)
    }
  }
}
```

ShipGate verifies your implementation against this spec and produces:

```
✓ SHIP  Trust Score: 94%
  ✓ Preconditions      3/3 passing
  ✓ Postconditions     2/2 passing
  ✓ Invariants         2/2 holding
  ✓ Error cases        2/2 correct
```

---

## The Sidebar

The ShipGate sidebar is your command center. Five tabs, each purpose-built:

### Overview

Live verification dashboard with:

- **Score ring** — 0-100 trust score with animated fill and SHIP / WARN / NO_SHIP verdict
- **Stats grid** — Claims verified, coverage %, files scanned, open issues — each with sparkline trends
- **Compliance readiness** — SOC 2, HIPAA, and EU AI Act scores at a glance
- **AI provenance** — Breakdown of AI-generated vs. human-written vs. AI-assisted code
- **Active findings** — Top critical issues with severity indicators

### Actions

One-click access to every ShipGate workflow:

| Action | What it does |
|--------|-------------|
| **Vibe -> Ship** | English prompt -> ISL spec -> verified code |
| **Go + Auto-Heal** | Scan project, then auto-fix violations |
| **Deep Scan** | Thorough analysis with higher coverage target |
| **Quick Scan** | Fast scan with gate verdict |
| **Infer ISL Specs** | AI-generate behavioral specs from code |
| **Heal All** | Auto-fix all violations across project |
| **Code -> ISL** | Generate spec from current file |
| **Format & Lint** | Auto-format all ISL spec files |

Plus a **6-language codegen grid**: TypeScript, Python, Rust, Go, GraphQL, OpenAPI.

### Claims

Expandable verification claims with:

- Status indicators (Proven / Partial / Failed)
- Confidence percentages
- Evidence excerpts
- SOC 2 control mappings

### Pipeline

CI/CD integration showing:

- Current run status with job progress dots
- Recent run history with verdicts and scores
- Deployment environment gates (Production, Staging, Preview)
- Blocker details for failed runs

### Files

Per-file verdict breakdown with:

- Summary bar (passed / warnings / failed counts)
- Color-coded SHIP / WARN / NO_SHIP badges
- Score percentages
- Click to open file at violation line

---

## ISL Language Support

Full language server integration for `.isl` files:

| Feature | Details |
|---------|---------|
| **Syntax Highlighting** | Full TextMate grammar — keywords, types, annotations, temporal expressions |
| **Real-time Diagnostics** | Squiggles as you type — syntax errors, type mismatches, undefined references |
| **Autocomplete** | Keywords, types, entity names, behavior names, field access |
| **Hover Documentation** | Type info and constraint details |
| **Go to Definition** | Jump to any entity or behavior declaration |
| **Document Outline** | Full symbol tree in the Outline panel |
| **Format on Save** | Consistent ISL formatting |
| **Code Snippets** | `domain`, `entity`, `behavior`, `scenario` starter templates |

---

## Commands

All available via **Cmd+Shift+P** (Ctrl+Shift+P on Windows/Linux):

### Core Workflows

| Command | Shortcut | Description |
|---------|----------|-------------|
| ShipGate: Go | Cmd+Shift+Enter | Scan + infer ISL + verify + gate |
| ShipGate: Go + Auto-Fix | — | Go with auto-heal |
| ShipGate: Go Deep Scan | — | Thorough scan with higher coverage |
| ShipGate: Vibe | Cmd+Shift+V | NL prompt -> ISL -> verified code |
| ShipGate: Scan Project | — | Quick scan with gate verdict |

### Verification

| Command | Description |
|---------|-------------|
| ShipGate: Verify Current Project | Full verification against all specs |
| ShipGate: Verify Current File | Verify only the active file |
| ShipGate: Heal (AI Autofix) | AI-fix violations in current file |
| ShipGate: Heal All Findings | Fix all violations across workspace |
| ShipGate: Trust Score | Print trust score to terminal |
| ShipGate: Coverage | Show spec coverage report |

### Code Generation

| Command | Description |
|---------|-------------|
| ShipGate: Generate TypeScript from ISL | ISL -> TypeScript |
| ShipGate: Generate Python from ISL | ISL -> Python (Pydantic + pytest) |
| ShipGate: Generate Rust from ISL | ISL -> Rust (Serde + traits) |
| ShipGate: Generate Go from ISL | ISL -> Go (structs + interfaces) |
| ShipGate: Generate GraphQL from ISL | ISL -> GraphQL schema |
| ShipGate: Generate OpenAPI from ISL | ISL -> OpenAPI 3.0 spec |

### Spec Tools

| Command | Description |
|---------|-------------|
| ShipGate: Infer ISL Specs from Code | AI-generate specs from existing code |
| ShipGate: Generate ISL Spec | Scaffold spec from active file |
| ShipGate: Init | Initialize ShipGate config |

### Reports & Compliance

| Command | Description |
|---------|-------------|
| ShipGate: Open Report | View verification report |
| ShipGate: Export Report | Export as PDF |
| ShipGate: View Latest Proof Bundle | Inspect evidence bundle |
| ShipGate: Open Web Dashboard | Open dashboard in browser |

---

## Configuration

```jsonc
{
  // Verification
  "shipgate.scanOnSave": false,              // Full verification on save (expensive)
  "shipgate.defaultTarget": "typescript",    // Codegen target: typescript | python | rust | go

  // Language Server
  "shipgate.languageServer.enabled": true,
  "shipgate.formatOnSave": true,
  "shipgate.lintOnSave": true,
  "shipgate.validation.enabled": true,
  "shipgate.trace.server": "off",            // "off" | "messages" | "verbose"

  // Firewall (lightweight on-save checks, < 100ms)
  "shipgate.firewall.enabled": true,
  "shipgate.firewall.runOnSave": true,

  // Display
  "shipgate.showCodeLens": true,
  "shipgate.showInlineHints": true,
  "shipgate.severity.minimum": "medium",     // low | medium | high | critical
  "shipgate.compliance.frameworks": ["soc2"],

  // Dashboard
  "shipgate.dashboardApiUrl": "http://localhost:3001"
}
```

---

## How ShipGate Works

```
Your Code  ──>  ISL Spec  ──>  Verify  ──>  SHIP / NO_SHIP
   │                │              │               │
   │     AI infers  │  or you      │  Checks pre/  │  With evidence
   │     specs from │  write by    │  postconditions│  bundle and
   │     your code  │  hand        │  + invariants  │  trust score
   │                │              │               │
   └────────────────┴──────────────┴───────────────┘
```

**ISL** (Intent Specification Language) is a declarative language for defining what your code must do — not how. It specifies:

- **Entities** — typed data models with field constraints and invariants
- **Behaviors** — function contracts with preconditions, postconditions, and error cases
- **Temporal bounds** — response time SLAs (e.g., `response within 500ms (p99)`)
- **Security annotations** — `[secret]`, `[pii]`, `[immutable]` field decorators

ShipGate verifies your running implementation against these specs and produces a trust score with full evidence trails.

---

## The Vibe Pipeline

The **Vibe -> Ship** workflow lets you go from an English description to verified, production-ready code:

```
"Build me a todo app with auth and Stripe payments"
   │
   ▼
ISL Spec (auto-generated, validated)
   │
   ▼
Full-stack code (TypeScript/Python/Rust/Go)
   │
   ▼
Verification against the ISL spec
   │
   ▼
Auto-heal any violations
   │
   ▼
SHIP ✓ (with evidence bundle)
```

Trigger it from the Actions tab or **Cmd+Shift+V**. You'll be prompted for a description and target language.

---

## Requirements

- **VS Code** 1.85+ (also works in **Cursor** and **VSCodium**)
- **Node.js** 18+
- The `shipgate` CLI for full verification: `npm install -g shipgate`

The language server works standalone for syntax highlighting, diagnostics, and completions — no CLI required.

---

## Supported Editors

| Editor | Install from |
|--------|-------------|
| VS Code | [Marketplace](https://marketplace.visualstudio.com/items?itemName=shipgate.shipgate-isl) |
| Cursor | [Open VSX](https://open-vsx.org/extension/shipgate/shipgate-isl) |
| VSCodium | [Open VSX](https://open-vsx.org/extension/shipgate/shipgate-isl) |

---

## Development

```bash
git clone https://github.com/Ship-Gate/ShipGate.git
cd ShipGate && pnpm install

cd packages/vscode
pnpm run build          # Production build
pnpm run watch          # Dev mode with hot reload
pnpm run package        # Build .vsix
```

Debug the language server:
```jsonc
{ "shipgate.trace.server": "verbose" }
```

---

## License

MIT — see [LICENSE](../../LICENSE).

---

<p align="center">
  <strong><a href="CHANGELOG.md">Changelog</a></strong> · <strong><a href="https://github.com/Ship-Gate/ShipGate/issues">Issues</a></strong> · <strong><a href="https://shipgate.dev">shipgate.dev</a></strong>
</p>

<p align="center">
  <em>Define what your code must do. We enforce it.</em>
</p>
