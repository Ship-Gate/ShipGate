# ISL Standard Library Reference

## Overview

The ISL Standard Library provides **31 modules** for ISL. The original 10 core modules are designed with formal verification in mind, with explicit determinism annotations. Additional modules cover payments, auth, caching, queues, workflows, and more.

## Core Modules (10 — verification-ready)

| Module | Import | Determinism | Description |
|--------|--------|-------------|-------------|
| String | `use @isl/string` | 100% | String manipulation |
| Math | `use @isl/math` | 100% | Mathematical operations |
| Collections | `use @isl/collections` | 100% | List and Map operations |
| JSON | `use @isl/json` | 100% | JSON parsing/manipulation |
| DateTime | `use @isl/datetime` | Mixed* | Date and time operations |
| UUID | `use @isl/uuid` | Mixed* | UUID generation/validation |
| Crypto | `use @isl/crypto` | Mixed* | Cryptographic operations |
| Encoding | `use @isl/encoding` | 100% | Encoding/decoding |
| Regex | `use @isl/regex` | 100% | Pattern matching |
| URL | `use @isl/url` | 100% | URL parsing/manipulation |

*Mixed modules have explicitly marked non-deterministic functions

## Extended Modules (21 — application-level)

| Module | Package | Lines | Description |
|--------|---------|-------|-------------|
| Payments | `stdlib-payments` | 9,889 | Charges, checkout, refunds, idempotency, receipts |
| Rate Limit | `stdlib-rate-limit` | 7,166 | Token bucket, sliding window, distributed rate limiting |
| Queue | `stdlib-queue` | 4,403 | Job queues, retry, dead-letter, priority scheduling |
| Cache | `stdlib-cache` | 3,710 | Multi-layer caching, invalidation, TTL management |
| SaaS | `stdlib-saas` | 2,617 | Multi-tenancy primitives, tenant isolation |
| Workflow | `stdlib-workflow` | 2,589 | State machines, step functions, saga orchestration |
| Auth | `stdlib-auth` | 2,443 | Authentication, sessions, token management |
| Billing | `stdlib-billing` | 2,119 | Subscription management, metering, invoicing |
| HTTP | `stdlib-http` | 1,682 | HTTP client/server primitives, middleware |
| Database | `stdlib-database` | 546 | Connection pooling, migrations, query building |
| Actors | `stdlib-actors` | — | Actor model primitives |
| AI | `stdlib-ai` | — | AI/ML integration patterns |
| Analytics | `stdlib-analytics` | — | Event tracking, metrics |
| API | `stdlib-api` | — | API design patterns |
| Audit | `stdlib-audit` | — | Audit trail primitives |
| Distributed | `stdlib-distributed` | — | Distributed systems patterns |
| Email | `stdlib-email` | — | Email sending, templates |
| Events | `stdlib-events` | — | Event sourcing, pub/sub |
| Files | `stdlib-files` | — | File storage, uploads |
| Messaging | `stdlib-messaging` | — | Message passing, channels |
| Notifications | `stdlib-notifications` | — | Push, email, SMS notifications |

---

## @isl/string

String manipulation and validation operations. **100% deterministic.**

### Types

```isl
type StringCase = enum { LOWER, UPPER, TITLE, SENTENCE, CAMEL, PASCAL, SNAKE, KEBAB }
type TrimMode = enum { BOTH, START, END }
```

### Functions

#### Length Operations
- `Length(value: String) -> Int` - Get string length
- `IsEmpty(value: String) -> Boolean` - Check if empty
- `IsBlank(value: String) -> Boolean` - Check if empty or whitespace

#### Case Operations
- `ToLowerCase(value: String) -> String`
- `ToUpperCase(value: String) -> String`
- `ToTitleCase(value: String) -> String`
- `ToCamelCase(value: String) -> String`
- `ToSnakeCase(value: String) -> String`
- `ToKebabCase(value: String) -> String`
- `ChangeCase(value: String, case: StringCase) -> String`

#### Trim Operations
- `Trim(value: String) -> String`
- `TrimStart(value: String) -> String`
- `TrimEnd(value: String) -> String`
- `TrimChars(value: String, chars: String) -> String`

