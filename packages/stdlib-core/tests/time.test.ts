// ============================================================================
// ISL Standard Library - Time Test Suite
// ============================================================================

import { describe, test, expect } from 'vitest';
import {
  // Duration factories
  milliseconds,
  ms,
  seconds,
  minutes,
  hours,
  days,
  weeks,
  
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
  
  // Date Range
  createDateRange,
  
  // Time of Day
  createTimeOfDay,
  formatTimeOfDay,
  parseTimeOfDay,
  
  // Timestamps
  nowUnixTimestamp,
  nowUnixTimestampMs,
  fromUnixTimestamp,
  toUnixTimestamp,
  
  // Formatting
  formatDuration,
  formatDurationLong,
  
  // Types
  TimeUnit,
  DayOfWeek,
  Month,
} from '../implementations/typescript/time';

// ============================================================================
// DURATION CREATION
// ============================================================================

describe('Duration Creation', () => {
  test('creates durations with correct units', () => {
    expect(milliseconds(500).unit).toBe(TimeUnit.MILLISECONDS);
    expect(seconds(30).unit).toBe(TimeUnit.SECONDS);
    expect(minutes(5).unit).toBe(TimeUnit.MINUTES);
    expect(hours(2).unit).toBe(TimeUnit.HOURS);
    expect(days(1).unit).toBe(TimeUnit.DAYS);
    expect(weeks(1).unit).toBe(TimeUnit.WEEKS);
  });

  test('ms is alias for milliseconds', () => {
    const a = ms(100);
    const b = milliseconds(100);
    expect(a.value).toBe(b.value);
    expect(a.unit).toBe(b.unit);
  });
});

// ============================================================================
// DURATION CONVERSIONS
// ============================================================================

describe('Duration Conversions', () => {
  test('converts seconds to milliseconds', () => {
    expect(toMilliseconds(seconds(1))).toBe(1000);
    expect(toMilliseconds(seconds(5))).toBe(5000);
  });

  test('converts minutes to milliseconds', () => {
    expect(toMilliseconds(minutes(1))).toBe(60000);
    expect(toMilliseconds(minutes(5))).toBe(300000);
  });

  test('converts hours to milliseconds', () => {
    expect(toMilliseconds(hours(1))).toBe(3600000);
    expect(toMilliseconds(hours(24))).toBe(86400000);
  });

  test('converts days to milliseconds', () => {
    expect(toMilliseconds(days(1))).toBe(86400000);
  });

  test('converts weeks to milliseconds', () => {
    expect(toMilliseconds(weeks(1))).toBe(604800000);
  });

  test('toSeconds converts correctly', () => {
    expect(toSeconds(minutes(1))).toBe(60);
    expect(toSeconds(hours(1))).toBe(3600);
  });

  test('toMinutes converts correctly', () => {
    expect(toMinutes(hours(1))).toBe(60);
    expect(toMinutes(seconds(120))).toBe(2);
  });

  test('toHours converts correctly', () => {
    expect(toHours(days(1))).toBe(24);
    expect(toHours(minutes(120))).toBe(2);
  });

  test('toDays converts correctly', () => {
    expect(toDays(weeks(1))).toBe(7);
    expect(toDays(hours(48))).toBe(2);
  });
});

// ============================================================================
// DURATION ARITHMETIC
// ============================================================================

describe('Duration Arithmetic', () => {
  test('adds durations', () => {
    const result = addDuration(seconds(30), seconds(30));
    expect(toSeconds(result)).toBe(60);
  });

  test('adds durations with different units', () => {
    const result = addDuration(minutes(1), seconds(30));
    expect(toSeconds(result)).toBe(90);
  });

  test('subtracts durations', () => {
    const result = subtractDuration(minutes(2), seconds(30));
    expect(toSeconds(result)).toBe(90);
  });

  test('multiplies duration', () => {
    const result = multiplyDuration(minutes(5), 3);
    expect(result.value).toBe(15);
    expect(result.unit).toBe(TimeUnit.MINUTES);
  });
});

// ============================================================================
// DURATION COMPARISON
// ============================================================================

describe('Duration Comparison', () => {
  test('compareDuration returns negative when a < b', () => {
    expect(compareDuration(seconds(30), minutes(1))).toBeLessThan(0);
  });

  test('compareDuration returns positive when a > b', () => {
    expect(compareDuration(minutes(2), seconds(30))).toBeGreaterThan(0);
  });

  test('compareDuration returns zero when equal', () => {
    expect(compareDuration(seconds(60), minutes(1))).toBe(0);
  });

  test('durationEquals works correctly', () => {
    expect(durationEquals(seconds(60), minutes(1))).toBe(true);
    expect(durationEquals(seconds(30), minutes(1))).toBe(false);
  });

  test('durationLessThan works correctly', () => {
    expect(durationLessThan(seconds(30), minutes(1))).toBe(true);
    expect(durationLessThan(minutes(1), seconds(30))).toBe(false);
  });

  test('durationGreaterThan works correctly', () => {
    expect(durationGreaterThan(minutes(1), seconds(30))).toBe(true);
    expect(durationGreaterThan(seconds(30), minutes(1))).toBe(false);
  });
});

