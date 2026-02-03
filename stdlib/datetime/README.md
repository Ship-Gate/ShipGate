# @isl/datetime

Date and time operations for ISL specifications.

## Overview

This module provides timestamp manipulation, formatting, parsing, and comparison operations. Most functions are **deterministic**, meaning they produce the same output given the same input.

## Determinism

| Function | Deterministic | Notes |
|----------|---------------|-------|
| `Now` | ❌ No | Returns current system time |
| `AddDuration` | ✅ Yes | Pure arithmetic |
| `SubtractDuration` | ✅ Yes | Pure arithmetic |
| `DiffTimestamps` | ✅ Yes | Pure arithmetic |
| `FormatTimestamp` | ✅ Yes | Same input → same output |
| `ParseTimestamp` | ✅ Yes | Same input → same output |
| `GetDatePart` | ✅ Yes | Same input → same output |
| `ToComponents` | ✅ Yes | Same input → same output |
| `FromComponents` | ✅ Yes | Same input → same output |
| `IsLeapYear` | ✅ Yes | Pure calculation |
| `DaysInMonth` | ✅ Yes | Pure calculation |
| `CompareTimestamps` | ✅ Yes | Pure comparison |
| `IsBefore` | ✅ Yes | Pure comparison |
| `IsAfter` | ✅ Yes | Pure comparison |
| `IsBetween` | ✅ Yes | Pure comparison |

## Types

- `Timestamp` - Unix timestamp in milliseconds
- `Duration` - Duration in milliseconds
- `TimeZone` - IANA timezone identifier (e.g., "America/New_York")
- `DateFormat` - Output format enum (ISO8601, ISO_DATE, etc.)
- `DatePart` - Date component enum (YEAR, MONTH, DAY, etc.)

## Usage

```isl
use @isl/datetime

behavior ProcessOrder {
  input {
    order_id: UUID
  }

  post success {
    # Use Now() for current time (non-deterministic)
    result.created_at <= Now()
    
    # Deterministic duration calculation
    result.expires_at == AddDuration(result.created_at, DAY_MS * 7)
    
    # Deterministic comparison
    IsBefore(result.created_at, result.expires_at)
  }
}
```

## Constants

- `SECOND_MS` - 1,000 milliseconds
- `MINUTE_MS` - 60,000 milliseconds
- `HOUR_MS` - 3,600,000 milliseconds
- `DAY_MS` - 86,400,000 milliseconds
- `WEEK_MS` - 604,800,000 milliseconds