#### Search Operations
- `Contains(value: String, substring: String, case_sensitive?: Boolean) -> Boolean`
- `StartsWith(value: String, prefix: String) -> Boolean`
- `EndsWith(value: String, suffix: String) -> Boolean`
- `IndexOf(value: String, substring: String, start_index?: Int) -> Int`
- `LastIndexOf(value: String, substring: String) -> Int`

#### Manipulation
- `Substring(value: String, start: Int, length?: Int) -> String`
- `Replace(value: String, search: String, replacement: String) -> String`
- `ReplaceAll(value: String, search: String, replacement: String) -> String`
- `Split(value: String, delimiter: String, limit?: Int) -> SplitResult`
- `Join(parts: List<String>, delimiter?: String) -> String`
- `Concat(parts: List<String>) -> String`
- `Repeat(value: String, count: Int) -> String`
- `PadStart(value: String, length: Int, fill?: String) -> String`
- `PadEnd(value: String, length: Int, fill?: String) -> String`
- `Reverse(value: String) -> String`

#### Validation
- `IsValidEmail(value: String) -> Boolean`
- `IsValidUrl(value: String, require_https?: Boolean) -> Boolean`
- `IsValidPhone(value: String) -> Boolean`
- `MatchesPattern(value: String, pattern: String) -> Boolean`
- `IsAlpha(value: String) -> Boolean`
- `IsAlphanumeric(value: String) -> Boolean`
- `IsNumeric(value: String) -> Boolean`
- `IsHexadecimal(value: String) -> Boolean`

---

## @isl/math

Mathematical operations. **100% deterministic.**

### Types

```isl
type RoundingMode = enum { HALF_UP, HALF_DOWN, HALF_EVEN, FLOOR, CEIL, TRUNC }
type Percentage = Number { min: 0, max: 100 }
type UnitInterval = Number { min: 0, max: 1 }
```

### Functions

#### Basic
- `Abs(value: Number) -> Number`
- `Sign(value: Number) -> Int` - Returns -1, 0, or 1
- `Min(a: Number, b: Number) -> Number`
- `Max(a: Number, b: Number) -> Number`
- `Clamp(value: Number, min: Number, max: Number) -> Number`

#### Rounding
- `Floor(value: Number) -> Int`
- `Ceil(value: Number) -> Int`
- `Round(value: Number, mode?: RoundingMode) -> Int`
- `RoundTo(value: Number, decimals: Int, mode?: RoundingMode) -> Number`
- `Trunc(value: Number) -> Int`

#### Arithmetic
- `Add(a: Number, b: Number) -> Number`
- `Subtract(a: Number, b: Number) -> Number`
- `Multiply(a: Number, b: Number) -> Number`
- `Divide(a: Number, b: Number) -> Number` - Throws on division by zero
- `Mod(a: Number, b: Number) -> Number`
- `Pow(base: Number, exponent: Number) -> Number`
- `Sqrt(value: Number) -> Number`

#### Safe Arithmetic (Overflow Protection)
- `SafeAdd(a: Int, b: Int) -> Int` - Throws on overflow
- `SafeSubtract(a: Int, b: Int) -> Int` - Throws on underflow
- `SafeMultiply(a: Int, b: Int) -> Int` - Throws on overflow

#### Comparison
- `Approximately(a: Number, b: Number, epsilon?: Number) -> Boolean`
- `IsPositive(value: Number) -> Boolean`
- `IsNegative(value: Number) -> Boolean`
- `IsZero(value: Number, epsilon?: Number) -> Boolean`
- `IsInteger(value: Number) -> Boolean`
- `IsFinite(value: Number) -> Boolean`

#### Range
- `InRange(value: Number, min: Number, max: Number, inclusive?: Boolean) -> Boolean`
- `Lerp(a: Number, b: Number, t: UnitInterval) -> Number`
- `InverseLerp(a: Number, b: Number, value: Number) -> UnitInterval`

#### Statistics
- `Sum(values: List<Number>) -> Number`
- `Average(values: List<Number>) -> Number?`
- `Median(values: List<Number>) -> Number?`
- `Variance(values: List<Number>, sample?: Boolean) -> Number?`
- `StdDev(values: List<Number>, sample?: Boolean) -> Number?`
- `MinOf(values: List<Number>) -> Number?`
- `MaxOf(values: List<Number>) -> Number?`
- `Statistics(values: List<Number>) -> StatisticsResult`

