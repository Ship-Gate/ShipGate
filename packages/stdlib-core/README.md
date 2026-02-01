# @intentos/stdlib-core

Core ISL (Intent Specification Language) standard library types with TypeScript and Python implementations.

## Overview

This package provides a comprehensive set of validated, type-safe primitives for building robust applications. All types are defined in ISL with corresponding runtime implementations in TypeScript and Python.

## Installation

```bash
npm install @intentos/stdlib-core
# or
pnpm add @intentos/stdlib-core
# or
yarn add @intentos/stdlib-core
```

## Modules

### Primitives (`@intentos/stdlib-core/primitives`)

Common primitive types with validation:

- **Email** - RFC 5322 compliant email validation
- **Phone** - E.164 international phone format
- **URL** / **SecureURL** - HTTP/HTTPS URL validation
- **Money** - Decimal precision with currency
- **Percentage** - 0-100 range validation
- **CreditCardNumber** - Luhn algorithm validation
- **Password** / **StrongPassword** - Password strength requirements
- **JWT** - JSON Web Token format
- **IPv4** / **IPv6** - IP address validation
- **HexColor** - CSS hex color codes
- **SemVer** - Semantic versioning
- **SHA256** / **MD5** - Hash format validation
- **Base64** / **Base64URL** - Encoding validation

```typescript
import { isValidEmail, parseEmail, createMoney, formatMoney } from '@intentos/stdlib-core';

// Validation
if (isValidEmail('user@example.com')) {
  // Type is narrowed to Email branded type
}

// Parsing with Result type
const result = parseEmail('user@example.com');
if (result.ok) {
  console.log(result.value); // Email type
} else {
  console.error(result.error);
}

// Money operations
const price = createMoney(99.99, 'USD');
console.log(formatMoney(price)); // "$99.99"
```

### Time (`@intentos/stdlib-core/time`)

Duration and time-related types:

- **Duration** - Time spans with fluent syntax
- **Timezone** - IANA timezone validation
- **ISODate** / **ISOTime** / **ISODateTime** - ISO 8601 formats
- **DateRange** / **DateTimeRange** - Time periods
- **TimeOfDay** - Wall clock time
- **CronExpression** - Cron schedule validation
- **UnixTimestamp** - Epoch timestamps

```typescript
import { seconds, minutes, hours, toMilliseconds, isValidTimezone } from '@intentos/stdlib-core/time';

// Fluent duration syntax
const timeout = seconds(30);
const interval = minutes(5);
const ttl = hours(24);

// Conversions
console.log(toMilliseconds(minutes(1))); // 60000

// Duration arithmetic
const total = addDuration(minutes(5), seconds(30));
console.log(formatDuration(total)); // "5.5m"

// Validation
isValidTimezone('America/New_York'); // true
isValidISODate('2024-01-15'); // true
isValidCronExpression('0 12 * * *'); // true
```

### Geo (`@intentos/stdlib-core/geo`)

Geographic and address types:

- **Coordinates** - WGS84 latitude/longitude
- **Address** / **USAddress** / **SimpleAddress** - Postal addresses
- **Distance** - Distance with unit conversions
- **BoundingBox** / **GeoCircle** / **GeoPolygon** - Geographic regions
- **ZipCode** / **UKPostcode** / **CanadianPostalCode** - Postal codes
- **Geohash** / **PlusCode** / **What3Words** - Location encoding

```typescript
import { 
  createCoordinates, 
  haversineDistance, 
  isWithinRadius,
  kilometers,
  isValidUSZipCode 
} from '@intentos/stdlib-core/geo';

// Coordinates
const sf = createCoordinates(37.7749, -122.4194);
const la = createCoordinates(34.0522, -118.2437);

// Distance calculation
const distance = haversineDistance(sf, la);
console.log(toKilometers(distance)); // ~559

// Radius check
isWithinRadius(point, center, kilometers(10));

// Postal code validation
isValidUSZipCode('94105'); // true
isValidUSZipCode('94105-1234'); // true (ZIP+4)
```

### IDs (`@intentos/stdlib-core/ids`)

Identifier types and generators:

