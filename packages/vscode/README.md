# Shipgate ISL — Behavioral Verification for AI-Generated Code v0.2.0

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/shipgate.shipgate-isl?label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=shipgate.shipgate-isl)
[![Open VSX](https://img.shields.io/open-vsx/v/shipgate/shipgate-isl?label=Open%20VSX)](https://open-vsx.org/extension/shipgate/shipgate-isl)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.2.0-blue)](https://github.com/shipgate/shipgate/releases/tag/v0.2.0)

> **Shipgate** ensures AI-generated code does what you *intended*. Write behavioral specifications in **Intent Specification Language (ISL)**, and Shipgate verifies your codebase against them — catching violations, broken contracts, and missing invariants before they reach production.

> **Think of it as:** Design-by-contract meets AI code review, built into your editor.

---

## 🎯 What Shipgate Does

1. **You describe intent** — Write `.isl` specs that define what your code *must* do (preconditions, postconditions, invariants, temporal constraints).
2. **Shipgate verifies** — Behavioral verification runs against your implementation, reporting violations as diagnostics directly in VS Code.
3. **AI stays honest** — CodeLens actions, coverage overlays, and status bar indicators give you continuous confidence that generated code matches your specifications.

---

## ✨ Features

### 🎨 ISL Syntax Highlighting

Full TextMate grammar with rich colorization for keywords, types, annotations, operators, temporal expressions, and more.

![ISL Syntax Highlighting](https://raw.githubusercontent.com/shipgate/shipgate/main/packages/vscode/screenshots/syntax-highlighting.png)

```isl
domain Payments {
  behavior Transfer {
    preconditions {
      Account.lookup(from).balance >= input.amount
      from != to
    }
    postconditions {
      success implies {
        Account.lookup(from).balance == old(balance) - input.amount
      }
    }
    temporal {
      response within 200ms (p99)
    }
  }
}
```

### 🔍 Real-Time Diagnostics & Quick Fixes

Errors and warnings appear inline as you type. The language server validates ISL syntax, types, and contract consistency. Quick fixes are available for common mistakes.

![Diagnostics & Errors](https://raw.githubusercontent.com/shipgate/shipgate/main/packages/vscode/screenshots/diagnostics.png)

### ⚡ CodeLens Above Behaviors

Inline action buttons appear above every `behavior` and `entity` declaration — verify, generate tests, or check coverage with a single click.

![CodeLens Actions](https://raw.githubusercontent.com/shipgate/shipgate/main/packages/vscode/screenshots/codelens.png)

```
▶ Verify  |  🔍 Generate Tests  |  📊 Coverage
behavior CreateUser {
  ...
}
```

### 🤖 Generate ISL Spec from Source

Right-click any TypeScript or JavaScript file and select **"Shipgate: Generate ISL Spec"** to scaffold a behavioral spec from your existing code.

![Generate ISL Spec](https://raw.githubusercontent.com/shipgate/shipgate/main/packages/vscode/screenshots/generate-spec.gif)

### 📊 Coverage Overlay

Gutter decorations show which source files have matching ISL specs and whether they pass verification:

| Indicator | Meaning |
|-----------|---------|
| 🟢 Green  | Has a matching ISL spec — all passing |
| 🟡 Yellow | No spec coverage (specless) |
| 🔴 Red    | Spec exists but verification failed |

### 📈 Status Bar

At a glance, see your verification status:
- `ISL: ✓ 12/15 specced` — coverage summary
- `ISL: ✗ 2 violations` — issues to fix

Click to run workspace-wide verification.

### 🌐 Language Server Protocol

Full LSP integration powered by `@isl-lang/lsp-server`:

| Feature | Description |
|---------|-------------|
| **Diagnostics** | Real-time error and warning squiggles |
| **Autocomplete** | Keywords, types, entity and behavior names |
| **Hover** | Type information and inline documentation |
| **Go to Definition** | Jump to entity or behavior declarations |
| **Document Symbols** | Outline view for `.isl` files |
| **Formatting** | Auto-format on save |
| **Semantic Tokens** | Enhanced highlighting via LSP |

---

## 🚀 Quick Start (60 seconds)

### 1. Install the extension

Search for **"Shipgate ISL"** in the VS Code Extensions panel, or install from the command line:

```bash
code --install-extension shipgate.shipgate-isl
```

### 2. Open a project with `.isl` files

The extension activates automatically when it detects `.isl` files in your workspace.

### 3. Write your first spec

Create a file called `auth.isl`:

```isl
domain Auth {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: Email [indexed]
    passwordHash: String [secret]

    invariants {
      email.contains("@")
    }
  }

  behavior Login {
    input {
      email: Email
      password: String
    }

    output {
      success: { token: String, user: User }
      errors {
        INVALID_CREDENTIALS
        ACCOUNT_LOCKED
      }
    }

    preconditions {
      User.exists(email)
      User.lookup(email).status != "locked"
    }

    postconditions {
      success implies output.token.length > 0
    }
  }
}
```

### 4. Verify

Open the Command Palette and run **"Shipgate: Verify Workspace"**. Violations appear in the Problems panel.

---

## 📋 Commands

All commands are available from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

### Core Commands

| Command | Description |
|---------|-------------|
| `Shipgate: Generate ISL Spec` | Generate a `.isl` spec from the active source file |
| `Shipgate: Verify Current File` | Verify the active file against its spec |
| `Shipgate: Verify Workspace` | Run verification across the entire workspace |
| `Shipgate: Show ISL Coverage` | Toggle gutter coverage decorations |

### ISL Language Commands

| Command | Description |
|---------|-------------|
| `ISL: Parse Current File` | Parse and display the ISL AST |
| `ISL: Type Check Current File` | Run the ISL type checker |
| `ISL: Generate TypeScript` | Generate TypeScript types from ISL spec |
| `ISL: Generate Rust` | Generate Rust types from ISL spec |
| `ISL: Open REPL` | Open an interactive ISL REPL terminal |
| `ISL: Restart Language Server` | Restart the LSP server |

### Advanced Commands

| Command | Description |
|---------|-------------|
| `Shipgate: Run Scan` | Run comprehensive security and compliance scan |
| `Shipgate: Heal (AI Autofix)` | AI-powered automatic fixes for violations |
| `Shipgate: Code to ISL` | Generate ISL spec from existing codebase |
| `Shipgate: Connect GitHub` | Link repository for CI/CD integration |
| `Shipgate: Open Report` | View detailed verification report |

---

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `shipgate.languageServer.enabled` | `true` | Enable the ISL language server for advanced features |
| `shipgate.server.path` | `""` | Custom path to the LSP server binary |
| `shipgate.formatOnSave` | `true` | Auto-format ISL files on save |
| `shipgate.lintOnSave` | `true` | Run linter when ISL files are saved |
| `shipgate.defaultTarget` | `"typescript"` | Default code generation target language |
| `shipgate.trace.server` | `"off"` | Trace LSP communication (`off`, `messages`, `verbose`) |
| `shipgate.coverage.autoRefresh` | `true` | Auto-refresh coverage decorations on save |
| `shipgate.codegen.outputDir` | `"generated"` | Output directory for generated code |
| `shipgate.validation.enabled` | `true` | Enable real-time validation of ISL files |

### Security & Compliance

| Setting | Default | Description |
|---------|---------|-------------|
| `shipgate.firewall.enabled` | `true` | Enable live firewall checks on file save |
| `shipgate.firewall.runOnSave` | `true` | Run lightweight checks on .ts/.js save |
| `shipgate.compliance.frameworks` | `["soc2"]` | Active compliance frameworks |
| `shipgate.severity.minimum` | `"medium"` | Minimum severity to display |

### GitHub Integration

| Setting | Default | Description |
|---------|---------|-------------|
| `shipgate.github.autoSync` | `true` | Auto-sync CI/CD status from GitHub |
| `shipgate.github.token` | `""` | GitHub token for API access |

---

## 🎯 Supported Languages

### ISL File Support

- **Syntax Highlighting** - Full TextMate grammar
- **Code Completion** - Keywords, types, entities
- **Diagnostics** - Real-time validation
- **Formatting** - Auto-format on save
- **Outline View** - Document symbols

### Source Code Languages

| Language | Spec Generation | Verification |
|----------|------------------|--------------|
| TypeScript | ✅ | ✅ |
| JavaScript | ✅ | ✅ |
| Python | ✅ | ✅ |
| Rust | ✅ | ✅ |
| Go | ✅ | ✅ |

---

## 💻 Requirements

- **VS Code** 1.85.0 or newer (also works in **Cursor** and **VSCodium** via Open VSX)
- **Node.js** 18+ (for the language server)
- The `shipgate` CLI is optional — the LSP server works standalone for syntax, diagnostics, and completions

---

## 🌍 Supported Editors

| Editor | Install From |
|--------|-------------|
| VS Code | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=shipgate.shipgate-isl) |
| Cursor | [Open VSX Registry](https://open-vsx.org/extension/shipgate/shipgate-isl) |
| VSCodium | [Open VSX Registry](https://open-vsx.org/extension/shipgate/shipgate-isl) |

---

## 🔧 Development

### Run the Extension (F5)

1. Open the repo root in VS Code.
2. Press **F5** or run **Run > Start Debugging**.
3. A new Extension Development Host window opens with the extension loaded.

### Run Tests

```bash
# From repo root
pnpm run test:unit --filter shipgate-isl

# From packages/vscode
pnpm run test:unit
```

### Package

```bash
cd packages/vscode
pnpm run build
npx vsce package --no-dependencies
```

### Debug

```bash
# Enable trace
"shipgate.trace.server": "verbose"

# Restart language server
"ISL: Restart Language Server"
```

---

## 📊 Examples

### Authentication Domain

```isl
domain Auth {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: Email [indexed]
    passwordHash: String [secret]
    status: UserStatus
    createdAt: DateTime [immutable]
    updatedAt: DateTime

    invariants {
      email.contains("@")
      passwordHash.length >= 60
      status in ["active", "inactive", "locked"]
    }
  }

  behavior Login {
    input {
      email: Email
      password: String
      rememberMe?: Boolean
    }

    output {
      success: { token: String, user: User, expiresAt: DateTime }
      errors {
        INVALID_CREDENTIALS
        ACCOUNT_LOCKED
        RATE_LIMITED
      }
    }

    preconditions {
      User.exists(email)
      User.lookup(email).status != "locked"
      RateLimit.check(email, 5, per: "minute")
    }

    postconditions {
      success implies {
        output.token.length > 0
        output.user.email == input.email
        output.expiresAt > now()
      }
    }

    temporal {
      response within 200ms (p99)
      token generation within 50ms (p95)
    }
  }
}
```

### Generated TypeScript

```typescript
// Generated by Shipgate
export interface User {
  id: string; // UUID
  email: string; // Email
  passwordHash: string; // String
  status: UserStatus;
  createdAt: Date; // DateTime
  updatedAt: Date; // DateTime
}

export type UserStatus = "active" | "inactive" | "locked";

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginSuccess {
  token: string;
  user: User;
  expiresAt: Date;
}

export type LoginOutput = 
  | { success: LoginSuccess }
  | { error: "INVALID_CREDENTIALS" }
  | { error: "ACCOUNT_LOCKED" }
  | { error: "RATE_LIMITED" };
```

---

## 🔗 Links

- **Shipgate Documentation**: https://shipgate.dev/docs
- **ISL Language Reference**: https://shipgate.dev/docs/isl
- **GitHub Repository**: https://github.com/shipgate/shipgate
- **Report an Issue**: https://github.com/shipgate/shipgate/issues
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Discord Community**: https://discord.gg/shipgate

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/shipgate/shipgate.git
cd shipgate

# Install dependencies
pnpm install

# Build extension
cd packages/vscode
pnpm run build

# Run tests
pnpm run test:unit
```

---

## 📄 License

MIT — see [LICENSE](../../LICENSE) for details.

---

**Shipgate ISL v0.2.0** - Behavioral verification for AI-generated code.

> *"Define what your code should do. We enforce it."*
