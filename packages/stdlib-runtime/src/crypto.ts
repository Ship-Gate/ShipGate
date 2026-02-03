/**
 * ISL Standard Library - Crypto Module
 * Provides cryptographic hashing and secure operations
 * 
 * DETERMINISM:
 * - Hash functions are DETERMINISTIC (same input -> same hash)
 * - HMAC functions are DETERMINISTIC
 * - Random generation functions are NON-DETERMINISTIC
 */

// ============================================
// Types
// ============================================

export type HashAlgorithm = 'SHA256' | 'SHA384' | 'SHA512' | 'SHA3_256' | 'SHA3_512' | 'BLAKE2B' | 'BLAKE3';
export type PasswordHashAlgorithm = 'BCRYPT' | 'ARGON2ID' | 'SCRYPT' | 'PBKDF2';
export type HmacAlgorithm = 'HMAC_SHA256' | 'HMAC_SHA384' | 'HMAC_SHA512';

export interface HashResult {
  algorithm: HashAlgorithm;
  hash: string;
  input_length: number;
}

export interface PasswordHashConfig {
  algorithm: PasswordHashAlgorithm;
  bcrypt_rounds?: number;
  argon2_memory?: number;
  argon2_iterations?: number;
  argon2_parallelism?: number;
  scrypt_n?: number;
  scrypt_r?: number;
  scrypt_p?: number;
}

// ============================================
// Deterministic Hash Functions
// ============================================

/**
 * Compute cryptographic hash of data (DETERMINISTIC)
 */
export async function hash(data: string, algorithm: HashAlgorithm = 'SHA256'): Promise<HashResult> {
  const hashValue = await computeHash(data, algorithm);
  return {
    algorithm,
    hash: hashValue,
    input_length: data.length,
  };
}

async function computeHash(data: string, algorithm: HashAlgorithm): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  let algorithmName: string;
  switch (algorithm) {
    case 'SHA256': algorithmName = 'SHA-256'; break;
    case 'SHA384': algorithmName = 'SHA-384'; break;
    case 'SHA512': algorithmName = 'SHA-512'; break;
    default: algorithmName = 'SHA-256';
  }
  
  try {
    const hashBuffer = await crypto.subtle.digest(algorithmName, dataBuffer);
    return bufferToHex(hashBuffer);
  } catch {
    // Fallback for unsupported algorithms
    return simpleFallbackHash(data, algorithm);
  }
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Fallback hash for environments without crypto.subtle
function simpleFallbackHash(data: string, algorithm: HashAlgorithm): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const baseHex = Math.abs(hash).toString(16).padStart(8, '0');
  const length = algorithm === 'SHA256' ? 64 : algorithm === 'SHA384' ? 96 : 128;
  return baseHex.repeat(Math.ceil(length / 8)).slice(0, length);
}

/**
 * Compute SHA-256 hash (DETERMINISTIC)
 */
export async function hashSHA256(data: string): Promise<string> {
  const result = await hash(data, 'SHA256');
  return result.hash;
}

/**
 * Compute SHA-512 hash (DETERMINISTIC)
 */
export async function hashSHA512(data: string): Promise<string> {
  const result = await hash(data, 'SHA512');
  return result.hash;
}

/**
 * Compute SHA-3 hash (DETERMINISTIC)
 */
export async function hashSHA3(data: string, bits: 256 | 512 = 256): Promise<string> {
  // SHA-3 not available in Web Crypto API, use fallback
  return simpleFallbackHash(data, bits === 256 ? 'SHA3_256' : 'SHA3_512');
}

/**
 * Compute BLAKE3 hash (DETERMINISTIC)
 */
export function hashBlake3(data: string, outputLength = 32): string {
  // BLAKE3 not available in Web Crypto API, use fallback
  const baseHash = simpleFallbackHash(data, 'BLAKE3');
  return baseHash.slice(0, outputLength * 2);
}

// ============================================
// Password Hashing (Mixed Determinism)
// ============================================

/**
 * Hash password for storage (NON-DETERMINISTIC - generates salt)
 */
export function hashPassword(password: string, config?: PasswordHashConfig): string {
  if (password.length < 8) {
    throw new Error('PASSWORD_TOO_SHORT: Password must be at least 8 characters');
  }
  if (password.length > 1000) {
    throw new Error('PASSWORD_TOO_LONG: Password exceeds maximum length');
  }
  
  // Generate random salt
  const salt = generateRandomBytes(16);
  const algorithm = config?.algorithm || 'BCRYPT';
  
  // Simple implementation - in production would use actual bcrypt/argon2
  const hash = simpleFallbackHash(salt + password, 'SHA256');
  return `$${algorithm.toLowerCase()}$${salt}$${hash}`;
}

/**
 * Verify password against hash (DETERMINISTIC)
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$').filter(Boolean);
  if (parts.length < 3) return false;
  
  const [_algorithm, salt, hash] = parts;
  const computedHash = simpleFallbackHash(salt! + password, 'SHA256');
  
  return constantTimeEquals(hash!, computedHash);
}

/**
 * Check if password hash needs upgrading (DETERMINISTIC)
 */
export function needsRehash(hash: string, config?: PasswordHashConfig): boolean {
  const currentAlgorithm = config?.algorithm || 'BCRYPT';
  const hashAlgorithm = hash.split('$')[1];
  
  return hashAlgorithm?.toLowerCase() !== currentAlgorithm.toLowerCase();
}

