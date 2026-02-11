/**
 * @packageDocumentation
 * @isl-lang/stdlib-core/ids
 */

// ============================================================================
// BRANDED TYPES
// ============================================================================

declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type UUID = Brand<string, 'UUID'>;
export type UUIDv7 = Brand<string, 'UUIDv7'>;
export type CompactUUID = Brand<string, 'CompactUUID'>;
export type ULID = Brand<string, 'ULID'>;
export type KSUID = Brand<string, 'KSUID'>;
export type NanoID = Brand<string, 'NanoID'>;
export type NanoIDCustom = Brand<string, 'NanoIDCustom'>;
export type ShortId = Brand<string, 'ShortId'>;
export type HumanCode = Brand<string, 'HumanCode'>;
export type OrderNumber = Brand<string, 'OrderNumber'>;
export type InvoiceNumber = Brand<string, 'InvoiceNumber'>;
export type TicketNumber = Brand<string, 'TicketNumber'>;
export type SKU = Brand<string, 'SKU'>;
export type EAN13 = Brand<string, 'EAN13'>;
export type UPCA = Brand<string, 'UPCA'>;
export type ISBN13 = Brand<string, 'ISBN13'>;
export type ISBN10 = Brand<string, 'ISBN10'>;
export type DOI = Brand<string, 'DOI'>;
export type ORCID = Brand<string, 'ORCID'>;
export type StripeCustomerId = Brand<string, 'StripeCustomerId'>;
export type StripePaymentIntentId = Brand<string, 'StripePaymentIntentId'>;
export type StripeSubscriptionId = Brand<string, 'StripeSubscriptionId'>;
export type ARN = Brand<string, 'ARN'>;
export type GitHubRepo = Brand<string, 'GitHubRepo'>;
export type DockerImage = Brand<string, 'DockerImage'>;
export type K8sName = Brand<string, 'K8sName'>;
export type ObjectId = Brand<string, 'ObjectId'>;
export type SnowflakeId = Brand<string, 'SnowflakeId'>;
export type Cursor = Brand<string, 'Cursor'>;
export type APIKey = Brand<string, 'APIKey'>;
export type SessionToken = Brand<string, 'SessionToken'>;
export type RefreshToken = Brand<string, 'RefreshToken'>;

// ============================================================================
// REGEX PATTERNS
// ============================================================================

export const ID_PATTERNS = {
  UUID_V4: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  UUID_V7: /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  UUID_ANY: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  COMPACT_UUID: /^[0-9a-f]{32}$/i,
  ULID: /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i,
  KSUID: /^[0-9A-Za-z]{27}$/,
  NANO_ID: /^[A-Za-z0-9_-]{21}$/,
  NANO_ID_CUSTOM: /^[A-Za-z0-9_-]+$/,
  SHORT_ID: /^[A-Za-z0-9_-]{8,12}$/,
  HUMAN_CODE: /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/,
  ORDER_NUMBER: /^[A-Z]{2,5}-\d{4}-\d{6}$/,
  INVOICE_NUMBER: /^INV-\d{4}-\d{6}$/,
  TICKET_NUMBER: /^TKT-[A-Z0-9]{6}$/,
  SKU: /^[A-Z]{2,10}(-[A-Z0-9]{2,10}){1,4}$/,
  EAN13: /^\d{13}$/,
  UPC_A: /^\d{12}$/,
  ISBN13: /^97[89]\d{10}$/,
  ISBN10: /^\d{9}[\dX]$/,
  DOI: /^10\.\d{4,9}\/[-._;()\/:A-Z0-9]+$/i,
  ORCID: /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/,
  STRIPE_CUSTOMER: /^cus_[A-Za-z0-9]{14,}$/,
  STRIPE_PAYMENT_INTENT: /^pi_[A-Za-z0-9]{24,}$/,
  STRIPE_SUBSCRIPTION: /^sub_[A-Za-z0-9]{14,}$/,
  ARN: /^arn:aws:[a-z0-9-]+:[a-z0-9-]*:(?:\d{12})?:.+$/,
  GITHUB_REPO: /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}\/[a-zA-Z0-9._-]{1,100}$/,
  DOCKER_IMAGE: /^(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?::\d+)?\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127})?(?:@sha256:[a-f0-9]{64})?$/,
  K8S_NAME: /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/,
  OBJECT_ID: /^[0-9a-f]{24}$/i,
  SNOWFLAKE: /^\d{18,19}$/,
  CURSOR: /^[A-Za-z0-9_-]+$/,
  API_KEY: /^(sk|pk)_(live|test)_[A-Za-z0-9]{32,}$/,
  SESSION_TOKEN: /^[A-Za-z0-9_-]{64,128}$/,
  REFRESH_TOKEN: /^[A-Za-z0-9_-]{64,256}$/,
} as const;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export function isValidUUID(value: string): value is UUID {
  return ID_PATTERNS.UUID_V4.test(value);
}

