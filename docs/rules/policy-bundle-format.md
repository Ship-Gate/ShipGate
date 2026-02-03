# Policy Bundle Format

## Overview

Policy bundles are versioned snapshots of policy pack configurations that ensure stable, reproducible policy evaluation across environments and time.

## Bundle Structure

```json
{
  "metadata": {
    "formatVersion": "1.0.0",
    "createdAt": "2026-02-02T12:00:00.000Z",
    "createdBy": "@isl-lang/policy-packs",
    "description": "Production policy bundle"
  },
  "packs": [
    {
      "packId": "auth",
      "version": "1.2.0",
      "enabled": true,
      "minSeverity": "error",
      "ruleOverrides": {
        "auth/bypass-detected": {
          "enabled": true,
          "severity": "error"
        }
      }
    }
  ],
  "compatibility": {
    "minFormatVersion": "1.0.0"
  }
}
```

## Fields

### metadata

- `formatVersion`: Bundle format version (currently `1.0.0`)
- `createdAt`: ISO 8601 timestamp when bundle was created
- `createdBy`: Tool that created the bundle
- `description`: Optional human-readable description

### packs

Array of pack version specifications:

- `packId`: Pack identifier (e.g., `auth`, `pii`, `payments`)
- `version`: Exact pack version to use (semantic versioning)
- `enabled`: Whether the pack is enabled
- `minSeverity`: Minimum severity level to include (`error`, `warning`, `info`)
- `ruleOverrides`: Per-rule configuration overrides

### compatibility

Optional compatibility constraints:

- `minFormatVersion`: Minimum bundle format version required
- `maxFormatVersion`: Maximum bundle format version supported

## Usage

### Creating a Bundle

```bash
# Create bundle from current packs
isl policy bundle create -o bundle.json

# Create with custom configuration
isl policy bundle create -o bundle.json -c config.json --min-severity warning
```

### Verifying a Bundle

```bash
# Verify bundle validity
isl policy bundle verify bundle.json

# Verify with compatibility checks
isl policy bundle verify bundle.json --check-compatibility
```

### Programmatic Usage

```typescript
import { createBundle, validateBundle, serializeBundle } from '@isl-lang/policy-packs';
import { registry, loadBuiltinPacks } from '@isl-lang/policy-packs';

// Load packs
await loadBuiltinPacks(registry);
const packs = registry.getAllPacks();

// Create bundle
const bundle = createBundle(packs, {
  auth: { enabled: true },
  pii: { enabled: true },
});

// Serialize
const json = serializeBundle(bundle);

// Validate
const packMap = new Map();
for (const pack of packs) {
  packMap.set(pack.id, [pack]);
}
const validation = validateBundle(bundle, packMap);
```

## Version Compatibility

- **Same major version**: Bundles are compatible across minor/patch versions
- **Different major versions**: May require bundle migration
- **Missing packs**: Validation fails if referenced packs are unavailable
- **Outdated versions**: Warnings issued when newer compatible versions exist

## Deprecation Handling

When rules are deprecated:

1. Bundle validation emits deprecation warnings
2. Deprecated rules continue to work but show warnings
3. Replacement rule IDs are provided when available
4. Migration path documented in deprecation message

## Best Practices

1. **Version Control**: Commit bundles to version control for reproducibility
2. **CI/CD Integration**: Verify bundles in CI/CD pipelines
3. **Regular Updates**: Periodically update bundles to newer pack versions
4. **Documentation**: Include bundle purpose in description field
5. **Testing**: Test bundles against your codebase before deployment

## Related Documentation

- [Rule ID Stability Policy](./rule-id-stability.md)
- [Pack Versioning](./pack-versioning.md)
- [Compatibility Testing](./compatibility-testing.md)
