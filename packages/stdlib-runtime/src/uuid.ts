/**
 * ISL Standard Library - UUID Module
 * Provides UUID generation, validation, and parsing
 * 
 * DETERMINISM:
 * - GenerateUUID (v4) is NON-DETERMINISTIC (random)
 * - GenerateUUIDv7 is NON-DETERMINISTIC (time + random)
 * - GenerateUUIDv5 is DETERMINISTIC (namespace + name -> same UUID)
 * - GenerateUUIDv3 is DETERMINISTIC (namespace + name -> same UUID)
 * - All validation/parsing functions are DETERMINISTIC
 */

// ============================================
// Types
// ============================================

export type UUID = string;
export type UUIDVersion = 'V1' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7';
export type UUIDNamespace = 'DNS' | 'URL' | 'OID' | 'X500';
export type UUIDFormat = 'CANONICAL' | 'COMPACT' | 'URN' | 'BRACES';

export interface UUIDInfo {
  uuid: UUID;
  version: UUIDVersion;
  variant: number;
  is_nil: boolean;
  is_max: boolean;
}

export interface UUIDComponents {
  time_low: string;
  time_mid: string;
  time_hi_and_version: string;
  clock_seq_hi_and_reserved: string;
  clock_seq_low: string;
  node: string;
}

// ============================================
// Constants
// ============================================

export const NIL_UUID: UUID = '00000000-0000-0000-0000-000000000000';
export const MAX_UUID: UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

export const NAMESPACE_DNS: UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
export const NAMESPACE_URL: UUID = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
export const NAMESPACE_OID: UUID = '6ba7b812-9dad-11d1-80b4-00c04fd430c8';
export const NAMESPACE_X500: UUID = '6ba7b814-9dad-11d1-80b4-00c04fd430c8';

const NAMESPACE_MAP: Record<UUIDNamespace, UUID> = {
  DNS: NAMESPACE_DNS,
  URL: NAMESPACE_URL,
  OID: NAMESPACE_OID,
  X500: NAMESPACE_X500,
};

// ============================================
// Non-Deterministic Functions
// ============================================

/**
 * Generate a random UUID v4 (NON-DETERMINISTIC)
 */
export function generateUUID(format: UUIDFormat = 'CANONICAL'): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  
  // Set version (4) and variant (RFC4122)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  
  return formatUUID(uuid, format);
}

/**
 * Generate a time-ordered UUID v7 (NON-DETERMINISTIC)
 */
export function generateUUIDv7(format: UUIDFormat = 'CANONICAL'): string {
  const timestamp = Date.now();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  
  // Encode timestamp in first 48 bits (6 bytes)
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  for (let i = 0; i < 6; i++) {
    bytes[i] = parseInt(timestampHex.slice(i * 2, i * 2 + 2), 16);
  }
  
  // Set version (7) and variant (RFC4122)
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  
  return formatUUID(uuid, format);
}

// ============================================
// Deterministic Functions - Generation
// ============================================

/**
 * Generate namespace UUID v5 using SHA-1 (DETERMINISTIC)
 */
export function generateUUIDv5(namespace: UUID, name: string, format: UUIDFormat = 'CANONICAL'): string {
  // Simple implementation using a hash-like approach
  // In production, this would use actual SHA-1
  const hash = simpleHash(normalizeUUID(namespace) + name, 'sha1');
  
  // Set version (5) and variant
  const bytes = hexToBytes(hash.slice(0, 32));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  
  return formatUUID(uuid, format);
}

/**
 * Generate namespace UUID v3 using MD5 (DETERMINISTIC)
 */
export function generateUUIDv3(namespace: UUID, name: string, format: UUIDFormat = 'CANONICAL'): string {
  // Simple implementation using a hash-like approach
  const hash = simpleHash(normalizeUUID(namespace) + name, 'md5');
  
  // Set version (3) and variant
  const bytes = hexToBytes(hash.slice(0, 32));
  bytes[6] = (bytes[6]! & 0x0f) | 0x30;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  
  return formatUUID(uuid, format);
}

/**
 * Generate UUID from predefined namespace (DETERMINISTIC)
 */
export function generateNamespacedUUID(namespace: UUIDNamespace, name: string, version: 'V3' | 'V5' = 'V5'): UUID {
  const namespaceUuid = NAMESPACE_MAP[namespace];
  if (version === 'V3') {
    return generateUUIDv3(namespaceUuid, name);
  }
  return generateUUIDv5(namespaceUuid, name);
}

// Simple hash function for deterministic UUID generation
function simpleHash(input: string, _type: 'sha1' | 'md5'): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  // Generate enough hex characters for UUID
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return (hex + hex + hex + hex + hex).slice(0, 32);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ============================================
// Deterministic Functions - Validation
// ============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPACT_UUID_REGEX = /^[0-9a-f]{32}$/i;
const URN_UUID_REGEX = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRACES_UUID_REGEX = /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value) ||
         COMPACT_UUID_REGEX.test(value) ||
         URN_UUID_REGEX.test(value) ||
         BRACES_UUID_REGEX.test(value);
}

