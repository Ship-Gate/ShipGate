---
title: Standard Library
description: ISL standard library modules and built-in functions.
---

ISL includes a standard library of modules that provide common operations. Import them with the `use` keyword.

## Importing modules

```isl
// Import entire module
use @isl/string

// Import with alias
use @isl/math as math

// Import specific items
use { Length, Trim, Contains } from @isl/string
```

## Core modules (ISL 1.0)

### @isl/string

String manipulation functions. 100% deterministic.

```isl
use @isl/string

preconditions {
  Length(name) > 0
  Length(name) <= 100
  Contains(email, "@")
  not IsEmpty(description)
}
```

| Function         | Description                        | Example                            |
| ---------------- | ---------------------------------- | ---------------------------------- |
| `Length(s)`       | String length                      | `Length("hello")` → `5`            |
| `Trim(s)`         | Remove leading/trailing whitespace | `Trim("  hi  ")` → `"hi"`         |
| `Contains(s, sub)` | Check substring                  | `Contains("hello", "ell")` → `true` |
| `StartsWith(s, prefix)` | Check prefix                | `StartsWith("hello", "he")` → `true` |
| `EndsWith(s, suffix)` | Check suffix                  | `EndsWith("hello", "lo")` → `true` |
| `ToUpper(s)`      | Uppercase                          | `ToUpper("hello")` → `"HELLO"`    |
| `ToLower(s)`      | Lowercase                          | `ToLower("HELLO")` → `"hello"`    |
| `Replace(s, old, new)` | Replace substring            | `Replace("foo", "o", "a")` → `"faa"` |
| `Split(s, sep)`   | Split into list                    | `Split("a,b", ",")` → `["a","b"]` |
| `IsEmpty(s)`      | Check if empty                     | `IsEmpty("")` → `true`            |

### @isl/math

Mathematical operations. 100% deterministic.

```isl
use @isl/math

postconditions {
  success implies {
    result.total == Round(subtotal * (1 + tax_rate), 2)
    Abs(result.balance) <= max_overdraft
  }
}
```

| Function          | Description              | Example                    |
| ----------------- | ------------------------ | -------------------------- |
| `Abs(n)`          | Absolute value           | `Abs(-5)` → `5`           |
| `Min(a, b)`       | Minimum of two values    | `Min(3, 7)` → `3`         |
| `Max(a, b)`       | Maximum of two values    | `Max(3, 7)` → `7`         |
| `Round(n, places)` | Round to decimal places | `Round(3.456, 2)` → `3.46` |
| `Floor(n)`        | Round down               | `Floor(3.7)` → `3`        |
| `Ceil(n)`         | Round up                 | `Ceil(3.2)` → `4`         |
| `Clamp(n, min, max)` | Clamp to range        | `Clamp(15, 0, 10)` → `10` |

### @isl/collections

List and Map operations. 100% deterministic.

```isl
use @isl/collections

postconditions {
  success implies {
    Size(result.items) > 0
    Contains(result.tags, "verified")
    not IsEmpty(result.items)
  }
}
```

| Function              | Description                     | Example                              |
| --------------------- | ------------------------------- | ------------------------------------ |
| `Size(collection)`    | Number of elements              | `Size([1,2,3])` → `3`               |
| `Contains(coll, item)` | Check membership              | `Contains([1,2], 1)` → `true`       |
| `IsEmpty(coll)`       | Check if empty                  | `IsEmpty([])` → `true`              |
| `First(list)`         | First element                   | `First([1,2,3])` → `1`              |
| `Last(list)`          | Last element                    | `Last([1,2,3])` → `3`               |
| `Flatten(list)`       | Flatten nested lists            | `Flatten([[1],[2]])` → `[1,2]`      |
| `Keys(map)`           | Map keys                        | `Keys({a:1})` → `["a"]`             |
| `Values(map)`         | Map values                      | `Values({a:1})` → `[1]`             |

### @isl/json

JSON parsing and manipulation. 100% deterministic.

