# ISL Standard Library 1.0 Roster

## Overview

This document defines the **10 officially registered stdlib modules** for ISL 1.0. Each module is fully implemented, tested, and supports deterministic verification.

## 1.0 Modules

| Module | Description | Determinism | Justification |
|--------|-------------|-------------|---------------|
| `@isl/string` | String manipulation and validation | 100% deterministic | Core primitive, heavily used in all specs |
| `@isl/math` | Mathematical operations | 100% deterministic | Essential for numeric contracts |
| `@isl/collections` | List and Map operations | 100% deterministic | Core data structure operations |
| `@isl/json` | JSON parsing and manipulation | 100% deterministic | API contracts, data interchange |
| `@isl/datetime` | Date and time operations | Mixed* | Temporal contracts, scheduling |
| `@isl/uuid` | UUID generation and validation | Mixed* | Entity identification |
| `@isl/crypto` | Cryptographic hashing | Mixed* | Security contracts, integrity |
| `@isl/encoding` | Base64, URL, HTML encoding | 100% deterministic | Data transformation |
| `@isl/regex` | Safe regex pattern matching | 100% deterministic | Input validation |
| `@isl/url` | URL parsing and manipulation | 100% deterministic | Web API contracts |

*Mixed determinism modules have explicit non-deterministic functions marked with `deterministic: false`

## Module Details

### 1. @isl/string

**Path:** `stdlib/string/index.isl`  
**Status:** Full implementation  
**Demo Usage:** Validation, formatting, parsing in all demos

Provides string manipulation operations including:
- Length, isEmpty, isBlank
- Case conversion (lower, upper, title, camel, snake, kebab)
- Trimming (trim, trimStart, trimEnd, trimChars)
- Search (contains, startsWith, endsWith, indexOf, lastIndexOf)
- Manipulation (substring, replace, replaceAll, split, join, concat, repeat)
- Padding (padStart, padEnd)
- Validation (isValidEmail, isValidUrl, isValidPhone, matchesPattern)
- Character checks (isAlpha, isAlphanumeric, isNumeric, isHexadecimal)

All functions are **deterministic**.

### 2. @isl/math

**Path:** `stdlib/math/index.isl`  
**Status:** Full implementation  
**Demo Usage:** Pricing calculations, statistics, metrics

Provides mathematical operations including:
- Basic: abs, sign, min, max, clamp
- Rounding: floor, ceil, round, trunc
- Arithmetic: add, subtract, multiply, divide, mod, pow
- Safe arithmetic: safeAdd, safeSubtract (overflow protection)
- Comparison: approximately, isPositive, isNegative, isZero
- Range: inRange, lerp (linear interpolation)
- Statistics: sum, average, median, variance, stdDev
- Financial: percentage, percentageOf, roundCurrency

All functions are **deterministic**.

### 3. @isl/collections

**Path:** `stdlib/collections/index.isl`  
**Status:** Full implementation  
**Demo Usage:** Data processing, aggregation, filtering

Provides collection operations including:
- List: map, filter, reduce, find, findIndex, every, some
- List: first, last, take, drop, slice, concat, reverse
- List: unique, flatten, chunk, zip, unzip
- List: sort, sortBy (stable sort, deterministic)
- Map: get, set, remove, has, keys, values, entries
- Map: merge, pick, omit, mapValues, filterValues
- Set operations: union, intersection, difference

All functions are **deterministic** (sort uses stable algorithm).

### 4. @isl/json

**Path:** `stdlib/json/index.isl`  
**Status:** Full implementation  
**Demo Usage:** API contracts, configuration parsing

Provides JSON operations including:
- Parsing: parse, tryParse, stringify, stringifyPretty
- Access: get, getString, getNumber, getBoolean, getArray, getObject, has
- Modification: set, remove, merge, clone
- Querying: keys, values, entries, query (JSONPath)
- Comparison: equals, diff, applyPatches
- Validation: isValid, isObject, isArray, isString, isNumber, isBoolean, isNull
- Transformation: flatten, unflatten, pick, omit

All functions are **deterministic**.

### 5. @isl/datetime

**Path:** `stdlib/datetime/index.isl`  
**Status:** Full implementation  
**Demo Usage:** Session expiry, scheduling, audit timestamps

Provides date/time operations including:
- **NON-DETERMINISTIC:** `now()` - returns current timestamp
- Arithmetic: addDuration, subtractDuration, diffTimestamps
- Formatting: formatTimestamp, parseTimestamp
- Components: getDatePart, toComponents, fromComponents
- Duration: durationToMs, msToDuration
- Calendar: isLeapYear, daysInMonth
- Comparison: compareTimestamps, isBefore, isAfter, isBetween

Only `now()` is **non-deterministic**. All other functions are deterministic.

### 6. @isl/uuid

**Path:** `stdlib/uuid/index.isl`  
**Status:** Full implementation  
**Demo Usage:** Entity IDs, correlation IDs, request tracing