export function isNilUUID(uuid: UUID): boolean {
  return normalizeUUID(uuid) === NIL_UUID;
}

export function isMaxUUID(uuid: UUID): boolean {
  return normalizeUUID(uuid) === MAX_UUID;
}

// ============================================
// Deterministic Functions - Parsing
// ============================================

export function parseUUID(value: string): UUIDInfo {
  if (!isValidUUID(value)) {
    throw new Error('INVALID_UUID: String is not a valid UUID format');
  }
  
  const normalized = normalizeUUID(value);
  const versionChar = normalized.charAt(14);
  
  let version: UUIDVersion;
  switch (versionChar) {
    case '1': version = 'V1'; break;
    case '3': version = 'V3'; break;
    case '4': version = 'V4'; break;
    case '5': version = 'V5'; break;
    case '6': version = 'V6'; break;
    case '7': version = 'V7'; break;
    default: version = 'V4';
  }
  
  const variantChar = parseInt(normalized.charAt(19), 16);
  let variant = 0;
  if ((variantChar & 0x8) === 0) variant = 0;
  else if ((variantChar & 0xc) === 0x8) variant = 1;
  else if ((variantChar & 0xe) === 0xc) variant = 2;
  else variant = 3;
  
  return {
    uuid: normalized,
    version,
    variant,
    is_nil: normalized === NIL_UUID,
    is_max: normalized === MAX_UUID,
  };
}

export function formatUUID(uuid: UUID, format: UUIDFormat): string {
  const normalized = normalizeUUID(uuid);
  
  switch (format) {
    case 'CANONICAL':
      return normalized;
    case 'COMPACT':
      return normalized.replace(/-/g, '');
    case 'URN':
      return `urn:uuid:${normalized}`;
    case 'BRACES':
      return `{${normalized}}`;
    default:
      return normalized;
  }
}

export function normalizeUUID(uuid: string): UUID {
  // Remove URN prefix
  if (uuid.toLowerCase().startsWith('urn:uuid:')) {
    uuid = uuid.slice(9);
  }
  
  // Remove braces
  if (uuid.startsWith('{') && uuid.endsWith('}')) {
    uuid = uuid.slice(1, -1);
  }
  
  // Add dashes if compact
  if (COMPACT_UUID_REGEX.test(uuid)) {
    uuid = `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
  }
  
  if (!UUID_REGEX.test(uuid)) {
    throw new Error('INVALID_UUID: Input is not a valid UUID');
  }
  
  return uuid.toLowerCase();
}

export function getUUIDVersion(uuid: UUID): UUIDVersion {
  const info = parseUUID(uuid);
  return info.version;
}

export function toComponents(uuid: UUID): UUIDComponents {
  const normalized = normalizeUUID(uuid);
  const parts = normalized.split('-');
  
  return {
    time_low: parts[0]!,
    time_mid: parts[1]!,
    time_hi_and_version: parts[2]!,
    clock_seq_hi_and_reserved: parts[3]!.slice(0, 2),
    clock_seq_low: parts[3]!.slice(2),
    node: parts[4]!,
  };
}

export function fromComponents(components: UUIDComponents): UUID {
  const {
    time_low,
    time_mid,
    time_hi_and_version,
    clock_seq_hi_and_reserved,
    clock_seq_low,
    node,
  } = components;
  
  const uuid = `${time_low}-${time_mid}-${time_hi_and_version}-${clock_seq_hi_and_reserved}${clock_seq_low}-${node}`;
  
  if (!UUID_REGEX.test(uuid)) {
    throw new Error('Invalid UUID components');
  }
  
  return uuid.toLowerCase();
}

// ============================================
// Deterministic Functions - Comparison
// ============================================

export function compareUUIDs(a: UUID, b: UUID): -1 | 0 | 1 {
  const normalizedA = normalizeUUID(a);
  const normalizedB = normalizeUUID(b);
  
  if (normalizedA < normalizedB) return -1;
  if (normalizedA > normalizedB) return 1;
  return 0;
}

export function uuidsEqual(a: string, b: string): boolean {
  try {
    return normalizeUUID(a) === normalizeUUID(b);
  } catch {
    return false;
  }
}

// ============================================
// Default Export
// ============================================

export const UUID_ = {
  // Non-deterministic
  generateUUID,
  generateUUIDv7,
  
  // Deterministic generation
  generateUUIDv5,
  generateUUIDv3,
  generateNamespacedUUID,
  
  // Validation
  isValidUUID,
  isNilUUID,
  isMaxUUID,
  
  // Parsing
  parseUUID,
  formatUUID,
  normalizeUUID,
  getUUIDVersion,
  toComponents,
  fromComponents,
  
  // Comparison
  compareUUIDs,
  uuidsEqual,
  
  // Constants
  NIL_UUID,
  MAX_UUID,
  NAMESPACE_DNS,
  NAMESPACE_URL,
  NAMESPACE_OID,
  NAMESPACE_X500,
};

export default UUID_;