```isl
use @isl/json

preconditions {
  IsValidJson(payload)
}

postconditions {
  success implies {
    GetField(result.metadata, "version") == "1.0"
  }
}
```

| Function                | Description            |
| ----------------------- | ---------------------- |
| `IsValidJson(s)`        | Check if valid JSON    |
| `GetField(json, path)`  | Extract field by path  |
| `HasField(json, path)`  | Check field existence  |

### @isl/datetime

Date and time operations. Mixed determinism (some functions depend on current time).

```isl
use @isl/datetime

postconditions {
  success implies {
    result.created_at <= Now()
    DurationBetween(result.start, result.end) > 0
    IsAfter(result.expires_at, Now())
  }
}
```

| Function                    | Description                  | Deterministic |
| --------------------------- | ---------------------------- | ------------- |
| `Now()`                     | Current timestamp            | No            |
| `DurationBetween(a, b)`     | Duration between timestamps  | Yes           |
| `AddDuration(ts, dur)`      | Add duration to timestamp    | Yes           |
| `IsBefore(a, b)`            | Check temporal ordering      | Yes           |
| `IsAfter(a, b)`             | Check temporal ordering      | Yes           |
| `FormatTimestamp(ts, fmt)`   | Format as string             | Yes           |

### @isl/uuid

UUID generation and validation. Mixed determinism.

```isl
use @isl/uuid

postconditions {
  success implies {
    IsValidUUID(result.id)
  }
}
```

| Function           | Description           | Deterministic |
| ------------------ | --------------------- | ------------- |
| `GenerateUUID()`   | Generate new UUID     | No            |
| `IsValidUUID(s)`   | Validate UUID format  | Yes           |

### @isl/crypto

Cryptographic operations. Mixed determinism.

```isl
use @isl/crypto

postconditions {
  success implies {
    Length(Hash(result.content)) == 64
  }
}
```

| Function               | Description              | Deterministic |
| ---------------------- | ------------------------ | ------------- |
| `Hash(data)`           | SHA-256 hash             | Yes           |
| `HmacSign(data, key)`  | HMAC signature           | Yes           |
| `HmacVerify(data, sig, key)` | Verify HMAC       | Yes           |
| `GenerateToken(len)`   | Random token             | No            |

### @isl/encoding

Encoding and decoding. 100% deterministic.

| Function              | Description              |
| --------------------- | ------------------------ |
| `Base64Encode(data)`  | Encode to Base64         |
| `Base64Decode(s)`     | Decode from Base64       |
| `UrlEncode(s)`        | URL-encode string        |
| `UrlDecode(s)`        | URL-decode string        |

### @isl/regex

Pattern matching. 100% deterministic.

```isl
use @isl/regex

preconditions {
  Matches(email, "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
  Matches(phone, "^\\+[1-9]\\d{1,14}$")
}
```

| Function                  | Description              |
| ------------------------- | ------------------------ |
| `Matches(s, pattern)`     | Test regex match         |
| `FindAll(s, pattern)`     | Find all matches         |
| `ReplaceAll(s, pattern, repl)` | Replace all matches |

### @isl/url

URL parsing and manipulation. 100% deterministic.

| Function              | Description              |
| --------------------- | ------------------------ |
| `ParseUrl(s)`         | Parse URL into parts     |
| `GetHost(url)`        | Extract hostname         |
| `GetPath(url)`        | Extract path             |
| `GetQuery(url, key)`  | Extract query parameter  |
| `IsValidUrl(s)`       | Validate URL format      |

## Using stdlib in specs

```isl
domain NotificationService {
  use @isl/string
  use @isl/datetime
  use @isl/regex

  behavior SendEmail {
    input {
      to: Email
      subject: String
      body: String
    }

    preconditions {
      Matches(to, "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
      not IsEmpty(subject)
      Length(subject) <= 200
      not IsEmpty(body)
    }

    postconditions {
      success implies {
        result.sent_at <= Now()
        result.recipient == to
        result.subject == subject
      }
    }
  }
}
```
