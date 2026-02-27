---
title: VS Code Extension — Changelog
description: Release history for the ShipGate ISL VS Code extension.
---

## v1.0.0

Initial release of the ShipGate ISL extension for Visual Studio Code.

### Features

- **ISL syntax highlighting** — full TextMate grammar for all ISL constructs including domains, entities, behaviors, scenarios, chaos blocks, temporal constraints, and standard library imports
- **Real-time diagnostics** — parse errors and type checking powered by the ISL language server (`@isl-lang/lsp-server`)
- **IntelliSense** — keyword completion, type completion, and entity/behavior name completion within the current domain
- **Snippets** — templates for domain, entity, behavior, scenario, chaos, preconditions, postconditions, and enum declarations
- **Code formatting** — automatic ISL file formatting with 2-space indentation and consistent brace style
- **Commands** — verify, generate, gate, type check, format, and coverage commands accessible from the Command Palette
- **Code lens** — inline Verify and Generate actions above behaviors and entities

### Supported ISL features

- Domain declarations with version and owner
- Entity declarations with fields, modifiers, invariants, and lifecycle
- Behavior declarations with all sections (actors, input, output, preconditions, postconditions, invariants, temporal, security, compliance)
- Custom type declarations with constraints
- Enum declarations
- Scenario blocks (given/when/then)
- Chaos blocks (inject/expect/retries)
- Standard library imports (`use @isl/string`, etc.)
- All expression operators and quantifiers

### Requirements

- VS Code 1.85+
- Node.js 18+
- ShipGate CLI (`@isl-lang/cli`)