- **UUID** / **UUIDv7** / **CompactUUID** - UUID formats
- **ULID** - Lexicographically sortable unique IDs
- **NanoID** / **ShortId** / **HumanCode** - Short identifiers
- **ObjectId** - MongoDB ObjectId
- **SnowflakeId** - Twitter-style snowflake IDs
- **EAN13** / **UPCA** / **ISBN13** / **ISBN10** - Product codes
- **DOI** / **ORCID** - Research identifiers
- **StripeCustomerId** / **ARN** / **K8sName** - Service-specific IDs

```typescript
import { 
  generateUUID, 
  generateULID, 
  generateShortId,
  generateHumanCode,
  isValidUUID,
  ulidToTimestamp,
  ulidToDate
} from '@intentos/stdlib-core/ids';

// Generation
const uuid = generateUUID(); // "550e8400-e29b-41d4-a716-446655440000"
const ulid = generateULID(); // "01ARZ3NDEKTSV4RRFFQ69G5FAV"
const shortId = generateShortId(); // "xY7_abc2XX"
const humanCode = generateHumanCode(); // "ABC123"

// Validation
isValidUUID(uuid); // true

// ULID timestamp extraction
const timestamp = ulidToTimestamp(ulid);
const date = ulidToDate(ulid);
```

### Validation (`@intentos/stdlib-core/validation`)

Validation framework:

- **Validator<T>** - Type-safe validator functions
- **ValidationResult** - Structured validation results
- **Constraint validators** - min, max, minLength, pattern, etc.
- **Composite validators** - compose, optional, array, object

```typescript
import { 
  compose, 
  string, 
  minLength, 
  maxLength, 
  pattern,
  object,
  optional
} from '@intentos/stdlib-core/validation';

// Build custom validators
const validateUsername = compose<string>(
  string(),
  minLength(3),
  maxLength(30),
  pattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
);

// Validate objects
const validateUser = object({
  username: validateUsername,
  email: compose(string(), pattern(PATTERNS.EMAIL)),
  age: optional(compose(number(), min(0), max(150)))
});

const result = validateUser({ 
  username: 'john_doe', 
  email: 'john@example.com' 
});
```

## ISL Type Definitions

Raw ISL definitions are available in the `intents/` directory:

- `intents/primitives.isl` - Email, Phone, URL, Money, etc.
- `intents/time.isl` - Duration, Timezone, DateRange
- `intents/geo.isl` - Address, Coordinates, Distance
- `intents/ids.isl` - UUID, ULID, ShortId

## Python Support

Python implementations are in `implementations/python/`:

```python
from stdlib_core import (
    is_valid_email,
    is_valid_phone,
    Money,
    Currency,
    parse_email,
    generate_uuid,
    generate_ulid,
    haversine_distance,
    Coordinates,
    Duration,
    seconds,
    minutes,
)

# Validation
if is_valid_email("user@example.com"):
    print("Valid email!")

# Money
price = Money.create(99.99, Currency.USD)

# Duration
timeout = seconds(30)
interval = minutes(5)

# Coordinates
sf = Coordinates(37.7749, -122.4194)
la = Coordinates(34.0522, -118.2437)
distance = haversine_distance(sf, la)
```

## Branded Types

TypeScript implementations use branded types for compile-time safety:

```typescript
import { Email, UUID, assertEmail, assertUUID } from '@intentos/stdlib-core';

function sendEmail(to: Email, subject: string) {
  // `to` is guaranteed to be a valid email at compile time
}

// This will narrow the type
const email = 'user@example.com';
assertEmail(email); // Throws if invalid
// email is now typed as Email

// Or use type guards
if (isValidEmail(email)) {
  sendEmail(email, 'Hello'); // email is Email type here
}
```

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

## API Reference

### Result Type

All parsing functions return a `Result` type:

```typescript
type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };
```

### Validation Functions

| Function | Input | Returns |
|----------|-------|---------|
| `isValid*` | `string` | `boolean` |
| `parse*` | `string` | `Result<T>` |
| `assert*` | `string` | `void` (throws) |
| `create*` | `...args` | `T` |

## License

MIT
