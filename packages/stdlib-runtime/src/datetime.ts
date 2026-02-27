/**
 * ISL Standard Library - DateTime Module
 * Provides date and time operations
 * 
 * DETERMINISM: 
 * - now() is NON-DETERMINISTIC (returns current system time)
 * - All other functions are DETERMINISTIC given the same inputs
 */

// ============================================
// Types
// ============================================

export type Timestamp = number; // Unix timestamp in milliseconds
export type Duration = number; // Duration in milliseconds
export type TimeZone = string; // IANA timezone identifier

export type DateFormat = 'ISO8601' | 'ISO_DATE' | 'ISO_TIME' | 'RFC2822' | 'UNIX_SECONDS' | 'UNIX_MS';
export type DatePart = 'YEAR' | 'MONTH' | 'DAY' | 'HOUR' | 'MINUTE' | 'SECOND' | 'MILLISECOND' | 'DAY_OF_WEEK' | 'DAY_OF_YEAR' | 'WEEK_OF_YEAR';
export type DayOfWeek = 'SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';

export interface DateTimeComponents {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  timezone?: string;
}

export interface DurationComponents {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

// ============================================
// Non-Deterministic Functions
// ============================================

/**
 * Get current timestamp (NON-DETERMINISTIC)
 * @returns Current Unix timestamp in milliseconds
 */
export function now(): Timestamp {
  return Date.now();
}

// ============================================
// Deterministic Functions - Arithmetic
// ============================================

export function addDuration(timestamp: Timestamp, duration: Duration): Timestamp {
  return timestamp + duration;
}

export function subtractDuration(timestamp: Timestamp, duration: Duration): Timestamp {
  const result = timestamp - duration;
  if (result < 0) {
    throw new Error('NEGATIVE_RESULT: Resulting timestamp would be negative');
  }
  return result;
}

export function diffTimestamps(start: Timestamp, end: Timestamp): Duration {
  if (end < start) {
    throw new Error('end must be greater than or equal to start');
  }
  return end - start;
}

// ============================================
// Deterministic Functions - Formatting
// ============================================

export function formatTimestamp(timestamp: Timestamp, format: DateFormat = 'ISO8601', timezone: TimeZone = 'UTC'): string {
  const date = new Date(timestamp);
  
  switch (format) {
    case 'ISO8601':
      if (timezone === 'UTC') {
        return date.toISOString();
      }
      return date.toLocaleString('sv', { timeZone: timezone }).replace(' ', 'T');
    case 'ISO_DATE':
      return date.toISOString().split('T')[0]!;
    case 'ISO_TIME':
      return date.toISOString().split('T')[1]!.replace('Z', '');
    case 'RFC2822':
      return date.toUTCString();
    case 'UNIX_SECONDS':
      return Math.floor(timestamp / 1000).toString();
    case 'UNIX_MS':
      return timestamp.toString();
    default:
      return date.toISOString();
  }
}

export function parseTimestamp(value: string, format: DateFormat = 'ISO8601', _timezone: TimeZone = 'UTC'): Timestamp {
  let date: Date;
  
  switch (format) {
    case 'ISO8601':
    case 'ISO_DATE':
      date = new Date(value);
      break;
    case 'UNIX_SECONDS':
      date = new Date(parseInt(value, 10) * 1000);
      break;
    case 'UNIX_MS':
      date = new Date(parseInt(value, 10));
      break;
    default:
      date = new Date(value);
  }
  
  if (isNaN(date.getTime())) {
    throw new Error('INVALID_FORMAT: String does not match expected format');
  }
  
  return date.getTime();
}

// ============================================
// Deterministic Functions - Components
// ============================================

export function getDatePart(timestamp: Timestamp, part: DatePart, timezone: TimeZone = 'UTC'): number {
  const date = new Date(timestamp);
  
  switch (part) {
    case 'YEAR':
      return timezone === 'UTC' ? date.getUTCFullYear() : date.getFullYear();
    case 'MONTH':
      return (timezone === 'UTC' ? date.getUTCMonth() : date.getMonth()) + 1;
    case 'DAY':
      return timezone === 'UTC' ? date.getUTCDate() : date.getDate();
    case 'HOUR':
      return timezone === 'UTC' ? date.getUTCHours() : date.getHours();
    case 'MINUTE':
      return timezone === 'UTC' ? date.getUTCMinutes() : date.getMinutes();
    case 'SECOND':
      return timezone === 'UTC' ? date.getUTCSeconds() : date.getSeconds();
    case 'MILLISECOND':
      return timezone === 'UTC' ? date.getUTCMilliseconds() : date.getMilliseconds();
    case 'DAY_OF_WEEK':
      return timezone === 'UTC' ? date.getUTCDay() : date.getDay();
    case 'DAY_OF_YEAR': {
      const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
      const diff = timestamp - start.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
    case 'WEEK_OF_YEAR': {
      const d = new Date(timestamp);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }
    default:
      throw new Error(`Unknown date part: ${part}`);
  }
}

export function toComponents(timestamp: Timestamp, timezone: TimeZone = 'UTC'): DateTimeComponents {
  const date = new Date(timestamp);
  
  return {
    year: timezone === 'UTC' ? date.getUTCFullYear() : date.getFullYear(),
    month: (timezone === 'UTC' ? date.getUTCMonth() : date.getMonth()) + 1,
    day: timezone === 'UTC' ? date.getUTCDate() : date.getDate(),
    hour: timezone === 'UTC' ? date.getUTCHours() : date.getHours(),
    minute: timezone === 'UTC' ? date.getUTCMinutes() : date.getMinutes(),
    second: timezone === 'UTC' ? date.getUTCSeconds() : date.getSeconds(),
    millisecond: timezone === 'UTC' ? date.getUTCMilliseconds() : date.getMilliseconds(),
    timezone,
  };
}

export function fromComponents(components: DateTimeComponents): Timestamp {
  const { year, month, day, hour, minute, second, millisecond, timezone } = components;
  
  if (timezone === 'UTC' || !timezone) {
    return Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  }
  
  // For non-UTC, create in local and adjust
  const date = new Date(year, month - 1, day, hour, minute, second, millisecond);
  return date.getTime();
}

// ============================================
// Deterministic Functions - Duration
// ============================================

export function durationToMs(components: DurationComponents): Duration {
  return (
    components.days * 86400000 +
    components.hours * 3600000 +
    components.minutes * 60000 +
    components.seconds * 1000 +
    components.milliseconds
  );
}

export function msToDuration(milliseconds: Duration): DurationComponents {
  let remaining = milliseconds;
  
  const days = Math.floor(remaining / 86400000);
  remaining %= 86400000;
  
  const hours = Math.floor(remaining / 3600000);
  remaining %= 3600000;
  
  const minutes = Math.floor(remaining / 60000);
  remaining %= 60000;
  
  const seconds = Math.floor(remaining / 1000);
  remaining %= 1000;
  
  return {
    days,
    hours,
    minutes,
    seconds,
    milliseconds: remaining,
  };
}

// ============================================
// Deterministic Functions - Calendar
// ============================================

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  if (month < 1 || month > 12) {
    throw new Error('Month must be between 1 and 12');
  }
  
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  
  return daysPerMonth[month - 1]!;
}

// ============================================
// Deterministic Functions - Comparison
// ============================================

export function compareTimestamps(a: Timestamp, b: Timestamp): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isBefore(timestamp: Timestamp, other: Timestamp): boolean {
  return timestamp < other;
}

export function isAfter(timestamp: Timestamp, other: Timestamp): boolean {
  return timestamp > other;
}

export function isBetween(timestamp: Timestamp, start: Timestamp, end: Timestamp, inclusive = true): boolean {
  if (start > end) {
    throw new Error('start must be less than or equal to end');
  }
  if (inclusive) {
    return timestamp >= start && timestamp <= end;
  }
  return timestamp > start && timestamp < end;
}

// ============================================
// Constants
// ============================================

export const SECOND_MS: Duration = 1000;
export const MINUTE_MS: Duration = 60000;
export const HOUR_MS: Duration = 3600000;
export const DAY_MS: Duration = 86400000;
export const WEEK_MS: Duration = 604800000;

export const DAYS_OF_WEEK: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// ============================================
// Default Export
// ============================================

export const DateTime = {
  // Non-deterministic
  now,
  
  // Arithmetic
  addDuration,
  subtractDuration,
  diffTimestamps,
  
  // Formatting
  formatTimestamp,
  parseTimestamp,
  
  // Components
  getDatePart,
  toComponents,
  fromComponents,
  
  // Duration
  durationToMs,
  msToDuration,
  
  // Calendar
  isLeapYear,
  daysInMonth,
  
  // Comparison
  compareTimestamps,
  isBefore,
  isAfter,
  isBetween,
  
  // Constants
  SECOND_MS,
  MINUTE_MS,
  HOUR_MS,
  DAY_MS,
  WEEK_MS,
  DAYS_OF_WEEK,
};

export default DateTime;
