# Changelog

All notable changes to the **Shipgate ISL** VS Code extension are documented here.  
This project follows [Semantic Versioning](https://semver.org/).

---

## [0.3.0] — 2026-02-17

### Added

- **New gate logo** — Marketplace icon updated to the official Shipgate S|G gate logo.
- **Sailship sidebar icon** — Activity bar and sidebar now display a clean sailship SVG that adapts to VS Code dark/light themes.
- **CSP-compliant webview** — Removed external Google Fonts dependency; sidebar panel now uses VS Code's native font variables (`--vscode-font-family`, `--vscode-editor-font-family`) for perfect theme integration and CSP compliance.
- **Dashboard sailship header** — Dashboard panel header icon updated to ⛵.

### Fixed

- **Webview Content Security Policy** — Added explicit CSP meta tag to the sidebar webview, preventing console security warnings and potential future Marketplace rejections.
- **External font loading** — Google Fonts was silently blocked by VS Code's default CSP. Fonts now correctly inherit from the user's VS Code theme and editor settings.

### Changed

- Bumped version to `0.3.0`.

---

## [0.2.0] — 2026-02-10

### Added

- **ShipGate Dashboard** — Full-featured sidebar panel with trust score ring, verdict badge, file-level findings, pipeline status, and action buttons.
- **Proof Bundle Viewer** — Dedicated webview panel for inspecting verification proof bundles (`.shipgate/proof-bundle.json`).
- **Evidence Decorations** — Gutter decorations showing pass/fail evidence markers in source files after verification.
- **Evidence CodeLens** — Inline CodeLens badges above functions showing verification evidence source.
- **File Decorations** — Explorer file decorations (✓/✗) reflecting spec coverage and verification status.
- **Watch mode** — `shipgate.toggleWatch` command and `shipgate.watchMode` config toggle.
- **Trust score command** — `shipgate.trustScore` shows the current trust score in a terminal.
- **Coverage, drift, security, compliance, chaos, simulate, PBT commands** — Full command palette integration for all CLI subcommands.
- **Scan on save** — `shipgate.scanOnSave` config triggers verification on every file save.

### Fixed

- CLI exit-code handling — `shipgate verify` exits 1 for NO_SHIP but still emits JSON; the extension now correctly parses results in both cases.
- Sidebar state persistence — last scan results are restored when the panel is re-opened via `workspaceState`.

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
