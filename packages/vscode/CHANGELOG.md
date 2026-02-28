# Changelog

All notable changes to the **Shipgate ISL** VS Code extension are documented here.  
This project follows [Semantic Versioning](https://semver.org/).

---

## [3.5.0] — 2026-02-28

### Added

- **Webview redesign** — Dark mission-control UI with score rings, verdict cards, and tabbed navigation (Overview / Actions / Findings / Files). Streamlined layout with improved information density and visual hierarchy.

### Fixed

- **CLI shim banner** — Added graceful handling for direct `node` invocation of the extension bundle (fixes "Cannot find module vscode" crash when the VSIX is run outside the extension host).
- **CLI resolver priority** — Now prefers workspace-local CLI over `npx`, reducing cold-start latency and ensuring the correct version runs in monorepo setups.
- **esbuild config** — Improved bundling with corrected externals and production minification settings.

### Changed

- **Minimum version: 3.5.0** — All previous VSIX builds (0.x through 3.1.x) are superseded. Users should install 3.5.0 or later.

---

## [3.1.0] — 2026-02-27

### Fixed

- **CLI resolution when installed** — The extension was running `node` on the extension install directory (e.g. `.cursor/extensions/shipgate.shipgate-isl-2.0.0-universal`) when the path didn't contain `packages/vscode`, so the replace never ran and `existsSync(extensionPath)` was true (directory exists). That made Node execute the extension bundle, which requires the `vscode` module and crashed outside the extension host. Now the local CLI path is only used when the extension path contains `packages/vscode` (monorepo dev); otherwise the extension uses `npx shipgate`. Same guard added in `resolveShipgateExecutable()` in `shipgateRunner.ts`.

---

## [2.0.0] — 2026-02-26

### Added

- **Actions Panel** — New sidebar tab with one-click buttons for every ShipGate workflow. Organized into Workflows, Analyze, Generate, and Spec Tools sections with an animated hero CTA.
- **`shipgate go` command** — One command to detect project, initialize ShipGate, infer ISL specs, verify, and gate. Bound to `Cmd+Shift+Enter`.
- **`shipgate vibe` command** — NL prompt → ISL spec → verified code, with language picker (TypeScript, Python, Rust, Go). Bound to `Cmd+Shift+V`.
- **Go + Auto-Heal** — `shipgate go --fix` scans then auto-heals violations.
- **Deep Scan** — `shipgate go --deep` runs thorough analysis with higher coverage.
- **AI Spec Inference** — `shipgate.inferSpecs` generates behavioral specs from existing code using AI.
- **Multi-language codegen buttons** — Sidebar buttons for TypeScript, Python, Rust, Go, GraphQL, and OpenAPI code generation from ISL. Each opens a file picker for `.isl` specs.
- **Code → ISL button** — Generate ISL spec from the current file directly from the sidebar.
- **Format & Lint button** — Auto-format all ISL files from the sidebar.
- **14 new VS Code commands** registered in the command palette with icons and categories.
- **Keyboard shortcuts** — `Cmd+Shift+Enter` for Go, `Cmd+Shift+V` for Vibe.
- **Onboarding empty state** — When no scan data exists, the sidebar shows a 3-step guide (Initialize → Verify → Ship) with a Get Started CTA that triggers `shipgate go`.

### Changed

- **Enterprise-grade design overhaul** — Complete CSS rewrite:
  - Refined dark color system with 5 background tiers and granular surface tokens
  - Design tokens for border radius, shadows, and transitions
  - Glassmorphism card effects with gradient overlays on hover
  - Custom thin scrollbar (5px) with dark track
  - Animated content transitions (`fadeSlideIn`) on tab switch
  - Header gradient with decorative bottom border fade
  - Logo glow effect with `box-shadow`
  - Active tab glow via `text-shadow`
- **Overview panel** — Score shown inside the ring, second glow circle for depth, stat cards with borders and hover states.
- **Files panel** — Summary bar showing Passed/Warnings/Failed counts at top, gradient divider, file rows with slide-right hover.
- **Claims panel** — Bordered cards with colored ring indicators and smaller monospace confidence text.
- **Pipeline panel** — Accent-colored detail border, bordered run and environment rows.
- **Actions tab always renders** — No longer requires scan data; works immediately on extension install.
- **Tighter typography** — `font-weight: 800` for hero headings, `-0.3px` letter-spacing, `9px` uppercase labels with `0.6px` tracking.
- **Gen grid** — Changed from 2-column to 3-column layout with shorter labels (TS, GQL) for better density.
- **Section titles** — Now have decorative `::after` line extending to fill width.

---

## [1.2.0] — 2026-02-27

### Fixed

- Fixed duplicate `shipgate.ship` command registration that caused extension installation to fail.
- Fixed `configurationDefaults` being placed outside the `contributes` block due to a mismatched closing brace.
- Removed unresolvable `workspace:*` dependencies (`@isl-lang/firewall`, `@isl-lang/lsp-server`) from the packaged VSIX.
- Removed library-only fields (`type`, `exports`, `types`, `sideEffects`) that are invalid for VS Code extensions.

---

## [1.0.0] — 2026-02-27

### Added

- **Production-ready release** — First stable release aligned with ShipGate CLI v1.0.0.
- **Vibe Panel** — Interactive panel for natural language → ISL → code generation workflow.
- **AI Firewall integration** — Real-time interception of AI suggestions against Truthpack and 27 policy rules.
- **Multi-language codegen** — Generate TypeScript, Python, Rust, or Go from ISL specs via the command palette.
- **Evidence HTML viewer** — `shipgate open` command opens rendered HTML evidence reports in browser.
- **Policy manifest** — `shipgate policy list` shows all 27 rules with severity and remediation hints.

### Changed

- Bumped version to `1.0.0` for production release.
- Updated repository URLs to `Ship-Gate/ShipGate`.

### Fixed

- Improved error handling in scan and verify commands.
- Better handling of workspace roots in multi-root workspaces.

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
