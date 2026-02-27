# Docs Site QA — 1.0

**Agent:** Docs Site QA (Agent 10)  
**Date:** 2026-02-09  
**Scope:** Public docs site validation for a new user (homepage, quickstart, API docs, link check, UX).

---

## 1. What Was Checked

### 1.1 Live site availability

| URL | Result |
|-----|--------|
| **https://shipgate.dev** | **Parked domain** — Hostinger “Parked Domain” page. No ShipGate content. |
| **https://shipgate.dev/docs** | Not reachable (navigates to parked domain or error). |
| **https://docs.shipgate.dev** | Configured in `packages/docs/astro.config.mjs` as `site: "https://docs.shipgate.dev"`. Not verified live (browser session unavailable). |
| **https://intentos.dev/docs** | Page load failed (no live docs at this URL). |

**Conclusion:** The main domain **shipgate.dev** does **not** serve the docs; it shows a registrar placeholder. The docs app is built from `packages/docs` (Astro/Starlight) and is intended to be deployed at **docs.shipgate.dev**. Until that (or another) URL is live, new users cannot use a “public docs site” as described in the checklist.

### 1.2 Docs source (repo) — coverage

Audited the **docs source** in the repo:

- **Homepage:** `packages/docs/src/content/docs/index.mdx` — hero, install snippet, “How it works”, cards to Quick Start, Syntax Reference, CLI, CI.
- **Quickstart:** `packages/docs/src/content/docs/getting-started/quickstart.md` — 6 steps (install → spec → check → gen → verify → gate). Readable and coherent.
- **Installation:** `packages/docs/src/content/docs/getting-started/installation.md` — prerequisites, global/project install, init, from-code, VS Code.
- **CLI reference:** Pages for `verify`, `generate`, `init`, `lint`, `repl`, `watch`. No dedicated pages for `check`, `gate`, `parse`, `fmt`, `trust-score`, `heal`, `proof`, `pbt`, `chaos`, `policy`, etc.
- **API reference:** `api/gate-api.md`, `api/dashboard-api.md` present.
- **Internal links:** All in-repo links use Starlight slugs that match the sidebar (e.g. `/getting-started/quickstart/`, `/guides/ci-integration/`, `/isl-language/syntax-reference/`). No broken internal links found in the scanned content.

### 1.3 Install and command accuracy (vs CLI)

- **Install:** Docs say `npm install -g @isl-lang/cli`. The published CLI package name in this repo is **`shipgate`** (`packages/cli/package.json` → `"name": "shipgate"`). So the correct install for the published package is `npm install -g shipgate`. If the package is published under a different name (e.g. `@isl-lang/cli`), docs and npm must be aligned.
- **Quickstart commands:** Compared to `packages/cli`:
  - `shipgate check user-service.isl` — **matches** (`check [files...]`).
  - `shipgate gen typescript user-service.isl -o ./src/generated` — **matches** (`gen <target> <file>`, target `ts`/`typescript`, `-o` supported).
  - `shipgate verify user-service.isl --impl ./src/user-service.ts` — **matches** (verify with path and `--impl`).
  - `shipgate gate user-service.isl --impl ./src/user-service.ts` — **matches** (gate command exists).
- **Init:** Docs say init creates `.shipgate.yml`, `specs/`, and optionally `.github/workflows/shipgate.yml`. **Matches** CLI behavior (config loader and init command).

### 1.4 Top 15–25 links (sidebar + key in-page links)

These were checked against the **sidebar and file layout** (no live click-through):