#### Financial
- `Percentage(value: Number, percent: Percentage) -> Number`
- `PercentageOf(value: Number, total: Number) -> Percentage`
- `RoundCurrency(value: Number, mode?: RoundingMode) -> Number`
- `DiscountedPrice(price: Number, discount_percent: Percentage) -> Number`

### Constants
- `PI` = 3.141592653589793
- `E` = 2.718281828459045
- `MAX_SAFE_INTEGER` = 9007199254740991
- `MIN_SAFE_INTEGER` = -9007199254740991

---

## @isl/collections

List and Map operations. **100% deterministic** (uses stable sort).

### Functions

#### List Basic
- `Length(list: List<T>) -> Int`
- `IsEmpty(list: List<T>) -> Boolean`
- `First(list: List<T>) -> T?`
- `Last(list: List<T>) -> T?`
- `Get(list: List<T>, index: Int) -> T`

#### Transformation
- `Map(list: List<T>, fn: T -> U) -> List<U>`
- `Filter(list: List<T>, predicate: T -> Boolean) -> List<T>`
- `Reduce(list: List<T>, reducer: (U, T) -> U, initial: U) -> U`
- `FlatMap(list: List<T>, fn: T -> List<U>) -> List<U>`

#### Search
- `Find(list: List<T>, predicate: T -> Boolean) -> T?`
- `FindIndex(list: List<T>, predicate: T -> Boolean) -> Int`
- `IndexOf(list: List<T>, value: T) -> Int`
- `Includes(list: List<T>, value: T) -> Boolean`

#### Testing
- `Every(list: List<T>, predicate: T -> Boolean) -> Boolean`
- `Some(list: List<T>, predicate: T -> Boolean) -> Boolean`
- `None(list: List<T>, predicate: T -> Boolean) -> Boolean`

#### Slicing
- `Take(list: List<T>, count: Int) -> List<T>`
- `Drop(list: List<T>, count: Int) -> List<T>`
- `Slice(list: List<T>, start: Int, end?: Int) -> List<T>`

#### Modification
- `Reverse(list: List<T>) -> List<T>`
- `Sort(list: List<T>, order?: SortOrder) -> List<T>` - Stable sort
- `SortBy(list: List<T>, key_fn: T -> K, order?: SortOrder) -> List<T>`
- `Unique(list: List<T>) -> List<T>`

#### Grouping
- `Chunk(list: List<T>, size: Int) -> List<List<T>>`
- `GroupBy(list: List<T>, key_fn: T -> K) -> List<GroupedResult<K, T>>`
- `Partition(list: List<T>, predicate: T -> Boolean) -> { matching, not_matching }`

#### Set Operations
- `Union(first: List<T>, second: List<T>) -> List<T>`
- `Intersection(first: List<T>, second: List<T>) -> List<T>`
- `Difference(first: List<T>, second: List<T>) -> List<T>`

#### Map Operations
- `MapGet(map: Map<K, V>, key: K, default?: V) -> V?`
- `MapSet(map: Map<K, V>, key: K, value: V) -> Map<K, V>`
- `MapRemove(map: Map<K, V>, key: K) -> Map<K, V>`
- `MapHas(map: Map<K, V>, key: K) -> Boolean`
- `MapKeys(map: Map<K, V>) -> List<K>`
- `MapValues(map: Map<K, V>) -> List<V>`
- `MapMerge(first: Map<K, V>, second: Map<K, V>) -> Map<K, V>`

#### Utility
- `Range(start: Int, end: Int, step?: Int) -> List<Int>`
- `Repeat(value: T, count: Int) -> List<T>`

---

## @isl/json

JSON parsing and manipulation. **100% deterministic.**

### Functions

#### Parsing
- `Parse(json: String) -> JSONValue`
- `TryParse(json: String) -> JSONParseResult`

#### Serialization
- `Stringify(value: JSONValue, format?: JSONFormatOptions) -> String`
- `StringifyPretty(value: JSONValue, indent?: Int) -> String`
- `StringifyCompact(value: JSONValue) -> String`

#### Access
- `Get(object: JSONValue, path: String, default?: JSONValue) -> JSONValue?`
- `GetString(object: JSONValue, path: String) -> String?`
- `GetNumber(object: JSONValue, path: String) -> Number?`
- `GetBoolean(object: JSONValue, path: String) -> Boolean?`
- `Has(object: JSONValue, path: String) -> Boolean`

