# Shipgate

> **Verify AI-generated code with intent specifications**

Shipgate gives AI-generated code a trust score (0-100) before it ships. Write ISL (Intent Specification Language) specs that define what your code should do, then verify that AI-generated implementations match your intent.

---

## 🎯 The Problem

AI coding assistants (Copilot, Cursor, etc.) generate code that:
- ✅ Compiles
- ✅ Looks correct  
- ❌ **Breaks in production**

Ghost features, missing edge cases, and subtle bugs slip through code review.

## ✅ The Solution

```
Write ISL Spec → AI Generates Code → Shipgate Verifies → Ship with Confidence
```

Shipgate bridges the gap between AI code generation and production safety:

1. **Write intent** in ISL — entities, behaviors, contracts, invariants
2. **Generate types** — TypeScript interfaces + Zod validators
3. **Verify implementation** — Runtime contract checking with trust scores
4. **Gate deployment** — Only ship code with trust score > 80

---

## 🚀 Quick Start

```bash
# Install Shipgate
npm install -g shipgate

# Initialize a new project
shipgate init my-app
cd my-app

# Edit my-app.isl to define your domain

# Generate TypeScript types
shipgate gen ts my-app.isl

# Verify implementation against spec
shipgate verify ./src
```

---

## 📝 Example ISL Specification

```isl
domain Ecommerce {
  version: "1.0.0"

  entity User {
    id: UUID @unique @immutable
    email: String @unique
    name: String
    createdAt: Timestamp @immutable

    invariants {
      email.is_valid()
      name.length > 0
    }
  }

  behavior CreateUser {
    input {
      email: String
      name: String
    }

    output {
      success: User
      errors {
        EMAIL_EXISTS { when: "Email already registered" }
        INVALID_EMAIL { when: "Email format is invalid" }
      }
    }

    preconditions {
      email.is_valid()
      not User.exists_by_email(email)
    }

    postconditions {
      success implies {
        result.id != null
        result.email == input.email
        result.status == UserStatus.Created
      }
    }
  }
}
```

**Generated TypeScript:**

```typescript
// types.ts - Generated from ISL
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

// validation.ts - Zod schemas generated from ISL constraints
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.date(),
});
```

---

## 🏗️ Architecture

```
ISL Spec → Parser → Type Checker → Code Generator → Runtime Verification
                ↓
         Trust Score Engine
                ↓
         Deployment Gate (SHIP/NO_SHIP/WARN)
```

---

## 📦 Features

### ✅ Available Now

| Feature | Status | Description |
|---------|--------|-------------|
| **ISL Parser** | ✅ Ready | Full parser with error recovery |
| **TypeScript Generator** | ✅ Ready | Generate types + Zod validators |
| **VS Code Extension** | ✅ Published | LSP support, IntelliSense |
| **CLI** | ✅ Ready | `init`, `check`, `gen`, `verify` |
| **MCP Server** | ✅ Ready | AI assistant integration |
| **Runtime Verification** | ✅ Ready | Contract checking |
| **Trust Scoring** | ✅ Ready | 0-100 composite scoring |

### 🚧 In Development

| Feature | Status | ETA |
|---------|--------|-----|
| Python Generator | 🚧 Partial | Q1 2026 |
| SMT Verification | 🚧 Partial | Q2 2026 |
| OpenAPI Generator | 🚧 Partial | Q1 2026 |
| GitHub Action | 🚧 Partial | Q1 2026 |
| AI Healing | 🚧 Alpha | Q2 2026 |

### 🔮 Roadmap

| Feature | Status | ETA |
|---------|--------|-----|
| Go/Rust Generators | 🔮 Planned | 2026 |
| Database Migrations | 🔮 Planned | 2026 |
| UI Component Generation | 🔮 Planned | 2026 |
| Full-Stack Generation | 🔮 Planned | 2027 |

---

## 🎖️ Trust Score

Every implementation gets a composite trust score:

```
Trust Score: 94/100 ✓ VERIFIED

✓ Preconditions: 12/12 passed
✓ Postconditions: 18/18 passed
✓ Invariants: 5/5 maintained
✓ Type Coverage: 97%
⚠ Edge Cases: 8/10 handled
```

