---
title: VS Code Extension — Features
description: Features of the ShipGate ISL extension for VS Code.
---

The ShipGate ISL extension provides a rich development experience for writing and verifying ISL specifications.

## Syntax highlighting

Full syntax highlighting for all ISL constructs:

- **Keywords** — `domain`, `entity`, `behavior`, `preconditions`, `postconditions`, etc.
- **Types** — `UUID`, `Email`, `String`, `Int`, `Money`, `List<T>`, etc.
- **Modifiers** — `[immutable]`, `[unique]`, `[sensitive]`, etc.
- **Operators** — `==`, `!=`, `implies`, `and`, `or`, `old()`, etc.
- **Constants** — `true`, `false`, `null`, `success`, `failure`
- **Comments** — single-line (`//`) and block (`/* */`)

The highlighting works with all VS Code color themes.

## Real-time diagnostics

The extension runs the ISL parser and type checker in the background. Errors appear as you type:

- **Parse errors** — syntax issues highlighted with red underlines
- **Type errors** — mismatched types, unknown references
- **Warnings** — missing postconditions, weak preconditions

## IntelliSense

### Keyword completion

Type the first few characters and get completions for:
- ISL keywords
- Built-in types
- Standard library functions
- Entity and behavior names (within the same domain)

### Snippets

Built-in snippets for common patterns:

| Prefix      | Expands to                          |
| ----------- | ----------------------------------- |
| `domain`    | Domain declaration skeleton         |
| `entity`    | Entity with id, invariants          |
| `behavior`  | Full behavior with all sections     |
| `scenario`  | Scenario with given/when/then       |
| `chaos`     | Chaos block with injection          |
| `pre`       | Preconditions block                 |
| `post`      | Postconditions block                |
| `enum`      | Enum declaration                    |

Example: typing `behavior` and pressing Tab expands to:

```isl
behavior Name {
  description: ""

  input {

  }

  output {
    success: Type
    errors {

    }
  }

  preconditions {

  }

  postconditions {
    success implies {

    }
    failure implies {

    }
  }
}
```

## Commands

Access commands via the Command Palette (`Ctrl+Shift+P`):

| Command                         | Description                        |
| ------------------------------- | ---------------------------------- |
| `ShipGate: Verify Current File` | Verify the active ISL file         |
| `ShipGate: Generate Code`       | Generate TypeScript from ISL       |
| `ShipGate: Run Gate`            | Run SHIP/NO_SHIP gate              |
| `ShipGate: Check Types`         | Parse and type-check               |
| `ShipGate: Format File`         | Format the current ISL file        |
| `ShipGate: Show Coverage`       | Show verification coverage         |
| `ShipGate: Generate Spec`       | Generate ISL from source code      |

## Code formatting

Format ISL files with:
- `Shift+Alt+F` (Format Document)
- Right-click > Format Document
- Format on save (if enabled in settings)

The formatter standardizes:
- Indentation (2 spaces)
- Brace placement
- Line spacing between blocks
- Alignment of field types and modifiers

## Verification results

After running `ShipGate: Verify Current File`, results appear in:

1. **Problems panel** — individual precondition/postcondition results
2. **Editor decorations** — inline pass/fail indicators
3. **Status bar** — trust score and verdict

## Code lens

Code lens annotations appear above behaviors and entities:

```
▶ Verify  |  ⚡ Generate  |  📊 3 scenarios
behavior CreateUser {
```

Click the annotations to run verification or generation directly.

## Multi-root workspace

The extension works with multi-root VS Code workspaces. Each workspace folder is treated independently for spec discovery and verification.

## Keyboard shortcuts

| Shortcut          | Action                    |
| ----------------- | ------------------------- |
| `Ctrl+Shift+V`   | Verify current file       |
| `Ctrl+Shift+G`   | Generate code             |
| `Shift+Alt+F`    | Format ISL file           |
