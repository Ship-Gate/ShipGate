"""
ISL Standard Library - Python Identifier Implementation
@stdlib/ids
"""

import os
import re
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import NewType, Optional


# ============================================================================
# BRANDED TYPES
# ============================================================================

UUID = NewType("UUID", str)
UUIDv7 = NewType("UUIDv7", str)
CompactUUID = NewType("CompactUUID", str)
ULID = NewType("ULID", str)
KSUID = NewType("KSUID", str)
NanoID = NewType("NanoID", str)
ShortId = NewType("ShortId", str)
ObjectId = NewType("ObjectId", str)
SnowflakeId = NewType("SnowflakeId", str)


# ============================================================================
# REGEX PATTERNS
# ============================================================================

ID_PATTERNS = {
    "UUID_V4": re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        re.IGNORECASE,
    ),
    "UUID_V7": re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        re.IGNORECASE,
    ),
    "UUID_ANY": re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        re.IGNORECASE,
    ),
    "COMPACT_UUID": re.compile(r"^[0-9a-f]{32}$", re.IGNORECASE),
    "ULID": re.compile(r"^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$", re.IGNORECASE),
    "KSUID": re.compile(r"^[0-9A-Za-z]{27}$"),
    "NANO_ID": re.compile(r"^[A-Za-z0-9_-]{21}$"),
    "SHORT_ID": re.compile(r"^[A-Za-z0-9_-]{8,12}$"),
    "HUMAN_CODE": re.compile(r"^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$"),
    "OBJECT_ID": re.compile(r"^[0-9a-f]{24}$"),
    "SNOWFLAKE": re.compile(r"^\d{18,19}$"),
    "EAN13": re.compile(r"^\d{13}$"),
    "UPC_A": re.compile(r"^\d{12}$"),
    "ISBN13": re.compile(r"^97[89]\d{10}$"),
    "ISBN10": re.compile(r"^\d{9}[\dX]$"),
    "DOI": re.compile(r"^10\.\d{4,9}\/[-._;()\/:A-Z0-9]+$", re.IGNORECASE),
    "ORCID": re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$"),
    "STRIPE_CUSTOMER": re.compile(r"^cus_[A-Za-z0-9]{14,}$"),
    "STRIPE_PAYMENT_INTENT": re.compile(r"^pi_[A-Za-z0-9]{24,}$"),
    "STRIPE_SUBSCRIPTION": re.compile(r"^sub_[A-Za-z0-9]{14,}$"),
    "ARN": re.compile(r"^arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:.+$"),
    "GITHUB_REPO": re.compile(
        r"^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}\/[a-zA-Z0-9._-]{1,100}$"
    ),
    "K8S_NAME": re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$"),
    "API_KEY": re.compile(r"^(sk|pk)_(live|test)_[A-Za-z0-9]{32,}$"),
}


# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================


def is_valid_uuid(value: str) -> bool:
    """Validate UUID v4 format."""
    return bool(ID_PATTERNS["UUID_V4"].match(value))


def is_valid_uuid_v7(value: str) -> bool:
    """Validate UUID v7 format."""
    return bool(ID_PATTERNS["UUID_V7"].match(value))


def is_valid_uuid_any(value: str) -> bool:
    """Validate any UUID format."""
    return bool(ID_PATTERNS["UUID_ANY"].match(value))


def is_valid_compact_uuid(value: str) -> bool:
    """Validate compact UUID format (no dashes)."""
    return bool(ID_PATTERNS["COMPACT_UUID"].match(value))


def is_valid_ulid(value: str) -> bool:
    """Validate ULID format."""
    return bool(ID_PATTERNS["ULID"].match(value))


def is_valid_ksuid(value: str) -> bool:
    """Validate KSUID format."""
    return bool(ID_PATTERNS["KSUID"].match(value))


def is_valid_nano_id(value: str) -> bool:
    """Validate NanoID format."""
    return bool(ID_PATTERNS["NANO_ID"].match(value))


def is_valid_short_id(value: str) -> bool:
    """Validate short ID format."""
    return bool(ID_PATTERNS["SHORT_ID"].match(value))


def is_valid_human_code(value: str) -> bool:
    """Validate human-readable code format."""
    return bool(ID_PATTERNS["HUMAN_CODE"].match(value))


def is_valid_object_id(value: str) -> bool:
    """Validate MongoDB ObjectId format."""
    return bool(ID_PATTERNS["OBJECT_ID"].match(value))


def is_valid_snowflake_id(value: str) -> bool:
    """Validate Snowflake ID format."""
    return bool(ID_PATTERNS["SNOWFLAKE"].match(value))


