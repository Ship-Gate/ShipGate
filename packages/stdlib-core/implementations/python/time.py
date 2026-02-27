"""
ISL Standard Library - Python Time Implementation
@stdlib/time
"""

import re
from dataclasses import dataclass
from datetime import datetime, date, time, timedelta, timezone
from enum import Enum
from typing import Optional, Tuple
from zoneinfo import ZoneInfo


# ============================================================================
# TIME UNIT ENUM
# ============================================================================


class TimeUnit(str, Enum):
    """Time units for duration."""

    MILLISECONDS = "MILLISECONDS"
    SECONDS = "SECONDS"
    MINUTES = "MINUTES"
    HOURS = "HOURS"
    DAYS = "DAYS"
    WEEKS = "WEEKS"
    MONTHS = "MONTHS"
    YEARS = "YEARS"


class DayOfWeek(int, Enum):
    """Day of week (ISO weekday)."""

    MONDAY = 1
    TUESDAY = 2
    WEDNESDAY = 3
    THURSDAY = 4
    FRIDAY = 5
    SATURDAY = 6
    SUNDAY = 7


class Month(int, Enum):
    """Month of year."""

    JANUARY = 1
    FEBRUARY = 2
    MARCH = 3
    APRIL = 4
    MAY = 5
    JUNE = 6
    JULY = 7
    AUGUST = 8
    SEPTEMBER = 9
    OCTOBER = 10
    NOVEMBER = 11
    DECEMBER = 12


# ============================================================================
# DURATION DATACLASS
# ============================================================================


@dataclass(frozen=True)
class Duration:
    """Duration with value and unit."""

    value: int
    unit: TimeUnit

    def to_milliseconds(self) -> int:
        """Convert duration to milliseconds."""
        multipliers = {
            TimeUnit.MILLISECONDS: 1,
            TimeUnit.SECONDS: 1000,
            TimeUnit.MINUTES: 60 * 1000,
            TimeUnit.HOURS: 60 * 60 * 1000,
            TimeUnit.DAYS: 24 * 60 * 60 * 1000,
            TimeUnit.WEEKS: 7 * 24 * 60 * 60 * 1000,
            TimeUnit.MONTHS: 30 * 24 * 60 * 60 * 1000,  # Approximate
            TimeUnit.YEARS: 365 * 24 * 60 * 60 * 1000,  # Approximate
        }
        return self.value * multipliers[self.unit]

    def to_seconds(self) -> float:
        """Convert duration to seconds."""
        return self.to_milliseconds() / 1000

    def to_minutes(self) -> float:
        """Convert duration to minutes."""
        return self.to_milliseconds() / (60 * 1000)

    def to_hours(self) -> float:
        """Convert duration to hours."""
        return self.to_milliseconds() / (60 * 60 * 1000)

    def to_days(self) -> float:
        """Convert duration to days."""
        return self.to_milliseconds() / (24 * 60 * 60 * 1000)

    def to_timedelta(self) -> timedelta:
        """Convert duration to Python timedelta."""
        return timedelta(milliseconds=self.to_milliseconds())

    def __add__(self, other: "Duration") -> "Duration":
        """Add two durations."""
        total_ms = self.to_milliseconds() + other.to_milliseconds()
        return Duration(total_ms, TimeUnit.MILLISECONDS)

    def __sub__(self, other: "Duration") -> "Duration":
        """Subtract two durations."""
        total_ms = self.to_milliseconds() - other.to_milliseconds()
        return Duration(total_ms, TimeUnit.MILLISECONDS)

    def __mul__(self, factor: int) -> "Duration":
        """Multiply duration by a factor."""
        return Duration(self.value * factor, self.unit)

    def __lt__(self, other: "Duration") -> bool:
        return self.to_milliseconds() < other.to_milliseconds()

    def __le__(self, other: "Duration") -> bool:
        return self.to_milliseconds() <= other.to_milliseconds()

    def __gt__(self, other: "Duration") -> bool:
        return self.to_milliseconds() > other.to_milliseconds()

    def __ge__(self, other: "Duration") -> bool:
        return self.to_milliseconds() >= other.to_milliseconds()

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Duration):
            return NotImplemented
        return self.to_milliseconds() == other.to_milliseconds()


# ============================================================================
# DURATION FACTORY FUNCTIONS
# ============================================================================


def milliseconds(value: int) -> Duration:
    """Create duration in milliseconds."""
    return Duration(value, TimeUnit.MILLISECONDS)


def ms(value: int) -> Duration:
    """Create duration in milliseconds (alias)."""
    return milliseconds(value)


def seconds(value: int) -> Duration:
    """Create duration in seconds."""
    return Duration(value, TimeUnit.SECONDS)


def second(value: int) -> Duration:
    """Create duration in seconds (singular alias)."""
    return seconds(value)


