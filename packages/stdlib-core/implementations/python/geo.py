"""
ISL Standard Library - Python Geographic Implementation
@stdlib/geo
"""

import math
import re
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, Tuple


# ============================================================================
# DISTANCE UNIT ENUM
# ============================================================================


class DistanceUnit(str, Enum):
    """Distance units."""

    METERS = "METERS"
    KILOMETERS = "KILOMETERS"
    MILES = "MILES"
    FEET = "FEET"
    YARDS = "YARDS"
    NAUTICAL_MILES = "NAUTICAL_MILES"


# ============================================================================
# US STATES
# ============================================================================

US_STATES = (
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC", "PR", "VI", "GU", "AS", "MP",
)


# ============================================================================
# POSTAL CODE PATTERNS
# ============================================================================

POSTAL_PATTERNS = {
    "US_ZIP": re.compile(r"^\d{5}(-\d{4})?$"),
    "UK_POSTCODE": re.compile(r"^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$", re.IGNORECASE),
    "CANADIAN": re.compile(r"^[A-Z]\d[A-Z]\s?\d[A-Z]\d$", re.IGNORECASE),
    "GERMAN": re.compile(r"^\d{5}$"),
}

GEO_PATTERNS = {
    "PLUS_CODE": re.compile(r"^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2,}$"),
    "WHAT3WORDS": re.compile(r"^[a-z]+\.[a-z]+\.[a-z]+$"),
    "GEOHASH": re.compile(r"^[0-9b-hjkmnp-z]{1,12}$"),
}


# ============================================================================
# COORDINATE TYPES
# ============================================================================


@dataclass(frozen=True)
class Coordinates:
    """Geographic coordinates (WGS84)."""

    latitude: float
    longitude: float

    def __post_init__(self) -> None:
        if not -90 <= self.latitude <= 90:
            raise ValueError(f"Latitude must be between -90 and 90, got {self.latitude}")
        if not -180 <= self.longitude <= 180:
            raise ValueError(
                f"Longitude must be between -180 and 180, got {self.longitude}"
            )

    def to_tuple(self) -> Tuple[float, float]:
        """Return as (latitude, longitude) tuple."""
        return (self.latitude, self.longitude)


@dataclass(frozen=True)
class Distance:
    """Distance with value and unit."""

    value: float
    unit: DistanceUnit

    def __post_init__(self) -> None:
        if self.value < 0:
            raise ValueError("Distance cannot be negative")

    def to_meters(self) -> float:
        """Convert to meters."""
        multipliers = {
            DistanceUnit.METERS: 1.0,
            DistanceUnit.KILOMETERS: 1000.0,
            DistanceUnit.MILES: 1609.344,
            DistanceUnit.FEET: 0.3048,
            DistanceUnit.YARDS: 0.9144,
            DistanceUnit.NAUTICAL_MILES: 1852.0,
        }
        return self.value * multipliers[self.unit]

    def to_kilometers(self) -> float:
        """Convert to kilometers."""
        return self.to_meters() / 1000.0

    def to_miles(self) -> float:
        """Convert to miles."""
        return self.to_meters() / 1609.344


@dataclass(frozen=True)
class BoundingBox:
    """Geographic bounding box."""

    north_east: Coordinates
    south_west: Coordinates

    def __post_init__(self) -> None:
        if self.north_east.latitude < self.south_west.latitude:
            raise ValueError("NorthEast latitude must be >= SouthWest latitude")

    def contains(self, point: Coordinates) -> bool:
        """Check if point is within bounding box."""
        return (
            self.south_west.latitude <= point.latitude <= self.north_east.latitude
            and self.south_west.longitude <= point.longitude <= self.north_east.longitude
        )

    @property
    def center(self) -> Coordinates:
        """Get center of bounding box."""
        return Coordinates(
            latitude=(self.north_east.latitude + self.south_west.latitude) / 2,
            longitude=(self.north_east.longitude + self.south_west.longitude) / 2,
        )


@dataclass(frozen=True)
class GeoCircle:
    """Circular geographic region."""

    center: Coordinates
    radius: Distance


@dataclass(frozen=True)
class GeoPolygon:
    """Polygon region defined by vertices."""

    vertices: Tuple[Coordinates, ...]

    def __post_init__(self) -> None:
        if len(self.vertices) < 3:
            raise ValueError("Polygon must have at least 3 vertices")


# ============================================================================
# ADDRESS TYPES
# ============================================================================


@dataclass(frozen=True)
class Address:
    """Full postal address."""

    line1: str
    city: str
    postal_code: str
    country: str
    line2: Optional[str] = None
    line3: Optional[str] = None
    state: Optional[str] = None


@dataclass(frozen=True)
class USAddress:
    """US-specific address."""

    line1: str
    city: str
    state: str
    zip_code: str
    line2: Optional[str] = None
    country: str = "US"

    def __post_init__(self) -> None:
        if self.state not in US_STATES:
            raise ValueError(f"Invalid US state: {self.state}")
        if not POSTAL_PATTERNS["US_ZIP"].match(self.zip_code):
            raise ValueError(f"Invalid ZIP code: {self.zip_code}")


@dataclass(frozen=True)
class SimpleAddress:
    """Simple address for forms."""

    street: str
    city: str
    postal_code: str
    country: str


@dataclass(frozen=True)
class Location:
    """Location with coordinates and optional address."""

    coordinates: Coordinates
    address: Optional[Address] = None
    name: Optional[str] = None
    place_id: Optional[str] = None


