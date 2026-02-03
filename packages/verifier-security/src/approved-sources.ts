/**
 * Approved Token Generator Sources
 * 
 * Defines cryptographically secure random sources that are approved
 * for generating session tokens with 256-bit minimum entropy.
 * 
 * Security Requirement: Session tokens must use CSPRNG (Cryptographically
 * Secure Pseudo-Random Number Generator) sources that provide at least
 * 256 bits of entropy.
 */

import type { ApprovedTokenSource, TokenSourceCheckResult } from './types.js';

// ============================================================================
// APPROVED CRYPTOGRAPHIC SOURCES
// ============================================================================

/**
 * Node.js crypto.randomBytes - The gold standard for Node.js
 * Provides cryptographically strong pseudo-random data.
 * 
 * Usage: crypto.randomBytes(32) for 256 bits (32 bytes)
 */
const NODE_CRYPTO_RANDOM_BYTES: ApprovedTokenSource = {
  name: 'Node.js crypto.randomBytes',
  module: 'crypto',
  functionName: 'randomBytes',
  pattern: /crypto\.randomBytes\s*\(\s*(\d+)\s*\)/g,
  minByteLength: 32,
  rationale: 'Uses OpenSSL CSPRNG, widely audited and trusted',
};

/**
 * Node.js crypto.randomUUID - UUID v4 generator
 * Provides 122 bits of randomness (UUID v4 spec).
 * 
 * Note: NOT sufficient for 256-bit entropy alone, but can be combined.
 */
const NODE_CRYPTO_RANDOM_UUID: ApprovedTokenSource = {
  name: 'Node.js crypto.randomUUID',
  module: 'crypto',
  functionName: 'randomUUID',
  pattern: /crypto\.randomUUID\s*\(\s*\)/g,
  minByteLength: 16, // 122 bits actual entropy
  rationale: 'Uses crypto.randomBytes internally, but only 122 bits',
};

/**
 * Web Crypto API - crypto.getRandomValues
 * Browser-compatible CSPRNG.
 * 
 * Usage: crypto.getRandomValues(new Uint8Array(32))
 */
const WEB_CRYPTO_GET_RANDOM_VALUES: ApprovedTokenSource = {
  name: 'Web Crypto getRandomValues',
  module: 'crypto',
  functionName: 'getRandomValues',
  pattern: /crypto\.getRandomValues\s*\(\s*new\s+Uint8Array\s*\(\s*(\d+)\s*\)\s*\)/g,
  minByteLength: 32,
  rationale: 'W3C standard CSPRNG, available in browsers and Node.js',
};

/**
 * Web Crypto API - SubtleCrypto.generateKey (for key derivation)
 * For generating cryptographic keys.
 */
