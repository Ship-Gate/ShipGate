# Changelog

## 0.1.1

### Patch Changes

- Updated dependencies [b67276d]
  - @isl-lang/lsp-server@1.0.0
  - @isl-lang/firewall@0.2.1

All notable changes to the **Shipgate ISL** VS Code extension are documented here.

This project follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Changed

- **Gate on save** — Clarified configuration descriptions for `shipgate.firewall.runOnSave` (lightweight checks on save) and `shipgate.scan.scanOnSave` (full gate on save). Firewall on save is enabled by default.
- **Marketplace** — Added "Machine Learning" category for better discovery among AI coding tools.

---

## [0.1.0] — 2026-02-08

### Added

- **ISL Syntax Highlighting** — Full TextMate grammar for `.isl` files with rich
  colorization of keywords, types, annotations, operators, temporal expressions,
  string literals, duration literals, and documentation comments.

- **Language Server Integration** — LSP client connecting to `@isl-lang/lsp-server`
  providing real-time diagnostics, autocomplete, hover documentation, go-to-definition,
  document symbols, formatting, and semantic tokens.

- **Shipgate Commands**
  - `Shipgate: Generate ISL Spec` — scaffolds a `.isl` spec from TypeScript/JavaScript source files.
  - `Shipgate: Verify Current File` — runs behavioral verification and reports violations in the Problems panel.
  - `Shipgate: Verify Workspace` — verifies the entire workspace against all ISL specs.
  - `Shipgate: Show ISL Coverage` — toggles gutter decorations showing spec coverage.

- **CodeLens** — Inline action buttons above `behavior` and `entity` declarations:
  Verify, Generate Tests, and Coverage.

- **Status Bar** — Displays real-time spec coverage (`ISL: ✓ N/M specced`) and
  violation count, with click-to-verify action.

- **ISL Code Snippets** — Common ISL patterns (domain, entity, behavior, scenario)
  available as editor snippets.

- **Context Menus** — Right-click integration for ISL files (verify, coverage) and
  TypeScript/JavaScript files (generate spec).

- **Configuration** — Server path, format-on-save, lint-on-save, codegen target,
  trace level, coverage auto-refresh, and validation toggle.

- **Language Configuration** — Bracket matching, auto-closing pairs, comment
  toggling, smart indentation, and code folding for ISL blocks.

- **ISL Studio Webview** — Interactive spec editor with assumption tracking,
  prompt interface, and evidence visualization.

- **Report Viewer** — Webview panel for viewing verification results with
  clause-level detail, fix suggestions, and navigation.

---

[0.1.0]: https://github.com/shipgate/shipgate/releases/tag/vscode-v0.1.0
