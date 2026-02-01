# ISL VS Code Extension

Language support for **Intent Specification Language (ISL)** in Visual Studio Code.

## Features

### Syntax Highlighting

Full syntax highlighting for ISL files including:

- **Keywords**: `domain`, `entity`, `behavior`, `type`, `enum`, etc.
- **Types**: `String`, `Int`, `UUID`, `Timestamp`, `Boolean`, etc.
- **Annotations**: `[immutable]`, `[unique]`, `[indexed]`, `[secret]`, etc.
- **Sections**: `input`, `output`, `preconditions`, `postconditions`, `invariants`
- **Temporal**: `eventually`, `within`, `immediately`, `never`, `always`
- **Strings, numbers, comments, and operators**

### Language Server Protocol (LSP)

When connected to the ISL language server:

- **Real-time validation** with inline error reporting
- **Go to definition** for types and entities
- **Hover information** with documentation
- **Auto-completion** for keywords, types, and references
- **Code actions** for quick fixes

### Commands

| Command | Description |
|---------|-------------|
| `ISL: Generate TypeScript Types` | Generate TypeScript types from the current ISL file |
| `ISL: Generate Tests` | Generate test scaffolding from behavior specifications |
| `ISL: Validate Specification` | Validate the current ISL specification |
| `ISL: Restart Language Server` | Restart the LSP server |

### Snippets

Quick scaffolding with code snippets:

| Prefix | Description |
|--------|-------------|
| `domain` | Create a new domain |
| `entity` | Create an entity with common fields |
| `entity-simple` | Create a minimal entity |
| `behavior` | Create a full behavior with all sections |
| `behavior-simple` | Create a minimal behavior |
| `type` | Create a type alias |
| `enum` | Create an enumeration |
| `scenario` | Create a test scenario |
| `input` | Create an input block |
| `output` | Create an output block |
| `error` | Define an error case |
| `preconditions` | Create preconditions block |
| `postconditions` | Create postconditions block |
| `invariants` | Create invariants block |
| `temporal` | Create temporal constraints |
| `security` | Create security constraints |
| `actors` | Define actors |
| `lifecycle` | Define state lifecycle |

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "ISL"
4. Click Install

### From VSIX

```bash
code --install-extension isl-vscode-0.1.0.vsix
```

### Development

```bash
# Clone the repository
git clone https://github.com/intentos/intentos
cd intentos/packages/vscode

# Install dependencies
npm install

# Build the extension
npm run build

# Package the extension
npm run package
```

## Configuration

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `isl.languageServer.enabled` | `true` | Enable/disable the language server |
| `isl.languageServer.path` | `""` | Custom path to the language server |
| `isl.validation.enabled` | `true` | Enable real-time validation |
| `isl.codegen.outputDir` | `"generated"` | Output directory for generated code |
| `isl.codegen.format` | `"typescript"` | Default code generation format |

### Example Configuration

```json
{
  "isl.languageServer.enabled": true,
  "isl.validation.enabled": true,
  "isl.codegen.outputDir": "src/generated",
  "isl.codegen.format": "typescript"
}
```

## Language Server

The extension works best when paired with the ISL Language Server (`@intentos/isl-lsp`).

### Installing the Language Server

```bash
npm install -g @intentos/isl-lsp
```

Or in your project:

```bash
npm install --save-dev @intentos/isl-lsp
```

The extension will automatically detect the language server in:
1. Custom path from settings
2. Bundled with the extension
3. Workspace `node_modules`
4. Global npm installation

## File Association

The extension automatically associates with `.isl` files. You can also manually set the language mode:

1. Open a file
2. Click on the language mode in the status bar
3. Select "Intent Specification Language"

## Example ISL File

```isl
domain UserManagement {
  version: "1.0.0"

  enum UserStatus {
    ACTIVE
    INACTIVE
    LOCKED
  }

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    status: UserStatus
    created_at: Timestamp [immutable]
  }

  behavior CreateUser {
    description: "Create a new user account"

    input {
      email: String
    }

    output {
      success: User

      errors {
        EMAIL_EXISTS {
          when: "Email already registered"
          retriable: false
        }
      }
    }

    postconditions {
      success implies {
        - User.exists(result.id)
        - User.email == input.email
      }
    }
  }
}
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

## License

MIT License - see [LICENSE](LICENSE) for details.