export function isValidUUIDv7(value: string): value is UUIDv7 {
  return ID_PATTERNS.UUID_V7.test(value);
}

export function isValidUUIDAny(value: string): boolean {
  return ID_PATTERNS.UUID_ANY.test(value);
}

export function isValidCompactUUID(value: string): value is CompactUUID {
  return ID_PATTERNS.COMPACT_UUID.test(value);
}

export function isValidULID(value: string): value is ULID {
  return ID_PATTERNS.ULID.test(value);
}

export function isValidKSUID(value: string): value is KSUID {
  return ID_PATTERNS.KSUID.test(value);
}

export function isValidNanoID(value: string): value is NanoID {
  return ID_PATTERNS.NANO_ID.test(value);
}

export function isValidNanoIDCustom(value: string): value is NanoIDCustom {
  return ID_PATTERNS.NANO_ID_CUSTOM.test(value) && value.length >= 10 && value.length <= 36;
}

export function isValidShortId(value: string): value is ShortId {
  return ID_PATTERNS.SHORT_ID.test(value);
}

export function isValidHumanCode(value: string): value is HumanCode {
  return ID_PATTERNS.HUMAN_CODE.test(value);
}

export function isValidOrderNumber(value: string): value is OrderNumber {
  return ID_PATTERNS.ORDER_NUMBER.test(value);
}

export function isValidInvoiceNumber(value: string): value is InvoiceNumber {
  return ID_PATTERNS.INVOICE_NUMBER.test(value);
}

export function isValidTicketNumber(value: string): value is TicketNumber {
  return ID_PATTERNS.TICKET_NUMBER.test(value);
}

export function isValidSKU(value: string): value is SKU {
  return ID_PATTERNS.SKU.test(value) && value.length <= 50;
}

export function isValidObjectId(value: string): value is ObjectId {
  return ID_PATTERNS.OBJECT_ID.test(value);
}

export function isValidSnowflakeId(value: string): value is SnowflakeId {
  return ID_PATTERNS.SNOWFLAKE.test(value);
}

export function isValidCursor(value: string): value is Cursor {
  return ID_PATTERNS.CURSOR.test(value) && value.length <= 500;
}

export function isValidAPIKey(value: string): value is APIKey {
  return ID_PATTERNS.API_KEY.test(value);
}

export function isValidSessionToken(value: string): value is SessionToken {
  return ID_PATTERNS.SESSION_TOKEN.test(value);
}

export function isValidRefreshToken(value: string): value is RefreshToken {
  return ID_PATTERNS.REFRESH_TOKEN.test(value);
}

// ============================================================================
// BARCODE / PRODUCT ID VALIDATION
// ============================================================================

export function isValidEAN13(value: string): value is EAN13 {
  if (!ID_PATTERNS.EAN13.test(value)) return false;
  return validateEAN13Checksum(value);
}

export function isValidUPCA(value: string): value is UPCA {
  if (!ID_PATTERNS.UPC_A.test(value)) return false;
  return validateUPCAChecksum(value);
}

export function isValidISBN13(value: string): value is ISBN13 {
  if (!ID_PATTERNS.ISBN13.test(value)) return false;
  return validateISBN13Checksum(value);
}

export function isValidISBN10(value: string): value is ISBN10 {
  if (!ID_PATTERNS.ISBN10.test(value)) return false;
  return validateISBN10Checksum(value);
}