**Score Interpretation:**
- **90-100**: SHIP — Production ready
- **70-89**: WARN — Review recommended
- **0-69**: NO_SHIP — Block deployment

---

## 💻 VS Code Extension

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=shipgate.shipgate-isl):

- Syntax highlighting for `.isl` files
- IntelliSense and auto-completion
- Real-time error checking
- One-click generate/verify

---

## 🤖 MCP Server

Shipgate includes an MCP (Model Context Protocol) server for AI assistant integration:

```json
{
  "mcpServers": {
    "shipgate": {
      "command": "npx",
      "args": ["-y", "shipgate-mcp"]
    }
  }
}
```

Your AI assistant can now:
- Read ISL specs for context
- Generate implementations from specs
- Verify code against specifications
- Suggest fixes for contract violations

---

## 🧪 Example Use Cases

### 1. Verify AI-Generated API Code

```bash
# AI generates code from prompt
# You write ISL spec for expected behavior
# Shipgate verifies the implementation
shipgate verify ./src/api/users.ts
```

### 2. Generate Type-Safe Types

```bash
# Design your domain in ISL
# Generate TypeScript automatically
shipgate gen ts domain.isl --output ./src/types
```

### 3. CI/CD Gate

```yaml
# .github/workflows/shipgate.yml
- name: Verify with Shipgate
  run: shipgate verify ./src --format json
  # Fails build if trust score < 80
```

---

## 📊 Comparison

| Tool | Type Safety | Behavioral Verification | AI Integration | Code Generation |
|------|-------------|------------------------|----------------|-----------------|
| **TypeScript** | ✅ | ❌ | ❌ | ❌ |
| **Zod** | ✅ | ⚠️ Runtime | ❌ | ❌ |
| **OpenAPI** | ⚠️ Partial | ❌ | ❌ | ⚠️ Partial |
| **Pact** | ❌ | ✅ Contracts | ❌ | ❌ |
| **Shipgate** | ✅ | ✅ Full | ✅ Native | ✅ Multi-target |

---

## 💰 Pricing

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Core CLI, TypeScript gen, VS Code ext, unlimited repos |
| **Pro** | $29/lifetime | AI healing, all generators, priority support |
| **Enterprise** | Custom | SSO, compliance packs, on-premise |

---

## 🛠️ Installation

### CLI

```bash
npm install -g shipgate
```

### VS Code Extension

Search "Shipgate ISL" in the VS Code marketplace or:

```bash
code --install-extension shipgate.shipgate-isl
```

### Docker

```bash
docker pull shipgate/cli:latest
docker run -v $(pwd):/workspace shipgate/cli verify /workspace/src
```

---

## 📚 Documentation

- [ISL Language Reference](https://docs.shipgate.dev/isl)
- [CLI Commands](https://docs.shipgate.dev/cli)
- [VS Code Extension](https://docs.shipgate.dev/vscode)
- [Examples](https://github.com/shipgate/examples)

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/shipgate/shipgate.git
cd shipgate
pnpm install
pnpm build
pnpm test
```

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🔗 Links

- **Website:** https://shipgate.dev
- **Documentation:** https://docs.shipgate.dev
- **VS Code Extension:** https://marketplace.visualstudio.com/items?itemName=shipgate.shipgate-isl
- **Twitter:** https://twitter.com/shipgate_dev
- **Discord:** https://discord.gg/shipgate

---

## 🌟 Why Shipgate?

> "TypeScript checks types. Shipgate checks behavior."

In the age of AI code generation, **verification matters more than generation**. Shipgate ensures AI-generated code not only compiles but **actually does what you intended**.

**Write intent. Generate code. Verify correctness. Ship with confidence.**

---

<p align="center">
  <a href="https://shipgate.dev">Website</a> •
  <a href="https://docs.shipgate.dev">Docs</a> •
  <a href="https://twitter.com/shipgate_dev">Twitter</a> •
  <a href="https://discord.gg/shipgate">Discord</a>
</p>
