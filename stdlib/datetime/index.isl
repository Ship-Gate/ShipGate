# DateTime Standard Library Module
# Provides deterministic date and time operations
#
# DETERMINISM NOTE:
# - now() is NON-DETERMINISTIC (returns current system time)
# - All other functions are DETERMINISTIC given the same inputs

module DateTime version "1.0.0"

# ============================================
# Types
# ============================================

type Timestamp = Int {
  description: "Unix timestamp in milliseconds"
  min: 0
}

type Duration = Int {
  description: "Duration in milliseconds"
  min: 0
}

type TimeZone = String {
  description: "IANA timezone identifier"
  format: "timezone"
  max_length: 64
}

type DateFormat = enum {
  ISO8601       # "2024-01-15T10:30:00Z"
  ISO_DATE      # "2024-01-15"
  ISO_TIME      # "10:30:00"
  RFC2822       # "Mon, 15 Jan 2024 10:30:00 +0000"
  UNIX_SECONDS  # "1705314600"
  UNIX_MS       # "1705314600000"
}

type DatePart = enum {
  YEAR
  MONTH
  DAY
  HOUR
  MINUTE
  SECOND
  MILLISECOND
  DAY_OF_WEEK
  DAY_OF_YEAR
  WEEK_OF_YEAR
}

type DayOfWeek = enum {
  SUNDAY     # 0
  MONDAY     # 1
  TUESDAY    # 2
  WEDNESDAY  # 3
  THURSDAY   # 4
  FRIDAY     # 5
  SATURDAY   # 6
}

# ============================================
# Entities
# ============================================

entity DateTimeComponents {
  year: Int { min: 1, max: 9999 }
  month: Int { min: 1, max: 12 }
  day: Int { min: 1, max: 31 }
  hour: Int { min: 0, max: 23 }
  minute: Int { min: 0, max: 59 }
  second: Int { min: 0, max: 59 }
  millisecond: Int { min: 0, max: 999 }
  timezone: TimeZone?

  invariants {
    # Day must be valid for the given month
    month == 2 implies day <= 29
    month in [4, 6, 9, 11] implies day <= 30
  }
}

entity DurationComponents {
  days: Int { min: 0, default: 0 }
  hours: Int { min: 0, max: 23, default: 0 }
  minutes: Int { min: 0, max: 59, default: 0 }
  seconds: Int { min: 0, max: 59, default: 0 }
  milliseconds: Int { min: 0, max: 999, default: 0 }
}

# ============================================
# Behaviors - Non-Deterministic
# ============================================

behavior Now {
  description: "Get current timestamp (NON-DETERMINISTIC)"
  deterministic: false

  input {}

  output {
    success: Timestamp
  }

  post success {
    result > 0
  }
}

# ============================================
# Behaviors - Deterministic
# ============================================

behavior AddDuration {
  description: "Add a duration to a timestamp (DETERMINISTIC)"
  deterministic: true

  input {
    timestamp: Timestamp
    duration: Duration
  }

  output {
    success: Timestamp
  }

  post success {
    result == input.timestamp + input.duration
  }
}

behavior SubtractDuration {
  description: "Subtract a duration from a timestamp (DETERMINISTIC)"
  deterministic: true

  input {
    timestamp: Timestamp
    duration: Duration
  }

  output {
    success: Timestamp

    errors {
      NEGATIVE_RESULT {
        when: "Resulting timestamp would be negative"
        retriable: false
      }
    }
  }

  pre {
    timestamp >= duration
  }

  post success {
    result == input.timestamp - input.duration
  }
}

behavior DiffTimestamps {
  description: "Calculate duration between two timestamps (DETERMINISTIC)"
  deterministic: true

  input {
    start: Timestamp
    end: Timestamp
  }

  output {
    success: Duration
  }

  pre {
    end >= start
  }

  post success {
    result == input.end - input.start
  }
}

behavior FormatTimestamp {
  description: "Format timestamp to string representation (DETERMINISTIC)"
  deterministic: true

  input {
    timestamp: Timestamp
    format: DateFormat [default: ISO8601]
    timezone: TimeZone [default: "UTC"]
  }

  output {
    success: String

    errors {
      INVALID_TIMEZONE {
        when: "Timezone identifier is not recognized"
        retriable: false
      }
    }
  }

  post success {
    result.length > 0
    input.format == ISO8601 implies result.matches("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}")
    input.format == ISO_DATE implies result.matches("^\\d{4}-\\d{2}-\\d{2}$")
    input.format == UNIX_SECONDS implies result.matches("^\\d+$")
  }
}

behavior ParseTimestamp {
  description: "Parse string to timestamp (DETERMINISTIC)"
  deterministic: true

  input {
    value: String
    format: DateFormat [default: ISO8601]
    timezone: TimeZone [default: "UTC"]
  }

  output {
    success: Timestamp

    errors {
      INVALID_FORMAT {
        when: "String does not match expected format"
        retriable: false
      }
      INVALID_DATE {
        when: "Parsed date is invalid (e.g., Feb 30)"
        retriable: false
      }
      INVALID_TIMEZONE {
        when: "Timezone identifier is not recognized"
        retriable: false
      }
    }
  }

  pre {
    value.length > 0
  }

  post success {
    result >= 0
  }
}

