"""
ISL Standard Library - Python Primitives Implementation
@stdlib/primitives
"""

import re
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import (
    Any,
    Generic,
    Literal,
    NewType,
    Optional,
    Tuple,
    TypeVar,
    Union,
)


# ============================================================================
# BRANDED TYPES (NewType for type safety)
# ============================================================================

Email = NewType("Email", str)
Phone = NewType("Phone", str)
URL = NewType("URL", str)
SecureURL = NewType("SecureURL", str)
UUID = NewType("UUID", str)
ULID = NewType("ULID", str)
ShortId = NewType("ShortId", str)
Slug = NewType("Slug", str)
Username = NewType("Username", str)
JWT = NewType("JWT", str)
IPv4 = NewType("IPv4", str)
IPv6 = NewType("IPv6", str)
HexColor = NewType("HexColor", str)
SemVer = NewType("SemVer", str)
CountryCode = NewType("CountryCode", str)
LanguageCode = NewType("LanguageCode", str)
CreditCardNumber = NewType("CreditCardNumber", str)
SHA256 = NewType("SHA256", str)
Base64 = NewType("Base64", str)


# ============================================================================
# REGEX PATTERNS
# ============================================================================

PATTERNS = {
    "EMAIL": re.compile(
        r"^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9]"
        r"(?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
        r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
    ),
    "PHONE_E164": re.compile(r"^\+[1-9]\d{1,14}$"),
    "PHONE_FLEXIBLE": re.compile(
        r"^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$"
    ),
    "URL": re.compile(
        r"^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\."
        r"[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$"
    ),
    "SECURE_URL": re.compile(
        r"^https:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\."
        r"[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$"
    ),
    "UUID_V4": re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        re.IGNORECASE,
    ),
    "UUID_V7": re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        re.IGNORECASE,
    ),
    "ULID": re.compile(r"^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$", re.IGNORECASE),
    "SHORT_ID": re.compile(r"^[A-Za-z0-9_-]{8,12}$"),
    "SLUG": re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$"),
    "USERNAME": re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{2,29}$"),
    "JWT": re.compile(r"^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$"),
    "IPV4": re.compile(
        r"^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}"
        r"(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
    ),
    "IPV6": re.compile(
        r"^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|"
        r"^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|"
        r"^(?:[0-9a-fA-F]{1,4}:){1,7}:$"
    ),
    "HEX_COLOR": re.compile(r"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"),
    "SEMVER": re.compile(
        r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
        r"(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)"
        r"(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
        r"(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
    ),
    "COUNTRY_CODE": re.compile(r"^[A-Z]{2}$"),
    "LANGUAGE_CODE": re.compile(r"^[a-z]{2}$"),
    "CREDIT_CARD": re.compile(r"^\d{13,19}$"),
    "SHA256": re.compile(r"^[a-fA-F0-9]{64}$"),
    "BASE64": re.compile(r"^[A-Za-z0-9+\/]*={0,2}$"),
    "BASE64_URL": re.compile(r"^[A-Za-z0-9_-]*$"),
}


# ============================================================================
# CURRENCY ENUM
# ============================================================================


class Currency(str, Enum):
    """ISO 4217 currency codes."""

    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"
    CHF = "CHF"
    CAD = "CAD"
    AUD = "AUD"
    CNY = "CNY"
    INR = "INR"
    BRL = "BRL"
    MXN = "MXN"
    SGD = "SGD"
    HKD = "HKD"
    KRW = "KRW"
    SEK = "SEK"
    NOK = "NOK"
    NZD = "NZD"
    ZAR = "ZAR"


class CryptoCurrency(str, Enum):
    """Common cryptocurrency codes."""

    BTC = "BTC"
    ETH = "ETH"
    USDT = "USDT"
    USDC = "USDC"
    SOL = "SOL"
    ADA = "ADA"
    DOGE = "DOGE"
    DOT = "DOT"
    MATIC = "MATIC"


# ============================================================================
# MONEY DATACLASS
# ============================================================================