#### Modification
- `Set(object: JSONValue, path: String, value: JSONValue) -> JSONValue`
- `Remove(object: JSONValue, path: String) -> JSONValue`
- `Merge(target: JSONObject, source: JSONObject, deep?: Boolean) -> JSONObject`
- `Clone(value: JSONValue) -> JSONValue`

#### Querying
- `Keys(object: JSONObject) -> List<String>`
- `Values(object: JSONObject) -> List<JSONValue>`
- `Entries(object: JSONObject) -> List<{ key, value }>`

#### Comparison
- `Equals(a: JSONValue, b: JSONValue) -> Boolean`
- `Diff(source: JSONValue, target: JSONValue) -> JSONDiff`

#### Validation
- `IsValid(json: String) -> Boolean`
- `IsObject(value: JSONValue) -> Boolean`
- `IsArray(value: JSONValue) -> Boolean`
- `IsString(value: JSONValue) -> Boolean`
- `IsNumber(value: JSONValue) -> Boolean`

#### Transformation
- `Flatten(object: JSONObject, delimiter?: String) -> Map<String, JSONValue>`
- `Unflatten(object: Map<String, JSONValue>) -> JSONObject`
- `Pick(object: JSONObject, keys: List<String>) -> JSONObject`
- `Omit(object: JSONObject, keys: List<String>) -> JSONObject`

---

## @isl/datetime

Date and time operations. **Mixed determinism.**

### Non-Deterministic Functions

These functions are excluded from formal verification:

- `Now() -> Timestamp` - Returns current system time

### Deterministic Functions

#### Arithmetic
- `AddDuration(timestamp: Timestamp, duration: Duration) -> Timestamp`
- `SubtractDuration(timestamp: Timestamp, duration: Duration) -> Timestamp`
- `DiffTimestamps(start: Timestamp, end: Timestamp) -> Duration`

#### Formatting
- `FormatTimestamp(timestamp: Timestamp, format?: DateFormat, timezone?: TimeZone) -> String`
- `ParseTimestamp(value: String, format?: DateFormat, timezone?: TimeZone) -> Timestamp`

#### Components
- `GetDatePart(timestamp: Timestamp, part: DatePart, timezone?: TimeZone) -> Int`
- `ToComponents(timestamp: Timestamp, timezone?: TimeZone) -> DateTimeComponents`
- `FromComponents(components: DateTimeComponents) -> Timestamp`

#### Duration
- `DurationToMs(components: DurationComponents) -> Duration`
- `MsToDuration(milliseconds: Duration) -> DurationComponents`

#### Calendar
- `IsLeapYear(year: Int) -> Boolean`
- `DaysInMonth(year: Int, month: Int) -> Int`

#### Comparison
- `CompareTimestamps(a: Timestamp, b: Timestamp) -> Int`
- `IsBefore(timestamp: Timestamp, other: Timestamp) -> Boolean`
- `IsAfter(timestamp: Timestamp, other: Timestamp) -> Boolean`
- `IsBetween(timestamp: Timestamp, start: Timestamp, end: Timestamp) -> Boolean`

### Constants
- `SECOND_MS` = 1000
- `MINUTE_MS` = 60000
- `HOUR_MS` = 3600000
- `DAY_MS` = 86400000
- `WEEK_MS` = 604800000

---

## @isl/uuid

UUID generation and validation. **Mixed determinism.**

### Non-Deterministic Functions

- `GenerateUUID(format?: UUIDFormat) -> String` - Random UUID v4
- `GenerateUUIDv7(format?: UUIDFormat) -> String` - Time-ordered UUID v7

### Deterministic Functions

#### Generation (Namespace-based)
- `GenerateUUIDv5(namespace: UUID, name: String) -> UUID` - SHA-1 based
- `GenerateUUIDv3(namespace: UUID, name: String) -> UUID` - MD5 based
- `GenerateNamespacedUUID(namespace: UUIDNamespace, name: String) -> UUID`

#### Validation
- `IsValidUUID(value: String) -> Boolean`
- `IsNilUUID(uuid: UUID) -> Boolean`
- `IsMaxUUID(uuid: UUID) -> Boolean`

#### Parsing
- `ParseUUID(value: String) -> UUIDInfo`
- `FormatUUID(uuid: UUID, format: UUIDFormat) -> String`
- `NormalizeUUID(uuid: String) -> UUID`
- `GetUUIDVersion(uuid: UUID) -> UUIDVersion`
- `ToComponents(uuid: UUID) -> UUIDComponents`
- `FromComponents(components: UUIDComponents) -> UUID`

