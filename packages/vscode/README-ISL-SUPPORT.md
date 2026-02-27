# VS Code ISL Language Support

VS Code language support for **ISL** (Intent Specification Language), including syntax highlighting, LSP features, and snippets.

## Features

### 1. TextMate Grammar (`syntaxes/isl.tmLanguage.json`)

Syntax highlighting for ISL with:

- **Keywords**: `entity`, `behavior`, `endpoint`, `actor`, `screen`, `form`, `scenario`, `constraint`, `version`, `when`, `then`, `must`, `can`, `cannot`, `returns`, `throws`
- **Types**: `String`, `Int`, `Boolean`, `UUID`, `Timestamp`, `Date`, `DateTime`, `Email`, `URL`, `array`, `optional`, and more
- **Annotations**: `[min: N]`, `[max: N]`, `[format: X]`, `[unique]`, `[optional]`, `[default: X]`
- **Comments**: `//` line comments, `/* */` block comments, `#` hash comments
- **Strings**: `"double quoted"` and `'single quoted'`
- **Operators**: `->`, `=>`, `:`, `|`, `&`
- **Blocks**: `{ }` delimiters with proper scope nesting

### 2. Language Server (LSP)

The LSP is implemented in `@isl-lang/lsp-server` and provides:

#### Diagnostics (real-time validation)

- Parse errors with exact line/column
- Undefined entity references (behavior references entity not defined)
- Duplicate names (two entities with same name)
- Missing required fields (entity without id, behavior without endpoint)
- Type mismatches in constraints (e.g. `min` on string without length context)

#### Autocomplete

- After `entity`: suggest entity name patterns
- Inside entity block: suggest field types
- After `behavior`: suggest CRUD verbs + entity names (e.g. CreateUser, GetUser)
- After `actor`: suggest `must:`, `can:`, `cannot` blocks
- After `endpoint`: suggest HTTP methods (GET, POST, PUT, PATCH, DELETE) and path patterns
- Inside constraints: suggest valid constraint keys for the field type (min_length, max_length for String; min, max for Int)

#### Hover info

- Show construct documentation on hover for keywords, types, and user-defined symbols

#### Go to definition

- Click entity reference → jump to entity definition

#### Code actions

- Quick fixes for common issues (add postconditions, add error cases, etc.)
- **Generate ISL spec from this TypeScript file** — available in `.ts`/`.js` files via the lightbulb (Ctrl+.)

### 3. Extension Registration

The language is registered in `package.json`:

```json
{
  "contributes": {
    "languages": [{
      "id": "isl",
      "aliases": ["ISL", "Intent Specification Language"],
      "extensions": [".isl"],
      "configuration": "./language-configuration.json"
    }],
    "grammars": [{
      "language": "isl",
      "scopeName": "source.isl",
      "path": "./syntaxes/isl.tmLanguage.json"
    }],
    "snippets": [{
      "language": "isl",
      "path": "./snippets/isl.json"
    }]
  }
}
```

### 4. Snippet Templates

Three full-domain snippets:

| Prefix | Description |
|--------|-------------|
| `crud-app` | Basic CRUD app with entity and Create/Get/Update/Delete behaviors |
| `auth-system` | Auth system with User, Session, Register, Login, Logout |
| `realtime-app` | Real-time app with Channel, Message, SendMessage, SubscribeChannel |

Additional snippets: `domain`, `entity`, `behavior`, `scenario`, `type`, `enum`, and more.

## Usage

1. Open a `.isl` file — syntax highlighting and LSP features activate automatically.
2. In a `.ts` or `.js` file, use the lightbulb (Ctrl+.) and select **Generate ISL spec from this TypeScript file**.
3. Type a snippet prefix (e.g. `crud-app`) and press Tab to expand.

## Configuration

- `shipgate.languageServer.enabled` — Enable/disable the LSP (default: true)
- `shipgate.trace.server` — LSP trace level: off, messages, verbose
- `shipgate.validation.enabled` — Enable real-time validation

## Architecture

```
packages/vscode/           # VS Code extension
├── syntaxes/isl.tmLanguage.json   # TextMate grammar
├── snippets/isl.json             # Snippets
├── language-configuration.json    # Bracket matching, comments
└── src/
    ├── client.ts                  # LSP client
    └── providers/
        └── codeToIslCodeAction.ts # Code-to-ISL code action

packages/lsp-server/       # LSP implementation
├── src/
│   ├── server.ts          # Main LSP server
│   ├── documents.ts       # Document manager
│   └── features/
│       ├── diagnostics.ts # Parse + semantic diagnostics
│       ├── completion.ts  # Autocomplete
│       ├── hover.ts       # Hover info
│       ├── definition.ts  # Go to definition
│       ├── actions.ts     # Code actions
│       └── semantic-linter.ts  # Duplicate entities, etc.
```
