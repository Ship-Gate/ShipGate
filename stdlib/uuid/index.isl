# UUID Standard Library Module
# Provides UUID generation, validation, and parsing
#
# DETERMINISM NOTE:
# - GenerateUUID (v4) is NON-DETERMINISTIC (random)
# - GenerateUUIDv5 is DETERMINISTIC (namespace + name → same UUID)
# - All validation/parsing functions are DETERMINISTIC

module UUID version "1.0.0"

# ============================================
# Types
# ============================================

type UUID = String {
  description: "Universally Unique Identifier"
  pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
  length: 36
}

type UUIDVersion = enum {
  V1   # Time-based
  V3   # MD5 namespace
  V4   # Random
  V5   # SHA-1 namespace
  V6   # Reordered time-based
  V7   # Unix timestamp
}

type UUIDNamespace = enum {
  DNS    # 6ba7b810-9dad-11d1-80b4-00c04fd430c8
  URL    # 6ba7b811-9dad-11d1-80b4-00c04fd430c8
  OID    # 6ba7b812-9dad-11d1-80b4-00c04fd430c8
  X500   # 6ba7b814-9dad-11d1-80b4-00c04fd430c8
}

type UUIDFormat = enum {
  CANONICAL    # 8-4-4-4-12 with hyphens: "550e8400-e29b-41d4-a716-446655440000"
  COMPACT      # No hyphens: "550e8400e29b41d4a716446655440000"
  URN          # With URN prefix: "urn:uuid:550e8400-e29b-41d4-a716-446655440000"
  BRACES       # With braces: "{550e8400-e29b-41d4-a716-446655440000}"
}

# ============================================
# Entities
# ============================================

entity UUIDInfo {
  uuid: UUID
  version: UUIDVersion
  variant: Int { min: 0, max: 3 }
  is_nil: Boolean
  is_max: Boolean

  invariants {
    is_nil implies uuid == "00000000-0000-0000-0000-000000000000"
    is_max implies uuid == "ffffffff-ffff-ffff-ffff-ffffffffffff"
  }
}

entity UUIDComponents {
  time_low: String { length: 8 }
  time_mid: String { length: 4 }
  time_hi_and_version: String { length: 4 }
  clock_seq_hi_and_reserved: String { length: 2 }
  clock_seq_low: String { length: 2 }
  node: String { length: 12 }
}

# ============================================
# Behaviors - Non-Deterministic Generation
# ============================================

behavior GenerateUUID {
  description: "Generate a random UUID v4 (NON-DETERMINISTIC)"
  deterministic: false

  input {
    format: UUIDFormat [default: CANONICAL]
  }

  output {
    success: String
  }

  post success {
    input.format == CANONICAL implies result.length == 36
    input.format == COMPACT implies result.length == 32
    input.format == URN implies result.starts_with("urn:uuid:")
    input.format == BRACES implies result.starts_with("{") and result.ends_with("}")
    IsValidUUID(result)
  }

  invariants {
    uses cryptographically secure random source
  }
}

behavior GenerateUUIDv7 {
  description: "Generate a time-ordered UUID v7 (NON-DETERMINISTIC)"
  deterministic: false

  input {
    format: UUIDFormat [default: CANONICAL]
  }

  output {
    success: String
  }

  post success {
    IsValidUUID(result)
    GetUUIDVersion(result) == V7
  }

  invariants {
    uses cryptographically secure random source
    timestamp embedded in UUID
  }
}

# ============================================
# Behaviors - Deterministic Generation
# ============================================

behavior GenerateUUIDv5 {
  description: "Generate namespace UUID v5 (DETERMINISTIC)"
  deterministic: true

  input {
    namespace: UUID
    name: String
    format: UUIDFormat [default: CANONICAL]
  }

  output {
    success: String
  }

  pre {
    IsValidUUID(namespace)
    name.length > 0
  }

  post success {
    IsValidUUID(result)
    GetUUIDVersion(result) == V5
    # Same namespace + name always produces same UUID
    GenerateUUIDv5(input.namespace, input.name) == result
  }
}

behavior GenerateUUIDv3 {
  description: "Generate namespace UUID v3 using MD5 (DETERMINISTIC)"
  deterministic: true

  input {
    namespace: UUID
    name: String
    format: UUIDFormat [default: CANONICAL]
  }

  output {
    success: String
  }

  pre {
    IsValidUUID(namespace)
    name.length > 0
  }

  post success {
    IsValidUUID(result)
    GetUUIDVersion(result) == V3
    # Same namespace + name always produces same UUID
    GenerateUUIDv3(input.namespace, input.name) == result
  }
}

behavior GenerateNamespacedUUID {
  description: "Generate UUID from predefined namespace (DETERMINISTIC)"
  deterministic: true

  input {
    namespace: UUIDNamespace
    name: String
    version: UUIDVersion [default: V5]
  }

  output {
    success: UUID

    errors {
      INVALID_VERSION {
        when: "Version must be V3 or V5 for namespaced UUIDs"
        retriable: false
      }
    }
  }

  pre {
    version in [V3, V5]
    name.length > 0
  }

  post success {
    IsValidUUID(result)
    # Same namespace + name always produces same UUID
  }
}

# ============================================
# Behaviors - Validation
# ============================================

