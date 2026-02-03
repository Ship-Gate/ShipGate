/**
 * ISL Standard Library - Encoding Module
 * Provides encoding and decoding operations
 * 
 * DETERMINISM: 100% deterministic - all functions produce same output for same input
 */

// ============================================
// Types
// ============================================

export type Encoding = 'UTF8' | 'UTF16' | 'ASCII' | 'LATIN1' | 'BASE64' | 'BASE64URL' | 'HEX';

export interface EncodingResult {
  success: boolean;
  value?: string;
  error_message?: string;
  bytes_processed?: number;
}

export interface DecodingResult {
  success: boolean;
  value?: string;
  error_message?: string;
  error_position?: number;
}

// ============================================
// Base64 Encoding
// ============================================

/**
 * Encode string to Base64 (DETERMINISTIC)
 */
export function encodeBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

/**
 * Decode Base64 string (DETERMINISTIC)
 */
export function decodeBase64(value: string): string {
  if (!isValidBase64(value)) {
    throw new Error('INVALID_BASE64: Input is not valid Base64');
  }
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    throw new Error('INVALID_BASE64: Input is not valid Base64');
  }
}

/**
 * Try to decode Base64, returning result object (DETERMINISTIC)
 */
export function tryDecodeBase64(value: string): DecodingResult {
  try {
    const decoded = decodeBase64(value);
    return { success: true, value: decoded };
  } catch (e) {
    return { 
      success: false, 
      error_message: e instanceof Error ? e.message : 'Invalid Base64' 
    };
  }
}

/**
 * Encode string to URL-safe Base64 (DETERMINISTIC)
 */
export function encodeBase64Url(value: string, includePadding = false): string {
  let encoded = encodeBase64(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  if (!includePadding) {
    encoded = encoded.replace(/=/g, '');
  }
  
  return encoded;
}

/**
 * Decode URL-safe Base64 string (DETERMINISTIC)
 */
export function decodeBase64Url(value: string): string {
  if (!isValidBase64Url(value)) {
    throw new Error('INVALID_BASE64URL: Input is not valid URL-safe Base64');
  }
  
  // Add padding if needed
  let padded = value.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) {
    padded += '=';
  }
  
  return decodeBase64(padded);
}

/**
 * Check if string is valid Base64 (DETERMINISTIC)
 */
export function isValidBase64(value: string): boolean {
  return /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

/**
 * Check if string is valid URL-safe Base64 (DETERMINISTIC)
 */
export function isValidBase64Url(value: string): boolean {
  return /^[A-Za-z0-9_-]*$/.test(value);
}

// ============================================
// URL Encoding
// ============================================

/**
 * URL-encode a string (DETERMINISTIC)
 */
export function encodeUrl(value: string): string {
  return encodeURI(value);
}

/**
 * URL-decode a string (DETERMINISTIC)
 */
export function decodeUrl(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    throw new Error('INVALID_ENCODING: Input contains invalid URL encoding');
  }
}

/**
 * Try to URL-decode, returning result object (DETERMINISTIC)
 */
export function tryDecodeUrl(value: string): DecodingResult {
  try {
    const decoded = decodeUrl(value);
    return { success: true, value: decoded };
  } catch (e) {
    return { 
      success: false, 
      error_message: e instanceof Error ? e.message : 'Invalid URL encoding' 
    };
  }
}

/**
 * Encode URL component (stricter than encodeUrl) (DETERMINISTIC)
 */
export function encodeUrlComponent(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Decode URL component (DETERMINISTIC)
 */
export function decodeUrlComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error('INVALID_ENCODING: Input contains invalid URL encoding');
  }
}

/**
 * Build URL query string from parameters (DETERMINISTIC)
 */
export function buildQueryString(params: Record<string, string | string[]>, encode = true): string {
  const parts: string[] = [];
  
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        const k = encode ? encodeUrlComponent(key) : key;
        const val = encode ? encodeUrlComponent(v) : v;
        parts.push(`${k}=${val}`);
      }
    } else {
      const k = encode ? encodeUrlComponent(key) : key;
      const val = encode ? encodeUrlComponent(value) : value;
      parts.push(`${k}=${val}`);
    }
  }
  
  return parts.join('&');
}

/**
 * Parse URL query string to parameters (DETERMINISTIC)
 */
export function parseQueryString(query: string, decode = true): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  
  // Remove leading ?
  if (query.startsWith('?')) {
    query = query.slice(1);
  }
  
  if (!query) return params;
  
  for (const part of query.split('&')) {
    const [rawKey, rawValue = ''] = part.split('=');
    if (rawKey === undefined) continue;
    const key = decode ? decodeUrlComponent(rawKey) : rawKey;
    const value = decode ? decodeUrlComponent(rawValue) : rawValue;
    
    if (key in params) {
      const existing = params[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else if (existing !== undefined) {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  }
  
  return params;
}

// ============================================
// HTML Encoding
// ============================================

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HTML_ENTITIES_REVERSE: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
};

/**
 * Escape HTML special characters (DETERMINISTIC)
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Unescape HTML entities (DETERMINISTIC)
 */
export function unescapeHtml(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|#39|#x27|apos);/gi, entity => 
    HTML_ENTITIES_REVERSE[entity.toLowerCase()] || entity
  );
}

/**
 * Escape string for use in HTML attribute (DETERMINISTIC)
 */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')
    .replace(/=/g, '&#61;');
}