const WEB_CRYPTO_SUBTLE_GENERATE_KEY: ApprovedTokenSource = {
  name: 'Web Crypto SubtleCrypto.generateKey',
  module: 'crypto',
  functionName: 'generateKey',
  pattern: /crypto\.subtle\.generateKey\s*\(/g,
  minByteLength: 32,
  rationale: 'W3C standard for cryptographic key generation',
};

/**
 * Node.js crypto.generateKey - For symmetric key generation
 */
const NODE_CRYPTO_GENERATE_KEY: ApprovedTokenSource = {
  name: 'Node.js crypto.generateKey',
  module: 'crypto',
  functionName: 'generateKey',
  pattern: /crypto\.generateKey\s*\(\s*['"]aes['"].*?(\d+)/g,
  minByteLength: 32,
  rationale: 'Node.js built-in key generation using CSPRNG',
};

/**
 * Node.js crypto.randomFillSync - Synchronous random fill
 * Fills a buffer with cryptographically strong random values.
 */
const NODE_CRYPTO_RANDOM_FILL_SYNC: ApprovedTokenSource = {
  name: 'Node.js crypto.randomFillSync',
  module: 'crypto',
  functionName: 'randomFillSync',
  pattern: /crypto\.randomFillSync\s*\(\s*(?:new\s+)?(?:Buffer|Uint8Array).*?(\d+)/g,
  minByteLength: 32,
  rationale: 'Synchronous variant of crypto CSPRNG',
};

/**
 * Node.js crypto.randomFill - Async random fill
 */
const NODE_CRYPTO_RANDOM_FILL: ApprovedTokenSource = {
  name: 'Node.js crypto.randomFill',
  module: 'crypto',
  functionName: 'randomFill',
  pattern: /crypto\.randomFill\s*\(\s*(?:new\s+)?(?:Buffer|Uint8Array).*?(\d+)/g,
  minByteLength: 32,
  rationale: 'Asynchronous variant of crypto CSPRNG',
};

/**
 * nanoid with custom alphabet - Popular secure ID generator
 * Must use customAlphabet with sufficient length.
 */
const NANOID_CUSTOM: ApprovedTokenSource = {
  name: 'nanoid',
  module: 'nanoid',
  functionName: 'customAlphabet',
  // nanoid(64) or customAlphabet(...)(64)
  pattern: /(?:nanoid|customAlphabet[^)]*\))\s*\(\s*(\d+)\s*\)/g,
  minByteLength: 32, // nanoid uses 64 chars of base64 for 256 bits
  rationale: 'Uses crypto.getRandomValues internally, popular and audited',
};

/**
 * uuid v4 - Standard UUID generator
 * Note: Only 122 bits, NOT sufficient alone for 256-bit requirement.
 */
const UUID_V4: ApprovedTokenSource = {
  name: 'uuid v4',
  module: 'uuid',
  functionName: 'v4',
  pattern: /(?:uuid\.v4|uuidv4|uuid\(\))\s*\(/g,
  minByteLength: 16, // 122 bits actual
  rationale: 'Uses CSPRNG but only provides 122 bits of entropy',
};

// ============================================================================
// REJECTED/INSECURE SOURCES (for detection)
// ============================================================================

/**
 * Patterns for INSECURE token generation that MUST be rejected
 */
export const INSECURE_PATTERNS = [
  {
    name: 'Math.random',
    pattern: /Math\.random\s*\(\s*\)/g,
    reason: 'Math.random is NOT cryptographically secure - predictable output',
    severity: 'critical' as const,
  },
  {
    name: 'Date.now for tokens',
    pattern: /Date\.now\s*\(\s*\).*(?:token|session|secret)/gi,
    reason: 'Timestamps are predictable and have low entropy',
    severity: 'critical' as const,
  },
  {
    name: 'Hardcoded token',
    pattern: /(?:token|session|secret)\s*[=:]\s*['"][a-zA-Z0-9]{8,}['"]/gi,
    reason: 'Hardcoded tokens have zero entropy',
    severity: 'critical' as const,
  },
  {
    name: 'Simple incrementing ID',
    pattern: /(?:token|session).*\+\+|(?:token|session).*\+=\s*1/gi,
    reason: 'Sequential values are trivially predictable',
    severity: 'critical' as const,
  },
  {
    name: 'process.hrtime alone',
    pattern: /process\.hrtime\s*\(\s*\).*(?:token|session)/gi,
    reason: 'High-resolution time is predictable',
    severity: 'high' as const,
  },
  {
    name: 'Object hash as token',
    pattern: /JSON\.stringify\s*\(.*\).*(?:token|session)/gi,
    reason: 'Object serialization is deterministic',
    severity: 'high' as const,
  },
];

// ============================================================================
// ALL APPROVED SOURCES
// ============================================================================

/**
 * Complete list of approved cryptographic token sources
 */
export const APPROVED_TOKEN_SOURCES: ApprovedTokenSource[] = [
  NODE_CRYPTO_RANDOM_BYTES,
  NODE_CRYPTO_RANDOM_UUID,
  WEB_CRYPTO_GET_RANDOM_VALUES,
  WEB_CRYPTO_SUBTLE_GENERATE_KEY,
  NODE_CRYPTO_GENERATE_KEY,
  NODE_CRYPTO_RANDOM_FILL_SYNC,
  NODE_CRYPTO_RANDOM_FILL,
  NANOID_CUSTOM,
  UUID_V4,
];

// ============================================================================
// SOURCE CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if code uses an approved token source
 * 
 * @param code - Code to analyze
 * @param requiredEntropyBits - Minimum entropy required (default: 256)
 * @returns Result indicating if source is approved
 */
export function checkTokenSource(
  code: string,
  requiredEntropyBits = 256
): TokenSourceCheckResult {
  // First check for insecure patterns
  for (const insecure of INSECURE_PATTERNS) {
    const match = code.match(insecure.pattern);
    if (match) {
      return {
        approved: false,
        sourceName: insecure.name,
        reason: `INSECURE: ${insecure.reason}`,
      };
    }
  }

  // Check for approved sources
  for (const source of APPROVED_TOKEN_SOURCES) {
    const matches = [...code.matchAll(source.pattern)];
    
    for (const match of matches) {
      // Extract byte length if captured
      const byteLength = match[1] ? parseInt(match[1], 10) : source.minByteLength;
      const entropyBits = byteLength * 8;

      // UUID v4 special case - only 122 bits
      if (source.name === 'uuid v4' || source.name === 'Node.js crypto.randomUUID') {
        if (requiredEntropyBits > 122) {
          return {
            approved: false,
            sourceName: source.name,
            byteLength,
            reason: `${source.name} only provides 122 bits of entropy, but ${requiredEntropyBits} bits required`,
          };
        }
      }

      if (entropyBits >= requiredEntropyBits) {
        return {
          approved: true,
          sourceName: source.name,
          byteLength,
          reason: `Approved: ${source.rationale} (${entropyBits} bits >= ${requiredEntropyBits} required)`,
        };
      } else {
        return {
          approved: false,
          sourceName: source.name,
          byteLength,
          reason: `Insufficient entropy: ${entropyBits} bits < ${requiredEntropyBits} required. Use crypto.randomBytes(${Math.ceil(requiredEntropyBits / 8)})`,
        };
      }
    }
  }

  return {
    approved: false,
    reason: 'No approved cryptographic source detected. Use crypto.randomBytes(32) for 256-bit entropy.',
  };
}

/**
 * Extract the byte length from a crypto call
 */
export function extractByteLength(code: string, sourceName: string): number | undefined {
  const source = APPROVED_TOKEN_SOURCES.find(s => s.name === sourceName);
  if (!source) return undefined;

  const match = code.match(source.pattern);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  return source.minByteLength;
}

/**
 * Get all approved source patterns for validation
 */
export function getApprovedSourcePatterns(): RegExp[] {
  return APPROVED_TOKEN_SOURCES.map(source => source.pattern);
}

/**
 * Check if a specific function call is approved
 */
export function isApprovedFunction(functionCall: string): boolean {
  return APPROVED_TOKEN_SOURCES.some(source => 
    source.pattern.test(functionCall)
  );
}

/**
 * Get the minimum byte length for 256-bit entropy
 */
export const MIN_BYTES_FOR_256_BIT = 32;

/**
 * Get the minimum hex string length for 256-bit entropy
 * (Each byte = 2 hex chars)
 */
export const MIN_HEX_LENGTH_FOR_256_BIT = 64;

/**
 * Get the minimum base64 string length for 256-bit entropy
 * (32 bytes = 44 chars in base64 with padding, 43 without)
 */
export const MIN_BASE64_LENGTH_FOR_256_BIT = 43;
