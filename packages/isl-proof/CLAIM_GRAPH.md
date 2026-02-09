# Unified Claim Graph

Unifies all scanners/verifiers into a single claim graph so engines stop operating in isolation. Multiple engines referencing the same route/env/symbol collapse into one graph node.

## Overview

The unified claim graph system provides:

1. **Unified Claim Schema** - Single schema for all claim types from different engines
2. **Graph Builder** - Deduplicates and links related claims
3. **Export** - JSON and lightweight HTML viewer
4. **Integration** - Easy integration into existing pipelines

## Claim Schema

Every claim has:

- `id` - Unique identifier
- `kind` - Type of claim (route, env, symbol, postcondition, etc.)
- `subject` - What the claim is about (normalized for deduplication)
- `locations` - Where the claim appears/applies
- `evidence` - Supporting evidence
- `confidence` - Confidence score 0-1
- `engine` - Which engine produced the claim
- `relationships` - Links to other claims
- `status` - Verification status (proven, violated, etc.)

## Usage

### Basic Example

```typescript
import {
  buildUnifiedClaimGraph,
  exportClaimGraphToJson,
  exportClaimGraphToHtml,
} from '@isl-lang/proof';

// Collect claims from multiple engines
const collection = {
  bundleClaims: [...],      // From proof bundle
  verifierClauses: [...],    // From verifier
  firewallClaims: [...],     // From firewall
  routes: [...],             // From truthpack
  envVars: [...],            // From truthpack
};

// Build unified graph (deduplicates automatically)
const graph = buildUnifiedClaimGraph(collection, {
  deduplicate: true,
  linkRelated: true,
});

// Export to JSON
await exportClaimGraphToJson(graph, './claim-graph.json');

// Export to HTML viewer
await exportClaimGraphToHtml(graph, './claim-graph.html');
```

### Integration into Pipeline

```typescript
import {
  buildUnifiedClaimGraph,
  extractClaimsFromProofBundle,
  extractClaimsFromVerifierReport,
} from '@isl-lang/proof';

// In your pipeline
const bundle = createProofBundle(...);
const verifierReport = runVerifier(...);

// Extract claims
const bundleClaims = extractClaimsFromProofBundle(bundle);
const verifierClaims = extractClaimsFromVerifierReport(verifierReport);

// Build unified graph
const graph = buildUnifiedClaimGraph({
  ...bundleClaims,
  ...verifierClaims,
});

// Graph is now available for proof bundle export
// Multiple engines referencing same route collapse into one graph node
```

## Deduplication

Claims are deduplicated by subject (route/env/symbol/type). When multiple engines reference the same subject:

- Locations are merged
- Evidence is combined
- Confidence is taken as maximum
- Status prefers proven > partial > not_proven > unknown
- Engines are tracked (all contributing engines listed)

## Linking

Related claims are automatically linked:

- Claims with same subject → `related_to` relationship
- Conflicting statuses → `conflicts_with` relationship
- Evidence dependencies → `depends_on` relationship

## Export Formats

### JSON Export

Stable, deterministic JSON export suitable for proof bundles:

```typescript
await exportClaimGraphToJson(graph, './claim-graph.json');
```

### HTML Viewer

Lightweight HTML viewer with:
- Search and filtering
- Grouped by subject
- Status indicators
- Evidence visualization
- Relationship display

```typescript
await exportClaimGraphToHtml(graph, './claim-graph.html', {
  title: 'Unified Claim Graph',
  includeJson: false,
});
```

## Adapters

Adapters convert claims from different engines:

- `fromBundleClaim` - Proof bundle claims
- `fromVerifierClauseResult` - Verifier clause results
- `fromFirewallClaim` - Firewall claims
- `createRouteClaim` - Route claims from truthpack
- `createEnvClaim` - Environment variable claims

## Acceptance Criteria

✅ Multiple engines referencing same route collapse into one graph node  
✅ Graph export is stable and used in proof bundles  
✅ All engines can emit claims that get unified  
✅ Deduplication works by subject (route/env/symbol/type)  
✅ Related claims are linked automatically
