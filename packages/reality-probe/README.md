# Reality Prober

**Agent 17 — Reality Prober**

Makes runtime verification "grounded": probes real routes, env vars, and critical dependencies to detect ghost features.

## Features

- **HTTP Route Probing**: Tests routes against a running server using OpenAPI specs or route maps
- **Environment Variable Verification**: Ensures required env vars exist and aren't placeholders
- **Ghost Feature Detection**: Identifies routes/env vars that are claimed but don't actually exist
- **Gate Score Integration**: Findings feed into the verification gate score

## Usage

### CLI Integration

```bash
# Enable reality probe with verify command
isl verify --reality --reality-base-url http://localhost:3000

# With custom route map and env vars
isl verify --reality \
  --reality-base-url http://localhost:3000 \
  --reality-route-map .shipgate/truthpack/routes.json \
  --reality-env-vars .shipgate/truthpack/env.json

# Enable all verification modes including reality probe
isl verify --all --reality-base-url http://localhost:3000
```

### Programmatic API

```typescript
import { runRealityProbe } from '@isl-lang/reality-probe';

const result = await runRealityProbe({
  baseUrl: 'http://localhost:3000',
  routeMapPath: '.shipgate/truthpack/routes.json',
  envVarsPath: '.shipgate/truthpack/env.json',
  timeoutMs: 10000,
  verbose: true,
});

console.log(`Ghost routes: ${result.summary.ghostRoutes}`);
console.log(`Ghost env vars: ${result.summary.ghostEnvVars}`);
```

## How It Works

1. **Route Probing**:
   - Loads routes from OpenAPI spec or truthpack route map
   - Probes each route against the running server
   - Detects ghost routes (claimed but don't exist)
   - Captures status codes and latency

2. **Environment Variable Verification**:
   - Loads required env vars from truthpack
   - Checks if they exist in runtime environment
   - Detects placeholder values (e.g., "changeme", "your-key-here")
   - Identifies ghost env vars (required but missing)

3. **Gate Score Integration**:
   - Ghost routes/env vars contribute to evidence score
   - Failures reduce overall trust score
   - Findings appear in verification report

## Acceptance Test

A spec claiming `/api/foo` exists fails when the server doesn't actually serve it, and the gate reflects it.

```bash
# Spec claims /api/foo exists, but server doesn't serve it
isl verify --reality --reality-base-url http://localhost:3000

# Output:
# ✗ 1 ghost routes detected
#   Route GET /api/foo: Ghost route detected: Route does not exist
# Verification failed - ghost features detected
```

## Configuration

The reality probe auto-detects truthpack files if not explicitly provided:

- Route map: `.shipgate/truthpack/routes.json` (default)
- Env vars: `.shipgate/truthpack/env.json` (default)

## License

MIT