// ============================================================================
// TIMEZONE VALIDATION
// ============================================================================

describe('Timezone Validation', () => {
  test('accepts valid IANA timezones', () => {
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('Europe/London')).toBe(true);
    expect(isValidTimezone('Asia/Tokyo')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
  });

  test('rejects invalid timezones', () => {
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone('Invalid/Timezone')).toBe(false);
    expect(isValidTimezone('America')).toBe(false);
    expect(isValidTimezone('EST')).toBe(false); // Abbreviations not valid
  });
});

// ============================================================================
// ISO DATE/TIME VALIDATION
// ============================================================================

describe('ISO Date/Time Validation', () => {
  test('isValidISODate accepts valid dates', () => {
    expect(isValidISODate('2024-01-15')).toBe(true);
    expect(isValidISODate('2023-12-31')).toBe(true);
    expect(isValidISODate('2000-01-01')).toBe(true);
  });

  test('isValidISODate rejects invalid dates', () => {
    expect(isValidISODate('')).toBe(false);
    expect(isValidISODate('2024-13-01')).toBe(false); // Invalid month
    expect(isValidISODate('2024-02-30')).toBe(false); // Invalid day
    expect(isValidISODate('01-15-2024')).toBe(false); // Wrong format
    expect(isValidISODate('2024/01/15')).toBe(false); // Wrong separator
  });

  test('isValidISOTime accepts valid times', () => {
    expect(isValidISOTime('14:30:00')).toBe(true);
    expect(isValidISOTime('00:00:00')).toBe(true);
    expect(isValidISOTime('23:59:59')).toBe(true);
    expect(isValidISOTime('12:30:45.123')).toBe(true);
  });

  test('isValidISOTime rejects invalid times', () => {
    expect(isValidISOTime('25:00:00')).toBe(false);
    expect(isValidISOTime('12:60:00')).toBe(false);
    expect(isValidISOTime('12:30')).toBe(false); // Missing seconds
  });

  test('isValidISODateTime accepts valid datetimes', () => {
    expect(isValidISODateTime('2024-01-15T14:30:00Z')).toBe(true);
    expect(isValidISODateTime('2024-01-15T14:30:00+05:30')).toBe(true);
    expect(isValidISODateTime('2024-01-15T14:30:00-08:00')).toBe(true);
    expect(isValidISODateTime('2024-01-15T14:30:00.123Z')).toBe(true);
  });

  test('isValidISODateTime rejects invalid datetimes', () => {
    expect(isValidISODateTime('2024-01-15 14:30:00')).toBe(false); // Space instead of T
    expect(isValidISODateTime('2024-01-15T14:30:00')).toBe(false); // Missing timezone
    expect(isValidISODateTime('2024-01-15')).toBe(false); // Date only
  });

  test('isValidUTCOffset accepts valid offsets', () => {
    expect(isValidUTCOffset('+00:00')).toBe(true);
    expect(isValidUTCOffset('-05:00')).toBe(true);
    expect(isValidUTCOffset('+12:30')).toBe(true);
    expect(isValidUTCOffset('-14:00')).toBe(true);
  });

  test('isValidUTCOffset rejects invalid offsets', () => {
    expect(isValidUTCOffset('00:00')).toBe(false); // Missing sign
    expect(isValidUTCOffset('+15:00')).toBe(false); // Out of range
    expect(isValidUTCOffset('+05:60')).toBe(false); // Invalid minutes
  });
});

// ============================================================================
// CRON VALIDATION
// ============================================================================

describe('Cron Expression Validation', () => {
  test('accepts valid cron expressions', () => {
    expect(isValidCronExpression('* * * * *')).toBe(true);
    expect(isValidCronExpression('0 12 * * *')).toBe(true);
    expect(isValidCronExpression('0 0 1 * *')).toBe(true);
    expect(isValidCronExpression('*/15 * * * *')).toBe(true);
    expect(isValidCronExpression('0 9-17 * * 1-5')).toBe(true);
  });

  test('rejects invalid cron expressions', () => {
    expect(isValidCronExpression('')).toBe(false);
    expect(isValidCronExpression('* * *')).toBe(false); // Too few fields
    expect(isValidCronExpression('60 * * * *')).toBe(false); // Invalid minute
    expect(isValidCronExpression('* 25 * * *')).toBe(false); // Invalid hour
  });
});

// ============================================================================
// DATE RANGE
// ============================================================================

