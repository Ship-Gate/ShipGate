// ============================================================================
// ISL Standard Library - Time Types
// @stdlib/time
// ============================================================================

/**
 * Duration with fluent syntax support
 * Examples: 5.seconds, 1.hour, 30.minutes
 */
type Duration = {
  value: Int { min: 0 }
  unit: TimeUnit
}

/**
 * Time units for duration
 */
enum TimeUnit {
  MILLISECONDS
  SECONDS
  MINUTES
  HOURS
  DAYS
  WEEKS
  MONTHS
  YEARS
}

/**
 * Duration in milliseconds (for precise timing)
 */
type DurationMs = Int {
  min: 0
  unit: milliseconds
}

/**
 * Duration in seconds
 */
type DurationSeconds = Int {
  min: 0
  unit: seconds
}

/**
 * IANA timezone identifier
 * Example: "America/New_York", "Europe/London"
 */
type Timezone = String {
  format: /^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$|^UTC$|^GMT$/
  validation: iana_timezone
}

/**
 * UTC offset in format +/-HH:MM
 */
type UTCOffset = String {
  format: /^[+-](?:0[0-9]|1[0-4]):[0-5][0-9]$/
}

/**
 * Date in ISO 8601 format (YYYY-MM-DD)
 */
type ISODate = String {
  format: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/
}

/**
 * Time in ISO 8601 format (HH:MM:SS)
 */
type ISOTime = String {
  format: /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?$/
}

/**
 * Full ISO 8601 datetime with timezone
 */
type ISODateTime = String {
  format: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:0[0-9]|1[0-4]):[0-5][0-9])$/
}

/**
 * Unix timestamp (seconds since epoch)
 */
type UnixTimestamp = Int {
  min: 0
}

/**
 * Unix timestamp in milliseconds
 */
type UnixTimestampMs = Int {
  min: 0
}

/**
 * Date range with start and end
 */
type DateRange = {
  start: ISODate
  end: ISODate
  
  invariants {
    start <= end
  }
}

/**
 * DateTime range with start and end
 */
type DateTimeRange = {
  start: Timestamp
  end: Timestamp
  
  invariants {
    start <= end
  }
}

/**
 * Time of day (wall clock time without date)
 */
type TimeOfDay = {
  hour: Int { min: 0, max: 23 }
  minute: Int { min: 0, max: 59 }
  second: Int { min: 0, max: 59 }
}

/**
 * Day of week
 */
enum DayOfWeek {
  MONDAY    = 1
  TUESDAY   = 2
  WEDNESDAY = 3
  THURSDAY  = 4
  FRIDAY    = 5
  SATURDAY  = 6
  SUNDAY    = 7
}

/**
 * Month of year
 */
enum Month {
  JANUARY   = 1
  FEBRUARY  = 2
  MARCH     = 3
  APRIL     = 4
  MAY       = 5
  JUNE      = 6
  JULY      = 7
  AUGUST    = 8
  SEPTEMBER = 9
  OCTOBER   = 10
  NOVEMBER  = 11
  DECEMBER  = 12
}

/**
 * Cron expression for scheduling
 * Format: minute hour day-of-month month day-of-week
 */
type CronExpression = String {
  format: /^(\*|([0-5]?\d)([-\/][0-5]?\d)*)\s+(\*|([01]?\d|2[0-3])([-\/]([01]?\d|2[0-3]))*)\s+(\*|([1-9]|[12]\d|3[01])([-\/]([1-9]|[12]\d|3[01]))*)\s+(\*|([1-9]|1[0-2])([-\/]([1-9]|1[0-2]))*)\s+(\*|[0-6]([-\/][0-6])*)$/
}

/**
 * Business hours specification
 */
type BusinessHours = {
  start: TimeOfDay
  end: TimeOfDay
  timezone: Timezone
  days: List<DayOfWeek>
  
  invariants {
    start < end
    days.length > 0
  }
}

/**
 * Recurring schedule
 */
type RecurringSchedule = {
  frequency: ScheduleFrequency
  interval: Int { min: 1, max: 365 }
  startDate: ISODate
  endDate: ISODate?
  timezone: Timezone
}

/**
 * Schedule frequency
 */
enum ScheduleFrequency {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
  QUARTERLY
  YEARLY
}

/**
 * Age in years
 */
type Age = Int {
  min: 0
  max: 150
}

/**
 * Year (4-digit)
 */
type Year = Int {
  min: 1000
  max: 9999
}

/**
 * TTL (Time To Live) in seconds
 */
type TTL = Int {
  min: 0
  max: 31536000  // Max 1 year
  unit: seconds
}

// ============================================================================
// DURATION HELPER FUNCTIONS
// ============================================================================

/**
 * Duration literals support fluent syntax:
 * - 5.seconds -> Duration { value: 5, unit: SECONDS }
 * - 1.hour -> Duration { value: 1, unit: HOURS }
 * - 30.minutes -> Duration { value: 30, unit: MINUTES }
 * - 100.ms -> Duration { value: 100, unit: MILLISECONDS }
 */
extensions Int {
  milliseconds: Duration = Duration { value: this, unit: MILLISECONDS }
  ms: Duration = Duration { value: this, unit: MILLISECONDS }
  seconds: Duration = Duration { value: this, unit: SECONDS }
  second: Duration = Duration { value: this, unit: SECONDS }
  minutes: Duration = Duration { value: this, unit: MINUTES }
  minute: Duration = Duration { value: this, unit: MINUTES }
  hours: Duration = Duration { value: this, unit: HOURS }
  hour: Duration = Duration { value: this, unit: HOURS }
  days: Duration = Duration { value: this, unit: DAYS }
  day: Duration = Duration { value: this, unit: DAYS }
  weeks: Duration = Duration { value: this, unit: WEEKS }
  week: Duration = Duration { value: this, unit: WEEKS }
}
