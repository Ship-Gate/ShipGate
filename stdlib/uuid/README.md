# @isl/uuid

UUID generation, validation, and parsing for ISL specifications.

## Overview

This module provides UUID (Universally Unique Identifier) operations including generation, validation, parsing, and formatting.

## Determinism

| Function | Deterministic | Notes |
|----------|---------------|-------|
| `GenerateUUID` | ❌ No | Random UUID v4 |
| `GenerateUUIDv7` | ❌ No | Time-ordered with random |
| `GenerateUUIDv5` | ✅ Yes | namespace + name → same UUID |
| `GenerateUUIDv3` | ✅ Yes | namespace + name → same UUID |
| `GenerateNamespacedUUID` | ✅ Yes | Uses v3/v5 |
| `IsValidUUID` | ✅ Yes | Format validation |
| `IsNilUUID` | ✅ Yes | Nil check |
| `IsMaxUUID` | ✅ Yes | Max check |
| `ParseUUID` | ✅ Yes | String → UUIDInfo |
| `FormatUUID` | ✅ Yes | UUID → String |
| `NormalizeUUID` | ✅ Yes | Canonical format |
| `GetUUIDVersion` | ✅ Yes | Extract version |
| `ToComponents` | ✅ Yes | Decompose |
| `FromComponents` | ✅ Yes | Compose |
| `CompareUUIDs` | ✅ Yes | Lexicographic |
| `UUIDsEqual` | ✅ Yes | Equality check |

## UUID Versions

- **v1** - Time-based (MAC address + timestamp)
- **v3** - MD5 hash of namespace + name
- **v4** - Random (most common)
- **v5** - SHA-1 hash of namespace + name
- **v6** - Reordered time-based
- **v7** - Unix timestamp + random (sortable)

## Usage

### Random UUID Generation

```isl
use @isl/uuid

behavior CreateUser {
  post success {
    # Generate random UUID v4
    result.id == GenerateUUID()
    IsValidUUID(result.id)
  }
}
```

### Deterministic UUID Generation

For reproducible UUIDs based on namespace and name:

```isl
use @isl/uuid

behavior CreateResource {
  input {
    name: String
  }

  post success {
    # Same name always produces same UUID
    result.id == GenerateUUIDv5(NAMESPACE_DNS, input.name)
  }
}
```

### Validation

```isl
use @isl/uuid

behavior UpdateUser {
  input {
    user_id: String
  }

  pre {
    # Validate UUID format
    IsValidUUID(user_id)
    not IsNilUUID(user_id)
  }
}
```

### Formatting

```isl
use @isl/uuid

behavior ExportData {
  input {
    id: UUID
  }

  post success {
    # Different format outputs
    FormatUUID(input.id, CANONICAL)  # "550e8400-e29b-41d4-a716-446655440000"
    FormatUUID(input.id, COMPACT)    # "550e8400e29b41d4a716446655440000"
    FormatUUID(input.id, URN)        # "urn:uuid:550e8400-e29b-41d4-a716-446655440000"
    FormatUUID(input.id, BRACES)     # "{550e8400-e29b-41d4-a716-446655440000}"
  }
}
```

## Constants

### Special UUIDs
- `NIL_UUID` - `"00000000-0000-0000-0000-000000000000"`
- `MAX_UUID` - `"ffffffff-ffff-ffff-ffff-ffffffffffff"`

### Predefined Namespaces
- `NAMESPACE_DNS` - For domain names
- `NAMESPACE_URL` - For URLs
- `NAMESPACE_OID` - For ISO OIDs
- `NAMESPACE_X500` - For X.500 DNs

## Formats

- `CANONICAL` - Standard 8-4-4-4-12 with hyphens
- `COMPACT` - 32 hex characters, no hyphens
- `URN` - With `urn:uuid:` prefix
- `BRACES` - With curly braces