describe('Date Range', () => {
  test('createDateRange creates valid range', () => {
    const range = createDateRange('2024-01-01', '2024-12-31');
    expect(range.start).toBe('2024-01-01');
    expect(range.end).toBe('2024-12-31');
  });

  test('createDateRange throws for invalid dates', () => {
    expect(() => createDateRange('invalid', '2024-12-31')).toThrow();
    expect(() => createDateRange('2024-01-01', 'invalid')).toThrow();
  });

  test('createDateRange throws when start > end', () => {
    expect(() => createDateRange('2024-12-31', '2024-01-01')).toThrow();
  });

  test('isValidDateRange validates correctly', () => {
    expect(isValidDateRange({ start: '2024-01-01', end: '2024-12-31' })).toBe(true);
    expect(isValidDateRange({ start: '2024-12-31', end: '2024-01-01' })).toBe(false);
    expect(isValidDateRange({ start: 'invalid', end: '2024-12-31' })).toBe(false);
  });
});

// ============================================================================
// TIME OF DAY
// ============================================================================

describe('Time of Day', () => {
  test('createTimeOfDay creates valid time', () => {
    const time = createTimeOfDay(14, 30, 0);
    expect(time.hour).toBe(14);
    expect(time.minute).toBe(30);
    expect(time.second).toBe(0);
  });

  test('createTimeOfDay throws for invalid values', () => {
    expect(() => createTimeOfDay(24, 0, 0)).toThrow();
    expect(() => createTimeOfDay(12, 60, 0)).toThrow();
    expect(() => createTimeOfDay(12, 0, 60)).toThrow();
    expect(() => createTimeOfDay(-1, 0, 0)).toThrow();
  });

  test('formatTimeOfDay formats correctly', () => {
    expect(formatTimeOfDay({ hour: 9, minute: 5, second: 0 })).toBe('09:05:00');
    expect(formatTimeOfDay({ hour: 14, minute: 30, second: 45 })).toBe('14:30:45');
  });

  test('parseTimeOfDay parses correctly', () => {
    const time = parseTimeOfDay('14:30:45');
    expect(time.hour).toBe(14);
    expect(time.minute).toBe(30);
    expect(time.second).toBe(45);
  });

  test('parseTimeOfDay throws for invalid format', () => {
    expect(() => parseTimeOfDay('invalid')).toThrow();
    expect(() => parseTimeOfDay('14:30')).toThrow();
  });
});

// ============================================================================
// TIMESTAMPS
// ============================================================================

describe('Timestamps', () => {
  test('nowUnixTimestamp returns current time in seconds', () => {
    const ts = nowUnixTimestamp();
    const expected = Math.floor(Date.now() / 1000);
    expect(Math.abs(ts - expected)).toBeLessThan(2);
  });

  test('nowUnixTimestampMs returns current time in milliseconds', () => {
    const ts = nowUnixTimestampMs();
    const expected = Date.now();
    expect(Math.abs(ts - expected)).toBeLessThan(100);
  });

  test('fromUnixTimestamp converts correctly', () => {
    const ts = 1704067200; // 2024-01-01 00:00:00 UTC
    const date = fromUnixTimestamp(ts);
    expect(date.getUTCFullYear()).toBe(2024);
    expect(date.getUTCMonth()).toBe(0);
    expect(date.getUTCDate()).toBe(1);
  });

  test('toUnixTimestamp converts correctly', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const ts = toUnixTimestamp(date);
    expect(ts).toBe(1704067200);
  });
});

// ============================================================================
// DURATION FORMATTING
// ============================================================================

describe('Duration Formatting', () => {
  test('formatDuration formats short durations', () => {
    expect(formatDuration(ms(500))).toBe('500ms');
    expect(formatDuration(seconds(5))).toMatch(/5\.0s/);
  });

  test('formatDuration formats medium durations', () => {
    expect(formatDuration(minutes(30))).toMatch(/30\.0m/);
    expect(formatDuration(hours(2))).toMatch(/2\.0h/);
  });

  test('formatDuration formats long durations', () => {
    expect(formatDuration(days(3))).toMatch(/3\.0d/);
  });

  test('formatDurationLong formats with full words', () => {
    expect(formatDurationLong(seconds(90))).toBe('1 minute, 30 seconds');
    expect(formatDurationLong(hours(25))).toBe('1 day, 1 hour');
    expect(formatDurationLong(seconds(0))).toBe('0 seconds');
  });
});

// ============================================================================
// ENUMS
// ============================================================================

describe('Time Enums', () => {
  test('DayOfWeek has correct values', () => {
    expect(DayOfWeek.MONDAY).toBe(1);
    expect(DayOfWeek.SUNDAY).toBe(7);
  });

  test('Month has correct values', () => {
    expect(Month.JANUARY).toBe(1);
    expect(Month.DECEMBER).toBe(12);
  });
});
