# Agent 35 — Security Verifier Enhancer

## Mission

Detect auth drift: endpoints that require auth per ISL but don't enforce it, and vice versa.

## Implementation

### Components

1. **ISL Auth Extractor** (`isl-extractor.ts`)
   - Extracts auth requirements from ISL files
   - Detects `security { requires auth }`, `requires role`, `requires permission`
   - Identifies public endpoints (no security block)
   - Parses role and permission requirements

2. **Route Auth Detector** (`route-detector.ts`)
   - Detects auth enforcement in route implementations
   - Supports Express, Next.js, NestJS, Hono, Fastify
   - Identifies middleware, guards, decorators, manual checks
   - Extracts roles and permissions from code

3. **Drift Detector** (`drift-detector.ts`)
   - Compares ISL requirements with observed policies
   - Detects missing auth, extra auth, role mismatches, permission mismatches
   - Uses confidence thresholds to avoid false positives
   - Emits claims with route, expected policy, observed policy

4. **Main Enhancer** (`enhancer.ts`)
   - Orchestrates the detection process
   - Provides high-level API
   - Configurable thresholds and options

## Usage

```typescript
import { SecurityVerifierEnhancer } from '@isl-lang/security-verifier-enhancer';

const enhancer = new SecurityVerifierEnhancer('./workspace', {
  minConfidence: 0.5,
  publicEndpointThreshold: 0.7,
});

const result = await enhancer.detectDrift();
```

## Drift Types

- **missing-auth**: ISL requires auth, route has none
- **extra-auth**: Route has auth, ISL marks as public
- **role-mismatch**: Required roles don't match
- **permission-mismatch**: Required permissions don't match

## Acceptance Criteria

✅ Flags real auth drift in fixtures  
✅ Doesn't over-flag public endpoints (confidence thresholds)  
✅ Emits claims with route, expected policy, observed policy  
✅ Includes fixtures and tests

## Test Fixtures

- `tests/fixtures/isl/auth-required.isl` - ISL specs with auth requirements
- `tests/fixtures/routes/missing-auth.ts` - Routes missing auth (should be flagged)
- `tests/fixtures/routes/correct-auth.ts` - Routes with correct auth (should not be flagged)
- `tests/fixtures/routes/public-endpoint.ts` - Public endpoints (should not be flagged)
- `tests/fixtures/routes/extra-auth.ts` - Routes with extra auth (might be flagged)

## Confidence Thresholds

- **minConfidence**: Minimum confidence to emit a claim (default: 0.5)
- **publicEndpointThreshold**: Higher threshold = less likely to flag public endpoints (default: 0.7)

This prevents false positives when:
- ISL spec is incomplete (missing security block)
- Route has defensive auth that's not in spec
- Public endpoints are incorrectly flagged
