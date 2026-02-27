# Code-to-ISL Engine — Turn Any Project Into ISL So the Gate Can Verify It

## Goal

Build an **engine** that:

1. Takes **any** project (TypeScript, JavaScript, Python, Go, etc.) as input.
2. Produces **ISL specs** that describe the same behavior (entities, behaviors, pre/post conditions where inferrable).
3. So that **Shipgate’s gate** can verify the implementation against those specs (SHIP/NO_SHIP).

In other words: **code → engine → ISL → gate verifies**.

---

## What Already Exists

| Piece | Location | What it does |
|-------|----------|--------------|
| **isl-generate** | `packages/cli` | CLI command: scan path → per-file ISL. Uses `@isl-lang/inference` when available; fallback = regex (export function/class/interface → minimal domain). |
| **@isl-lang/inference** | `packages/inference` | Parses TS/Python; extracts types, functions, validations, test cases; generates entities, behaviors, invariants; optional AI enhancement. Returns ISL string + confidence. |
| **Gate** | `shipgate gate` | Verifies implementation vs ISL (and firewall). Needs ISL + impl path. |

So the pipeline **“any project → ISL”** is already partially there: `isl-generate` + inference. The engine is the **formalization and extension** of that into a single, robust, “turn this repo into ISL” flow.

---

## Engine Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Input: project root (or path to src/)                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1. DISCOVER                                                             │
│     - Detect language(s), framework (Next, Express, etc.)                │
│     - List source files (ts, js, py, go, …)                             │
│     - Optional: list tests for extra context                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. PARSE & EXTRACT (per file or per module)                             │
│     - AST-based: types, functions, params, return types, validations    │
│     - Heuristics: route handlers, API shapes, DB models                 │
│     - Optional: AI to infer pre/post from comments or behavior           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. AGGREGATE & NORMALIZE                                                │
│     - Group by domain (by folder, package, or config)                    │
│     - Dedupe entities/behaviors; merge from multiple files              │
│     - Resolve references (imports → same entity in another file)        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. GENERATE ISL                                                         │
│     - One domain per logical module (or one big domain)                 │
│     - Entities from types/interfaces/classes                             │
│     - Behaviors from functions/handlers with input/output               │
│     - Pre/post when inferrable (validations, tests, AI)                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Output: .isl file(s) + optional .shipgate.bindings.json                │
│  Then: shipgate gate <spec> --impl <path>                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Single entry point and config (fast)

- **CLI:** One command that runs the full pipeline, e.g.  
  `shipgate engine <path>` or `shipgate code-to-isl <path>`  
  - Runs discover → parse/extract (using existing inference + isl-generate) → aggregate → write ISL.
- **Config:** Optional `shipgate.engine.json` (or section in `.shipgate.yml`) to:
  - Set source dirs, ignore patterns, domain grouping (e.g. by folder).
  - Enable/disable AI, confidence threshold, overwrite.
- **Output:** Same as today: `specs/**/*.isl` (or one `generated.isl`) plus optional bindings.
- **Gate:** User (or same command) runs `shipgate gate specs/ --impl src/`.

Deliverable: “Point at repo → get ISL → run gate” in one workflow.

### Phase 2: Stronger extraction (so the gate is useful)

- **TypeScript/JavaScript:** Use inference’s TS parser everywhere; add route/API extraction (Express, Fastify, Next API routes) so behaviors map to real endpoints.
- **Python:** Use inference’s Python parser; add Flask/FastAPI route → behavior mapping.
- **Go:** Add a Go parser (or reuse existing if any) and basic type/func → entity/behavior.
- **Pre/post:** From validations (e.g. zod, joi), test descriptions, or optional AI (“given X, then Y” from comments).

Deliverable: Generated ISL that reflects real structure and some semantics so the gate can catch real drift.

### Phase 3: Bindings and verification loop

- **Bindings:** Engine writes `.shipgate.bindings.json` (or uses existing `shipgate bind`) so the gate knows which code file implements which behavior.
- **CI:** Single job: `shipgate engine . --output specs/ && shipgate gate specs/ --impl src/`.
- **Optional:** `shipgate engine --watch` to regenerate ISL on change and re-run gate.

Deliverable: Any project can be turned into ISL and verified in CI with minimal setup.

---

## Where to Put the Code

- **Option A (recommended):** Keep the pipeline in the CLI and inference:
  - Add `shipgate engine` (or `code-to-isl`) that orchestrates: discover → call inference/isl-generate per module → aggregate → write ISL + bindings.
  - Add a small `packages/code-to-isl-engine` that only does “discover + aggregate + config” and calls inference + generators. CLI depends on it.
- **Option B:** New package `@isl-lang/code-to-isl-engine` that encapsulates discover, parse, aggregate, generate; CLI just runs it.

Start with Option A: implement the orchestration in the CLI and in `isl-generate` (e.g. “full repo mode” that writes one or more domains and bindings), then extract to a dedicated package if needed.

---

## Success Criteria

- **Any** TS/JS (and ideally Python) repo: run `shipgate engine .` → get valid ISL under `specs/` (or configured dir).
- Run `shipgate gate specs/ --impl src/` → gate runs (spec gate + firewall); SHIP/NO_SHIP reflects real issues when possible.
- One-command CI: `shipgate engine . && shipgate gate specs/ --impl src/` (or a single `shipgate engine --verify` that does both).

---

## Next Steps

1. Add **`shipgate engine <path>`** (or `shipgate code-to-isl <path>`) that:
   - Scans path (reuse isl-generate scan).
   - For each file/module, calls inference (or lightweight fallback).
   - Aggregates by domain (folder or config).
   - Writes `.isl` files and optional bindings.
2. Add **engine config** (e.g. in `.shipgate.yml`: `engine.sourceDirs`, `engine.domainByFolder`, `engine.useAI`).
3. Document: “Turn any project into ISL” in README and docs (quickstart: engine → gate).
4. Iterate on inference quality (pre/post, routes, more languages) so the gate verification is meaningful.
