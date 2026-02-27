# @isl-lang/lsp-server

Language Server Protocol (LSP) implementation for ISL.

## Installation

```bash
npm install @isl-lang/lsp-server
```

## Usage

### As a standalone server

```bash
# Start in stdio mode (for editor integration)
isl-lsp --stdio

# Start in socket mode
isl-lsp --socket --port 5007
```

### Programmatic usage

```typescript
import { createServer, startServer } from '@isl-lang/lsp-server';

// Create and start server
const server = createServer();
startServer(server, { stdio: true });

// Or with custom configuration
const server = createServer({
  capabilities: {
    completionProvider: { triggerCharacters: ['.', ':'] },
    hoverProvider: true,
    definitionProvider: true,
  },
});
```

## Features

The ISL language server provides:

- **Diagnostics** - Real-time error reporting
- **Completion** - Context-aware suggestions
- **Hover** - Type information and documentation
- **Go to Definition** - Navigate to declarations
- **Find References** - Find all usages
- **Document Symbols** - File outline
- **Workspace Symbols** - Project-wide symbol search
- **Formatting** - Code formatting
- **Rename** - Safe symbol renaming
- **Code Actions** - Quick fixes and refactoring

## Editor Integration

### VS Code

Install the [ISL extension](https://marketplace.visualstudio.com/items?itemName=isl-lang.isl-lang) which includes this server.

### Neovim (nvim-lspconfig)

```lua
local lspconfig = require('lspconfig')

lspconfig.isl.setup({
  cmd = { 'isl-lsp', '--stdio' },
  filetypes = { 'isl' },
  root_dir = lspconfig.util.root_pattern('isl.config.yaml', '.git'),
})
```

### Sublime Text (LSP package)

```json
{
  "clients": {
    "isl": {
      "command": ["isl-lsp", "--stdio"],
      "selector": "source.isl"
    }
  }
}
```

### Emacs (lsp-mode)

```elisp
(lsp-register-client
 (make-lsp-client
  :new-connection (lsp-stdio-connection '("isl-lsp" "--stdio"))
  :major-modes '(isl-mode)
  :server-id 'isl-lsp))
```

## Configuration

The server reads configuration from `isl.config.yaml`:

```yaml
lsp:
  diagnostics:
    enabled: true
    debounce: 200
  completion:
    snippets: true
    autoImport: true
  formatting:
    tabSize: 2
    insertSpaces: true
```

## Documentation

Full documentation: https://isl-lang.dev/docs/lsp-server

## Import-Aware Diagnostics

The ISL language server supports multi-file ISL projects with import resolution. When your ISL files use imports, the server provides:

### Import Resolution

- **Cross-file symbol lookup**: Resolve types, entities, and behaviors from imported files
- **Missing import errors**: Detect when imported files cannot be found (`ISL2001`)
- **Unknown export errors**: Detect when importing symbols that don't exist in the source file (`ISL2002`)
- **Unused import hints**: Detect imports that are never used (`ISL2003`)

### Diagnostic Locations

Import errors are shown at both:
- The import site (where the `imports` statement is)
- Related information pointing to available exports in the imported file

### Example

```isl
// common-types.isl
domain CommonTypes {
  version: "1.0.0"
  type Email = String { format: "email" }
}

// user-domain.isl
domain UserDomain {
  version: "1.0.0"
  imports { Email, UnknownType } from "./common-types"
  //               ^^^^^^^^^^^ ISL2002: 'UnknownType' is not exported from './common-types'
  
  entity User {
    email: Email  // Resolved from import
  }
}
```

## Semantic Lint Rules

The server includes semantic linting with the following rules:

| Code | Name | Severity | Description |
|------|------|----------|-------------|
| ISL1001 | missing-postcondition | Warning | Behavior has no postconditions |
| ISL1002 | precondition-without-error | Hint | Behavior has preconditions but no error cases |
| ISL1003 | unused-type | Hint | Type is defined but never used |
| ISL1004 | undefined-behavior-reference | Error | Scenarios reference undefined behavior |
| ISL1010 | missing-description | Hint | Behavior should have a description |
| ISL1011 | entity-without-id | Warning | Entity should have an id field |
| ISL1012 | mutable-behavior-no-temporal | Hint | State-modifying behavior without temporal constraints |
| ISL1013 | no-scenarios | Hint | Behavior has no test scenarios |
| ISL1020 | sensitive-field-unprotected | Warning | Sensitive field without constraints |
| ISL1021 | no-authentication | Hint | State-modifying behavior without security |
| ISL1030 | unbounded-list | Hint | List type without size constraint |
| ISL1031 | missing-pagination | Hint | List-returning behavior without pagination |

### Quickfix Support

All lint rules include quickfix data payloads that enable VS Code code actions:

- Add postconditions block
- Add error cases for preconditions
- Add id field to entity
- Add temporal constraints
- Add security requirements
- Add pagination to input
- Generate test scenarios
- And more...

### Rule Configuration

Disable specific rules via configuration:

```typescript
import { ISLDiagnosticsProvider } from '@isl-lang/lsp-server';

const provider = new ISLDiagnosticsProvider(documentManager);
provider.configure({
  disabledRules: ['ISL1003', 'ISL1010']  // Disable unused-type and missing-description
});
```

## Related Packages

- [@isl-lang/lsp-core](https://npm.im/@isl-lang/lsp-core) - Core language intelligence
- [@isl-lang/cli](https://npm.im/@isl-lang/cli) - CLI tool

## License

MIT