behavior GetDatePart {
  description: "Extract a component from a timestamp (DETERMINISTIC)"
  deterministic: true

  input {
    timestamp: Timestamp
    part: DatePart
    timezone: TimeZone [default: "UTC"]
  }

  output {
    success: Int

    errors {
      INVALID_TIMEZONE {
        when: "Timezone identifier is not recognized"
        retriable: false
      }
    }
  }

  post success {
    input.part == YEAR implies result >= 1970
    input.part == MONTH implies result >= 1 and result <= 12
    input.part == DAY implies result >= 1 and result <= 31
    input.part == HOUR implies result >= 0 and result <= 23
    input.part == MINUTE implies result >= 0 and result <= 59
    input.part == SECOND implies result >= 0 and result <= 59
    input.part == MILLISECOND implies result >= 0 and result <= 999
    input.part == DAY_OF_WEEK implies result >= 0 and result <= 6
    input.part == DAY_OF_YEAR implies result >= 1 and result <= 366
    input.part == WEEK_OF_YEAR implies result >= 1 and result <= 53
  }
}

behavior ToComponents {
  description: "Decompose timestamp into date/time components (DETERMINISTIC)"
  deterministic: true

  input {
    timestamp: Timestamp
    timezone: TimeZone [default: "UTC"]
  }

  output {
    success: DateTimeComponents

    errors {
      INVALID_TIMEZONE {
        when: "Timezone identifier is not recognized"
        retriable: false
      }
    }
  }

  post success {
    result.year >= 1970
    result.month >= 1 and result.month <= 12
    result.day >= 1 and result.day <= 31
  }
}

behavior FromComponents {
  description: "Construct timestamp from date/time components (DETERMINISTIC)"
  deterministic: true

  input {
    components: DateTimeComponents
  }

  output {
    success: Timestamp

    errors {
      INVALID_DATE {
        when: "Component values form an invalid date"
        retriable: false
      }
    }
  }

  pre {
    components.year >= 1970
    components.month >= 1 and components.month <= 12
    components.day >= 1 and components.day <= 31
  }

  post success {
    result >= 0
  }
}

behavior DurationToMs {
  description: "Convert duration components to milliseconds (DETERMINISTIC)"
  deterministic: true

  input {
    components: DurationComponents
  }

  output {
    success: Duration
  }

  post success {
    result == (
      input.components.days * 86400000 +
      input.components.hours * 3600000 +
      input.components.minutes * 60000 +
      input.components.seconds * 1000 +
      input.components.milliseconds
    )
  }
}

behavior MsToDuration {
  description: "Convert milliseconds to duration components (DETERMINISTIC)"
  deterministic: true

  input {
    milliseconds: Duration
  }

  output {
    success: DurationComponents
  }

  post success {
    result.days >= 0
    result.hours >= 0 and result.hours <= 23
    result.minutes >= 0 and result.minutes <= 59
    result.seconds >= 0 and result.seconds <= 59
    result.milliseconds >= 0 and result.milliseconds <= 999
  }
}

behavior IsLeapYear {
  description: "Check if a year is a leap year (DETERMINISTIC)"
  deterministic: true

  input {
    year: Int { min: 1 }
  }

  output {
    success: Boolean
  }

  post success {
    result == (
      (input.year % 4 == 0 and input.year % 100 != 0) or
      (input.year % 400 == 0)
    )
  }
}

behavior DaysInMonth {
  description: "Get number of days in a month (DETERMINISTIC)"
  deterministic: true

  input {
    year: Int { min: 1 }
    month: Int { min: 1, max: 12 }
  }

  output {
    success: Int { min: 28, max: 31 }
  }

  post success {
    input.month in [1, 3, 5, 7, 8, 10, 12] implies result == 31
    input.month in [4, 6, 9, 11] implies result == 30
    input.month == 2 and IsLeapYear(input.year) implies result == 29
    input.month == 2 and not IsLeapYear(input.year) implies result == 28
  }
}

behavior CompareTimestamps {
  description: "Compare two timestamps (DETERMINISTIC)"
  deterministic: true

  input {
    a: Timestamp
    b: Timestamp
  }

  output {
    success: Int { min: -1, max: 1 }
  }

  post success {
    input.a < input.b implies result == -1
    input.a == input.b implies result == 0
    input.a > input.b implies result == 1
  }
}

behavior IsBefore {
  description: "Check if first timestamp is before second (DETERMINISTIC)"
  deterministic: true

  input {
    timestamp: Timestamp
    other: Timestamp
  }

  output {
    success: Boolean
  }

  post success {
    result == (input.timestamp < input.other)
  }
}

behavior IsAfter {
  description: "Check if first timestamp is after second (DETERMINISTIC)"
  deterministic: true

  input {
    timestamp: Timestamp
    other: Timestamp
  }

  output {
    success: Boolean
  }

  post success {
    result == (input.timestamp > input.other)
  }
}

behavior IsBetween {
  description: "Check if timestamp is between two others (DETERMINISTIC)"
  deterministic: true

  input {
    timestamp: Timestamp
    start: Timestamp
    end: Timestamp
    inclusive: Boolean [default: true]
  }

  output {
    success: Boolean
  }

  pre {
    start <= end
  }

  post success {
    input.inclusive implies result == (input.timestamp >= input.start and input.timestamp <= input.end)
    not input.inclusive implies result == (input.timestamp > input.start and input.timestamp < input.end)
  }
}

# ============================================
# Constants
# ============================================

const SECOND_MS: Duration = 1000
const MINUTE_MS: Duration = 60000
const HOUR_MS: Duration = 3600000
const DAY_MS: Duration = 86400000
const WEEK_MS: Duration = 604800000