behavior IsValidUUID {
  description: "Check if string is a valid UUID (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: Boolean
  }

  post success {
    result == input.value.matches("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
       or input.value.matches("^[0-9a-f]{32}$")
       or input.value.matches("^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
       or input.value.matches("^\\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\}$")
  }
}

behavior IsNilUUID {
  description: "Check if UUID is the nil UUID (DETERMINISTIC)"
  deterministic: true

  input {
    uuid: UUID
  }

  output {
    success: Boolean
  }

  post success {
    result == (NormalizeUUID(input.uuid) == "00000000-0000-0000-0000-000000000000")
  }
}

behavior IsMaxUUID {
  description: "Check if UUID is the max UUID (DETERMINISTIC)"
  deterministic: true

  input {
    uuid: UUID
  }

  output {
    success: Boolean
  }

  post success {
    result == (NormalizeUUID(input.uuid) == "ffffffff-ffff-ffff-ffff-ffffffffffff")
  }
}

# ============================================
# Behaviors - Parsing and Formatting
# ============================================

behavior ParseUUID {
  description: "Parse UUID string and extract info (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
  }

  output {
    success: UUIDInfo

    errors {
      INVALID_UUID {
        when: "String is not a valid UUID format"
        retriable: false
      }
    }
  }

  pre {
    value.length >= 32
  }

  post success {
    result.uuid.length == 36
  }
}

behavior FormatUUID {
  description: "Format UUID to specified format (DETERMINISTIC)"
  deterministic: true

  input {
    uuid: UUID
    format: UUIDFormat
  }

  output {
    success: String
  }

  pre {
    IsValidUUID(uuid)
  }

  post success {
    input.format == CANONICAL implies result.length == 36
    input.format == COMPACT implies result.length == 32
    input.format == URN implies result.length == 45
    input.format == BRACES implies result.length == 38
  }
}

behavior NormalizeUUID {
  description: "Normalize UUID to canonical lowercase format (DETERMINISTIC)"
  deterministic: true

  input {
    uuid: String
  }

  output {
    success: UUID

    errors {
      INVALID_UUID {
        when: "Input is not a valid UUID"
        retriable: false
      }
    }
  }

  post success {
    result.length == 36
    result.matches("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    # Idempotent: normalizing twice gives same result
    NormalizeUUID(result) == result
  }
}

behavior GetUUIDVersion {
  description: "Extract version from UUID (DETERMINISTIC)"
  deterministic: true

  input {
    uuid: UUID
  }

  output {
    success: UUIDVersion

    errors {
      INVALID_UUID {
        when: "UUID is malformed"
        retriable: false
      }
      UNKNOWN_VERSION {
        when: "UUID version not recognized"
        retriable: false
      }
    }
  }

  pre {
    IsValidUUID(uuid)
  }
}

behavior ToComponents {
  description: "Decompose UUID into components (DETERMINISTIC)"
  deterministic: true

  input {
    uuid: UUID
  }

  output {
    success: UUIDComponents

    errors {
      INVALID_UUID {
        when: "UUID is malformed"
        retriable: false
      }
    }
  }

  pre {
    IsValidUUID(uuid)
  }

  post success {
    result.time_low.length == 8
    result.time_mid.length == 4
    result.time_hi_and_version.length == 4
    result.node.length == 12
  }
}

behavior FromComponents {
  description: "Construct UUID from components (DETERMINISTIC)"
  deterministic: true

  input {
    components: UUIDComponents
  }

  output {
    success: UUID
  }

  pre {
    components.time_low.length == 8
    components.time_mid.length == 4
    components.time_hi_and_version.length == 4
    components.clock_seq_hi_and_reserved.length == 2
    components.clock_seq_low.length == 2
    components.node.length == 12
  }

  post success {
    result.length == 36
    IsValidUUID(result)
  }
}

# ============================================
# Behaviors - Comparison
# ============================================

behavior CompareUUIDs {
  description: "Compare two UUIDs lexicographically (DETERMINISTIC)"
  deterministic: true

  input {
    a: UUID
    b: UUID
  }

  output {
    success: Int { min: -1, max: 1 }
  }

  pre {
    IsValidUUID(a)
    IsValidUUID(b)
  }

  post success {
    NormalizeUUID(input.a) < NormalizeUUID(input.b) implies result == -1
    NormalizeUUID(input.a) == NormalizeUUID(input.b) implies result == 0
    NormalizeUUID(input.a) > NormalizeUUID(input.b) implies result == 1
  }
}

behavior UUIDsEqual {
  description: "Check if two UUIDs are equal (DETERMINISTIC)"
  deterministic: true

  input {
    a: String
    b: String
  }

  output {
    success: Boolean

    errors {
      INVALID_UUID_A {
        when: "First argument is not a valid UUID"
        retriable: false
      }
      INVALID_UUID_B {
        when: "Second argument is not a valid UUID"
        retriable: false
      }
    }
  }

  post success {
    result == (NormalizeUUID(input.a) == NormalizeUUID(input.b))
  }
}

# ============================================
# Constants
# ============================================

const NIL_UUID: UUID = "00000000-0000-0000-0000-000000000000"
const MAX_UUID: UUID = "ffffffff-ffff-ffff-ffff-ffffffffffff"

# Predefined namespaces
const NAMESPACE_DNS: UUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
const NAMESPACE_URL: UUID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
const NAMESPACE_OID: UUID = "6ba7b812-9dad-11d1-80b4-00c04fd430c8"
const NAMESPACE_X500: UUID = "6ba7b814-9dad-11d1-80b4-00c04fd430c8"