@dataclass(frozen=True)
class Money:
    """Money with decimal precision and currency."""

    amount: Decimal
    currency: Currency

    def __post_init__(self) -> None:
        if self.amount < 0:
            raise ValueError("Money amount cannot be negative")

    @classmethod
    def create(cls, amount: Union[int, float, str, Decimal], currency: Currency) -> "Money":
        """Create money with proper decimal rounding."""
        dec_amount = Decimal(str(amount)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        return cls(amount=dec_amount, currency=currency)


@dataclass(frozen=True)
class SignedMoney:
    """Money that can be negative (for refunds, adjustments)."""

    amount: Decimal
    currency: Currency

    @classmethod
    def create(cls, amount: Union[int, float, str, Decimal], currency: Currency) -> "SignedMoney":
        """Create signed money with proper decimal rounding."""
        dec_amount = Decimal(str(amount)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        return cls(amount=dec_amount, currency=currency)


@dataclass(frozen=True)
class CryptoAmount:
    """Cryptocurrency amount with 8 decimal precision."""

    amount: Decimal
    currency: CryptoCurrency

    @classmethod
    def create(
        cls, amount: Union[int, float, str, Decimal], currency: CryptoCurrency
    ) -> "CryptoAmount":
        """Create crypto amount with proper decimal rounding."""
        dec_amount = Decimal(str(amount)).quantize(
            Decimal("0.00000001"), rounding=ROUND_HALF_UP
        )
        return cls(amount=dec_amount, currency=currency)


# ============================================================================
# VALIDATION FUNCTIONS
# ============================================================================


def is_valid_email(value: str) -> bool:
    """Validate email address format."""
    return bool(PATTERNS["EMAIL"].match(value)) and len(value) <= 254


def is_valid_phone(value: str) -> bool:
    """Validate phone number in E.164 format."""
    return bool(PATTERNS["PHONE_E164"].match(value)) and 8 <= len(value) <= 16


def is_valid_url(value: str) -> bool:
    """Validate HTTP/HTTPS URL."""
    return bool(PATTERNS["URL"].match(value)) and len(value) <= 2048


def is_valid_secure_url(value: str) -> bool:
    """Validate HTTPS URL only."""
    return bool(PATTERNS["SECURE_URL"].match(value)) and len(value) <= 2048


def is_valid_uuid(value: str) -> bool:
    """Validate UUID v4 format."""
    return bool(PATTERNS["UUID_V4"].match(value))


def is_valid_uuid_v7(value: str) -> bool:
    """Validate UUID v7 format."""
    return bool(PATTERNS["UUID_V7"].match(value))


def is_valid_ulid(value: str) -> bool:
    """Validate ULID format."""
    return bool(PATTERNS["ULID"].match(value))


def is_valid_short_id(value: str) -> bool:
    """Validate short ID format (8-12 URL-safe characters)."""
    return bool(PATTERNS["SHORT_ID"].match(value))


def is_valid_slug(value: str) -> bool:
    """Validate URL slug format."""
    return bool(PATTERNS["SLUG"].match(value)) and len(value) <= 100


def is_valid_username(value: str) -> bool:
    """Validate username format."""
    return bool(PATTERNS["USERNAME"].match(value))


def is_valid_jwt(value: str) -> bool:
    """Validate JWT format."""
    return bool(PATTERNS["JWT"].match(value))


def is_valid_ipv4(value: str) -> bool:
    """Validate IPv4 address."""
    return bool(PATTERNS["IPV4"].match(value))


def is_valid_ipv6(value: str) -> bool:
    """Validate IPv6 address."""
    return bool(PATTERNS["IPV6"].match(value))


def is_valid_ip_address(value: str) -> bool:
    """Validate IPv4 or IPv6 address."""
    return is_valid_ipv4(value) or is_valid_ipv6(value)


def is_valid_hex_color(value: str) -> bool:
    """Validate hex color code."""
    return bool(PATTERNS["HEX_COLOR"].match(value))


def is_valid_semver(value: str) -> bool:
    """Validate semantic version."""
    return bool(PATTERNS["SEMVER"].match(value))


def is_valid_country_code(value: str) -> bool:
    """Validate ISO 3166-1 alpha-2 country code."""
    return bool(PATTERNS["COUNTRY_CODE"].match(value))


def is_valid_language_code(value: str) -> bool:
    """Validate ISO 639-1 language code."""
    return bool(PATTERNS["LANGUAGE_CODE"].match(value))


def is_valid_sha256(value: str) -> bool:
    """Validate SHA-256 hash (hex)."""
    return bool(PATTERNS["SHA256"].match(value))


def is_valid_base64(value: str) -> bool:
    """Validate Base64 string."""
    return bool(PATTERNS["BASE64"].match(value))


def is_valid_percentage(value: float) -> bool:
    """Validate percentage (0-100)."""
    return 0 <= value <= 100


# ============================================================================
# LUHN ALGORITHM (Credit Card Validation)
# ============================================================================


def luhn_check(card_number: str) -> bool:
    """Validate credit card number using Luhn algorithm."""
    if not PATTERNS["CREDIT_CARD"].match(card_number):
        return False

    total = 0
    is_even = False

    for digit in reversed(card_number):
        d = int(digit)
        if is_even:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        is_even = not is_even

    return total % 10 == 0


def is_valid_credit_card(value: str) -> bool:
    """Validate credit card number."""
    return luhn_check(value)


# ============================================================================
# MONEY OPERATIONS
# ============================================================================


def add_money(a: Money, b: Money) -> Money:
    """Add two money values (must have same currency)."""
    if a.currency != b.currency:
        raise ValueError(
            f"Cannot add money with different currencies: {a.currency} vs {b.currency}"
        )
    return Money.create(a.amount + b.amount, a.currency)


def subtract_money(a: Money, b: Money) -> SignedMoney:
    """Subtract money values (must have same currency)."""
    if a.currency != b.currency:
        raise ValueError(
            f"Cannot subtract money with different currencies: {a.currency} vs {b.currency}"
        )
    return SignedMoney.create(a.amount - b.amount, a.currency)


def multiply_money(money: Money, factor: float) -> Money:
    """Multiply money by a factor."""
    return Money.create(money.amount * Decimal(str(factor)), money.currency)


def format_money(money: Money) -> str:
    """Format money for display."""
    # Basic formatting, locale-aware formatting would need babel
    symbol_map = {
        Currency.USD: "$",
        Currency.EUR: "€",
        Currency.GBP: "£",
        Currency.JPY: "¥",
    }
    symbol = symbol_map.get(money.currency, money.currency.value + " ")
    return f"{symbol}{money.amount:,.2f}"


# ============================================================================
# RESULT TYPE
# ============================================================================

T = TypeVar("T")
E = TypeVar("E", bound=Exception)


@dataclass
class Ok(Generic[T]):
    """Success result."""

    value: T

    @property
    def ok(self) -> Literal[True]:
        return True


@dataclass
class Err(Generic[E]):
    """Error result."""

    error: E

    @property
    def ok(self) -> Literal[False]:
        return False


Result = Union[Ok[T], Err[E]]


# ============================================================================
# PARSING FUNCTIONS
# ============================================================================


def parse_email(value: str) -> Result[Email, ValueError]:
    """Parse and validate email."""
    if is_valid_email(value):
        return Ok(Email(value))
    return Err(ValueError(f"Invalid email format: {value}"))


def parse_phone(value: str) -> Result[Phone, ValueError]:
    """Parse and validate phone number."""
    if is_valid_phone(value):
        return Ok(Phone(value))
    return Err(ValueError(f"Invalid phone format. Expected E.164: {value}"))


def parse_url(value: str) -> Result[URL, ValueError]:
    """Parse and validate URL."""
    if is_valid_url(value):
        return Ok(URL(value))
    return Err(ValueError(f"Invalid URL format: {value}"))


def parse_uuid(value: str) -> Result[UUID, ValueError]:
    """Parse and validate UUID."""
    if is_valid_uuid(value):
        return Ok(UUID(value))
    return Err(ValueError(f"Invalid UUID format: {value}"))


def parse_ulid(value: str) -> Result[ULID, ValueError]:
    """Parse and validate ULID."""
    if is_valid_ulid(value):
        return Ok(ULID(value))
    return Err(ValueError(f"Invalid ULID format: {value}"))


def parse_money(
    amount: Any, currency: str
) -> Result[Money, ValueError]:
    """Parse and validate money."""
    try:
        curr = Currency(currency)
    except ValueError:
        return Err(ValueError(f"Invalid currency: {currency}"))

    try:
        return Ok(Money.create(amount, curr))
    except (ValueError, TypeError) as e:
        return Err(ValueError(f"Invalid money amount: {e}"))


# ============================================================================
# PERCENTAGE OPERATIONS
# ============================================================================


def percentage_to_decimal(percentage: float) -> float:
    """Convert percentage to decimal (50 -> 0.5)."""
    return percentage / 100


def decimal_to_percentage(decimal: float) -> float:
    """Convert decimal to percentage (0.5 -> 50)."""
    return decimal * 100


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    # Types
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
    # Enums
    "Currency",
    "CryptoCurrency",
    # Classes
    "Money",
    "SignedMoney",
    "CryptoAmount",
    "Ok",
    "Err",
    "Result",
    # Validation
    "is_valid_email",
    "is_valid_phone",
    "is_valid_url",
    "is_valid_secure_url",
    "is_valid_uuid",
    "is_valid_uuid_v7",
    "is_valid_ulid",
    "is_valid_short_id",
    "is_valid_slug",
    "is_valid_username",
    "is_valid_jwt",
    "is_valid_ipv4",
    "is_valid_ipv6",
    "is_valid_ip_address",
    "is_valid_hex_color",
    "is_valid_semver",
    "is_valid_country_code",
    "is_valid_language_code",
    "is_valid_credit_card",
    "is_valid_sha256",
    "is_valid_base64",
    "is_valid_percentage",
    "luhn_check",
    # Money operations
    "add_money",
    "subtract_money",
    "multiply_money",
    "format_money",
    # Parsing
    "parse_email",
    "parse_phone",
    "parse_url",
    "parse_uuid",
    "parse_ulid",
    "parse_money",
    # Percentage
    "percentage_to_decimal",
    "decimal_to_percentage",
    # Constants
    "PATTERNS",
]
