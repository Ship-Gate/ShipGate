# Deterministic vs Non-Deterministic Functions

Understanding determinism is critical for ISL specifications. This document explains which stdlib functions are deterministic and why it matters.

## Why Determinism Matters

**Deterministic functions** always produce the same output given the same input. This is important for:

1. **Verification** - Deterministic functions can be verified symbolically
2. **Testing** - Test results are reproducible
3. **Caching** - Results can be cached safely
4. **Formal proofs** - Mathematical reasoning is possible

**Non-deterministic functions** may produce different outputs on each call, even with the same input. Examples include:
- Current time
- Random number generation
- External system calls

## Module Determinism Summary

| Module | Fully Deterministic | Has Non-Deterministic |
|--------|--------------------|-----------------------|
| `@isl/strings` | ✅ | - |
| `@isl/json` | ✅ | - |
| `@isl/rate-limit` | ✅ | - |
| `@isl/audit` | ✅ | - |
| `@isl/datetime` | - | ✅ `Now()` |
| `@isl/crypto` | - | ✅ `Generate*` functions |
| `@isl/uuid` | - | ✅ `GenerateUUID()`, `GenerateUUIDv7()` |
| `@isl/auth` | - | ✅ Session/token generation |
| `@isl/payments` | - | ✅ Transaction IDs |
| `@isl/uploads` | - | ✅ File IDs |

## @isl/datetime Determinism

### Non-Deterministic
| Function | Reason |
|----------|--------|
| `Now()` | Returns current system time |

### Deterministic
| Function | Notes |
|----------|-------|
| `AddDuration(timestamp, duration)` | Pure arithmetic |
| `SubtractDuration(timestamp, duration)` | Pure arithmetic |
| `DiffTimestamps(start, end)` | Pure arithmetic |
| `FormatTimestamp(timestamp, format, timezone)` | Same input → same output |
| `ParseTimestamp(value, format, timezone)` | Same input → same output |
| `GetDatePart(timestamp, part, timezone)` | Same input → same output |
| `ToComponents(timestamp, timezone)` | Decomposition |
| `FromComponents(components)` | Composition |
| `DurationToMs(components)` | Conversion |
| `MsToDuration(milliseconds)` | Conversion |
| `IsLeapYear(year)` | Mathematical calculation |
| `DaysInMonth(year, month)` | Mathematical calculation |
| `CompareTimestamps(a, b)` | Pure comparison |
| `IsBefore(timestamp, other)` | Pure comparison |
| `IsAfter(timestamp, other)` | Pure comparison |
| `IsBetween(timestamp, start, end)` | Pure comparison |

### Best Practice

```isl
# ❌ Avoid: Using Now() in postconditions makes them non-deterministic
post success {
  result.created_at == Now()  # Different on each verification
}

# ✅ Better: Use relative comparisons
post success {
  result.created_at <= Now()  # Verifiable: created_at is in the past
  result.expires_at == AddDuration(result.created_at, DAY_MS * 7)  # Deterministic
}
```

## @isl/crypto Determinism

### Non-Deterministic
| Function | Reason |
|----------|--------|
| `GenerateToken(length, encoding)` | Uses CSPRNG |
| `GenerateApiKey(prefix, length)` | Uses CSPRNG |
| `GenerateBytes(count)` | Uses CSPRNG |

### Deterministic
| Function | Notes |
|----------|-------|
| `Hash(data, algorithm)` | Same data → same hash |
| `HashSHA256(data)` | Same data → same hash |
| `HashSHA512(data)` | Same data → same hash |
| `HashSHA3(data, bits)` | Same data → same hash |
| `HashBlake3(data, output_length)` | Same data → same hash |
| `HashPassword(password, config)` | Deterministic with same salt* |
| `VerifyPassword(password, hash)` | Comparison operation |
| `NeedsRehash(hash, config)` | Config comparison |
| `Hmac(data, key, algorithm)` | Same inputs → same HMAC |
| `VerifyHmac(data, key, signature)` | Comparison operation |
| `DeriveKey(password, salt, iterations, key_length)` | Same inputs → same key |
| `ConstantTimeEquals(a, b)` | Comparison operation |
| `HashFile(content, algorithm)` | Same content → same hash |

*Note: `HashPassword` is deterministic if the same salt is used. In practice, implementations generate random salts for security.

### Best Practice