# ============================================================================
# BARCODE / PRODUCT ID VALIDATION
# ============================================================================


def _validate_ean13_checksum(code: str) -> bool:
    """Validate EAN-13 checksum."""
    total = sum(
        int(code[i]) * (1 if i % 2 == 0 else 3) for i in range(12)
    )
    check_digit = (10 - (total % 10)) % 10
    return check_digit == int(code[12])


def _validate_upc_a_checksum(code: str) -> bool:
    """Validate UPC-A checksum."""
    total = sum(
        int(code[i]) * (3 if i % 2 == 0 else 1) for i in range(11)
    )
    check_digit = (10 - (total % 10)) % 10
    return check_digit == int(code[11])


def _validate_isbn10_checksum(code: str) -> bool:
    """Validate ISBN-10 checksum."""
    total = sum(int(code[i]) * (10 - i) for i in range(9))
    last_char = code[9]
    last_value = 10 if last_char == "X" else int(last_char)
    total += last_value
    return total % 11 == 0


def _validate_orcid_checksum(orcid: str) -> bool:
    """Validate ORCID checksum."""
    digits = orcid.replace("-", "")
    total = 0
    for i in range(15):
        total = (total + int(digits[i])) * 2
    remainder = total % 11
    check_digit = (12 - remainder) % 11
    expected = "X" if check_digit == 10 else str(check_digit)
    return digits[15] == expected


def is_valid_ean13(value: str) -> bool:
    """Validate EAN-13 barcode."""
    if not ID_PATTERNS["EAN13"].match(value):
        return False
    return _validate_ean13_checksum(value)


def is_valid_upc_a(value: str) -> bool:
    """Validate UPC-A barcode."""
    if not ID_PATTERNS["UPC_A"].match(value):
        return False
    return _validate_upc_a_checksum(value)


def is_valid_isbn13(value: str) -> bool:
    """Validate ISBN-13."""
    if not ID_PATTERNS["ISBN13"].match(value):
        return False
    return _validate_ean13_checksum(value)


def is_valid_isbn10(value: str) -> bool:
    """Validate ISBN-10."""
    if not ID_PATTERNS["ISBN10"].match(value):
        return False
    return _validate_isbn10_checksum(value)


def is_valid_doi(value: str) -> bool:
    """Validate DOI."""
    return bool(ID_PATTERNS["DOI"].match(value))


def is_valid_orcid(value: str) -> bool:
    """Validate ORCID."""
    if not ID_PATTERNS["ORCID"].match(value):
        return False
    return _validate_orcid_checksum(value)


# ============================================================================
# SERVICE-SPECIFIC VALIDATORS
# ============================================================================


def is_valid_stripe_customer_id(value: str) -> bool:
    """Validate Stripe customer ID."""
    return bool(ID_PATTERNS["STRIPE_CUSTOMER"].match(value))


def is_valid_stripe_payment_intent_id(value: str) -> bool:
    """Validate Stripe payment intent ID."""
    return bool(ID_PATTERNS["STRIPE_PAYMENT_INTENT"].match(value))


def is_valid_stripe_subscription_id(value: str) -> bool:
    """Validate Stripe subscription ID."""
    return bool(ID_PATTERNS["STRIPE_SUBSCRIPTION"].match(value))


def is_valid_arn(value: str) -> bool:
    """Validate AWS ARN."""
    return bool(ID_PATTERNS["ARN"].match(value))


def is_valid_github_repo(value: str) -> bool:
    """Validate GitHub repo identifier."""
    return bool(ID_PATTERNS["GITHUB_REPO"].match(value))


def is_valid_k8s_name(value: str) -> bool:
    """Validate Kubernetes resource name."""
    return bool(ID_PATTERNS["K8S_NAME"].match(value))


def is_valid_api_key(value: str) -> bool:
    """Validate API key format."""
    return bool(ID_PATTERNS["API_KEY"].match(value))


# ============================================================================
# UUID GENERATION
# ============================================================================


def generate_uuid() -> UUID:
    """Generate UUID v4."""
    import uuid as uuid_module

    return UUID(str(uuid_module.uuid4()))


# ============================================================================
# ULID GENERATION
# ============================================================================

ULID_ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def generate_ulid() -> ULID:
    """Generate ULID."""
    timestamp = int(time.time() * 1000)

    # Encode timestamp (first 10 characters)
    timestamp_part = ""
    t = timestamp
    for _ in range(10):
        timestamp_part = ULID_ENCODING[t % 32] + timestamp_part
        t //= 32

    # Generate random bytes for randomness part
    random_bytes = secrets.token_bytes(10)
    random_part = ""
    for b in random_bytes:
        random_part += ULID_ENCODING[b % 32]
    random_part = random_part[:16]

    return ULID(timestamp_part + random_part)