def minutes(value: int) -> Duration:
    """Create duration in minutes."""
    return Duration(value, TimeUnit.MINUTES)


def minute(value: int) -> Duration:
    """Create duration in minutes (singular alias)."""
    return minutes(value)


def hours(value: int) -> Duration:
    """Create duration in hours."""
    return Duration(value, TimeUnit.HOURS)


def hour(value: int) -> Duration:
    """Create duration in hours (singular alias)."""
    return hours(value)


def days(value: int) -> Duration:
    """Create duration in days."""
    return Duration(value, TimeUnit.DAYS)


def day(value: int) -> Duration:
    """Create duration in days (singular alias)."""
    return days(value)


def weeks(value: int) -> Duration:
    """Create duration in weeks."""
    return Duration(value, TimeUnit.WEEKS)


def week(value: int) -> Duration:
    """Create duration in weeks (singular alias)."""
    return weeks(value)


# ============================================================================
# DATE PATTERNS
# ============================================================================

DATE_PATTERNS = {
    "ISO_DATE": re.compile(r"^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$"),
    "ISO_TIME": re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?$"),
    "ISO_DATETIME": re.compile(
        r"^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T"
        r"(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?"
        r"(?:Z|[+-](?:0[0-9]|1[0-4]):[0-5][0-9])$"
    ),
    "UTC_OFFSET": re.compile(r"^[+-](?:0[0-9]|1[0-4]):[0-5][0-9]$"),
    "CRON": re.compile(
        r"^(\*|([0-5]?\d)([-\/][0-5]?\d)*)\s+"
        r"(\*|([01]?\d|2[0-3])([-\/]([01]?\d|2[0-3]))*)\s+"
        r"(\*|([1-9]|[12]\d|3[01])([-\/]([1-9]|[12]\d|3[01]))*)\s+"
        r"(\*|([1-9]|1[0-2])([-\/]([1-9]|1[0-2]))*)\s+"
        r"(\*|[0-6]([-\/][0-6])*)$"
    ),
    "TIMEZONE": re.compile(
        r"^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$|^UTC$|^GMT$"
    ),
}


# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================