| # | Link / slug | File exists | Notes |
|---|-------------|-------------|--------|
| 1 | Getting Started → Installation | ✅ | `getting-started/installation.md` |
| 2 | Getting Started → Quick Start | ✅ | `getting-started/quickstart.md` |
| 3 | Getting Started → Your First Spec | ✅ | `getting-started/your-first-spec.md` |
| 4 | ISL Language → Syntax Reference | ✅ | `isl-language/syntax-reference.md` |
| 5 | ISL Language → Types | ✅ | `isl-language/types.md` |
| 6 | ISL Language → Entities | ✅ | `isl-language/entities.md` |
| 7 | ISL Language → Behaviors | ✅ | `isl-language/behaviors.md` |
| 8 | ISL Language → Postconditions | ✅ | `isl-language/postconditions.md` |
| 9 | ISL Language → Scenarios | ✅ | `isl-language/scenarios.md` |
| 10 | ISL Language → Chaos Engineering | ✅ | `isl-language/chaos.md` |
| 11 | ISL Language → Standard Library | ✅ | `isl-language/stdlib.md` |
| 12 | Guides → CI/CD Integration | ✅ | `guides/ci-integration.md` |
| 13 | Guides → Specless Mode | ✅ | `guides/specless-mode.md` |
| 14 | Guides → Team Configuration | ✅ | `guides/team-config.md` |
| 15 | Guides → Migration | ✅ | `guides/migration.md` |
| 16 | Guides → Best Practices | ✅ | `guides/best-practices.md` |
| 17 | CLI Reference → verify | ✅ | `cli/verify.md` |
| 18 | CLI Reference → generate | ✅ | `cli/generate.md` |
| 19 | CLI Reference → lint | ✅ | `cli/lint.md` |
| 20 | CLI Reference → init | ✅ | `cli/init.md` |
| 21 | CLI Reference → repl | ✅ | `cli/repl.md` |
| 22 | CLI Reference → watch | ✅ | `cli/watch.md` |
| 23 | API Reference → Gate API | ✅ | `api/gate-api.md` |
| 24 | API Reference → Dashboard API | ✅ | `api/dashboard-api.md` |
| 25 | VS Code → Installation, Features, Changelog | ✅ | `vscode/*.md` |

All of the above correspond to existing files under `packages/docs/src/content/docs/`. No broken internal links were identified in the sampled doc content.

---

## 2. Broken Links

- **External / live:** The **homepage** at **https://shipgate.dev** is a parked domain. Any link that points users to “shipgate.dev” for docs leads to the registrar page, not the documentation. If the app is deployed at **docs.shipgate.dev**, that URL is not yet verified live and should be confirmed.
- **Internal (within docs app):** No broken internal links found in the reviewed markdown (all `/getting-started/...`, `/guides/...`, `/isl-language/...`, `/cli/...`, `/api/...`, `/vscode/...` match the sidebar slugs and existing files).

---

## 3. Mismatches with CLI Behavior

| Doc location | Doc says | CLI reality | Severity |
|--------------|----------|-------------|----------|
| **Installation**, **Quick Start**, **index.mdx** | `npm install -g @isl-lang/cli` | Published package name in repo is **`shipgate`** (`packages/cli/package.json`). Install that works for published CLI: `npm install -g shipgate`. | **High** — copy-paste can fail for users installing from npm. |
| **CLI Reference sidebar** | Only: verify, generate, lint, init, repl, watch | CLI also has: `check`, `gate`, `parse`, `fmt`, `trust-score`, `heal`, `proof`, `pbt`, `chaos`, `policy`, truthpack, drift, etc. | **Medium** — primary commands like `check` and `gate` have no dedicated pages. |
| **Quick Start** | Uses `shipgate` for all commands | When running from repo (e.g. `pnpm --filter @isl-lang/cli exec isl ...`), binary is `isl`. Both `shipgate` and `isl` are in `bin` in package.json. | **Low** — acceptable if “shipgate” is the supported user-facing name. |

---

## 4. Proposed Edits (Exact Pages/Sections)

### 4.1 Install command (high impact)

- **Pages:** `packages/docs/src/content/docs/getting-started/installation.md`, `packages/docs/src/content/docs/getting-started/quickstart.md`, `packages/docs/src/content/docs/index.mdx`.
- **Change:** Replace `npm install -g @isl-lang/cli` with the **actual published package name**. If the published package is `shipgate`, use:
  - `npm install -g shipgate`
  and optionally note: “From source you can run the CLI as `isl` (e.g. `pnpm --filter @isl-lang/cli exec isl --version`).”
- **Section:** Every code block or line that shows the install command (Installation “Install the CLI”, Quick Start “1. Install ShipGate”, index “Install in seconds”).

### 4.2 Homepage / docs URL (critical for new users)

- **Owners:** Infra / product. Not a doc copy edit.
- **Proposal:** Either (a) deploy the Astro docs to **docs.shipgate.dev** (or another stable URL) and redirect **shipgate.dev** to the docs or landing, or (b) clearly document in README/release notes that “Documentation: https://docs.shipgate.dev” (or the real URL) and that shipgate.dev may be parked.
- **RELEASE_1.0_CHECKLIST.md:** The item “Verify homepage: https://shipgate.dev” should be updated to either “Verify docs: https://docs.shipgate.dev” or “Verify shipgate.dev redirects to docs” once deployment is decided.

### 4.3 CLI Reference — add core commands

