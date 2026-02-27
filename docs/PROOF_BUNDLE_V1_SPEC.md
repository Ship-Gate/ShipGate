# ProofBundle v1 Specification

## Overview

A **ProofBundle v1** is a self-contained, deterministic, hashable, and verifiable JSON document that captures the complete proof that an ISL specification is satisfied by an implementation.

**Key properties:**
- **Deterministic** — identical inputs always produce identical bundles (byte-for-byte)
- **Hashable** — every bundle carries a SHA-256 hash derived from its canonical JSON representation
- **Verifiable** — any modification to any artifact causes verification to fail

## Schema Version

```
schemaVersion: "1.0.0"
```

All v1 bundles use schema version `1.0.0`. Parsers MUST reject unknown schema versions.

## Manifest Schema

```typescript
interface ProofBundleV1 {
  schemaVersion: "1.0.0";
  bundleHash: string;          // SHA-256 hex (64 chars)
  spec: SpecInfo;
  verdicts: VerdictArtifact[];
  claims: Claim[];
  traces: TraceRef[];
  evidence: Evidence[];
  verdict: BundleVerdict;
  verdictReason: string;
  createdAt: string;           // ISO 8601
  signature?: string;          // HMAC-SHA256 hex (64 chars)
}
```

### SpecInfo

```typescript
interface SpecInfo {
  domain: string;       // Domain name from the ISL spec
  version: string;      // Spec version (semver)
  specHash: string;     // SHA-256 of spec file content
  specPath?: string;    // Relative path to spec file
}
```

### BundleVerdict

One of: `PROVEN` | `INCOMPLETE_PROOF` | `VIOLATED` | `UNPROVEN`

| Verdict            | Meaning |
|--------------------|---------|
| `PROVEN`           | All claims proven, all phases passed, tests exist |
| `INCOMPLETE_PROOF` | Some claims unknown/not proven, or no tests |
| `VIOLATED`         | One or more claims violated, or a phase failed |
| `UNPROVEN`         | No claims in bundle |

## Included Artifacts

### 1. Verdicts

Phase-level outcomes from the verification pipeline.

```typescript
interface VerdictArtifact {
  phase: string;                    // "gate" | "build" | "test" | "verify"
  verdict: string;                  // Phase-specific verdict string
  score?: number;                   // Numeric score (0-100, if applicable)
  details: Record<string, unknown>; // Phase-specific detail payload
  timestamp: string;                // ISO 8601
}
```

**Standard phases:**
- **gate** — verdict is `"SHIP"` or `"NO_SHIP"`, score is trust score 0–100
- **build** — verdict is `"pass"`, `"fail"`, or `"skipped"`
- **test** — verdict is `"pass"` or `"fail"`, details include `totalTests`, `passedTests`, `failedTests`
- **verify** — verdict is `"PROVEN"`, `"NOT_PROVEN"`, `"VIOLATED"`

### 2. Claims

Clause-level assertions about spec satisfaction.

```typescript
type ClaimStatus = "proven" | "not_proven" | "violated" | "unknown";

interface Claim {
  clauseId: string;                                                  // Unique ID, e.g. "login:postcondition:1"
  clauseType: "precondition" | "postcondition" | "invariant" | "intent";
  behavior?: string;                                                 // Parent behavior name
  status: ClaimStatus;
  reason?: string;
  traceIds?: string[];                                               // Evidence trace IDs
  source?: { file: string; line: number; column?: number };
}
```

### 3. Traces

References to execution trace files used as evidence.

```typescript
interface TraceRef {
  traceId: string;     // Unique trace ID
  behavior: string;    // Behavior exercised
  testName: string;    // Originating test name
  tracePath: string;   // Relative path inside bundle directory
  eventCount: number;  // Number of events in the trace
}
```

### 4. Evidence

Evaluation results for postconditions and invariants.

```typescript
interface Evidence {
  clauseId: string;
  evidenceType: "test" | "trace" | "static_analysis" | "smt" | "manual";
  satisfied: boolean;
  confidence: number;                  // 0.0 – 1.0
  payload?: Record<string, unknown>;   // Evidence-specific data
}
```

