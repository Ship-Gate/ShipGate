# ISL VS Code Extension

Language support for **Intent Specification Language (ISL)** in Visual Studio Code.

> **Note for publishing**: Before publishing to the marketplace, create a `icons/isl-icon.png` file (128x128 pixels) and add `"icon": "icons/isl-icon.png"` to package.json.

## Features

### Syntax Highlighting

Full syntax highlighting for ISL files including:

- **Keywords**: `intent`, `pre`, `post`, `invariant`, `scenario`, `chaos`, `domain`, `entity`, `behavior`, etc.
- **Operators**: `forall`, `exists`, `implies`, `old`
- **Types**: `String`, `Number`, `Boolean`, `Array`, `Map`, `UUID`, `Timestamp`, etc.
- **Annotations**: `[immutable]`, `[unique]`, `[indexed]`, `[secret]`, etc.
- **Sections**: `input`, `output`, `preconditions`, `postconditions`, `invariants`
- **Temporal**: `eventually`, `within`, `immediately`, `never`, `always`
- **Testing**: `given`, `when`, `then`, `inject`, `expect`
- **Comments**: `//` line comments and `/* */` block comments
- **Strings, numbers, and operators**

### Language Server Protocol (LSP)

When connected to the ISL language server:

- **Real-time validation** with inline error reporting
- **Go to definition** for types and entities
- **Hover information** with documentation
- **Auto-completion** for keywords, types, and references
- **Code actions** for quick fixes
- **Formatting** support

### Commands

| Command | Description |
|---------|-------------|
| `ISL: Parse Current File` | Show the AST of the current ISL file |
| `ISL: Type Check Current File` | Run the type checker on current file |
| `ISL: Generate TypeScript` | Generate TypeScript code from current file |
| `ISL: Generate Rust` | Generate Rust code from current file |
| `ISL: Open REPL` | Open ISL REPL in terminal |
| `ISL: Initialize Project` | Create `.islrc.json` and example spec |
| `ISL: Verify Spec` | Run interpreter/verifier on current file |
| `ISL: Restart Language Server` | Restart the LSP server |

### Status Bar

- Shows **ISL version** when an `.isl` file is open
- Shows **parse/check status**: ✓ for success, error count for failures
- Click to show the Problems panel

### Snippets

Quick scaffolding with code snippets:

| Prefix | Description |
|--------|-------------|
| `intent` | Create a new intent with pre/post conditions |
| `scenario` | Create a test scenario (given/when/then) |
| `chaos` | Create a chaos engineering test |
| `domain` | Create a new domain |
| `entity` | Create an entity with common fields |
| `entity-simple` | Create a minimal entity |
| `behavior` | Create a full behavior with all sections |
| `behavior-simple` | Create a minimal behavior |
| `type` | Create a type alias |
| `enum` | Create an enumeration |
| `pre` | Add a precondition |
| `post` | Add a postcondition |
| `invariant` | Add an invariant |
| `input` | Create an input block |
| `output` | Create an output block |
| `error` | Define an error case |
| `temporal` | Create temporal constraints |
| `security` | Create security constraints |
| `actors` | Define actors |
| `lifecycle` | Define state lifecycle |
| `forall` | Create a forall quantifier |
| `exists` | Create an exists quantifier |
| `given` | Define given precondition |
| `when` | Define when action |
| `then` | Define then assertion |
| `inject` | Inject a fault |
| `expect` | Expect recovery behavior |

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
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

# Watch for changes during development
npm run watch

# Package the extension
npm run package
```

## Configuration

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `isl.server.path` | `""` | Custom path to the language server |
| `isl.defaultTarget` | `"typescript"` | Default code generation target |
| `isl.formatOnSave` | `true` | Format ISL files on save |
| `isl.lintOnSave` | `true` | Run linter on save |
| `isl.trace.server` | `"off"` | LSP trace level (`off`, `messages`, `verbose`) |
| `isl.languageServer.enabled` | `true` | Enable/disable the language server |
| `isl.codegen.outputDir` | `"generated"` | Output directory for generated code |
| `isl.validation.enabled` | `true` | Enable real-time validation |

### Example Configuration

```json
{
  "isl.server.path": "",
  "isl.defaultTarget": "typescript",
  "isl.formatOnSave": true,
  "isl.lintOnSave": true,
  "isl.trace.server": "off"
}
```

## Language Server

The extension bundles the ISL Language Server for a seamless experience. The server provides:

- Diagnostics and error reporting
- Completion suggestions
- Hover documentation
- Go to definition
- Find references
- Code formatting
- Code actions

### Server Detection

The extension looks for the language server in this order:
1. Custom path from `isl.server.path` setting
2. Bundled with the extension
3. Workspace `node_modules`
4. Global npm/pnpm installation

## File Association

The extension automatically associates with `.isl` files. You can also manually set the language mode:

1. Open a file
2. Click on the language mode in the status bar (bottom right)
3. Select "Intent Specification Language"

## Example ISL File

```isl
// User management domain specification
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
    name: String
    status: UserStatus
    created_at: Timestamp [immutable]

    invariants {
      - email.contains("@")
      - name.length > 0
    }
  }

  intent CreateUser {
    pre: input.email.isValid && !User.exists(email: input.email)
    post: User.exists(result.id) && User.email == input.email
  }

  behavior CreateUser {
    description: "Create a new user account"

    actors {
      Admin {
        must: authenticated
      }
    }

    input {
      email: String
      name: String
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

    temporal {
      - within 500ms (p99): response returned
    }
  }

  scenario "Create user with valid email" {
    given: { no existing user with email "test@example.com" }
    when: CreateUser(email: "test@example.com", name: "Test User")
    then: success with User where email == "test@example.com"
  }

  chaos {
    inject: database_timeout
    expect: graceful_degradation with retry
  }
}
```

## Project Initialization

Run `ISL: Initialize Project` from the command palette to create:

- `.islrc.json` - Project configuration file
- `specs/example.isl` - Example specification file

## Troubleshooting

### Language server not starting

1. Check the Output panel (View > Output) and select "ISL" from the dropdown
2. Verify `isl.languageServer.enabled` is `true`
3. Try `ISL: Restart Language Server` from the command palette
4. Check if a custom server path is set and valid

### Syntax highlighting not working

1. Ensure the file has `.isl` extension
2. Check if the language mode is set to "Intent Specification Language"
3. Try reloading VS Code

### Commands not appearing

Commands like `Parse Current File` only appear when an ISL file is open and focused.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

## License

MIT License - see [LICENSE](LICENSE) for details.
