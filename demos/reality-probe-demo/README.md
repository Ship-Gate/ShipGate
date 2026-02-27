# Reality Probe Demo

Demonstrates ghost route detection using the reality probe.

## Setup

1. Start the demo server:
```bash
npm start
# Server runs on http://localhost:3000
```

2. Build truthpack (if needed):
```bash
shipgate truthpack build
```

3. Run reality probe:
```bash
isl verify --reality --reality-base-url http://localhost:3000
```

## Ghost Route Example

The server implements `/api/users` but the spec claims `/api/foo` exists. The reality probe will detect this ghost route.

## Files

- `server.ts` - Express server with some routes
- `spec.isl` - ISL spec claiming routes (including ghost route)
- `.shipgate/truthpack/routes.json` - Route map from truthpack
