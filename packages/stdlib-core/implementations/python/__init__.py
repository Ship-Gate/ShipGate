"""
ISL Standard Library - Python Entry Point
@stdlib/core
"""

from .primitives import (
    # Types
    Email,
    Phone,
    URL,
    SecureURL,
    UUID,
    ULID,
    ShortId,
    Slug,
    Username,
    JWT,
    IPv4,
    IPv6,
    HexColor,
    SemVer,
    CountryCode,
    LanguageCode,
    CreditCardNumber,
    SHA256,
    Base64,
    # Enums
    Currency,
    CryptoCurrency,
    # Classes
    Money,
    SignedMoney,
    CryptoAmount,
    Ok,
    Err,
    Result,
    # Validation
    is_valid_email,
    is_valid_phone,
    is_valid_url,
    is_valid_secure_url,
    is_valid_uuid,
    is_valid_uuid_v7,
    is_valid_ulid,
    is_valid_short_id,
    is_valid_slug,
    is_valid_username,
    is_valid_jwt,
    is_valid_ipv4,
    is_valid_ipv6,
    is_valid_ip_address,
    is_valid_hex_color,
    is_valid_semver,
    is_valid_country_code,
    is_valid_language_code,
    is_valid_credit_card,
    is_valid_sha256,
    is_valid_base64,
    is_valid_percentage,
    luhn_check,
    # Money operations
    add_money,
    subtract_money,
    multiply_money,
    format_money,
    # Parsing
    parse_email,
    parse_phone,
    parse_url,
    parse_uuid,
    parse_ulid,
    parse_money,
    # Percentage
    percentage_to_decimal,
    decimal_to_percentage,
    # Constants
    PATTERNS,
)

from .time import (
    # Enums
    TimeUnit,
    DayOfWeek,
    Month,
    # Classes
    Duration,
    DateRange,
    DateTimeRange,
    TimeOfDay,
    # Duration factories
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
    # Validation
    is_valid_iso_date,
    is_valid_iso_time,
    is_valid_iso_datetime,
    is_valid_utc_offset,
    is_valid_cron_expression,
    is_valid_timezone,
    # Timestamp helpers
    now_unix_timestamp,
    now_unix_timestamp_ms,
    from_unix_timestamp,
    from_unix_timestamp_ms,
    to_unix_timestamp,
    to_unix_timestamp_ms,
    # Formatting
    format_duration,
    format_duration_long,
    # Constants
    DATE_PATTERNS,
)

from .geo import (
    # Enums
    DistanceUnit,
    # Classes
    Coordinates,
    Distance,
    BoundingBox,
    GeoCircle,
    GeoPolygon,
    Address,
    USAddress,
    SimpleAddress,
    Location,
    ShippingAddress,
    BillingAddress,
    # Distance factories
    meters,
    kilometers,
    miles,
    feet,
    # Validation
    is_valid_latitude,
    is_valid_longitude,
    is_valid_coordinates,
    is_valid_us_zip_code,
    is_valid_uk_postcode,
    is_valid_canadian_postal_code,
    is_valid_german_postal_code,
    is_valid_us_state,
    is_valid_geohash,
    is_valid_plus_code,
    is_valid_what3words,
    # Distance calculations
    haversine_distance,
    is_within_radius,
    # Formatting
    format_address,
    format_us_address,
    # Constants
    US_STATES,
    POSTAL_PATTERNS,
    EARTH_RADIUS_METERS,
)

from .ids import (
    # Types (re-export with aliases to avoid conflicts)
    UUID as UUIDType,
    CompactUUID,
    ULID as ULIDType,
    KSUID,
    NanoID,
    ShortId as ShortIdType,
    ObjectId,
    SnowflakeId,
    # Validation
    is_valid_uuid_any,
    is_valid_compact_uuid,
    is_valid_ksuid,
    is_valid_nano_id,
    is_valid_human_code,
    is_valid_object_id,
    is_valid_snowflake_id,
    is_valid_ean13,
    is_valid_upc_a,
    is_valid_isbn13,
    is_valid_isbn10,
    is_valid_doi,
    is_valid_orcid,
    is_valid_stripe_customer_id,
    is_valid_stripe_payment_intent_id,
    is_valid_stripe_subscription_id,
    is_valid_arn,
    is_valid_github_repo,
    is_valid_k8s_name,
    is_valid_api_key,
    # Generation
    generate_uuid,
    generate_ulid,
    generate_short_id,
    generate_human_code,
    # UUID utilities
    uuid_to_compact,
    compact_to_uuid,
    uuid_to_bytes,
    bytes_to_uuid,
    # ULID utilities
    ulid_to_timestamp,
    ulid_to_datetime,
    # Snowflake utilities
    snowflake_to_timestamp,
    snowflake_to_datetime,
    # Constants
    ID_PATTERNS,
    ULID_ENCODING,
    SNOWFLAKE_EPOCH,
)


__version__ = "0.1.0"

__all__ = [
    # Version
    "__version__",
    # Primitives
    "Email",
    "Phone",
    "URL",
    "SecureURL",
    "UUID",
    "ULID",
    "ShortId",
    "Slug",
    "Username",
    "JWT",
    "IPv4",
    "IPv6",
    "HexColor",
    "SemVer",
    "CountryCode",
    "LanguageCode",
    "CreditCardNumber",
    "SHA256",
    "Base64",
    "Currency",
    "CryptoCurrency",
    "Money",
    "SignedMoney",
    "CryptoAmount",
    "Ok",
    "Err",
    "Result",
    # Time
    "TimeUnit",
    "DayOfWeek",
    "Month",
    "Duration",
    "DateRange",
    "DateTimeRange",
    "TimeOfDay",
    # Geo
    "DistanceUnit",
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
    # IDs
    "CompactUUID",
    "KSUID",
    "NanoID",
    "ObjectId",
    "SnowflakeId",
]