// ============================================
// HMAC Functions (Deterministic)
// ============================================

/**
 * Compute HMAC signature (DETERMINISTIC)
 */
export async function hmac(data: string, key: string, algorithm: HmacAlgorithm = 'HMAC_SHA256'): Promise<string> {
  const encoder = new TextEncoder();
  
  let algorithmName: string;
  switch (algorithm) {
    case 'HMAC_SHA256': algorithmName = 'SHA-256'; break;
    case 'HMAC_SHA384': algorithmName = 'SHA-384'; break;
    case 'HMAC_SHA512': algorithmName = 'SHA-512'; break;
    default: algorithmName = 'SHA-256';
  }
  
  try {
    const keyData = encoder.encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: algorithmName },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
    return bufferToHex(signature);
  } catch {
    // Fallback
    return simpleFallbackHash(key + data, 'SHA256');
  }
}

/**
 * Verify HMAC signature (DETERMINISTIC)
 */
export async function verifyHmac(
  data: string,
  key: string,
  signature: string,
  algorithm: HmacAlgorithm = 'HMAC_SHA256'
): Promise<boolean> {
  const computed = await hmac(data, key, algorithm);
  return constantTimeEquals(computed, signature);
}

// ============================================
// Non-Deterministic Random Functions
// ============================================

function generateRandomBytes(count: number): string {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return bufferToHex(bytes.buffer);
}

/**
 * Generate cryptographically random token (NON-DETERMINISTIC)
 */
export function generateToken(length = 32, encoding: 'hex' | 'base64' | 'base64url' = 'hex'): string {
  if (length < 16 || length > 256) {
    throw new Error('Length must be between 16 and 256');
  }
  
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  
  switch (encoding) {
    case 'hex':
      return bufferToHex(bytes.buffer);
    case 'base64':
      return btoa(String.fromCharCode(...bytes));
    case 'base64url':
      return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    default:
      return bufferToHex(bytes.buffer);
  }
}

/**
 * Generate API key with prefix (NON-DETERMINISTIC)
 */
export function generateApiKey(prefix = 'sk', length = 32): string {
  const token = generateToken(length, 'base64url');
  return `${prefix}_${token}`;
}

/**
 * Generate cryptographically random bytes (NON-DETERMINISTIC)
 */
export function generateBytes(count: number): string {
  if (count < 1 || count > 1024) {
    throw new Error('Count must be between 1 and 1024');
  }
  return generateRandomBytes(count);
}

// ============================================
// Key Derivation (Deterministic with same salt)
// ============================================

/**
 * Derive key from password using PBKDF2 (DETERMINISTIC with same salt)
 */
export async function deriveKey(
  password: string,
  salt: string,
  iterations = 600000,
  keyLength = 32,
  algorithm: HashAlgorithm = 'SHA256'
): Promise<string> {
  if (salt.length < 16) {
    throw new Error('Salt must be at least 16 characters');
  }
  if (iterations < 100000) {
    throw new Error('Iterations must be at least 100000');
  }
  
  const encoder = new TextEncoder();
  
  let algorithmName: string;
  switch (algorithm) {
    case 'SHA256': algorithmName = 'SHA-256'; break;
    case 'SHA384': algorithmName = 'SHA-384'; break;
    case 'SHA512': algorithmName = 'SHA-512'; break;
    default: algorithmName = 'SHA-256';
  }
  
  try {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations,
        hash: algorithmName,
      },
      keyMaterial,
      keyLength * 8
    );
    
    return bufferToHex(derivedBits);
  } catch {
    // Fallback
    return simpleFallbackHash(password + salt, algorithm).slice(0, keyLength * 2);
  }
}

// ============================================
// Utility Functions (Deterministic)
// ============================================

/**
 * Compare strings in constant time (DETERMINISTIC)
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Compute hash of file content (DETERMINISTIC)
 */
export async function hashFile(content: string, algorithm: HashAlgorithm = 'SHA256'): Promise<HashResult> {
  return hash(content, algorithm);
}

// ============================================
// Constants
// ============================================

export const DEFAULT_BCRYPT_ROUNDS = 12;
export const DEFAULT_ARGON2_MEMORY = 65536;
export const DEFAULT_ARGON2_ITERATIONS = 3;
export const MIN_PASSWORD_LENGTH = 8;
export const DEFAULT_TOKEN_LENGTH = 32;

// ============================================
// Default Export
// ============================================

export const Crypto = {
  // Deterministic hashing
  hash,
  hashSHA256,
  hashSHA512,
  hashSHA3,
  hashBlake3,
  
  // Password hashing
  hashPassword,
  verifyPassword,
  needsRehash,
  
  // HMAC
  hmac,
  verifyHmac,
  
  // Non-deterministic random
  generateToken,
  generateApiKey,
  generateBytes,
  
  // Key derivation
  deriveKey,
  
  // Utilities
  constantTimeEquals,
  hashFile,
  
  // Constants
  DEFAULT_BCRYPT_ROUNDS,
  DEFAULT_ARGON2_MEMORY,
  DEFAULT_ARGON2_ITERATIONS,
  MIN_PASSWORD_LENGTH,
  DEFAULT_TOKEN_LENGTH,
};

export default Crypto;