function validateEAN13Checksum(code: string): boolean {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code.charAt(i), 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(code.charAt(12), 10);
}

function validateUPCAChecksum(code: string): boolean {
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += parseInt(code.charAt(i), 10) * (i % 2 === 0 ? 3 : 1);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(code.charAt(11), 10);
}

function validateISBN13Checksum(code: string): boolean {
  return validateEAN13Checksum(code);
}

function validateISBN10Checksum(code: string): boolean {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(code.charAt(i), 10) * (10 - i);
  }
  const lastChar = code.charAt(9);
  const lastValue = lastChar === 'X' ? 10 : parseInt(lastChar, 10);
  sum += lastValue;
  return sum % 11 === 0;
}

// ============================================================================
// SERVICE-SPECIFIC VALIDATORS
// ============================================================================

export function isValidDOI(value: string): value is DOI {
  return ID_PATTERNS.DOI.test(value) && value.length <= 256;
}

export function isValidORCID(value: string): value is ORCID {
  if (!ID_PATTERNS.ORCID.test(value)) return false;
  return validateORCIDChecksum(value);
}

function validateORCIDChecksum(orcid: string): boolean {
  const digits = orcid.replace(/-/g, '');
  let total = 0;
  for (let i = 0; i < 15; i++) {
    total = (total + parseInt(digits.charAt(i), 10)) * 2;
  }
  const remainder = total % 11;
  const checkDigit = (12 - remainder) % 11;
  const expected = checkDigit === 10 ? 'X' : checkDigit.toString();
  return digits.charAt(15) === expected;
}

export function isValidStripeCustomerId(value: string): value is StripeCustomerId {
  return ID_PATTERNS.STRIPE_CUSTOMER.test(value);
}

export function isValidStripePaymentIntentId(value: string): value is StripePaymentIntentId {
  return ID_PATTERNS.STRIPE_PAYMENT_INTENT.test(value);
}

export function isValidStripeSubscriptionId(value: string): value is StripeSubscriptionId {
  return ID_PATTERNS.STRIPE_SUBSCRIPTION.test(value);
}

export function isValidARN(value: string): value is ARN {
  return ID_PATTERNS.ARN.test(value) && value.length <= 2048;
}

export function isValidGitHubRepo(value: string): value is GitHubRepo {
  return ID_PATTERNS.GITHUB_REPO.test(value);
}

export function isValidDockerImage(value: string): value is DockerImage {
  return ID_PATTERNS.DOCKER_IMAGE.test(value) && value.length <= 256;
}

export function isValidK8sName(value: string): value is K8sName {
  return ID_PATTERNS.K8S_NAME.test(value);
}

// ============================================================================
// UUID GENERATION (v4)
// ============================================================================

export function generateUUID(): UUID {
  // Use crypto.randomUUID if available (Node.js 19+ / modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID() as UUID;
  }
  
  // Fallback implementation
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  
  // Set version (4) and variant (RFC4122)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as UUID;
}

// ============================================================================
// ULID GENERATION
// ============================================================================

const ULID_ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let _ulidLastTs = 0;
let _ulidSameMsCounter = 0;

export function generateULID(): ULID {
  const timestamp = Date.now();

  if (timestamp !== _ulidLastTs) {
    _ulidLastTs = timestamp;
    _ulidSameMsCounter = 0;
  }

  // Encode timestamp (first 10 characters)
  let timestampPart = '';
  let t = timestamp;
  for (let i = 0; i < 10; i++) {
    timestampPart = ULID_ENCODING[t % 32] + timestampPart;
    t = Math.floor(t / 32);
  }

  // Encode counter (0, 1, 2, ...) so ULIDs in same ms sort monotonically
  let n = _ulidSameMsCounter;
  let randomPart = '';
  for (let i = 0; i < 16; i++) {
    randomPart = ULID_ENCODING[n % 32] + randomPart;
    n = Math.floor(n / 32);
  }
  _ulidSameMsCounter += 1;
  return (timestampPart + randomPart) as ULID;
}

// ============================================================================
// SHORT ID GENERATION
// ============================================================================