def is_valid_iso_date(value: str) -> bool:
    """Validate ISO 8601 date (YYYY-MM-DD)."""
    if not DATE_PATTERNS["ISO_DATE"].match(value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def is_valid_iso_time(value: str) -> bool:
    """Validate ISO 8601 time (HH:MM:SS)."""
    return bool(DATE_PATTERNS["ISO_TIME"].match(value))


def is_valid_iso_datetime(value: str) -> bool:
    """Validate ISO 8601 datetime with timezone."""
    if not DATE_PATTERNS["ISO_DATETIME"].match(value):
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def is_valid_utc_offset(value: str) -> bool:
    """Validate UTC offset format (+/-HH:MM)."""
    return bool(DATE_PATTERNS["UTC_OFFSET"].match(value))


def is_valid_cron_expression(value: str) -> bool:
    """Validate cron expression."""
    return bool(DATE_PATTERNS["CRON"].match(value))


def is_valid_timezone(value: str) -> bool:
    """Validate IANA timezone identifier."""
    if not DATE_PATTERNS["TIMEZONE"].match(value):
        return False
    try:
        ZoneInfo(value)
        return True
    except Exception:
        return False


# ============================================================================
# DATE RANGE
# ============================================================================


@dataclass(frozen=True)
class DateRange:
    """Date range with start and end."""

    start: date
    end: date

    def __post_init__(self) -> None:
        if self.start > self.end:
            raise ValueError("Start date must be before or equal to end date")

    @classmethod
    def from_strings(cls, start: str, end: str) -> "DateRange":
        """Create DateRange from ISO date strings."""
        return cls(
            start=date.fromisoformat(start),
            end=date.fromisoformat(end),
        )

    def contains(self, d: date) -> bool:
        """Check if date is within range."""
        return self.start <= d <= self.end

    def duration_days(self) -> int:
        """Get duration in days."""
        return (self.end - self.start).days


@dataclass(frozen=True)
class DateTimeRange:
    """DateTime range with start and end."""

    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        if self.start > self.end:
            raise ValueError("Start datetime must be before or equal to end datetime")

    def contains(self, dt: datetime) -> bool:
        """Check if datetime is within range."""
        return self.start <= dt <= self.end

    def duration(self) -> Duration:
        """Get duration of range."""
        delta = self.end - self.start
        return Duration(int(delta.total_seconds() * 1000), TimeUnit.MILLISECONDS)


# ============================================================================
# TIME OF DAY
# ============================================================================


@dataclass(frozen=True)
class TimeOfDay:
    """Time of day (wall clock time without date)."""

    hour: int
    minute: int
    second: int = 0

    def __post_init__(self) -> None:
        if not 0 <= self.hour <= 23:
            raise ValueError("Hour must be between 0 and 23")
        if not 0 <= self.minute <= 59:
            raise ValueError("Minute must be between 0 and 59")
        if not 0 <= self.second <= 59:
            raise ValueError("Second must be between 0 and 59")

    def to_time(self) -> time:
        """Convert to Python time object."""
        return time(self.hour, self.minute, self.second)

    @classmethod
    def from_time(cls, t: time) -> "TimeOfDay":
        """Create from Python time object."""
        return cls(hour=t.hour, minute=t.minute, second=t.second)

    @classmethod
    def from_string(cls, value: str) -> "TimeOfDay":
        """Parse from HH:MM:SS string."""
        match = re.match(r"^(\d{2}):(\d{2}):(\d{2})$", value)
        if not match:
            raise ValueError(f"Invalid time format: {value}")
        return cls(
            hour=int(match.group(1)),
            minute=int(match.group(2)),
            second=int(match.group(3)),
        )

    def __str__(self) -> str:
        """Format as HH:MM:SS."""
        return f"{self.hour:02d}:{self.minute:02d}:{self.second:02d}"

    def __lt__(self, other: "TimeOfDay") -> bool:
        return (self.hour, self.minute, self.second) < (
            other.hour,
            other.minute,
            other.second,
        )


# ============================================================================
# TIMESTAMP HELPERS
# ============================================================================


def now_unix_timestamp() -> int:
    """Get current Unix timestamp (seconds)."""
    return int(datetime.now(timezone.utc).timestamp())


def now_unix_timestamp_ms() -> int:
    """Get current Unix timestamp (milliseconds)."""
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def from_unix_timestamp(timestamp: int) -> datetime:
    """Convert Unix timestamp to datetime (UTC)."""
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def from_unix_timestamp_ms(timestamp: int) -> datetime:
    """Convert Unix timestamp (ms) to datetime (UTC)."""
    return datetime.fromtimestamp(timestamp / 1000, tz=timezone.utc)


def to_unix_timestamp(dt: datetime) -> int:
    """Convert datetime to Unix timestamp."""
    return int(dt.timestamp())


def to_unix_timestamp_ms(dt: datetime) -> int:
    """Convert datetime to Unix timestamp (ms)."""
    return int(dt.timestamp() * 1000)


# ============================================================================
# DURATION FORMATTING
# ============================================================================


def format_duration(duration: Duration) -> str:
    """Format duration for display (short form)."""
    ms_total = duration.to_milliseconds()

    if ms_total < 1000:
        return f"{ms_total}ms"
    if ms_total < 60 * 1000:
        return f"{ms_total / 1000:.1f}s"
    if ms_total < 60 * 60 * 1000:
        return f"{ms_total / (60 * 1000):.1f}m"
    if ms_total < 24 * 60 * 60 * 1000:
        return f"{ms_total / (60 * 60 * 1000):.1f}h"
    return f"{ms_total / (24 * 60 * 60 * 1000):.1f}d"


def format_duration_long(duration: Duration) -> str:
    """Format duration for display (long form)."""
    ms_total = duration.to_milliseconds()

    days_val = ms_total // (24 * 60 * 60 * 1000)
    ms_total %= 24 * 60 * 60 * 1000
    hours_val = ms_total // (60 * 60 * 1000)
    ms_total %= 60 * 60 * 1000
    minutes_val = ms_total // (60 * 1000)
    ms_total %= 60 * 1000
    seconds_val = ms_total // 1000

    parts = []
    if days_val > 0:
        parts.append(f"{days_val} day{'s' if days_val > 1 else ''}")
    if hours_val > 0:
        parts.append(f"{hours_val} hour{'s' if hours_val > 1 else ''}")
    if minutes_val > 0:
        parts.append(f"{minutes_val} minute{'s' if minutes_val > 1 else ''}")
    if seconds_val > 0 or not parts:
        parts.append(f"{seconds_val} second{'s' if seconds_val != 1 else ''}")

    return ", ".join(parts)


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    # Enums
    "TimeUnit",
    "DayOfWeek",
    "Month",
    # Classes
    "Duration",
    "DateRange",
    "DateTimeRange",
    "TimeOfDay",
    # Duration factories
    "milliseconds",
    "ms",
    "seconds",
    "second",
    "minutes",
    "minute",
    "hours",
    "hour",
    "days",
    "day",
    "weeks",
    "week",
    # Validation
    "is_valid_iso_date",
    "is_valid_iso_time",
    "is_valid_iso_datetime",
    "is_valid_utc_offset",
    "is_valid_cron_expression",
    "is_valid_timezone",
    # Timestamp helpers
    "now_unix_timestamp",
    "now_unix_timestamp_ms",
    "from_unix_timestamp",
    "from_unix_timestamp_ms",
    "to_unix_timestamp",
    "to_unix_timestamp_ms",
    # Formatting
    "format_duration",
    "format_duration_long",
    # Constants
    "DATE_PATTERNS",
]