#### Comparison
- `CompareUUIDs(a: UUID, b: UUID) -> Int`
- `UUIDsEqual(a: String, b: String) -> Boolean`

### Constants
- `NIL_UUID` = "00000000-0000-0000-0000-000000000000"
- `MAX_UUID` = "ffffffff-ffff-ffff-ffff-ffffffffffff"
- `NAMESPACE_DNS`, `NAMESPACE_URL`, `NAMESPACE_OID`, `NAMESPACE_X500`

---

## @isl/crypto

Cryptographic operations. **Mixed determinism.**

### Non-Deterministic Functions

- `GenerateToken(length?: Int, encoding?: String) -> String`
- `GenerateApiKey(prefix?: String, length?: Int) -> String`
- `GenerateBytes(count: Int) -> String`
- `HashPassword(password: String, config?: PasswordHashConfig) -> String` - Uses random salt

### Deterministic Functions

#### Hashing
- `Hash(data: String, algorithm?: HashAlgorithm) -> HashResult`
- `HashSHA256(data: String) -> String`
- `HashSHA512(data: String) -> String`
- `HashSHA3(data: String, bits?: Int) -> String`
- `HashBlake3(data: String, output_length?: Int) -> String`
- `HashFile(content: String, algorithm?: HashAlgorithm) -> HashResult`

#### Password Verification
- `VerifyPassword(password: String, hash: String) -> Boolean`
- `NeedsRehash(hash: String, config?: PasswordHashConfig) -> Boolean`

#### HMAC
- `Hmac(data: String, key: String, algorithm?: HmacAlgorithm) -> String`
- `VerifyHmac(data: String, key: String, signature: String) -> Boolean`

#### Key Derivation
- `DeriveKey(password: String, salt: String, iterations?: Int) -> String`

#### Utility
- `ConstantTimeEquals(a: String, b: String) -> Boolean`

---

## @isl/encoding

Encoding and decoding operations. **100% deterministic.**

### Functions

#### Base64
- `EncodeBase64(value: String) -> String`
- `DecodeBase64(value: String) -> String`
- `EncodeBase64Url(value: String, include_padding?: Boolean) -> String`
- `DecodeBase64Url(value: String) -> String`
- `IsValidBase64(value: String) -> Boolean`
- `IsValidBase64Url(value: String) -> Boolean`

#### URL
- `EncodeUrl(value: String) -> String`
- `DecodeUrl(value: String) -> String`
- `EncodeUrlComponent(value: String) -> String`
- `DecodeUrlComponent(value: String) -> String`
- `BuildQueryString(params: Map<String, String>) -> String`
- `ParseQueryString(query: String) -> Map<String, String>`

#### HTML
- `EscapeHtml(value: String) -> String`
- `UnescapeHtml(value: String) -> String`
- `EscapeHtmlAttribute(value: String) -> String`

#### Hex
- `EncodeHex(value: String, uppercase?: Boolean) -> String`
- `DecodeHex(value: String) -> String`
- `IsValidHex(value: String) -> Boolean`

#### Unicode
- `EncodeUtf8(value: String) -> String`
- `DecodeUtf8(bytes: String) -> String`
- `GetByteLength(value: String) -> Int`
- `StringToCodePoints(value: String) -> List<Int>`
- `CodePointsToString(code_points: List<Int>) -> String`

---

## @isl/regex

Safe regex pattern matching. **100% deterministic.**

### Functions

#### Matching
- `Test(value: String, pattern: String, flags?: String) -> Boolean`
- `Match(value: String, pattern: String, flags?: String) -> Match?`
- `MatchAll(value: String, pattern: String, flags?: String) -> MatchAllResult`
- `Exec(value: String, pattern: String, start_index?: Int) -> Match?`

#### Capture Groups
- `Groups(value: String, pattern: String) -> Map<String, String?>`
- `Captures(value: String, pattern: String) -> List<String?>`

#### Replacement
- `Replace(value: String, pattern: String, replacement: String) -> ReplaceResult`
- `ReplaceAll(value: String, pattern: String, replacement: String) -> ReplaceResult`

#### Splitting
- `Split(value: String, pattern: String, limit?: Int) -> SplitResult`

