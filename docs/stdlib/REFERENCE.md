# ISL Standard Library Reference

The ISL Standard Library (stdlib) provides reusable modules for common functionality in specifications. All modules are versioned and can be imported using the `use` statement.

## Module Overview

| Module | Alias | Description | Deterministic |
|--------|-------|-------------|---------------|
| `@isl/auth` | `stdlib-auth` | Authentication and authorization | Mixed |
| `@isl/rate-limit` | `stdlib-rate-limit` | Rate limiting and quotas | Yes |
| `@isl/audit` | `stdlib-audit` | Audit logging and compliance | Yes |
| `@isl/payments` | `stdlib-payments` | Payment processing | Mixed |
| `@isl/uploads` | `stdlib-uploads` | File uploads and storage | Mixed |
| `@isl/datetime` | `stdlib-datetime` | Date/time operations | Mixed |
| `@isl/strings` | `stdlib-strings` | String manipulation | Yes |
| `@isl/crypto` | `stdlib-crypto` | Cryptographic operations | Mixed |
| `@isl/uuid` | `stdlib-uuid` | UUID generation/validation | Mixed |
| `@isl/json` | `stdlib-json` | JSON parsing/manipulation | Yes |

## Import Syntax

```isl
# Using canonical name
use @isl/datetime

# Using alias
use stdlib-datetime

# Multiple imports
use @isl/datetime
use @isl/strings
use @isl/crypto
```

---

## @isl/auth

Authentication and authorization specifications.

### Exports

**Types:** `User`, `Session`, `Role`, `Permission`, `Token`, `Credential`, `AuthResult`, `LoginAttempt`

**Files:**
- `oauth-login.isl` - OAuth 2.0 authentication flows
- `session-create.isl` - Session management
- `password-reset.isl` - Password reset flows
- `rate-limit-login.isl` - Login rate limiting

### Example

```isl
use @isl/auth

behavior Login {
  post success {
    Session.exists(result.session.id)
    result.session.expires_at > now()
  }
}
```

---

## @isl/rate-limit

Rate limiting and quota management specifications.

### Exports

**Types:** `RateLimitConfig`, `RateLimitResult`, `RateLimitKey`, `QuotaConfig`, `QuotaUsage`, `SlidingWindowConfig`, `TokenBucketConfig`, `FixedWindowConfig`

### Algorithms

- **Fixed Window** - Simple count per time window
- **Sliding Window** - Rolling window calculation
- **Token Bucket** - Token-based rate limiting

---

## @isl/audit

Audit logging and compliance specifications.

### Exports

**Types:** `AuditEntry`, `AuditLog`, `AuditQuery`, `AuditRetention`, `AuditEvent`, `AuditActor`, `AuditContext`

---

## @isl/payments

Payment processing specifications.

### Exports

**Types:** `Payment`, `Invoice`, `Subscription`, `Price`, `Currency`, `Transaction`, `Refund`, `Webhook`

---

## @isl/uploads

File upload and storage specifications.

### Exports

**Types:** `File`, `FileMetadata`, `StorageProvider`, `UploadResult`, `MimeType`, `Blob`

---

## @isl/datetime

Date and time operations.

### Exports

**Types:**
- `Timestamp` - Unix timestamp in milliseconds
- `Duration` - Duration in milliseconds
- `TimeZone` - IANA timezone identifier
- `DateFormat` - Format enum (ISO8601, ISO_DATE, etc.)
- `DatePart` - Component enum (YEAR, MONTH, DAY, etc.)
- `DateTimeComponents` - Decomposed date/time
- `DurationComponents` - Decomposed duration

**Behaviors:**
- `Now()` - Current timestamp ❌ Non-deterministic
- `AddDuration(timestamp, duration)` - Add duration ✅ Deterministic
- `SubtractDuration(timestamp, duration)` - Subtract duration ✅ Deterministic
- `DiffTimestamps(start, end)` - Calculate difference ✅ Deterministic
- `FormatTimestamp(timestamp, format, timezone)` - Format to string ✅ Deterministic
- `ParseTimestamp(value, format, timezone)` - Parse from string ✅ Deterministic
- `GetDatePart(timestamp, part, timezone)` - Extract component ✅ Deterministic
- `IsLeapYear(year)` - Check leap year ✅ Deterministic
- `DaysInMonth(year, month)` - Days in month ✅ Deterministic
- `CompareTimestamps(a, b)` - Compare (-1, 0, 1) ✅ Deterministic
- `IsBefore(timestamp, other)` - Before check ✅ Deterministic
- `IsAfter(timestamp, other)` - After check ✅ Deterministic
- `IsBetween(timestamp, start, end)` - Range check ✅ Deterministic

**Constants:**
- `SECOND_MS`, `MINUTE_MS`, `HOUR_MS`, `DAY_MS`, `WEEK_MS`

### Example

