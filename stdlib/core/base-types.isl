# Core Base Types Module
# Provides fundamental constrained types used across all ISL specs
#
# These types are building blocks — use them in entity fields,
# behavior inputs/outputs, and constraint expressions.

module CoreBaseTypes version "1.0.0"

# ============================================
# String Format Types
# ============================================

type Email = String {
  description: "RFC 5322 email address"
  pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
  max_length: 254
}

type URL = String {
  description: "Fully-qualified URL"
  pattern: "^https?://"
  max_length: 2048
}

type Phone = String {
  description: "E.164 phone number"
  pattern: "^\\+[1-9]\\d{1,14}$"
  max_length: 16
}

type Slug = String {
  description: "URL-safe slug"
  pattern: "^[a-z0-9]+(-[a-z0-9]+)*$"
  min_length: 1
  max_length: 128
}

type Locale = String {
  description: "BCP 47 language tag (e.g., en-US, fr-FR)"
  pattern: "^[a-z]{2}(-[A-Z]{2})?$"
  max_length: 10
}

type CountryCode = String {
  description: "ISO 3166-1 alpha-2 country code"
  length: 2
  pattern: "^[A-Z]{2}$"
}

type IPv4 = String {
  description: "IPv4 address"
  pattern: "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
}

type IPv6 = String {
  description: "IPv6 address"
  max_length: 45
}

type IPAddress = String {
  description: "IPv4 or IPv6 address"
  max_length: 45
}

type SemVer = String {
  description: "Semantic version string"
  pattern: "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.]+)?(\\+[a-zA-Z0-9.]+)?$"
  max_length: 64
}

type MimeType = String {
  description: "IANA media type"
  pattern: "^[a-z]+/[a-z0-9.+\\-]+$"
  max_length: 255
}

# ============================================
# Identifier Types
# ============================================

type UUID = String {
  description: "Universally Unique Identifier (v4/v7)"
  pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
  length: 36
}

type ULID = String {
  description: "Universally Unique Lexicographically Sortable Identifier"
  pattern: "^[0-9A-HJKMNP-TV-Z]{26}$"
  length: 26
}

type CUID = String {
  description: "Collision-resistant Unique Identifier"
  pattern: "^c[a-z0-9]{24,}$"
}

# ============================================
# Temporal Types
# ============================================

type Timestamp = Int {
  description: "Unix timestamp in milliseconds since epoch"
  min: 0
}

type Duration = Int {
  description: "Duration in milliseconds"
  min: 0
}

type DateString = String {
  description: "ISO 8601 date (YYYY-MM-DD)"
  pattern: "^\\d{4}-\\d{2}-\\d{2}$"
  length: 10
}

type TimeString = String {
  description: "ISO 8601 time (HH:MM:SS)"
  pattern: "^\\d{2}:\\d{2}:\\d{2}$"
  length: 8
}

type DateTimeString = String {
  description: "ISO 8601 datetime"
  pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
  max_length: 30
}

type TimeZone = String {
  description: "IANA timezone identifier (e.g., America/New_York)"
  max_length: 64
}

# ============================================
# Monetary Types
# ============================================

type Currency = enum {
  USD
  EUR
  GBP
  CAD
  AUD
  JPY
  CHF
  CNY
  INR
  BRL
}

type Money = Decimal {
  description: "Non-negative monetary amount with 2-decimal precision"
  min: 0
  precision: 2
}

type MonetaryAmount = {
  amount: Money
  currency: Currency
}

# ============================================
# Numeric Types
# ============================================

type Percentage = Decimal {
  description: "Percentage value (0-100)"
  min: 0
  max: 100
  precision: 2
}

type PositiveInt = Int {
  description: "Strictly positive integer"
  min: 1
}

type NonNegativeInt = Int {
  description: "Non-negative integer (zero or positive)"
  min: 0
}

type ByteSize = Int {
  description: "Size in bytes"
  min: 0
}

# ============================================
# Content Types
# ============================================

type Markdown = String {
  description: "Markdown-formatted text"
  max_length: 100000
}

type HTML = String {
  description: "HTML content (sanitized)"
  max_length: 500000
}

type JSON = String {
  description: "Valid JSON string"
  max_length: 1000000
}

# ============================================
# Pagination Types
# ============================================

type PageSize = Int {
  description: "Number of items per page"
  min: 1
  max: 100
  default: 20
}

type PageOffset = Int {
  description: "Offset for pagination"
  min: 0
  default: 0
}

type Cursor = String {
  description: "Opaque cursor for cursor-based pagination"
  max_length: 512
}

type SortDirection = enum {
  ASC
  DESC
}

# ============================================
# Common Entities
# ============================================

entity PageInfo {
  total_count: NonNegativeInt
  page_size: PageSize
  has_next_page: Boolean
  has_previous_page: Boolean
  start_cursor: Cursor?
  end_cursor: Cursor?

  invariants {
    total_count >= 0
    has_next_page implies end_cursor != null
    has_previous_page implies start_cursor != null
  }
}

entity AuditMetadata {
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  created_by: UUID?
  updated_by: UUID?
  version: NonNegativeInt [default: 1]

  invariants {
    updated_at >= created_at
    version >= 1
  }
}

# ============================================
# Constants
# ============================================

const MAX_EMAIL_LENGTH: Int = 254
const MAX_URL_LENGTH: Int = 2048
const MAX_SLUG_LENGTH: Int = 128
const DEFAULT_PAGE_SIZE: Int = 20
const MAX_PAGE_SIZE: Int = 100
