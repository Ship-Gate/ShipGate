---
title: VS Code Extension — Installation
description: Install and configure the ShipGate ISL extension for VS Code.
---

The ShipGate ISL extension adds ISL language support to Visual Studio Code with syntax highlighting, real-time diagnostics, and verification commands.

## Install from marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"ShipGate ISL"**
4. Click **Install**

Or install from the command line:

```bash
code --install-extension shipgate-isl
```

## What you get

After installation, VS Code will recognize `.isl` files and provide:

- **Syntax highlighting** for all ISL constructs
- **Real-time error detection** as you type
- **IntelliSense** for ISL keywords and built-in types
- **Snippets** for common patterns (entity, behavior, scenario)
- **Commands** for verification and code generation
- **Code formatting** for ISL files

## Configuration

Open VS Code settings (`Ctrl+,`) and search for "ShipGate" to configure:

| Setting                           | Default | Description                       |
| --------------------------------- | ------- | --------------------------------- |
| `shipgate.specPath`               | `specs/` | Default path for ISL spec files  |
| `shipgate.implPath`               | `src/`   | Default implementation path      |
| `shipgate.verifyOnSave`           | `false`  | Auto-verify when saving .isl files |
| `shipgate.showInlineDiagnostics`  | `true`   | Show errors inline in editor     |
| `shipgate.gateThreshold`          | `80`     | Default gate trust score threshold |

## File association

The extension automatically recognizes `.isl` files. To manually associate other file extensions, add to your `settings.json`:

```json
{
  "files.associations": {
    "*.intent": "isl",
    "*.spec.isl": "isl"
  }
}
```

## Verify the installation

1. Create a file named `test.isl`
2. Type a domain declaration:

```isl
domain Test {
  entity User {
    id: UUID [immutable, unique]
    email: Email
  }
}
```

3. You should see syntax highlighting for keywords, types, and modifiers

## Requirements

- VS Code 1.85 or later
- Node.js 18+ (for CLI integration)
- ShipGate CLI installed (`npm install -g @isl-lang/cli`)

## Troubleshooting

### Extension not activating

The extension activates when:
- You open a `.isl` file
- Your workspace contains `.isl` files
- You run a ShipGate command

If it's not activating, check the Output panel (`Ctrl+Shift+U`) and select "ShipGate ISL" from the dropdown.

### Diagnostics not showing

Ensure the ShipGate CLI is installed and accessible:

```bash
shipgate --version
```

If the CLI is installed locally (not globally), set the path in settings:

```json
{
  "shipgate.cliPath": "./node_modules/.bin/shipgate"
}
```