```isl
use @isl/datetime

behavior CreateOrder {
  post success {
    result.created_at <= Now()
    result.expires_at == AddDuration(result.created_at, DAY_MS * 7)
    IsBefore(result.created_at, result.expires_at)
  }
}
```

---

## @isl/strings

String manipulation and validation.

### Exports

**Types:**
- `StringCase` - Case enum (LOWER, UPPER, TITLE, CAMEL, SNAKE, KEBAB)
- `EmailFormat`, `UrlFormat`, `PhoneFormat` - Pre-validated types

**Behaviors:**

*Length Operations:*
- `Length(value)` - Get length ✅
- `IsEmpty(value)` - Check empty ✅
- `IsBlank(value)` - Check whitespace-only ✅

*Case Operations:*
- `ToLowerCase(value)` - To lowercase ✅
- `ToUpperCase(value)` - To uppercase ✅
- `ToTitleCase(value)` - To title case ✅
- `ChangeCase(value, case)` - Convert case ✅

*Trim Operations:*
- `Trim(value)` - Trim both ends ✅
- `TrimStart(value)` - Trim start ✅
- `TrimEnd(value)` - Trim end ✅

*Search Operations:*
- `Contains(value, substring)` - Contains check ✅
- `StartsWith(value, prefix)` - Prefix check ✅
- `EndsWith(value, suffix)` - Suffix check ✅
- `IndexOf(value, substring)` - Find first ✅
- `LastIndexOf(value, substring)` - Find last ✅

*Manipulation:*
- `Substring(value, start, length)` - Extract portion ✅
- `Replace(value, search, replacement)` - Replace first ✅
- `ReplaceAll(value, search, replacement)` - Replace all ✅
- `Split(value, delimiter)` - Split string ✅
- `Join(parts, delimiter)` - Join strings ✅
- `Concat(parts)` - Concatenate ✅
- `Repeat(value, count)` - Repeat n times ✅
- `PadStart(value, length, fill)` - Pad start ✅
- `PadEnd(value, length, fill)` - Pad end ✅
- `Reverse(value)` - Reverse ✅

*Validation:*
- `IsValidEmail(value)` - Email validation ✅
- `IsValidUrl(value)` - URL validation ✅
- `IsValidPhone(value)` - E.164 phone validation ✅
- `MatchesPattern(value, pattern)` - Regex match ✅
- `IsAlpha(value)` - Letters only ✅
- `IsAlphanumeric(value)` - Letters and digits ✅
- `IsNumeric(value)` - Digits only ✅
- `IsHexadecimal(value)` - Hex string ✅

*Encoding:*
- `EncodeBase64(value)` / `DecodeBase64(value)` ✅
- `EncodeUrl(value)` / `DecodeUrl(value)` ✅
- `EscapeHtml(value)` / `UnescapeHtml(value)` ✅

### Example

```isl
use @isl/strings

behavior RegisterUser {
  input {
    email: String
    username: String
  }
  
  pre {
    IsValidEmail(email)
    Length(username) >= 3
    IsAlphanumeric(username)
  }
  
  post success {
    result.email == ToLowerCase(Trim(input.email))
  }
}
```

---

## @isl/crypto

Cryptographic hashing and secure operations.

### Exports

**Types:**
- `HashAlgorithm` - SHA256, SHA384, SHA512, SHA3_256, SHA3_512, BLAKE2B, BLAKE3
- `PasswordHashAlgorithm` - BCRYPT, ARGON2ID, SCRYPT, PBKDF2
- `HmacAlgorithm` - HMAC_SHA256, HMAC_SHA384, HMAC_SHA512
- `HashOutput`, `PasswordHash`, `SecureToken`, `HmacSignature`, `SecretKey`

**Behaviors:**

*Hash Functions (Deterministic):*
- `Hash(data, algorithm)` - General hash ✅
- `HashSHA256(data)` - SHA-256 ✅
- `HashSHA512(data)` - SHA-512 ✅
- `HashSHA3(data, bits)` - SHA-3 ✅
- `HashBlake3(data, output_length)` - BLAKE3 ✅

*Password Hashing:*
- `HashPassword(password, config)` - Hash password ✅
- `VerifyPassword(password, hash)` - Verify password ✅
- `NeedsRehash(hash, config)` - Check if upgrade needed ✅

*HMAC:*
- `Hmac(data, key, algorithm)` - Compute HMAC ✅
- `VerifyHmac(data, key, signature)` - Verify HMAC ✅

*Random Generation (Non-deterministic):*
- `GenerateToken(length, encoding)` - Random token ❌
- `GenerateApiKey(prefix, length)` - API key ❌
- `GenerateBytes(count)` - Random bytes ❌

*Key Derivation:*
- `DeriveKey(password, salt, iterations, key_length)` ✅

*Utility:*
- `ConstantTimeEquals(a, b)` - Timing-safe compare ✅

### Example

