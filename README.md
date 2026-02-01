<p align="center">
  <img src="./assets/logo.png" alt="ISL Logo" width="200" />
</p>

<h1 align="center">ISL — Intent Specification Language</h1>

<p align="center">
  <strong>A language for specifying and verifying AI-generated code</strong>
</p>

<p align="center">
  <a href="https://github.com/mevla/isl-lang/actions"><img src="https://github.com/mevla/isl-lang/actions/workflows/ci.yml/badge.svg" alt="Build Status" /></a>
  <a href="https://www.npmjs.com/package/@isl-lang/cli"><img src="https://img.shields.io/npm/v/@isl-lang/cli.svg" alt="npm version" /></a>
  <a href="https://github.com/mevla/isl-lang/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
</p>

---

## Quick Install

```bash
npm install -g @isl-lang/cli
```

## What is ISL?

ISL lets you write **behavioral specifications** that define *what* your code should do, not *how*. AI generates the implementation; ISL verifies it's correct.

```isl
domain UserAuth {
  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    status: UserStatus
  }

  behavior Login {
    input {
      email: String
      password: String [sensitive]
    }

    output {
      success: Session
      errors { INVALID_CREDENTIALS, USER_LOCKED }
    }

    preconditions {
      email.is_valid
      password.length >= 8
    }

    postconditions {
      success implies Session.user_id == User.lookup(email).id
    }

    invariants {
      password never_logged
    }
  }
}
```

## Features

- **Parser** — Full ISL language parser with error recovery
- **Type Checker** — Static analysis with refinement types
- **Code Generators** — TypeScript, Python, Go, GraphQL, OpenAPI
- **VS Code Extension** — Syntax highlighting, IntelliSense, diagnostics
- **REPL** — Interactive exploration and testing
- **Verifiers** — Runtime, formal, and security verification
- **Standard Library** — Auth, payments, workflows, and more

## Why ISL?

AI can write code, but how do you know it's correct? ISL bridges the gap between human intent and machine implementation—you specify the contract, AI implements it, ISL verifies it works.

## Documentation

- [Language Specification](./ISL-LANGUAGE-SPEC.md)
- [How It Works](./docs/HOW_IT_WORKS.md)
- [Standard Library](./STDLIB.md)
- [Examples](./examples/)

## Packages

| Package | Description |
|---------|-------------|
| `@isl-lang/cli` | Command-line interface |
| `@isl-lang/parser` | ISL parser |
| `@isl-lang/typechecker` | Type checking and analysis |
| `@isl-lang/codegen-typescript` | TypeScript code generator |
| `@isl-lang/vscode` | VS Code extension |
| `@isl-lang/repl` | Interactive REPL |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE) © mevla