@dataclass(frozen=True)
class ShippingAddress:
    """Shipping address with contact info."""

    recipient_name: str
    address: Address
    residential: bool
    company: Optional[str] = None
    phone: Optional[str] = None
    instructions: Optional[str] = None


@dataclass(frozen=True)
class BillingAddress:
    """Billing address."""

    name: str
    address: Address
    vat_number: Optional[str] = None


# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================


def is_valid_latitude(value: float) -> bool:
    """Validate latitude (-90 to 90)."""
    return -90 <= value <= 90


def is_valid_longitude(value: float) -> bool:
    """Validate longitude (-180 to 180)."""
    return -180 <= value <= 180


def is_valid_coordinates(latitude: float, longitude: float) -> bool:
    """Validate geographic coordinates."""
    return is_valid_latitude(latitude) and is_valid_longitude(longitude)


def is_valid_us_zip_code(value: str) -> bool:
    """Validate US ZIP code."""
    return bool(POSTAL_PATTERNS["US_ZIP"].match(value))


def is_valid_uk_postcode(value: str) -> bool:
    """Validate UK postcode."""
    return bool(POSTAL_PATTERNS["UK_POSTCODE"].match(value))


def is_valid_canadian_postal_code(value: str) -> bool:
    """Validate Canadian postal code."""
    return bool(POSTAL_PATTERNS["CANADIAN"].match(value))


def is_valid_german_postal_code(value: str) -> bool:
    """Validate German postal code (PLZ)."""
    return bool(POSTAL_PATTERNS["GERMAN"].match(value))


def is_valid_us_state(value: str) -> bool:
    """Validate US state code."""
    return value.upper() in US_STATES


def is_valid_geohash(value: str) -> bool:
    """Validate geohash string."""
    return bool(GEO_PATTERNS["GEOHASH"].match(value.lower()))


def is_valid_plus_code(value: str) -> bool:
    """Validate Plus Code (Open Location Code)."""
    return bool(GEO_PATTERNS["PLUS_CODE"].match(value))


def is_valid_what3words(value: str) -> bool:
    """Validate What3Words address."""
    return bool(GEO_PATTERNS["WHAT3WORDS"].match(value))


# ============================================================================
# DISTANCE FACTORY FUNCTIONS
# ============================================================================


def meters(value: float) -> Distance:
    """Create distance in meters."""
    return Distance(value, DistanceUnit.METERS)


def kilometers(value: float) -> Distance:
    """Create distance in kilometers."""
    return Distance(value, DistanceUnit.KILOMETERS)


def miles(value: float) -> Distance:
    """Create distance in miles."""
    return Distance(value, DistanceUnit.MILES)


def feet(value: float) -> Distance:
    """Create distance in feet."""
    return Distance(value, DistanceUnit.FEET)


# ============================================================================
# HAVERSINE FORMULA
# ============================================================================

EARTH_RADIUS_METERS = 6371000


def haversine_distance(a: Coordinates, b: Coordinates) -> Distance:
    """Calculate distance between two coordinates using Haversine formula."""
    lat1 = math.radians(a.latitude)
    lat2 = math.radians(b.latitude)
    d_lat = math.radians(b.latitude - a.latitude)
    d_lon = math.radians(b.longitude - a.longitude)

    h = (
        math.sin(d_lat / 2) ** 2
        + math.sin(d_lon / 2) ** 2 * math.cos(lat1) * math.cos(lat2)
    )

    c = 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))
    distance = EARTH_RADIUS_METERS * c

    return Distance(distance, DistanceUnit.METERS)


def is_within_radius(
    point: Coordinates, center: Coordinates, radius: Distance
) -> bool:
    """Check if point is within radius of center."""
    distance = haversine_distance(point, center)
    return distance.to_meters() <= radius.to_meters()


# ============================================================================
# ADDRESS FORMATTING
# ============================================================================


def format_address(address: Address) -> str:
    """Format address for display."""
    lines = [address.line1]
    if address.line2:
        lines.append(address.line2)
    if address.line3:
        lines.append(address.line3)

    city_line = (
        f"{address.city}, {address.state} {address.postal_code}"
        if address.state
        else f"{address.city} {address.postal_code}"
    )
    lines.append(city_line)
    lines.append(address.country)

    return "\n".join(lines)


def format_us_address(address: USAddress) -> str:
    """Format US address for display."""
    lines = [address.line1]
    if address.line2:
        lines.append(address.line2)
    lines.append(f"{address.city}, {address.state} {address.zip_code}")
    return "\n".join(lines)


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    # Enums
    "DistanceUnit",
    # Classes
    "Coordinates",
    "Distance",
    "BoundingBox",
    "GeoCircle",
    "GeoPolygon",
    "Address",
    "USAddress",
    "SimpleAddress",
    "Location",
    "ShippingAddress",
    "BillingAddress",
    # Distance factories
    "meters",
    "kilometers",
    "miles",
    "feet",
    # Validation
    "is_valid_latitude",
    "is_valid_longitude",
    "is_valid_coordinates",
    "is_valid_us_zip_code",
    "is_valid_uk_postcode",
    "is_valid_canadian_postal_code",
    "is_valid_german_postal_code",
    "is_valid_us_state",
    "is_valid_geohash",
    "is_valid_plus_code",
    "is_valid_what3words",
    # Distance calculations
    "haversine_distance",
    "is_within_radius",
    # Formatting
    "format_address",
    "format_us_address",
    # Constants
    "US_STATES",
    "POSTAL_PATTERNS",
    "EARTH_RADIUS_METERS",
]