## Hashing Rules

All hashing uses **canonical JSON** to guarantee determinism.

### Canonical JSON Rules

1. **Sorted keys** — Object keys are sorted lexicographically at **every** depth level
2. **Stable line endings** — All `\r\n` and `\r` are normalized to `\n`
3. **Special values**:
   - `undefined` → omitted entirely
   - `NaN` → `null`
   - `Infinity` / `-Infinity` → `null`
4. **Compact form for hashing** — No whitespace (no indentation, no newlines between tokens)
5. **Pretty form for storage** — 2-space indentation, trailing newline

### Bundle Hash Computation

```
Input:  ProofBundleV1 object
Output: 64-character lowercase hex SHA-256 digest

Algorithm:
  1. Remove `bundleHash` and `signature` fields from the object
  2. Serialize remaining fields to compact canonical JSON
  3. Compute SHA-256 over the UTF-8 bytes
  4. Encode as lowercase hex
```

The `bundleHash` field stores this digest. The `signature` field (if present) is computed **after** the hash and is also excluded from the hash input.

### Signature

Optional HMAC-SHA256 signature for tamper-proofing.

```
Input:  bundleHash string + HMAC secret
Output: 64-character lowercase hex HMAC-SHA256 digest

Algorithm:
  1. Compute HMAC-SHA256(secret, bundleHash)
  2. Encode as lowercase hex
```

## API Reference

### `createBundle(input: CreateBundleInput): ProofBundleV1`

Creates a new proof bundle from inputs. The verdict is derived automatically from claims and phase verdicts. The hash is computed deterministically.

### `verifyBundle(bundle: ProofBundleV1, options?): VerifyBundleResult`

Verifies bundle integrity:
- Schema version check
- Hash integrity (re-derives hash and compares)
- Signature validity (if secret provided)
- Verdict consistency (re-derives verdict and compares)

### `bundleHash(bundle: ProofBundleV1): string`

Computes the SHA-256 hash of the bundle's hashable content.

### `serializeBundle(bundle: ProofBundleV1): string`

Serializes to canonical JSON (pretty-printed, 2-space indent, trailing newline).

### `parseBundle(json: string): ProofBundleV1`

Parses and validates a bundle from a JSON string.

## CLI Commands

### `shipgate proof pack`

```
shipgate proof pack --spec <file> [--evidence <dir>] [-o <dir>] [--sign-secret <secret>] [--timestamp <iso>]
```

Packs artifacts into a deterministic proof bundle.

| Flag | Description |
|------|-------------|
| `--spec <file>` | **(required)** ISL spec file |
| `--evidence <dir>` | Evidence directory (results.json, traces/, etc.) |
| `-o, --output <dir>` | Output directory (default: `.proof-bundle`) |
| `--sign-secret <secret>` | HMAC secret for signing |
| `--timestamp <iso>` | Fixed timestamp for deterministic builds |

### `shipgate proof verify`

```
shipgate proof verify <bundle-path> [--sign-secret <secret>] [--skip-file-check] [--skip-signature-check]
```

Verifies a proof bundle's integrity.

## Verdict Derivation Rules

```
1. If any claim has status "violated"      → VIOLATED
2. If gate verdict is "NO_SHIP"            → VIOLATED
3. If build verdict is "fail"              → VIOLATED
4. If test verdict is "fail"               → VIOLATED
5. If any claim is "unknown" or "not_proven" → INCOMPLETE_PROOF
6. If test totalTests == 0                 → INCOMPLETE_PROOF
7. If no claims exist                      → UNPROVEN
8. Otherwise (all proven, all passed)      → PROVEN
```

## Determinism Guarantee

Given identical `CreateBundleInput`, `createBundle()` MUST produce:
- Identical `bundleHash` values
- Identical `signature` values (if same secret)
- Identical `verdict` and `verdictReason`

This is achieved by:
- Requiring the caller to supply `createdAt` (no internal `Date.now()`)
- Using canonical JSON with sorted keys at all depth levels
- Excluding mutable fields (`bundleHash`, `signature`) from the hash input
