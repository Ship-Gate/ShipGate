# ProductHunt Launch

## Name
ShipGate

## Tagline (60 chars max)
SHIP or NO_SHIP — behavioral CI gate for AI-generated code

## Description (260 chars max)
AI writes code that compiles but hallucinates routes, forgets auth, and references ghost env vars. ShipGate verifies behavior — not just syntax. Define intent with ISL. Get a SHIP/NO_SHIP verdict with tamper-proof evidence. Open source. One command.

## Topics
- Developer Tools
- Artificial Intelligence
- Open Source
- Code Quality

## First Comment from Maker

I built ShipGate because I kept shipping AI-generated code that looked right but wasn't.

The pattern was always the same: ask Cursor or Copilot to build a feature, get back something that compiles and passes ESLint, deploy it, then discover the auth endpoint it created doesn't actually check tokens. Or it reads `process.env.STRIPE_KEY` but that variable was never configured. Or it wired up a route that doesn't match any API contract.

These aren't syntax bugs. Linters can't catch them. Tests only catch them if you already know to write tests for them — which you don't, because the AI told you it handled it.

So I built a gate. Not a linter. A behavioral verifier.

ShipGate works like this: you define what your code *must* do using ISL (Intent Specification Language) — preconditions, postconditions, invariants. Think of it as a contract, not a type. Then ShipGate checks your implementation against that contract and gives you a binary verdict: SHIP or NO_SHIP.

The "vibe pipeline" takes this further. You describe what you want in plain English, ShipGate generates the ISL spec, generates the code in TypeScript/Python/Rust/Go, verifies it against the spec, and if it fails, tries to heal the violations automatically. If it can't heal, you get NO_SHIP with exactly what's broken.

Everything produces a tamper-proof evidence bundle — a JSON artifact you can attach to PRs, store for audit, or use as proof-of-compliance in regulated environments.

It's open source. MIT license. Runs as a CLI, a CI gate, or an MCP server that intercepts AI suggestions in real time inside Cursor.

This is v2.1. ISL is the story — the language is the moat. We're not building another linter. We're building the specification layer that AI needs to be trustworthy.

Try it: `npm install -g shipgate && shipgate init`

Would love your feedback, especially from teams shipping AI-generated code in production.

## Media Needed

1. **Hero image** (1270x760): Dark terminal background showing `shipgate vibe "build a todo API"` with the full pipeline output ending in green "SHIP" verdict. Ship Score: 91/100.

2. **GIF: Ghost route detection** (800x500): Terminal running `shipgate scan .` on a project. Output shows BLOCK verdict for a ghost route `/api/v1/admin/users` with red highlight.

3. **GIF: Vibe pipeline** (800x500): Full `shipgate vibe "payment system with Stripe"` execution — ISL spec streams in, codegen happens, verify runs, SHIP at the end. ~10 seconds.

4. **Screenshot: GitHub PR comment** (800x400): The ShipGate bot comment on a PR showing verdict SHIP, trust score 94/100, with the expandable full report section.

5. **Screenshot: Policy list** (800x400): Terminal output of `shipgate policy list` showing rules organized by severity (critical, high, medium) with colored labels.

6. **Diagram: How it works** (1200x400): Three-step flow — "Define Intent (ISL)" → "Verify Code (27 policy rules)" → "Gate the Merge (SHIP/NO_SHIP)" with icons. Dark theme.
