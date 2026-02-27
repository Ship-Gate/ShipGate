# Documentation Site Structure

## Page Index

| Filename | Title | Description |
|----------|-------|-------------|
| `getting-started.md` | Getting Started | 5-minute quickstart. Install, init, verify, gate. Gets the user to a SHIP/NO_SHIP verdict on their own code. |
| `isl-reference.md` | ISL Language Reference | Full specification of ISL syntax — domain, entity, behavior, preconditions, postconditions, invariants, types, enums, api, storage, config, workflow, event. |
| `cli-reference.md` | CLI Reference | Every command, every flag, with examples. Organized by workflow: init → verify → gate → vibe → scan. |
| `vibe-pipeline.md` | The Vibe Pipeline | End-to-end walkthrough of NL → ISL → codegen → verify → SHIP. Covers --lang, --dry-run, --from-spec, heal loop, token budget. |
| `truthpack.md` | Truthpack Format | Schema for the auto-extracted ground truth (routes, env vars, auth rules, contracts). How it's built, how it's used, how to extend it. |
| `policy-rules.md` | Policy Rules | All 27 policy rules with id, severity, description, remediation hint, and language applicability. Searchable. |
| `mcp-setup.md` | MCP / AI Firewall Setup | How to configure shipgate as an MCP server for Cursor, Copilot, and Claude Code. Real-time suggestion interception. |
| `github-actions.md` | GitHub Actions Integration | Full workflow setup — the generated shipgate.yml, custom composite action, evidence artifact upload, PR comments. |
| `multi-lang-codegen.md` | Multi-Language Codegen | Using --lang to generate Python (FastAPI), Rust (Axum), Go (Gin) from ISL. Adapter architecture. Limitations per language. |
| `evidence-bundles.md` | Evidence Bundles | JSON schema for evidence artifacts. How to read reports, how to render HTML, how to use `shipgate open`. Fingerprint verification. |
| `ship-score.md` | Ship Score | How the 0–100 score is calculated. What raises it, what drops it. How to go from NO_SHIP to SHIP. |
| `migration.md` | Migrating from ESLint / SonarQube / Semgrep | Comparison of what each tool catches vs. what shipgate catches. Side-by-side. Migration guide — shipgate is additive, not a replacement. |
| `faq.md` | FAQ | Common questions: "Is ISL Turing-complete?", "Do I need an API key?", "Can I use this without AI?", "What about monorepos?", "How does it differ from TLA+?" |
