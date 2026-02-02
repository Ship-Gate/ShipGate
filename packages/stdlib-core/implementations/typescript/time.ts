// ============================================================================
// ISL Standard Library - TypeScript Time Implementation
// @stdlib/time
// ============================================================================

// ============================================================================
// TIME UNIT ENUM
// ============================================================================

export enum TimeUnit {
  MILLISECONDS = 'MILLISECONDS',
  SECONDS = 'SECONDS',
  MINUTES = 'MINUTES',
  HOURS = 'HOURS',
  DAYS = 'DAYS',
  WEEKS = 'WEEKS',
  MONTHS = 'MONTHS',
  YEARS = 'YEARS',
}

// ============================================================================
// DURATION TYPE
// ============================================================================

export interface Duration {
  value: number;
  unit: TimeUnit;
}

// ============================================================================
// DURATION FACTORY FUNCTIONS
// ============================================================================

export function milliseconds(value: number): Duration {
  return { value, unit: TimeUnit.MILLISECONDS };
}

export function ms(value: number): Duration {
  return milliseconds(value);
}

export function seconds(value: number): Duration {
  return { value, unit: TimeUnit.SECONDS };
}

export function second(value: number): Duration {
  return seconds(value);
}

export function minutes(value: number): Duration {
  return { value, unit: TimeUnit.MINUTES };
}

export function minute(value: number): Duration {
  return minutes(value);
}

export function hours(value: number): Duration {
  return { value, unit: TimeUnit.HOURS };
}

export function hour(value: number): Duration {
  return hours(value);
}

export function days(value: number): Duration {
  return { value, unit: TimeUnit.DAYS };
}

export function day(value: number): Duration {
  return days(value);
}

export function weeks(value: number): Duration {
  return { value, unit: TimeUnit.WEEKS };
}

export function week(value: number): Duration {
  return weeks(value);
}

// ============================================================================
// DURATION CONVERSIONS
// ============================================================================

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = MS_PER_SECOND * 60;
const MS_PER_HOUR = MS_PER_MINUTE * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const MS_PER_WEEK = MS_PER_DAY * 7;

export function toMilliseconds(duration: Duration): number {
  switch (duration.unit) {
    case TimeUnit.MILLISECONDS:
      return duration.value;
    case TimeUnit.SECONDS:
      return duration.value * MS_PER_SECOND;
    case TimeUnit.MINUTES:
      return duration.value * MS_PER_MINUTE;
    case TimeUnit.HOURS:
      return duration.value * MS_PER_HOUR;
    case TimeUnit.DAYS:
      return duration.value * MS_PER_DAY;
    case TimeUnit.WEEKS:
      return duration.value * MS_PER_WEEK;
    case TimeUnit.MONTHS:
      return duration.value * MS_PER_DAY * 30; // Approximate
    case TimeUnit.YEARS:
      return duration.value * MS_PER_DAY * 365; // Approximate
    default:
      throw new Error(`Unknown time unit: ${duration.unit}`);
  }
}

export function toSeconds(duration: Duration): number {
  return toMilliseconds(duration) / MS_PER_SECOND;
}

export function toMinutes(duration: Duration): number {
  return toMilliseconds(duration) / MS_PER_MINUTE;
}

export function toHours(duration: Duration): number {
  return toMilliseconds(duration) / MS_PER_HOUR;
}

export function toDays(duration: Duration): number {
  return toMilliseconds(duration) / MS_PER_DAY;
}

// ============================================================================
// DURATION ARITHMETIC
// ============================================================================

export function addDuration(a: Duration, b: Duration): Duration {
  const totalMs = toMilliseconds(a) + toMilliseconds(b);
  return { value: totalMs, unit: TimeUnit.MILLISECONDS };
}

export function subtractDuration(a: Duration, b: Duration): Duration {
  const totalMs = toMilliseconds(a) - toMilliseconds(b);
  return { value: totalMs, unit: TimeUnit.MILLISECONDS };
}

export function multiplyDuration(duration: Duration, factor: number): Duration {
  return { value: duration.value * factor, unit: duration.unit };
}

// ============================================================================
// DURATION COMPARISON
// ============================================================================

export function compareDuration(a: Duration, b: Duration): number {
  return toMilliseconds(a) - toMilliseconds(b);
}

export function durationEquals(a: Duration, b: Duration): boolean {
  return toMilliseconds(a) === toMilliseconds(b);
}

export function durationLessThan(a: Duration, b: Duration): boolean {
  return toMilliseconds(a) < toMilliseconds(b);
}

export function durationGreaterThan(a: Duration, b: Duration): boolean {
  return toMilliseconds(a) > toMilliseconds(b);
}

// ============================================================================
// TIMEZONE VALIDATION
// ============================================================================

const TIMEZONE_PATTERN = /^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$|^UTC$|^GMT$/;

export function isValidTimezone(value: string): boolean {
  if (!TIMEZONE_PATTERN.test(value)) {
    return false;
  }
  
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// DATE PATTERNS
// ============================================================================

export const DATE_PATTERNS = {
  ISO_DATE: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/,
  ISO_TIME: /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?$/,
  ISO_DATETIME: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:0[0-9]|1[0-4]):[0-5][0-9])$/,
  UTC_OFFSET: /^[+-](?:0[0-9]|1[0-4]):[0-5][0-9]$/,
  CRON: /^(\*|([0-5]?\d)([-\/][0-5]?\d)*)\s+(\*|([01]?\d|2[0-3])([-\/]([01]?\d|2[0-3]))*)\s+(\*|([1-9]|[12]\d|3[01])([-\/]([1-9]|[12]\d|3[01]))*)\s+(\*|([1-9]|1[0-2])([-\/]([1-9]|1[0-2]))*)\s+(\*|[0-6]([-\/][0-6])*)$/,
} as const;

