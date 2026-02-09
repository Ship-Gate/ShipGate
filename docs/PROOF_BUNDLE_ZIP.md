# Proof Bundle ZIP Format

## Overview

Proof bundles can be packaged as deterministic ZIP archives for easy distribution and verification. ZIP bundles include:

- Deterministic timestamps (1980-01-01) for reproducibility
- Sorted file entries for consistent ordering
- Complete manifest.json with all hashes
- Optional ed25519 signing for tamper-proofing

## Creating ZIP Bundles

### From Directory Bundle

```bash
# Create ZIP from existing directory bundle
isl proof zip-create ./proof-bundle ./proof-bundle.zip

# With ed25519 signing
isl proof zip-create ./proof-bundle ./proof-bundle.zip --sign-key <private-key>
```

### During Bundle Creation

The proof bundle writer can optionally create ZIP files:

```typescript
import { createProofBundleWriter, createZipBundle } from '@isl-lang/proof';

const writer = createProofBundleWriter({
  outputDir: './proof-bundle',
  projectRoot: '.',
});

// ... set spec, gate result, etc.

const result = await writer.write();

// Create ZIP
const zipResult = await createZipBundle({
  bundleDir: result.bundlePath,
  outputPath: './proof-bundle.zip',
  signKey: process.env.ED25519_PRIVATE_KEY,
  deterministic: true,
});
```

## Verifying ZIP Bundles

```bash
# Verify ZIP bundle
isl proof verify ./proof-bundle.zip

# With public key for ed25519 signature verification
isl proof verify ./proof-bundle.zip --sign-secret <public-key>

# With HMAC secret for legacy signatures
isl proof verify ./proof-bundle.zip --sign-secret <hmac-secret>
```

The `isl proof verify` command automatically detects ZIP files by extension and handles them appropriately.

## ZIP Bundle Structure

```
proof-bundle.zip
├── manifest.json          # Complete manifest with all hashes
├── spec.isl               # ISL specification
├── results/
│   ├── gate.json          # Gate results
│   ├── build.json         # Build results
│   ├── tests.json         # Test results
│   └── ...
├── traces/                # Execution traces (if any)
│   └── ...
└── reports/
    └── summary.html       # HTML viewer
```

## Deterministic ZIPs

ZIP bundles use fixed timestamps (1980-01-01) and sorted file entries to ensure:

- Same inputs produce identical ZIP hash
- Reproducible builds across machines
- Consistent bundle IDs

## Signing

### Ed25519 Signing

Ed25519 provides cryptographic signing for tamper-proofing:

```bash
# Generate ed25519 key pair
openssl genpkey -algorithm Ed25519 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem

# Create signed ZIP
isl proof zip-create ./bundle ./bundle.zip --sign-key $(cat private.pem)

# Verify signed ZIP
isl proof verify ./bundle.zip --sign-secret $(cat public.pem)
```

### HMAC Signing (Legacy)

HMAC-SHA256 signing is also supported for compatibility:

```bash
# Create HMAC-signed bundle
isl proof pack --spec spec.isl --output ./bundle --sign-secret <secret>

# Verify HMAC-signed bundle
isl proof verify ./bundle --sign-secret <secret>
```

## Manifest Enhancements

The manifest.json includes:

- **Tool Versions**: Node.js, build tools, test frameworks, SMT solvers
- **Verifier Results**: Runtime/SMT/PBT/chaos verification results
- **Complete Hashes**: Spec hash, impl hash, bundle ID
- **Verdict & Reasons**: Detailed verdict explanation

Example manifest snippet:

```json
{
  "schemaVersion": "2.0.0",
  "bundleId": "abc123...",
  "toolVersions": {
    "nodeVersion": "v20.10.0",
    "buildTool": "tsc",
    "buildToolVersion": "5.3.3",
    "testFramework": "vitest",
    "testFrameworkVersion": "1.2.0"
  },
  "verifyResults": {
    "verdict": "PROVEN",
    "summary": {
      "totalClauses": 10,
      "provenClauses": 10,
      "unknownClauses": 0,
      "violatedClauses": 0
    }
  }
}
```

## HTML Viewer

ZIP bundles include an HTML viewer at `reports/summary.html`:

```bash
# Extract and view
unzip proof-bundle.zip
open reports/summary.html
```

The HTML viewer displays:
- Verdict and reason
- Summary statistics
- Gate details
- Verification results
- Tool versions
- Signature information

## Acceptance Tests

### Deterministic Bundle Hash

Same inputs should produce identical ZIP hash:

```bash
# Create bundle twice
isl proof pack --spec spec.isl --output ./bundle1
isl proof pack --spec spec.isl --output ./bundle2

# Create ZIPs
isl proof zip-create ./bundle1 ./bundle1.zip
isl proof zip-create ./bundle2 ./bundle2.zip

# Compare hashes (should be identical)
sha256sum bundle1.zip bundle2.zip
```

### Tamper Detection

```bash
# Create and sign bundle
isl proof zip-create ./bundle ./bundle.zip --sign-key <private-key>

# Verify (should pass)
isl proof verify ./bundle.zip --sign-secret <public-key>

# Tamper with ZIP
echo "tampered" >> bundle.zip

# Verify again (should fail)
isl proof verify ./bundle.zip --sign-secret <public-key>
```

## Implementation Notes

- ZIP format uses minimal compression (stored) for determinism
- File entries are sorted alphabetically
- Timestamps are fixed to 1980-01-01 00:00:00 (ZIP epoch)
- Ed25519 signing uses Node.js crypto (requires Node.js 12+)
- Signature stored in separate `.sig` file alongside ZIP

## See Also

- [Proof Bundle Specification](./PROOF_BUNDLE_V1_SPEC.md)
- [Verification Guide](./VERIFICATION.md)