// ============================================
// Hex Encoding
// ============================================

/**
 * Encode string/bytes to hexadecimal (DETERMINISTIC)
 */
export function encodeHex(value: string, uppercase = false): string {
  const hex = Array.from(new TextEncoder().encode(value))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return uppercase ? hex.toUpperCase() : hex;
}

/**
 * Decode hexadecimal string to bytes (DETERMINISTIC)
 */
export function decodeHex(value: string): string {
  if (!isValidHex(value)) {
    throw new Error('INVALID_HEX: Input is not valid hexadecimal');
  }
  
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  
  return new TextDecoder().decode(bytes);
}

/**
 * Check if string is valid hexadecimal (DETERMINISTIC)
 */
export function isValidHex(value: string): boolean {
  return /^[0-9a-fA-F]*$/.test(value) && value.length % 2 === 0;
}

// ============================================
// Unicode/UTF Encoding
// ============================================

/**
 * Encode string to UTF-8 byte representation (DETERMINISTIC)
 */
export function encodeUtf8(value: string): string {
  return encodeHex(value);
}

/**
 * Decode UTF-8 bytes to string (DETERMINISTIC)
 */
export function decodeUtf8(bytes: string): string {
  try {
    return decodeHex(bytes);
  } catch {
    throw new Error('INVALID_UTF8: Invalid UTF-8 byte sequence');
  }
}

/**
 * Get UTF-8 byte length of string (DETERMINISTIC)
 */
export function getByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Convert string to Unicode code points (DETERMINISTIC)
 */
export function stringToCodePoints(value: string): number[] {
  const codePoints: number[] = [];
  for (const char of value) {
    const cp = char.codePointAt(0);
    if (cp !== undefined) {
      codePoints.push(cp);
    }
  }
  return codePoints;
}

/**
 * Convert Unicode code points to string (DETERMINISTIC)
 */
export function codePointsToString(codePoints: number[]): string {
  for (const cp of codePoints) {
    if (cp < 0 || cp > 0x10FFFF) {
      throw new Error('INVALID_CODE_POINT: Invalid Unicode code point');
    }
  }
  return String.fromCodePoint(...codePoints);
}

// ============================================
// JSON String Encoding
// ============================================

/**
 * Escape string for use in JSON (DETERMINISTIC)
 */
export function escapeJsonString(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

/**
 * Unescape JSON string escapes (DETERMINISTIC)
 */
export function unescapeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    throw new Error('INVALID_ESCAPE: Invalid escape sequence');
  }
}

// ============================================
// Utility
// ============================================

/**
 * Convert between encodings (DETERMINISTIC)
 */
export function convert(value: string, fromEncoding: Encoding, toEncoding: Encoding): string {
  // First decode to string
  let decoded: string;
  switch (fromEncoding) {
    case 'BASE64':
      decoded = decodeBase64(value);
      break;
    case 'BASE64URL':
      decoded = decodeBase64Url(value);
      break;
    case 'HEX':
      decoded = decodeHex(value);
      break;
    default:
      decoded = value;
  }
  
  // Then encode to target
  switch (toEncoding) {
    case 'BASE64':
      return encodeBase64(decoded);
    case 'BASE64URL':
      return encodeBase64Url(decoded);
    case 'HEX':
      return encodeHex(decoded);
    default:
      return decoded;
  }
}

/**
 * Detect likely encoding of byte sequence (DETERMINISTIC)
 */
export function detectEncoding(bytes: string): { encoding: Encoding; confidence: number } {
  // Simple heuristics
  if (/^[A-Za-z0-9+/]*={0,2}$/.test(bytes) && bytes.length % 4 === 0) {
    return { encoding: 'BASE64', confidence: 0.8 };
  }
  if (/^[A-Za-z0-9_-]*$/.test(bytes)) {
    return { encoding: 'BASE64URL', confidence: 0.7 };
  }
  if (/^[0-9a-fA-F]*$/.test(bytes) && bytes.length % 2 === 0) {
    return { encoding: 'HEX', confidence: 0.9 };
  }
  return { encoding: 'UTF8', confidence: 0.5 };
}

// ============================================
// Constants
// ============================================

export const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const HEX_ALPHABET_LOWER = '0123456789abcdef';
export const HEX_ALPHABET_UPPER = '0123456789ABCDEF';

// ============================================
// Default Export
// ============================================

export const Encoding_ = {
  // Base64
  encodeBase64,
  decodeBase64,
  tryDecodeBase64,
  encodeBase64Url,
  decodeBase64Url,
  isValidBase64,
  isValidBase64Url,
  
  // URL
  encodeUrl,
  decodeUrl,
  tryDecodeUrl,
  encodeUrlComponent,
  decodeUrlComponent,
  buildQueryString,
  parseQueryString,
  
  // HTML
  escapeHtml,
  unescapeHtml,
  escapeHtmlAttribute,
  
  // Hex
  encodeHex,
  decodeHex,
  isValidHex,
  
  // Unicode
  encodeUtf8,
  decodeUtf8,
  getByteLength,
  stringToCodePoints,
  codePointsToString,
  
  // JSON
  escapeJsonString,
  unescapeJsonString,
  
  // Utility
  convert,
  detectEncoding,
  
  // Constants
  BASE64_ALPHABET,
  BASE64URL_ALPHABET,
  HEX_ALPHABET_LOWER,
  HEX_ALPHABET_UPPER,
};

export default Encoding_;