```isl
use @isl/crypto

behavior CreateUser {
  input { password: String }
  
  post success {
    result.password_hash == HashPassword(input.password)
  }
  
  invariants {
    password never_stored_plaintext
    password never_logged
  }
}

behavior VerifyWebhook {
  input {
    payload: String
    signature: String
    secret: String
  }
  
  pre {
    VerifyHmac(payload, secret, signature, HMAC_SHA256)
  }
}
```

---

## @isl/uuid

UUID generation, validation, and parsing.

### Exports

**Types:**
- `UUID` - UUID string type
- `UUIDVersion` - V1, V3, V4, V5, V6, V7
- `UUIDNamespace` - DNS, URL, OID, X500
- `UUIDFormat` - CANONICAL, COMPACT, URN, BRACES

**Behaviors:**

*Generation (Non-deterministic):*
- `GenerateUUID(format)` - Random UUID v4 ❌
- `GenerateUUIDv7(format)` - Time-ordered UUID v7 ❌

*Generation (Deterministic):*
- `GenerateUUIDv5(namespace, name)` - SHA-1 namespace UUID ✅
- `GenerateUUIDv3(namespace, name)` - MD5 namespace UUID ✅

*Validation:*
- `IsValidUUID(value)` - Format validation ✅
- `IsNilUUID(uuid)` - Nil check ✅
- `IsMaxUUID(uuid)` - Max check ✅

*Parsing/Formatting:*
- `ParseUUID(value)` - Parse to UUIDInfo ✅
- `FormatUUID(uuid, format)` - Format to string ✅
- `NormalizeUUID(uuid)` - Canonical format ✅
- `GetUUIDVersion(uuid)` - Extract version ✅

*Comparison:*
- `CompareUUIDs(a, b)` - Lexicographic compare ✅
- `UUIDsEqual(a, b)` - Equality check ✅

**Constants:**
- `NIL_UUID`, `MAX_UUID`
- `NAMESPACE_DNS`, `NAMESPACE_URL`, `NAMESPACE_OID`, `NAMESPACE_X500`

### Example

```isl
use @isl/uuid

behavior CreateResource {
  post success {
    IsValidUUID(result.id)
    not IsNilUUID(result.id)
  }
}

behavior GetResource {
  input { id: String }
  
  pre {
    IsValidUUID(id)
  }
}
```

---

## @isl/json

JSON parsing, serialization, and manipulation.

### Exports

**Types:**
- `JSONValue`, `JSONObject`, `JSONArray`
- `JSONPath` - JSONPath expression
- `JSONPointer` - JSON Pointer (RFC 6901)
- `JSONPatchOp` - ADD, REMOVE, REPLACE, MOVE, COPY, TEST
- `JSONFormatOptions` - COMPACT, PRETTY, SORTED_KEYS

**Behaviors:**

*Parsing:*
- `Parse(json)` - Parse string to value ✅
- `TryParse(json)` - Parse with error handling ✅

*Serialization:*
- `Stringify(value, format)` - Serialize to string ✅
- `StringifyPretty(value, indent)` - Pretty print ✅
- `StringifyCompact(value)` - Compact output ✅

*Access:*
- `Get(object, path)` - Get value at path ✅
- `GetString(object, path)` - Get string ✅
- `GetNumber(object, path)` - Get number ✅
- `GetBoolean(object, path)` - Get boolean ✅
- `GetArray(object, path)` - Get array ✅
- `GetObject(object, path)` - Get object ✅
- `Has(object, path)` - Check path exists ✅

*Modification:*
- `Set(object, path, value)` - Set value ✅
- `Remove(object, path)` - Remove value ✅
- `Merge(target, source)` - Deep merge ✅
- `Clone(value)` - Deep clone ✅

*Querying:*
- `Keys(object)` - Get keys ✅
- `Values(object)` - Get values ✅
- `Entries(object)` - Get key-value pairs ✅
- `Query(object, path)` - JSONPath query ✅

*Comparison:*
- `Equals(a, b)` - Deep equality ✅
- `Diff(source, target)` - Calculate patches ✅
- `ApplyPatches(value, patches)` - Apply patches ✅

*Validation:*
- `IsValid(json)` - Valid JSON check ✅
- `IsObject(value)`, `IsArray(value)`, `IsString(value)`, `IsNumber(value)`, `IsBoolean(value)`, `IsNull(value)` ✅

*Transformation:*
- `Flatten(object, delimiter)` - Flatten to dot-notation ✅
- `Unflatten(object, delimiter)` - Expand dot-notation ✅
- `Pick(object, keys)` - Select keys ✅
- `Omit(object, keys)` - Exclude keys ✅

### Example

```isl
use @isl/json

behavior ProcessWebhook {
  input { payload: String }
  
  pre {
    IsValid(payload)
  }
  
  post success {
    data = Parse(input.payload)
    GetString(data, "$.event_type") != null
    Has(data, "$.data.id")
  }
}
```

---

## See Also

- [Deterministic vs Non-Deterministic Functions](./DETERMINISM.md)
- [ISL Syntax Reference](../SYNTAX.md)
- [ISL Verification Guide](../VERIFICATION.md)
