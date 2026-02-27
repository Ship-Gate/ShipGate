// ============================================================================
// ISL Standard Library - Identifier Types
// @stdlib/ids
// ============================================================================

/**
 * UUID v4 (random)
 * Example: 550e8400-e29b-41d4-a716-446655440000
 */
type UUID = String {
  format: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  length: 36
  generation: random
}

/**
 * UUID v7 (timestamp-based, sortable)
 * Recommended for database primary keys
 */
type UUIDv7 = String {
  format: /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  length: 36
  generation: timestamp_random
  sortable: true
}

/**
 * UUID without dashes (compact form)
 */
type CompactUUID = String {
  format: /^[0-9a-f]{32}$/i
  length: 32
}

/**
 * ULID (Universally Unique Lexicographically Sortable Identifier)
 * 26 characters, timestamp-prefixed, case-insensitive
 * Example: 01ARZ3NDEKTSV4RRFFQ69G5FAV
 */
type ULID = String {
  format: /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i
  length: 26
  sortable: true
  generation: timestamp_random
}

/**
 * KSUID (K-Sortable Unique IDentifier)
 * 27 characters, timestamp-prefixed
 */
type KSUID = String {
  format: /^[0-9A-Za-z]{27}$/
  length: 27
  sortable: true
  generation: timestamp_random
}

/**
 * NanoID (URL-safe unique ID)
 * Default 21 characters
 */
type NanoID = String {
  format: /^[A-Za-z0-9_-]{21}$/
  length: 21
  generation: random
}

/**
 * Configurable-length NanoID
 */
type NanoIDCustom = String {
  format: /^[A-Za-z0-9_-]+$/
  min_length: 10
  max_length: 36
  generation: random
}

/**
 * Short ID for user-facing identifiers
 * URL-safe, 8-12 characters
 * Example: xY7_abc2
 */
type ShortId = String {
  format: /^[A-Za-z0-9_-]{8,12}$/
  min_length: 8
  max_length: 12
  generation: random
}

/**
 * Human-readable short code
 * Excludes ambiguous characters (0, O, l, 1, I)
 * Example: ABC123
 */
type HumanCode = String {
  format: /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/
  length: 6
  generation: random
  charset: unambiguous
}

/**
 * Order/reference number
 * Formatted with prefix and numeric sequence
 * Example: ORD-2024-000123
 */
type OrderNumber = String {
  format: /^[A-Z]{2,5}-\d{4}-\d{6}$/
  generation: sequential
}

/**
 * Invoice number
 * Example: INV-2024-000001
 */
type InvoiceNumber = String {
  format: /^INV-\d{4}-\d{6}$/
  generation: sequential
}

/**
 * Ticket/case number
 * Example: TKT-ABC123
 */
type TicketNumber = String {
  format: /^TKT-[A-Z0-9]{6}$/
  generation: random
}

/**
 * SKU (Stock Keeping Unit)
 * Example: PROD-CAT-001
 */
type SKU = String {
  format: /^[A-Z]{2,10}(-[A-Z0-9]{2,10}){1,4}$/
  max_length: 50
}

/**
 * EAN-13 barcode
 */
type EAN13 = String {
  format: /^\d{13}$/
  length: 13
  validation: ean13_checksum
}

/**
 * UPC-A barcode
 */
type UPCA = String {
  format: /^\d{12}$/
  length: 12
  validation: upc_checksum
}

/**
 * ISBN-13
 */
type ISBN13 = String {
  format: /^97[89]\d{10}$/
  length: 13
  validation: isbn13_checksum
}

/**
 * ISBN-10 (legacy)
 */
type ISBN10 = String {
  format: /^\d{9}[\dX]$/
  length: 10
  validation: isbn10_checksum
}

/**
 * DOI (Digital Object Identifier)
 * Example: 10.1000/xyz123
 */
type DOI = String {
  format: /^10\.\d{4,9}\/[-._;()\/:A-Z0-9]+$/i
  max_length: 256
}

/**
 * ORCID (researcher identifier)
 * Example: 0000-0002-1825-0097
 */
type ORCID = String {
  format: /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/
  length: 19
  validation: orcid_checksum
}

/**
 * Stripe ID format (various prefixes)
 */
type StripeCustomerId = String {
  format: /^cus_[A-Za-z0-9]{14,}$/
}

type StripePaymentIntentId = String {
  format: /^pi_[A-Za-z0-9]{24,}$/
}

type StripeSubscriptionId = String {
  format: /^sub_[A-Za-z0-9]{14,}$/
}

/**
 * AWS ARN (Amazon Resource Name)
 */
type ARN = String {
  format: /^arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:.+$/
  max_length: 2048
}

/**
 * GitHub repository identifier
 * Example: owner/repo
 */
type GitHubRepo = String {
  format: /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}\/[a-zA-Z0-9._-]{1,100}$/
}

/**
 * Docker image reference
 * Example: nginx:latest, registry.io/org/image:tag
 */
type DockerImage = String {
  format: /^(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?::\d+)?\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127})?(?:@sha256:[a-f0-9]{64})?$/
  max_length: 256
}

/**
 * Kubernetes resource name
 * Must be lowercase, alphanumeric, dashes allowed
 */
type K8sName = String {
  format: /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
  max_length: 63
}

/**
 * MongoDB ObjectId
 */
type ObjectId = String {
  format: /^[0-9a-f]{24}$/
  length: 24
}

/**
 * Snowflake ID (Twitter-style)
 * 64-bit integer as string (timestamp + worker + sequence)
 */
type SnowflakeId = String {
  format: /^\d{18,19}$/
  sortable: true
}

/**
 * Cursor-based pagination token
 * Base64-encoded opaque token
 */
type Cursor = String {
  format: /^[A-Za-z0-9_-]+$/
  max_length: 500
  opaque: true
}

/**
 * API key with prefix
 * Example: sk_live_abc123...
 */
type APIKey = String {
  format: /^(sk|pk)_(live|test)_[A-Za-z0-9]{32,}$/
  sensitive: true
}

/**
 * Session token
 */
type SessionToken = String {
  format: /^[A-Za-z0-9_-]{64,128}$/
  sensitive: true
}

/**
 * Refresh token
 */
type RefreshToken = String {
  format: /^[A-Za-z0-9_-]{64,256}$/
  sensitive: true
}