```isl
# ❌ Avoid: Direct equality with random generation
post success {
  result.token == GenerateToken(32)  # Never true - different on each call
}

# ✅ Better: Verify properties, not exact values
post success {
  result.token.length >= 32
  result.token != null
}

# ✅ For verification: Use deterministic hash comparisons
post success {
  HashSHA256(input.data) == expected_hash  # Deterministic
}
```

## @isl/uuid Determinism

### Non-Deterministic
| Function | Reason |
|----------|--------|
| `GenerateUUID()` | Random UUID v4 |
| `GenerateUUIDv7()` | Time + random |

### Deterministic
| Function | Notes |
|----------|-------|
| `GenerateUUIDv5(namespace, name)` | Same namespace + name → same UUID |
| `GenerateUUIDv3(namespace, name)` | Same namespace + name → same UUID |
| `GenerateNamespacedUUID(namespace, name)` | Uses v3 or v5 |
| `IsValidUUID(value)` | Format validation |
| `IsNilUUID(uuid)` | Nil comparison |
| `IsMaxUUID(uuid)` | Max comparison |
| `ParseUUID(value)` | Parsing |
| `FormatUUID(uuid, format)` | Formatting |
| `NormalizeUUID(uuid)` | Normalization |
| `GetUUIDVersion(uuid)` | Extraction |
| `ToComponents(uuid)` | Decomposition |
| `FromComponents(components)` | Composition |
| `CompareUUIDs(a, b)` | Comparison |
| `UUIDsEqual(a, b)` | Comparison |

### Best Practice

```isl
# ❌ Avoid: Equality with random generation
post success {
  result.id == GenerateUUID()  # Never true
}

# ✅ Better: Verify format and properties
post success {
  IsValidUUID(result.id)
  not IsNilUUID(result.id)
}

# ✅ For deterministic IDs based on input
post success {
  # Same namespace + name always produces same UUID
  result.resource_id == GenerateUUIDv5(NAMESPACE_DNS, input.name)
}
```

## @isl/strings and @isl/json

These modules are **fully deterministic**. All operations produce the same output given the same input.

```isl
# All these are deterministic and verifiable
ToLowerCase("HELLO") == "hello"  # Always true
Length("test") == 4  # Always true
Parse('{"a":1}').a == 1  # Always true
IsValidEmail("user@example.com") == true  # Always true
```

## Writing Verifiable Specifications

### Rule 1: Avoid Equality with Non-Deterministic Functions

```isl
# ❌ Bad
post success {
  result.timestamp == Now()
}

# ✅ Good
post success {
  result.timestamp <= Now()
}
```

### Rule 2: Use Deterministic Functions for Verification

```isl
# ❌ Can't verify - random each time
post success {
  result.token == GenerateToken(32)
}

# ✅ Verify with deterministic functions
post success {
  Length(result.token) >= 32
  IsHexadecimal(result.token)
}
```

### Rule 3: Use Namespace UUIDs for Deterministic IDs

```isl
# ❌ Non-deterministic ID
behavior CreateResource {
  post success {
    result.id == GenerateUUID()
  }
}

# ✅ Deterministic ID based on input
behavior CreateResource {
  input { name: String }
  
  post success {
    # Same name always produces same UUID
    result.id == GenerateUUIDv5(NAMESPACE_DNS, input.name)
  }
}
```

### Rule 4: Mark Non-Deterministic in Spec

ISL modules explicitly mark determinism:

```isl
behavior Now {
  description: "Get current timestamp (NON-DETERMINISTIC)"
  deterministic: false  # Explicit marker
  ...
}

behavior AddDuration {
  description: "Add a duration to a timestamp (DETERMINISTIC)"
  deterministic: true  # Explicit marker
  ...
}
```

## Verification Implications

### Fully Verifiable Clauses

These can be verified symbolically:

```isl
post success {
  # All deterministic - can be proven mathematically
  ToLowerCase(input.email) == result.email
  HashSHA256(input.data) == result.hash
  IsValidUUID(result.id)
  result.expires_at == AddDuration(result.created_at, DAY_MS * 7)
}
```

### Partially Verifiable Clauses

These require runtime evidence:

```isl
post success {
  # Non-deterministic - need execution trace to verify
  result.created_at <= Now()
  result.token.length >= 32
}
```

### Non-Verifiable Clauses

Avoid these patterns:

```isl
post success {
  # ❌ Never verifiable - always false
  result.id == GenerateUUID()
  result.token == GenerateToken(32)
}
```

## See Also

- [Stdlib Reference](./REFERENCE.md)
- [Verification Guide](../VERIFICATION.md)
