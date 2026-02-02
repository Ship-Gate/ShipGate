# ISL - Intent Specification Language (VS Code Extension)

Official VS Code extension for ISL (Intent Specification Language).

## Features

- **Syntax Highlighting** - Full grammar support for ISL
- **IntelliSense** - Auto-completion for keywords, types, and symbols
- **Diagnostics** - Real-time error detection and reporting
- **Go to Definition** - Navigate to type and intent definitions
- **Find References** - Find all usages of a symbol
- **Hover Information** - View type information on hover
- **Code Formatting** - Format ISL files
- **Snippets** - Common ISL patterns
- **Code Actions** - Quick fixes and refactoring

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "ISL" or "Intent Specification Language"
4. Click Install

Or install from the command line:

```bash
code --install-extension isl-lang.isl-lang
```

## Quick Start

1. Create a new file with `.isl` extension
2. Start typing ISL code:

```isl
domain UserManagement {
  type User {
    id: uuid
    name: string
    email: email
    createdAt: timestamp
  }

  intent CreateUser {
    input {
      name: string
      email: email
    }
    output {
      user: User
    }
    preconditions {
      name.length > 0
      email.isValid()
    }
    postconditions {
      result.user.id != null
    }
  }
}
```

## Commands

Access via Command Palette (Ctrl+Shift+P):

| Command | Description |
|---------|-------------|
| `ISL: Parse Current File` | Parse and show AST |
| `ISL: Type Check Current File` | Run type checker |
| `ISL: Generate TypeScript` | Generate TypeScript code |
| `ISL: Generate Rust` | Generate Rust code |
| `ISL: Open REPL` | Start interactive REPL |
| `ISL: Initialize Project` | Create new ISL project |
| `ISL: Verify Spec` | Run formal verification |
| `ISL: Restart Language Server` | Restart LSP |

## Configuration

Configure in VS Code settings:

```json
{
  "isl.defaultTarget": "typescript",
  "isl.formatOnSave": true,
  "isl.lintOnSave": true,
  "isl.languageServer.enabled": true,
  "isl.codegen.outputDir": "generated",
  "isl.trace.server": "off"
}
```

## Snippets

Type these prefixes and press Tab:

| Prefix | Description |
|--------|-------------|
| `domain` | New domain |
| `intent` | New intent |
| `type` | New type |
| `entity` | New entity type |
| `enum` | New enum |
| `pre` | Precondition block |
| `post` | Postcondition block |

## Requirements

- VS Code 1.85.0 or higher
- Node.js 18.0.0 or higher (for language server)

## Related

- [ISL Documentation](https://isl-lang.dev)
- [ISL CLI](https://npm.im/@isl-lang/cli)
- [ISL GitHub](https://github.com/isl-lang/isl)

## License

MIT

## Feedback

- [Report Issues](https://github.com/isl-lang/isl/issues)
- [Feature Requests](https://github.com/isl-lang/isl/discussions)