# ============================================================================
# SHORT ID GENERATION
# ============================================================================

SHORT_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"
HUMAN_CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def generate_short_id(length: int = 10) -> ShortId:
    """Generate short ID."""
    if not 8 <= length <= 12:
        raise ValueError("ShortId length must be between 8 and 12")

    return ShortId("".join(secrets.choice(SHORT_ID_CHARS) for _ in range(length)))


def generate_human_code(length: int = 6) -> str:
    """Generate human-readable code (no ambiguous characters)."""
    return "".join(secrets.choice(HUMAN_CODE_CHARS) for _ in range(length))


# ============================================================================
# UUID UTILITIES
# ============================================================================


def uuid_to_compact(uuid: UUID) -> CompactUUID:
    """Convert UUID to compact form (no dashes)."""
    return CompactUUID(uuid.replace("-", "").lower())


def compact_to_uuid(compact: CompactUUID) -> UUID:
    """Convert compact UUID to standard form."""
    h = compact.lower()
    return UUID(f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}")


def uuid_to_bytes(uuid: UUID) -> bytes:
    """Convert UUID to bytes."""
    hex_str = uuid.replace("-", "")
    return bytes.fromhex(hex_str)


def bytes_to_uuid(b: bytes) -> UUID:
    """Convert bytes to UUID."""
    if len(b) != 16:
        raise ValueError("UUID must be 16 bytes")
    h = b.hex()
    return UUID(f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}")


# ============================================================================
# ULID UTILITIES
# ============================================================================


def ulid_to_timestamp(ulid: ULID) -> int:
    """Extract timestamp from ULID (milliseconds)."""
    timestamp = 0
    for i in range(10):
        timestamp = timestamp * 32 + ULID_ENCODING.index(ulid[i].upper())
    return timestamp


def ulid_to_datetime(ulid: ULID) -> datetime:
    """Extract datetime from ULID."""
    ts = ulid_to_timestamp(ulid)
    return datetime.fromtimestamp(ts / 1000, tz=timezone.utc)


# ============================================================================
# SNOWFLAKE ID UTILITIES
# ============================================================================

# Discord-style snowflake epoch (2015-01-01)
SNOWFLAKE_EPOCH = 1420070400000


def snowflake_to_timestamp(snowflake: SnowflakeId) -> int:
    """Extract timestamp from Snowflake ID (milliseconds)."""
    return (int(snowflake) >> 22) + SNOWFLAKE_EPOCH


def snowflake_to_datetime(snowflake: SnowflakeId) -> datetime:
    """Extract datetime from Snowflake ID."""
    ts = snowflake_to_timestamp(snowflake)
    return datetime.fromtimestamp(ts / 1000, tz=timezone.utc)


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    # Types
    "UUID",
    "UUIDv7",
    "CompactUUID",
    "ULID",
    "KSUID",
    "NanoID",
    "ShortId",
    "ObjectId",
    "SnowflakeId",
    # Validation
    "is_valid_uuid",
    "is_valid_uuid_v7",
    "is_valid_uuid_any",
    "is_valid_compact_uuid",
    "is_valid_ulid",
    "is_valid_ksuid",
    "is_valid_nano_id",
    "is_valid_short_id",
    "is_valid_human_code",
    "is_valid_object_id",
    "is_valid_snowflake_id",
    "is_valid_ean13",
    "is_valid_upc_a",
    "is_valid_isbn13",
    "is_valid_isbn10",
    "is_valid_doi",
    "is_valid_orcid",
    "is_valid_stripe_customer_id",
    "is_valid_stripe_payment_intent_id",
    "is_valid_stripe_subscription_id",
    "is_valid_arn",
    "is_valid_github_repo",
    "is_valid_k8s_name",
    "is_valid_api_key",
    # Generation
    "generate_uuid",
    "generate_ulid",
    "generate_short_id",
    "generate_human_code",
    # UUID utilities
    "uuid_to_compact",
    "compact_to_uuid",
    "uuid_to_bytes",
    "bytes_to_uuid",
    # ULID utilities
    "ulid_to_timestamp",
    "ulid_to_datetime",
    # Snowflake utilities
    "snowflake_to_timestamp",
    "snowflake_to_datetime",
    # Constants
    "ID_PATTERNS",
    "ULID_ENCODING",
    "SNOWFLAKE_EPOCH",
]