const SHORT_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const HUMAN_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateShortId(length: number = 10): ShortId {
  if (length < 8 || length > 12) {
    throw new Error('ShortId length must be between 8 and 12');
  }
  
  let result = '';
  const bytes = new Uint8Array(length);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  
  for (let i = 0; i < length; i++) {
    result += SHORT_ID_CHARS[bytes[i]! % SHORT_ID_CHARS.length];
  }
  
  return result as ShortId;
}

export function generateNanoID(length: number = 21): NanoID {
  if (length < 10 || length > 36) {
    throw new Error('NanoID length must be between 10 and 36');
  }
  
  let result = '';
  const bytes = new Uint8Array(length);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  
  for (let i = 0; i < length; i++) {
    result += SHORT_ID_CHARS[bytes[i]! % SHORT_ID_CHARS.length];
  }
  
  return result as NanoID;
}

export function generateHumanCode(length: number = 6): HumanCode {
  let result = '';
  const bytes = new Uint8Array(length);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  
  for (let i = 0; i < length; i++) {
    result += HUMAN_CODE_CHARS[bytes[i]! % HUMAN_CODE_CHARS.length];
  }
  
  return result as HumanCode;
}

// ============================================================================
// UUID UTILITIES
// ============================================================================

export function uuidToCompact(uuid: UUID): CompactUUID {
  return uuid.replace(/-/g, '').toLowerCase() as CompactUUID;
}

export function compactToUUID(compact: CompactUUID): UUID {
  const hex = compact.toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as UUID;
}

export function uuidToBytes(uuid: UUID): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToUUID(bytes: Uint8Array): UUID {
  if (bytes.length !== 16) {
    throw new Error('UUID must be 16 bytes');
  }
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as UUID;
}

// ============================================================================
// ULID UTILITIES
// ============================================================================

export function ulidToTimestamp(ulid: ULID): number {
  let timestamp = 0;
  for (let i = 0; i < 10; i++) {
    timestamp = timestamp * 32 + ULID_ENCODING.indexOf(ulid.charAt(i).toUpperCase());
  }
  return timestamp;
}

export function ulidToDate(ulid: ULID): Date {
  return new Date(ulidToTimestamp(ulid));
}

// ============================================================================
// SNOWFLAKE ID UTILITIES
// ============================================================================

// Discord-style snowflake epoch (2015-01-01)
const SNOWFLAKE_EPOCH = 1420070400000n;

export function snowflakeToTimestamp(snowflake: SnowflakeId): number {
  const id = BigInt(snowflake);
  const timestamp = Number((id >> 22n) + SNOWFLAKE_EPOCH);
  return timestamp;
}

export function snowflakeToDate(snowflake: SnowflakeId): Date {
  return new Date(snowflakeToTimestamp(snowflake));
}

// ============================================================================
// EXPORTS
// ============================================================================

export const Ids = {
  // Validation
  isValidUUID,
  isValidUUIDv7,
  isValidUUIDAny,
  isValidCompactUUID,
  isValidULID,
  isValidKSUID,
  isValidNanoID,
  isValidNanoIDCustom,
  isValidShortId,
  isValidHumanCode,
  isValidOrderNumber,
  isValidInvoiceNumber,
  isValidTicketNumber,
  isValidSKU,
  isValidObjectId,
  isValidSnowflakeId,
  isValidEAN13,
  isValidUPCA,
  isValidISBN13,
  isValidISBN10,
  isValidDOI,
  isValidORCID,
  isValidStripeCustomerId,
  isValidStripePaymentIntentId,
  isValidStripeSubscriptionId,
  isValidARN,
  isValidGitHubRepo,
  isValidDockerImage,
  isValidK8sName,
  isValidCursor,
  isValidAPIKey,
  isValidSessionToken,
  isValidRefreshToken,
  
  // Generation
  generateUUID,
  generateULID,
  generateShortId,
  generateNanoID,
  generateHumanCode,
  
  // UUID utilities
  uuidToCompact,
  compactToUUID,
  uuidToBytes,
  bytesToUUID,
  
  // ULID utilities
  ulidToTimestamp,
  ulidToDate,
  
  // Snowflake utilities
  snowflakeToTimestamp,
  snowflakeToDate,
  
  // Constants
  ID_PATTERNS,
};

export default Ids;
