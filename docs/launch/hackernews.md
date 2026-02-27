# Hacker News "Show HN" Post

## Title
Show HN: ShipGate – behavioral CI gate for AI-generated code (NL → ISL → SHIP/NO_SHIP)

## Body

I've been working on ShipGate, a CLI tool that verifies AI-generated code against behavioral specifications before it ships.

The core insight: AI coding assistants produce code that compiles and passes linters but frequently hallucinates — it creates API routes that aren't in any spec, references env vars that don't exist, and generates endpoints without auth middleware. These are behavioral bugs, not syntactic ones. Static analysis misses them.

ShipGate introduces ISL (Intent Specification Language), a domain-specific language for behavioral contracts. An ISL spec defines what your code must do — preconditions, postconditions, invariants, error cases — not just what types it uses.

The pipeline:
1. You write ISL by hand, or describe what you want in natural language ("build a todo API with auth")
2. ShipGate generates the ISL spec (with retry+repair if the first attempt doesn't parse)
3. It generates code from the spec (TypeScript, Python, Rust, or Go)
4. It verifies the generated code against the spec — checking 27 policy rules including ghost route detection, secret exposure, auth enforcement, CORS misconfiguration, mass assignment, and more
5. It produces a binary verdict: SHIP (exit 0) or NO_SHIP (exit 1), with a tamper-proof evidence bundle

The evidence bundle is a JSON artifact containing the spec hash, implementation hash, clause-by-clause results, and a fingerprint. It's designed to be unforgeable and useful for compliance audit trails.

The "Truthpack" is a snapshot of your codebase's ground truth — routes, env vars, auth rules, API contracts — extracted automatically. When AI suggests new code, ShipGate cross-references it against the Truthpack to detect ghost artifacts.

It runs as a CLI (`shipgate gate --ci`), in GitHub Actions, or as an MCP server that intercepts AI suggestions inside Cursor in real time.

The whole thing is open source (MIT). ISL parser, policy engine, codegen packages — all of it.

```
npm install -g shipgate
shipgate vibe "build a user auth system with JWT"
```

GitHub: https://github.com/Ship-Gate/ShipGate
Docs: https://shipgate.dev/docs

I know this is a strong claim. Happy to discuss the verification approach, the limitations of ISL, and where this breaks down. I've been dogfooding it on the ShipGate codebase itself.

---

## Pre-Written Top Comment (answer to "Why not just use tests?")

> Why not just use tests?

Tests verify what you think to test. The gap with AI-generated code is that the AI confidently generates things you didn't ask for and wouldn't think to test against — a route you didn't specify, an env var you didn't declare, auth middleware that's absent because the AI "assumed" your framework handles it.

ShipGate's verification is spec-driven, not test-driven. You define the behavioral contract (ISL spec), and ShipGate checks every precondition, postcondition, and invariant against the implementation. Tests are a subset of this — ShipGate can also generate tests from specs — but the gate itself is a structural verification, not a test runner.

Think of it as the difference between "I wrote tests and they pass" vs "the implementation satisfies every clause in the spec." Tests tell you what you checked. Specs tell you what you should have checked.

That said, ShipGate isn't a replacement for tests. It's a layer above them. You still run your test suite. ShipGate gates the merge based on behavioral compliance, not test results.

---

## Anticipated HN Objections & Responses

### 1. "ISL is just another DSL nobody will learn."

Fair concern. ISL is designed to be writable by AI from natural language. The expected workflow for most users is: describe what you want in English → ShipGate generates the ISL → you review/edit it → it gates your code. You don't need to be fluent in ISL. You need to be fluent in what your code should do.

That said, ISL is intentionally small. The core constructs are `domain`, `entity`, `behavior`, `preconditions`, `postconditions`, `invariants`, `errors`. If you've used Alloy, TLA+, or even OpenAPI, you can read ISL in 5 minutes.

### 2. "This is just linting with extra steps."

Linting checks syntax and style. ShipGate checks behavior. A linter can tell you that your route handler has an unused variable. It can't tell you that the route handler shouldn't exist because it's not in any API spec. It can't tell you that the handler should check authentication because the ISL spec says `actor must: authenticated`. Ghost route detection, auth enforcement, env var validation — these are structural verification, not pattern matching.

### 3. "How reliable is NL → ISL? AI generating specs for AI-generated code is turtles all the way down."

The NL → ISL step has a retry+repair loop (up to 3 attempts) and produces a confidence score. If the generated ISL doesn't parse, ShipGate sends the error back to the model for repair. If confidence is below threshold, it warns you. You can also skip NL → ISL entirely and write specs by hand (`--from-spec`).

The key insight: the ISL spec is validated by a deterministic parser and type checker before any code is generated. The AI generates a candidate spec, but the verification pipeline is not AI — it's formal. If the spec is garbage, it fails validation. If the spec is valid but wrong, the code will fail verification. The AI is constrained at both ends.

### 4. "Tamper-proof evidence bundles — isn't that just a hash?"

It's a deterministic fingerprint derived from: spec hash + implementation hash + results hash + ISL version. The bundle contains all artifacts with individual hashes. You can re-derive the fingerprint from the artifacts to verify nothing was altered. It's not blockchain-level tamper-proof, but it's sufficient for audit trails where you need to prove "this code was verified against this spec and produced this result at this timestamp." Think of it as what `git log` is for source control, but for verification decisions.

### 5. "What about languages other than TypeScript?"

ISL itself is language-agnostic. The codegen packages target TypeScript (Next.js/Express/Fastify), Python (FastAPI/Pydantic), Rust (Axum), and Go (Gin). The policy rules (27 currently) apply across all four. The vibe pipeline supports `--lang python|rust|go` for end-to-end generation. TypeScript is the most mature. The others are functional but thinner — e.g., Python generates Pydantic models and pytest stubs but doesn't scaffold a full FastAPI project the way TypeScript scaffolds a full Next.js project yet.