#### Pattern Utilities
- `Escape(value: String) -> String` - Escape for literal matching
- `IsValidPattern(pattern: String, flags?: String) -> Boolean`
- `ValidatePattern(pattern: String) -> { valid, error?, info? }`
- `GetPatternInfo(pattern: String) -> PatternInfo`

#### Common Pattern Matchers
- `MatchEmail(value: String, strict?: Boolean) -> Match?`
- `MatchUrl(value: String, require_protocol?: Boolean) -> Match?`
- `MatchPhone(value: String, format?: String) -> Match?`
- `MatchUuid(value: String, version?: Int) -> Match?`
- `MatchIpAddress(value: String, version?: Int) -> Match?`

### Common Patterns
- `PATTERN_EMAIL`
- `PATTERN_URL`
- `PATTERN_UUID`
- `PATTERN_UUID_V4`
- `PATTERN_IPV4`
- `PATTERN_PHONE_E164`
- `PATTERN_HEX`
- `PATTERN_SLUG`

---

## @isl/url

URL parsing and manipulation. **100% deterministic.**

### Functions

#### Parsing
- `Parse(url: String, base?: String) -> ParsedURL`
- `TryParse(url: String, base?: String) -> URLParseResult`
- `ParseQuery(query: String, decode?: Boolean) -> QueryParams`

#### Component Access
- `GetProtocol(url: String) -> String`
- `GetHost(url: String) -> String`
- `GetHostname(url: String) -> String`
- `GetPort(url: String) -> Int?`
- `GetPathname(url: String) -> String`
- `GetSearch(url: String) -> String?`
- `GetHash(url: String) -> String?`
- `GetOrigin(url: String) -> String`

#### Query Parameters
- `GetQueryParam(url: String, name: String, default?: String) -> String?`
- `GetQueryParams(url: String) -> QueryParams`
- `GetQueryParamAll(url: String, name: String) -> List<String>`
- `HasQueryParam(url: String, name: String) -> Boolean`
- `SetQueryParam(url: String, name: String, value: String) -> String`
- `SetQueryParams(url: String, params: Map<String, String>) -> String`
- `RemoveQueryParam(url: String, name: String) -> String`
- `ClearQueryParams(url: String) -> String`

#### Building
- `Build(components: URLComponents) -> String`
- `BuildQuery(params: Map<String, String>, encode?: Boolean) -> String`
- `Join(base: String, segments: List<String>) -> String`
- `Resolve(base: String, relative: String) -> String`

#### Validation
- `IsValid(url: String) -> Boolean`
- `IsAbsolute(url: String) -> Boolean`
- `IsRelative(url: String) -> Boolean`
- `IsHttps(url: String) -> Boolean`
- `IsSameOrigin(url1: String, url2: String) -> Boolean`

#### Normalization
- `Normalize(url: String, options?: NormalizeOptions) -> String`
- `RemoveTrailingSlash(url: String) -> String`
- `AddTrailingSlash(url: String) -> String`

#### Modification
- `SetProtocol(url: String, protocol: String) -> String`
- `SetHost(url: String, host: String, port?: Int) -> String`
- `SetPathname(url: String, pathname: String) -> String`
- `SetHash(url: String, hash: String?) -> String`

#### Path Utilities
- `GetPathSegments(url: String) -> List<String>`
- `GetFilename(url: String) -> String?`
- `GetExtension(url: String) -> String?`

---

## Determinism Policy

### Verification Mode

In formal verification mode, only deterministic functions are allowed:

```isl
# Allowed in verification
let hash = crypto.HashSHA256(data)
let formatted = datetime.FormatTimestamp(timestamp, "ISO8601")
let uuid = uuid.GenerateUUIDv5(namespace, name)

# NOT allowed in verification (non-deterministic)
let now = datetime.Now()         # Error
let id = uuid.GenerateUUID()     # Error
let token = crypto.GenerateToken()  # Error
```

### Runtime Mode

In runtime mode, all functions are available:

```isl
# All functions available at runtime
let now = datetime.Now()
let id = uuid.GenerateUUID()
let token = crypto.GenerateToken(32)
```

### Function Annotations

Non-deterministic functions are explicitly marked in ISL:

```isl
behavior Now {
  description: "Get current timestamp"
  deterministic: false  # Explicit marker
  
  output {
    success: Timestamp
  }
}
```
