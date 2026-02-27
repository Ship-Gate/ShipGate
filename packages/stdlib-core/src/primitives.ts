/**
 * @packageDocumentation
 * @isl-lang/stdlib-core/primitives
 */

// ============================================================================
// BRANDED TYPES
// ============================================================================

declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type Email = Brand<string, 'Email'>;
export type Phone = Brand<string, 'Phone'>;
export type URL = Brand<string, 'URL'>;
export type SecureURL = Brand<string, 'SecureURL'>;
export type UUID = Brand<string, 'UUID'>;
export type ULID = Brand<string, 'ULID'>;
export type ShortId = Brand<string, 'ShortId'>;
export type Slug = Brand<string, 'Slug'>;
export type Username = Brand<string, 'Username'>;
export type JWT = Brand<string, 'JWT'>;
export type IPv4 = Brand<string, 'IPv4'>;
export type IPv6 = Brand<string, 'IPv6'>;
export type HexColor = Brand<string, 'HexColor'>;
export type SemVer = Brand<string, 'SemVer'>;
export type CountryCode = Brand<string, 'CountryCode'>;
export type LanguageCode = Brand<string, 'LanguageCode'>;
export type CreditCardNumber = Brand<string, 'CreditCardNumber'>;
export type SHA256 = Brand<string, 'SHA256'>;
export type Base64 = Brand<string, 'Base64'>;

// ============================================================================
// REGEX PATTERNS
// ============================================================================

export const PATTERNS = {
  EMAIL: /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  PHONE_E164: /^\+[1-9]\d{1,14}$/,
  PHONE_FLEXIBLE: /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/,
  URL: /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/,
  SECURE_URL: /^https:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/,
  UUID_V4: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  UUID_V7: /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ULID: /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i,
  SHORT_ID: /^[A-Za-z0-9_-]{8,12}$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  USERNAME: /^[a-zA-Z][a-zA-Z0-9_-]{2,29}$/,
  JWT: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
  IPV4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  IPV6: /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  SEMVER: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
  COUNTRY_CODE: /^[A-Z]{2}$/,
  LANGUAGE_CODE: /^[a-z]{2}$/,
  CREDIT_CARD: /^\d{13,19}$/,
  SHA256: /^[a-fA-F0-9]{64}$/,
  BASE64: /^[A-Za-z0-9+\/]*={0,2}$/,
  BASE64_URL: /^[A-Za-z0-9_-]*$/,
} as const;

// ============================================================================
// CURRENCY
// ============================================================================

export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY',
  'INR', 'BRL', 'MXN', 'SGD', 'HKD', 'KRW', 'SEK', 'NOK',
  'NZD', 'ZAR',
] as const;

export type Currency = typeof CURRENCIES[number];

export const CRYPTO_CURRENCIES = [
  'BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'ADA', 'DOGE', 'DOT', 'MATIC',
] as const;

export type CryptoCurrency = typeof CRYPTO_CURRENCIES[number];

// ============================================================================
// MONEY TYPE
// ============================================================================

export interface Money {
  amount: number;
  currency: Currency;
}

export interface SignedMoney {
  amount: number;
  currency: Currency;
}

export interface PreciseMoney {
  amount: number;
  currency: Currency;
}

export interface CryptoAmount {
  amount: number;
  currency: CryptoCurrency;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export function isValidEmail(value: string): value is Email {
  if (!PATTERNS.EMAIL.test(value) || value.length > 254) return false;
  const at = value.indexOf('@');
  if (at <= 0 || at > 64) return false; // local part max 64 octets (RFC 5321)
  const domain = value.slice(at + 1);
  return domain.length <= 253; // max domain 253 (RFC 1035)
}

export function isValidPhone(value: string): value is Phone {
  return PATTERNS.PHONE_E164.test(value) && value.length >= 8 && value.length <= 16;
}

export function isValidURL(value: string): value is URL {
  return PATTERNS.URL.test(value) && value.length <= 2048;
}

export function isValidSecureURL(value: string): value is SecureURL {
  return PATTERNS.SECURE_URL.test(value) && value.length <= 2048;
}

export function isValidUUID(value: string): value is UUID {
  return PATTERNS.UUID_V4.test(value);
}

export function isValidUUIDv7(value: string): boolean {
  return PATTERNS.UUID_V7.test(value);
}

export function isValidULID(value: string): value is ULID {
  return PATTERNS.ULID.test(value);
}

export function isValidShortId(value: string): value is ShortId {
  return PATTERNS.SHORT_ID.test(value);
}

export function isValidSlug(value: string): value is Slug {
  return PATTERNS.SLUG.test(value) && value.length <= 100;
}

export function isValidUsername(value: string): value is Username {
  return PATTERNS.USERNAME.test(value);
}

export function isValidJWT(value: string): value is JWT {
  return PATTERNS.JWT.test(value);
}

export function isValidIPv4(value: string): value is IPv4 {
  return PATTERNS.IPV4.test(value);
}

export function isValidIPv6(value: string): value is IPv6 {
  return PATTERNS.IPV6.test(value);
}

export function isValidIPAddress(value: string): boolean {
  return isValidIPv4(value) || isValidIPv6(value);
}

export function isValidHexColor(value: string): value is HexColor {
  return PATTERNS.HEX_COLOR.test(value);
}

export function isValidSemVer(value: string): value is SemVer {
  return PATTERNS.SEMVER.test(value);
}

export function isValidCountryCode(value: string): value is CountryCode {
  return PATTERNS.COUNTRY_CODE.test(value);
}

export function isValidLanguageCode(value: string): value is LanguageCode {
  return PATTERNS.LANGUAGE_CODE.test(value);
}

export function isValidSHA256(value: string): value is SHA256 {
  return PATTERNS.SHA256.test(value);
}

export function isValidBase64(value: string): value is Base64 {
  return PATTERNS.BASE64.test(value);
}

// ============================================================================
// LUHN ALGORITHM (Credit Card Validation)
// ============================================================================

export function luhnCheck(cardNumber: string): boolean {
  if (!PATTERNS.CREDIT_CARD.test(cardNumber)) {
    return false;
  }
  
  let sum = 0;
  let isEven = false;
  
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber.charAt(i), 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

export function isValidCreditCard(value: string): value is CreditCardNumber {
  if (/\D/.test(value)) return false; // no dashes/spaces; digits only
  return PATTERNS.CREDIT_CARD.test(value) && luhnCheck(value);
}

// ============================================================================
// MONEY OPERATIONS
// ============================================================================

export function createMoney(amount: number, currency: Currency): Money {
  return {
    amount: Math.round(amount * 100) / 100,
    currency,
  };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add money with different currencies: ${a.currency} vs ${b.currency}`);
  }
  return createMoney(a.amount + b.amount, a.currency);
}

export function subtractMoney(a: Money, b: Money): SignedMoney {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot subtract money with different currencies: ${a.currency} vs ${b.currency}`);
  }
  return {
    amount: Math.round((a.amount - b.amount) * 100) / 100,
    currency: a.currency,
  };
}