Provides UUID operations including:
- **NON-DETERMINISTIC:** `generateUUID()` (v4), `generateUUIDv7()`
- **DETERMINISTIC:** `generateUUIDv5()`, `generateUUIDv3()` (namespace-based)
- Validation: isValidUUID, isNilUUID, isMaxUUID
- Parsing: parseUUID, formatUUID, normalizeUUID, getUUIDVersion
- Components: toComponents, fromComponents
- Comparison: compareUUIDs, uuidsEqual

Random generation (v4, v7) is **non-deterministic**. Namespace-based generation (v3, v5) and all validation/parsing are deterministic.

### 7. @isl/crypto

**Path:** `stdlib/crypto/index.isl`  
**Status:** Full implementation  
**Demo Usage:** Password hashing, HMAC signatures, data integrity

Provides cryptographic operations including:
- **DETERMINISTIC Hashing:** hash, hashSHA256, hashSHA512, hashSHA3, hashBlake3
- **DETERMINISTIC HMAC:** hmac, verifyHmac
- **DETERMINISTIC Password:** verifyPassword, needsRehash
- **DETERMINISTIC Key:** deriveKey (with same salt)
- **DETERMINISTIC Utility:** constantTimeEquals, hashFile
- **NON-DETERMINISTIC:** generateToken, generateApiKey, generateBytes, hashPassword (generates salt)

Hash functions and HMAC are **deterministic** (same input → same output). Random generation is non-deterministic.

### 8. @isl/encoding

**Path:** `stdlib/encoding/index.isl`  
**Status:** Full implementation  
**Demo Usage:** API payloads, URL parameters, HTML rendering

Provides encoding operations including:
- Base64: encodeBase64, decodeBase64, encodeBase64Url, decodeBase64Url
- URL: encodeUrl, decodeUrl, encodeUrlComponent, decodeUrlComponent
- HTML: escapeHtml, unescapeHtml
- Hex: encodeHex, decodeHex
- Unicode: encodeUtf8, decodeUtf8

All functions are **deterministic**.

### 9. @isl/regex

**Path:** `stdlib/regex/index.isl`  
**Status:** Full implementation  
**Demo Usage:** Input validation, parsing, extraction

Provides safe regex operations including:
- Matching: test, match, matchAll
- Extraction: exec, groups, captures
- Replacement: replace, replaceAll
- Splitting: split
- Pattern building: escape, compile
- Validation: isValidPattern

All functions are **deterministic**. Patterns are limited to safe subsets (no catastrophic backtracking).

### 10. @isl/url

**Path:** `stdlib/url/index.isl`  
**Status:** Full implementation  
**Demo Usage:** API endpoints, routing, link generation

Provides URL operations including:
- Parsing: parse, tryParse
- Components: getProtocol, getHost, getPort, getPathname, getSearch, getHash
- Query: getQueryParam, getQueryParams, setQueryParam, removeQueryParam
- Building: build, join, resolve
- Validation: isValid, isAbsolute, isRelative, isHttps
- Normalization: normalize, removeTrailingSlash

All functions are **deterministic**.

---

## Determinism Policy

### Verification Mode

In **formal verification mode**, only deterministic functions are allowed:

```
verification_mode: strict

# Allowed:
let hash = crypto.hashSHA256(data)
let formatted = datetime.formatTimestamp(timestamp, "ISO8601")

# NOT Allowed (will fail verification):
let now = datetime.now()       # Non-deterministic
let id = uuid.generateUUID()   # Non-deterministic
```

### Runtime Mode

In **runtime mode**, all functions are available:

```
runtime_mode: full

# All functions available
let now = datetime.now()
let id = uuid.generateUUID()
```

### Explicit Marking

Non-deterministic functions are explicitly marked in ISL:

```isl
behavior now {
  description: "Get current timestamp (NON-DETERMINISTIC)"
  deterministic: false  # Explicit marker
  
  input {}
  output {
    success: Timestamp
  }
}
```

The verifier reads `deterministic: false` and excludes these functions from formal proofs.

---

## Not Included in 1.0

The following modules exist but are **not part of 1.0 stdlib**:

| Module | Reason |
|--------|--------|
| `@isl/auth` | Domain-specific (authentication) |
| `@isl/payments` | Domain-specific (PCI compliance) |
| `@isl/uploads` | Domain-specific (file handling) |
| `@isl/rate-limit` | Domain-specific (infrastructure) |
| `@isl/audit` | Domain-specific (compliance) |

These modules are available as **community packages** but not part of the core 1.0 stdlib. They may be promoted in future versions after broader validation.

---

## Import Syntax

```isl
# Standard imports
use @isl/string
use @isl/math
use @isl/json

# Aliased imports
use @isl/string as str
use @isl/collections as col

# Selective imports
use { Length, Trim, Contains } from @isl/string
use { sum, average } from @isl/math
```

---

## Registry Reference

The 1.0 stdlib is registered at:
- `packages/isl-stdlib/registry.json` (canonical)
- `packages/import-resolver/src/stdlib-registry.json` (resolver)

Both registries are automatically synchronized on build.