- **Location:** `packages/docs/astro.config.mjs` sidebar + new pages under `packages/docs/src/content/docs/cli/`.
- **Proposal:** Add sidebar entries and pages for at least:
  - **check** — parse and type-check ISL files (`shipgate check [files...]`).
  - **gate** — SHIP/NO_SHIP gate (`shipgate gate <spec> --impl <path>`).
  Optionally add **parse**, **fmt**, or link to a single “CLI overview” that lists all commands with one-line descriptions and links to existing subpages.

### 4.4 Quick Start — align binary name

- **Page:** `packages/docs/src/content/docs/getting-started/quickstart.md`.
- **Current:** All commands use `shipgate`.
- **Proposal:** Add a short note after “Install ShipGate”: “If you’re building from source, you may have the CLI as `isl`; in that case use `isl` instead of `shipgate` in the examples below.” This reduces confusion for contributors.

### 4.5 “Explore commands” entry point

- **Page:** `packages/docs/src/content/docs/index.mdx`.
- **Current:** “Explore commands →” links to `/cli/verify/`.
- **Proposal:** Either (a) change the link to a new `/cli/` overview page that lists all commands (including check and gate), or (b) keep linking to verify but add a sentence: “For type-checking use `shipgate check`; for the SHIP/NO_SHIP gate use `shipgate gate`.”

---

## 5. Top 5 UX / Confusion Points and Quick Fixes

| # | Issue | Impact | Quick fix |
|---|--------|--------|-----------|
| 1 | **shipgate.dev is parked** — New users going to “the docs” land on a registrar page. | Critical — no usable public docs experience. | Deploy docs to docs.shipgate.dev (or agreed URL) and point shipgate.dev there or to a landing that links to docs. |
| 2 | **Install command uses wrong package name** — Docs say `@isl-lang/cli`; published name is `shipgate`. | High — install fails or installs wrong package. | Update all install blocks to `npm install -g shipgate` (or the real published name) and add a one-line note for source users. |
| 3 | **No doc for `check` or `gate`** — Quick Start uses them, but CLI Reference only has verify, generate, init, lint, repl, watch. | High — users can’t find reference for the first commands they run. | Add CLI pages for `check` and `gate` and add them to the sidebar; optionally add a CLI overview. |
| 4 | **“Explore commands” goes only to verify** — Suggests verify is the main command; check and gate are invisible in nav. | Medium — discoverability of check/gate is poor. | Add a CLI overview or at least sidebar items + pages for check and gate; optionally change the homepage “Explore commands” link to the overview. |
| 5 | **Binary name inconsistency** — Docs say `shipgate`; README/source often show `isl`. | Medium — contributors and power users get confused. | Add one sentence in Installation or Quick Start: “When using the published CLI you’ll use `shipgate`; when running from source you may use `isl`.” |

---

## 6. Summary

| Item | Status |
|------|--------|
| Homepage loads (public URL) | ❌ shipgate.dev is parked; docs app not verified at docs.shipgate.dev. |
| Quickstart reachable & readable | ✅ In repo; clear and well-structured. |
| Install commands match reality | ❌ Docs use `@isl-lang/cli`; published package is `shipgate`. |
| Top 15–25 links (structure) | ✅ All corresponding files exist; no broken internal links found. |
| API docs (stale or not) | ⚠️ Not compared line-by-line to code; Gate API and Dashboard API pages exist. |

**Recommendation:** Before treating “Documentation Site” as done in the release checklist, (1) deploy the docs to a stable URL and fix the shipgate.dev experience, and (2) align install instructions and CLI reference with the published package and the most-used commands (`check`, `gate`).

---

## 7. Fixes applied (post-QA)

The following edits were made in the docs repo after this QA:

- **Install command:** Replaced `@isl-lang/cli` with `shipgate` in `packages/docs/src/content/docs/getting-started/installation.md`, `quickstart.md`, and `index.mdx`. Project-level install also updated to `shipgate`.
- **Binary name note:** Added a sentence in Installation and Quick Start that when using the published CLI you use `shipgate`, and when running from source the binary may be `isl`.
- **CLI Reference:** Added two new pages and sidebar entries: CLI: check and CLI: gate (`packages/docs/src/content/docs/cli/check.md`, `gate.md`). Sidebar in `packages/docs/astro.config.mjs` now lists check and gate first under CLI Reference.
- **Homepage "Explore commands":** Updated the CLI Reference card on the docs index to mention `shipgate check` and `shipgate gate`; the "Explore commands" link still goes to `/cli/verify/`.

The shipgate.dev parked-domain / deployment issue is unchanged and requires infra or product action.