export function isValidISODate(value: string): boolean {
  if (!DATE_PATTERNS.ISO_DATE.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !isNaN(date.getTime());
}

export function isValidISOTime(value: string): boolean {
  return DATE_PATTERNS.ISO_TIME.test(value);
}

export function isValidISODateTime(value: string): boolean {
  if (!DATE_PATTERNS.ISO_DATETIME.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !isNaN(date.getTime());
}

export function isValidUTCOffset(value: string): boolean {
  return DATE_PATTERNS.UTC_OFFSET.test(value);
}

export function isValidCronExpression(value: string): boolean {
  return DATE_PATTERNS.CRON.test(value);
}

// ============================================================================
// DATE RANGE
// ============================================================================

export interface DateRange {
  start: string; // ISO date
  end: string;   // ISO date
}

export interface DateTimeRange {
  start: Date;
  end: Date;
}

export function isValidDateRange(range: DateRange): boolean {
  if (!isValidISODate(range.start) || !isValidISODate(range.end)) {
    return false;
  }
  return new Date(range.start) <= new Date(range.end);
}

export function createDateRange(start: string, end: string): DateRange {
  if (!isValidISODate(start)) {
    throw new Error(`Invalid start date: ${start}`);
  }
  if (!isValidISODate(end)) {
    throw new Error(`Invalid end date: ${end}`);
  }
  if (new Date(start) > new Date(end)) {
    throw new Error('Start date must be before or equal to end date');
  }
  return { start, end };
}

// ============================================================================
// TIME OF DAY
// ============================================================================

export interface TimeOfDay {
  hour: number;   // 0-23
  minute: number; // 0-59
  second: number; // 0-59
}

export function createTimeOfDay(hour: number, minute: number, second: number = 0): TimeOfDay {
  if (hour < 0 || hour > 23) {
    throw new Error('Hour must be between 0 and 23');
  }
  if (minute < 0 || minute > 59) {
    throw new Error('Minute must be between 0 and 59');
  }
  if (second < 0 || second > 59) {
    throw new Error('Second must be between 0 and 59');
  }
  return { hour, minute, second };
}

export function formatTimeOfDay(time: TimeOfDay): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}`;
}

export function parseTimeOfDay(value: string): TimeOfDay {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid time format: ${value}`);
  }
  return createTimeOfDay(parseInt(match[1]!, 10), parseInt(match[2]!, 10), parseInt(match[3]!, 10));
}

// ============================================================================
// DAY OF WEEK & MONTH
// ============================================================================

export enum DayOfWeek {
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
  SUNDAY = 7,
}

export enum Month {
  JANUARY = 1,
  FEBRUARY = 2,
  MARCH = 3,
  APRIL = 4,
  MAY = 5,
  JUNE = 6,
  JULY = 7,
  AUGUST = 8,
  SEPTEMBER = 9,
  OCTOBER = 10,
  NOVEMBER = 11,
  DECEMBER = 12,
}

// ============================================================================
// TIMESTAMP HELPERS
// ============================================================================

export function nowUnixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

export function nowUnixTimestampMs(): number {
  return Date.now();
}

export function fromUnixTimestamp(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

export function fromUnixTimestampMs(timestamp: number): Date {
  return new Date(timestamp);
}

export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function toUnixTimestampMs(date: Date): number {
  return date.getTime();
}

// ============================================================================
// DURATION FORMATTING
// ============================================================================

export function formatDuration(duration: Duration): string {
  const ms = toMilliseconds(duration);
  
  if (ms < MS_PER_SECOND) {
    return `${ms}ms`;
  }
  if (ms < MS_PER_MINUTE) {
    return `${(ms / MS_PER_SECOND).toFixed(1)}s`;
  }
  if (ms < MS_PER_HOUR) {
    return `${(ms / MS_PER_MINUTE).toFixed(1)}m`;
  }
  if (ms < MS_PER_DAY) {
    return `${(ms / MS_PER_HOUR).toFixed(1)}h`;
  }
  return `${(ms / MS_PER_DAY).toFixed(1)}d`;
}

export function formatDurationLong(duration: Duration): string {
  const ms = toMilliseconds(duration);
  
  const days = Math.floor(ms / MS_PER_DAY);
  const hours = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((ms % MS_PER_MINUTE) / MS_PER_SECOND);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  
  return parts.join(', ');
}

// ============================================================================
// EXPORTS
// ============================================================================

export const Time = {
  // Factories
  milliseconds,
  ms,
  seconds,
  second,
  minutes,
  minute,
  hours,
  hour,
  days,
  day,
  weeks,
  week,
  
  // Conversions
  toMilliseconds,
  toSeconds,
  toMinutes,
  toHours,
  toDays,
  
  // Arithmetic
  addDuration,
  subtractDuration,
  multiplyDuration,
  
  // Comparison
  compareDuration,
  durationEquals,
  durationLessThan,
  durationGreaterThan,
  
  // Validation
  isValidTimezone,
  isValidISODate,
  isValidISOTime,
  isValidISODateTime,
  isValidUTCOffset,
  isValidCronExpression,
  isValidDateRange,
  
  // Date ranges
  createDateRange,
  
  // Time of day
  createTimeOfDay,
  formatTimeOfDay,
  parseTimeOfDay,
  
  // Timestamps
  nowUnixTimestamp,
  nowUnixTimestampMs,
  fromUnixTimestamp,
  fromUnixTimestampMs,
  toUnixTimestamp,
  toUnixTimestampMs,
  
  // Formatting
  formatDuration,
  formatDurationLong,
  
  // Constants
  TimeUnit,
  DayOfWeek,
  Month,
  DATE_PATTERNS,
};

export default Time;
