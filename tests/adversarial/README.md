# Adversarial Red-Team Test Suite

Tests whether ShipGate's scanners can be bypassed using real-world evasion techniques. Every fixture contains **genuinely vulnerable code** that uses obfuscation or indirection to avoid detection.

## Purpose

Static analysis scanners rely on pattern matching, AST inspection, and taint tracking. This suite stress-tests those techniques by writing vulnerable code that:

- Produces the same exploitable behavior as direct vulnerable patterns
- Restructures the code so common detection heuristics miss it
- Reflects patterns AI code generators actually produce in the wild

When a scanner catches a fixture, we mark `expectedCaught: true` in the catalog. When it doesn't, we know where to improve.

## Structure

```
tests/adversarial/
├── evasion-catalog.ts          # Typed registry of all techniques
├── fixtures/
│   ├── sql-injection-evasion/  # SQL injection bypass attempts
│   ├── secret-evasion/         # Secret exposure bypass attempts
│   ├── xss-evasion/            # XSS bypass attempts
│   ├── auth-bypass/            # Auth evasion attempts
│   └── mock-evasion/           # Mock detector evasion attempts
├── package.json
├── tsconfig.json
└── README.md
```

## Evasion Techniques

### SQL Injection Evasion

| Fixture | Technique | Difficulty | Expected Caught |
|---------|-----------|------------|-----------------|
| `indirect-concat.ts` | Helper function concatenates SQL — taint crosses function boundary | Medium | No |
| `template-nesting.ts` | User input in intermediate template literal, then nested into SQL | Medium | No |
| `computed-property.ts` | Query builder accessed via `obj[key]()` bracket notation | High | No |
| `string-array-join.ts` | SQL built via `[...parts].join("")` instead of `+` concat | Medium | No |
| `dynamic-eval.ts` | SQL string built then passed through `eval()` | Low | **Yes** |

**Why these are hard to catch:** Most SQL injection scanners look for string concatenation (`+`) or template interpolation (`${}`) adjacent to SQL keywords (`SELECT`, `WHERE`). Indirect patterns break the lexical adjacency that scanners rely on.

### Secret Exposure Evasion

| Fixture | Technique | Difficulty | Expected Caught |
|---------|-----------|------------|-----------------|
| `base64-encoded.ts` | Secret stored as base64 literal, decoded via `Buffer.from()` | High | No |
| `split-concat.ts` | Key prefix and body in separate variables, concatenated at use | Medium | No |
| `char-codes.ts` | Secret assembled from `String.fromCharCode()` numeric arrays | High | No |
| `env-fallback.ts` | `process.env.KEY \|\| "hardcoded_secret"` — fallback is a real key | Low | **Yes** |
| `reversed.ts` | Secret stored backwards, reversed at runtime; also ROT13 variant | High | No |

**Why these are hard to catch:** Secret scanners use regex patterns like `/sk_live_[a-zA-Z0-9]+/`. Encoding, splitting, or reversing the secret means no single string literal matches the pattern.

### XSS Evasion

| Fixture | Technique | Difficulty | Expected Caught |
|---------|-----------|------------|-----------------|
| `dynamic-property.ts` | `element[propName] = input` where `propName = "innerHTML"` | Medium | No |
| `create-element.ts` | `createElement("div").innerHTML = input` then `appendChild()` | Low | **Yes** |
| `template-render.ts` | Handlebars `{{{html}}}` / EJS `<%- html %>` unescaped output | High | No |
| `iframe-srcdoc.ts` | `iframe.srcdoc = userInput` — full HTML injection | Medium | No |

**Why these are hard to catch:** XSS scanners typically match `.innerHTML`, `dangerouslySetInnerHTML`, or `document.write`. Bracket notation, template engine syntax, and lesser-known DOM sinks like `srcdoc` fall outside the usual sink list.

### Auth Bypass Evasion

| Fixture | Technique | Difficulty | Expected Caught |
|---------|-----------|------------|-----------------|
| `conditional-auth.ts` | `if (NODE_ENV !== "test") requireAuth()` — auth skipped conditionally | Medium | No |
| `role-confusion.ts` | JWT decoded but not signature-verified; role claim is trusted | High | No |
| `path-traversal-auth.ts` | Auth on `/api/users` bypassed via `/api/public/../users` | High | No |

**Why these are hard to catch:** Auth scanners verify that protected routes have middleware applied. These patterns technically have auth middleware — it's just that the auth is conditional, the trust boundary is wrong, or path normalization defeats the middleware matching.

### Mock Detection Evasion

| Fixture | Technique | Difficulty | Expected Caught |
|---------|-----------|------------|-----------------|
| `dynamic-success.ts` | `result["success"] = true` via bracket notation instead of literal | Medium | No |
| `promise-resolve.ts` | `Promise.resolve({ success: true })` — async-looking fake results | Medium | No |

**Why these are hard to catch:** Mock detectors look for `return { success: true }` literals or functions that never call external services. Dynamic object construction and Promise wrapping obscure the pattern.

## Using the Catalog

```typescript
import { evasionCatalog, getCatalogStats } from "./evasion-catalog";

// Get all techniques
console.log(`Total techniques: ${evasionCatalog.length}`);

// Check detection rate
const stats = getCatalogStats();
console.log(`Detection rate: ${(stats.detectionRate * 100).toFixed(1)}%`);
console.log(`Caught: ${stats.caught}, Missed: ${stats.missed}`);
```

## Updating

When a scanner is improved to catch a previously-missed technique:

1. Run the scanner against the fixture
2. Verify it now reports the vulnerability
3. Update `expectedCaught: true` in `evasion-catalog.ts`
4. Add a note about which scanner version started catching it

When adding new evasion techniques:

1. Create the fixture in the appropriate `fixtures/` subdirectory
2. Add the entry to `evasion-catalog.ts`
3. Update this README's technique tables

## Detection Rate Baseline

As of initial creation, the expected detection rate is **3 out of 19 techniques** (15.8%). The three expected catches are:

- `dynamic-eval.ts` — eval() is independently dangerous
- `env-fallback.ts` — fallback string is a plain literal
- `create-element.ts` — direct innerHTML assignment is present

The remaining 16 techniques require advanced analysis capabilities (inter-procedural taint tracking, constant folding, template engine awareness, control flow analysis) that are targets for future scanner improvements.