export function multiplyMoney(money: Money, factor: number): Money {
  return createMoney(money.amount * factor, money.currency);
}

export function formatMoney(money: Money): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency,
  }).format(money.amount);
}

// ============================================================================
// PERCENTAGE OPERATIONS
// ============================================================================

export function isValidPercentage(value: number): boolean {
  return value >= 0 && value <= 100;
}

export function percentageToDecimal(percentage: number): number {
  return percentage / 100;
}

export function decimalToPercentage(decimal: number): number {
  return decimal * 100;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function assertEmail(value: string): asserts value is Email {
  if (!isValidEmail(value)) {
    throw new Error(`Invalid email: ${value}`);
  }
}

export function assertPhone(value: string): asserts value is Phone {
  if (!isValidPhone(value)) {
    throw new Error(`Invalid phone: ${value}`);
  }
}

export function assertURL(value: string): asserts value is URL {
  if (!isValidURL(value)) {
    throw new Error(`Invalid URL: ${value}`);
  }
}

export function assertUUID(value: string): asserts value is UUID {
  if (!isValidUUID(value)) {
    throw new Error(`Invalid UUID: ${value}`);
  }
}

export function assertULID(value: string): asserts value is ULID {
  if (!isValidULID(value)) {
    throw new Error(`Invalid ULID: ${value}`);
  }
}

// ============================================================================
// PARSING FUNCTIONS (with Result type)
// ============================================================================

export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

export function parseEmail(value: string): Result<Email> {
  if (isValidEmail(value)) {
    return { ok: true, value };
  }
  return { ok: false, error: new Error(`Invalid email format: ${value}`) };
}

export function parsePhone(value: string): Result<Phone> {
  if (isValidPhone(value)) {
    return { ok: true, value };
  }
  return { ok: false, error: new Error(`Invalid phone format. Expected E.164: ${value}`) };
}

export function parseURL(value: string): Result<URL> {
  if (isValidURL(value)) {
    return { ok: true, value };
  }
  return { ok: false, error: new Error(`Invalid URL format: ${value}`) };
}

export function parseUUID(value: string): Result<UUID> {
  if (isValidUUID(value)) {
    return { ok: true, value };
  }
  return { ok: false, error: new Error(`Invalid UUID format: ${value}`) };
}

export function parseULID(value: string): Result<ULID> {
  if (isValidULID(value)) {
    return { ok: true, value };
  }
  return { ok: false, error: new Error(`Invalid ULID format: ${value}`) };
}

export function parseMoney(amount: unknown, currency: unknown): Result<Money> {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return { ok: false, error: new Error(`Invalid money amount: ${amount}`) };
  }
  if (typeof currency !== 'string' || !CURRENCIES.includes(currency as Currency)) {
    return { ok: false, error: new Error(`Invalid currency: ${currency}`) };
  }
  return { ok: true, value: createMoney(amount, currency as Currency) };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const Primitives = {
  // Validation
  isValidEmail,
  isValidPhone,
  isValidURL,
  isValidSecureURL,
  isValidUUID,
  isValidUUIDv7,
  isValidULID,
  isValidShortId,
  isValidSlug,
  isValidUsername,
  isValidJWT,
  isValidIPv4,
  isValidIPv6,
  isValidIPAddress,
  isValidHexColor,
  isValidSemVer,
  isValidCountryCode,
  isValidLanguageCode,
  isValidCreditCard,
  isValidSHA256,
  isValidBase64,
  isValidPercentage,
  luhnCheck,
  
  // Assertions
  assertEmail,
  assertPhone,
  assertURL,
  assertUUID,
  assertULID,
  
  // Parsing
  parseEmail,
  parsePhone,
  parseURL,
  parseUUID,
  parseULID,
  parseMoney,
  
  // Money operations
  createMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  formatMoney,
  
  // Percentage
  percentageToDecimal,
  decimalToPercentage,
  
  // Constants
  PATTERNS,
  CURRENCIES,
  CRYPTO_CURRENCIES,
};

export default Primitives;
