# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: now, addDuration, subtractDuration, diffTimestamps, formatTimestamp, parseTimestamp, getDatePart, toComponents, fromComponents, durationToMs, msToDuration, isLeapYear, daysInMonth, compareTimestamps, isBefore, isAfter, isBetween, SECOND_MS, MINUTE_MS, HOUR_MS, DAY_MS, WEEK_MS, DAYS_OF_WEEK, DateTime, Timestamp, Duration, TimeZone, DateFormat, DatePart, DayOfWeek, DateTimeComponents, DurationComponents
# dependencies: 

domain Datetime {
  version: "1.0.0"

  type Timestamp = String
  type Duration = String
  type TimeZone = String
  type DateFormat = String
  type DatePart = String
  type DayOfWeek = String
  type DateTimeComponents = String
  type DurationComponents = String

  invariants exports_present {
    - true
  }
}
