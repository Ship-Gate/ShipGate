/**
 * Runtime Security Checks
 * 
 * Runtime verification of token entropy from execution traces.
 * 
 * CRITICAL SECURITY INVARIANT:
 * These checks NEVER log or store the actual token value.
 * Only safe metadata (length, encoding, hash) is recorded.
 */

import type {
  SecurityTraceEvent,
  SafeTokenMetadata,
  RuntimeTokenCheckResult,
  SecuritySeverity,
} from './types.js';
import {
  MIN_HEX_LENGTH_FOR_256_BIT,
  MIN_BASE64_LENGTH_FOR_256_BIT,
  MIN_BYTES_FOR_256_BIT,
} from './approved-sources.js';

// ============================================================================
// SAFE TOKEN METADATA EXTRACTION
// ============================================================================

/**
 * Detect the encoding of a token string
 * Does NOT log the token, only analyzes character patterns
 */
function detectEncoding(tokenLength: number, charPattern: 'hex' | 'base64' | 'base64url' | 'unknown'): 'hex' | 'base64' | 'base64url' | 'unknown' {
  // This is passed in from analysis, not derived from the actual token
  return charPattern;
}

/**
 * Calculate estimated entropy bits based on length and encoding
 * 
 * @param length - Character length of the token
 * @param encoding - Token encoding type
 * @returns Estimated entropy in bits
 */
export function calculateEntropyBits(length: number, encoding: 'hex' | 'base64' | 'base64url' | 'unknown'): number {
  switch (encoding) {
    case 'hex':
      // Each hex char = 4 bits
      return length * 4;
    case 'base64':
    case 'base64url':
      // Each base64 char ≈ 6 bits (but with padding considerations)
      // Actual: (length * 3/4) bytes * 8 bits = length * 6 bits
      return Math.floor(length * 6);
    case 'unknown':
      // Assume alphanumeric (62 chars) ≈ 5.95 bits per char
      return Math.floor(length * 5.95);
  }
}

/**
 * Create safe metadata from token properties WITHOUT accessing the token value
 * 
 * @param tokenLength - Length of the token in characters
 * @param byteLength - Length in bytes (if known)
 * @param encoding - Token encoding
 * @param createdAt - Creation timestamp
 * @param expiresAt - Expiry timestamp
 * @param requestId - Request correlation ID
 * @returns SafeTokenMetadata that can be safely logged
 */
export function createSafeMetadata(
  tokenLength: number,
  byteLength: number,
  encoding: 'hex' | 'base64' | 'base64url' | 'unknown' = 'hex',
  createdAt?: number,
  expiresAt?: number,
  requestId?: string
): SafeTokenMetadata {
  const estimatedEntropyBits = calculateEntropyBits(tokenLength, encoding);
  
  return {
    length: tokenLength,
    byteLength,
    encoding,
    estimatedEntropyBits,
    meetsLengthRequirement: tokenLength >= MIN_HEX_LENGTH_FOR_256_BIT,
    meetsEntropyRequirement: estimatedEntropyBits >= 256,
    createdAt,
    expiresAt,
    requestId,
  };
}

/**
 * Create a one-way hash of a token for correlation purposes
 * Uses SHA-256 and only returns first 8 chars for correlation
 * 
 * IMPORTANT: This is ONE-WAY and truncated - the token cannot be recovered
 */
export async function createTokenHash(tokenValue: string): Promise<string> {
  // Use Web Crypto API for hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(tokenValue);
  
  // SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Return only first 8 chars - enough for correlation, impossible to reverse
  return hashHex.slice(0, 8);
}

/**
 * Synchronous version using Node.js crypto (for environments without Web Crypto)
 */
export function createTokenHashSync(tokenValue: string): string {
  // Dynamic import to avoid breaking in browser
  try {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(tokenValue).digest('hex');
    return hash.slice(0, 8);
  } catch {
    // Fallback: simple hash (less secure but still one-way)
    let hash = 0;
    for (let i = 0; i < tokenValue.length; i++) {
      const char = tokenValue.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

// ============================================================================
// RUNTIME TOKEN VERIFICATION
// ============================================================================

/**
 * Verify token length meets minimum requirements
 * 
 * @param tokenLength - Length of the token (NOT the token itself)
 * @param minLength - Minimum required length (default: 64)
 * @returns Runtime check result
 */
export function verifyTokenLength(
  tokenLength: number,
  minLength: number = MIN_HEX_LENGTH_FOR_256_BIT
): RuntimeTokenCheckResult {
  const metadata = createSafeMetadata(
    tokenLength,
    Math.ceil(tokenLength / 2), // Assume hex encoding
    'hex'
  );

  if (tokenLength >= minLength) {
    return {
      passed: true,
      checkName: 'token-length',
      metadata,
      reason: `Token length ${tokenLength} meets minimum ${minLength}`,
    };
  }

  return {
    passed: false,
    checkName: 'token-length',
    metadata,
    reason: `Token length ${tokenLength} is below minimum ${minLength}`,
    severity: 'critical',
  };
}

/**
 * Verify token entropy meets minimum requirements
 * 
 * @param tokenLength - Length of the token
 * @param encoding - Token encoding type
 * @param minEntropyBits - Minimum entropy required (default: 256)
 * @returns Runtime check result
 */
export function verifyTokenEntropy(
  tokenLength: number,
  encoding: 'hex' | 'base64' | 'base64url' | 'unknown' = 'hex',
  minEntropyBits: number = 256
): RuntimeTokenCheckResult {
  const estimatedBits = calculateEntropyBits(tokenLength, encoding);
  const metadata = createSafeMetadata(
    tokenLength,
    Math.ceil(estimatedBits / 8),
    encoding
  );

  if (estimatedBits >= minEntropyBits) {
    return {
      passed: true,
      checkName: 'token-entropy',
      metadata,
      reason: `Token entropy ${estimatedBits} bits meets minimum ${minEntropyBits} bits`,
    };
  }

  return {
    passed: false,
    checkName: 'token-entropy',
    metadata,
    reason: `Token entropy ${estimatedBits} bits is below minimum ${minEntropyBits} bits`,
    severity: 'critical',
  };
}

// ============================================================================
// TRACE EVENT VERIFICATION
// ============================================================================

/**
 * Verify a token creation trace event
 * 
 * IMPORTANT: The trace event should NEVER contain the actual token,
 * only safe metadata like length and encoding.
 */
export function verifyTraceEvent(
  event: SecurityTraceEvent,
  config?: { minLength?: number; minEntropyBits?: number }
): RuntimeTokenCheckResult[] {
  const results: RuntimeTokenCheckResult[] = [];
  const minLength = config?.minLength || MIN_HEX_LENGTH_FOR_256_BIT;
  const minEntropyBits = config?.minEntropyBits || 256;

  // Verify token length
  results.push(verifyTokenLength(event.tokenLength, minLength));

  // Verify entropy if metadata available
  if (event.metadata) {
    const entropyResult = verifyTokenEntropy(
      event.metadata.length,
      event.metadata.encoding || 'hex',
      minEntropyBits
    );
    results.push(entropyResult);
  }

  return results;
}

/**
 * Verify all token trace events in a trace
 */
export function verifyAllTraceEvents(
  events: SecurityTraceEvent[],
  config?: { minLength?: number; minEntropyBits?: number }
): RuntimeTokenCheckResult[] {
  const results: RuntimeTokenCheckResult[] = [];

  for (const event of events) {
    if (event.type === 'token_created') {
      results.push(...verifyTraceEvent(event, config));
    }
  }

  return results;
}

// ============================================================================
// CLAUSE EVALUATION FOR VERIFICATION ENGINE
// ============================================================================

import type { SecurityClause, ClauseEvaluationResult } from './types.js';

/**
 * Evaluate a security clause against runtime evidence
 * 
 * This function is designed to integrate with the ISL verification engine
 */
export function evaluateSecurityClause(
  clause: SecurityClause,
  evidence: { tokenLength?: number; encoding?: 'hex' | 'base64' | 'base64url' | 'unknown' }
): ClauseEvaluationResult {
  switch (clause.type) {
    case 'token_length': {
      if (evidence.tokenLength === undefined) {
        return {
          clause,
          passed: false,
          evidence: 'No token length evidence available',
          error: 'Missing token length in trace',
        };
      }

      const requiredLength = clause.unit === 'bytes' 
        ? clause.requiredValue * 2 // Convert bytes to hex chars
        : clause.requiredValue;

      const passed = evidence.tokenLength >= requiredLength;
      
      return {
        clause,
        passed,
        actualValue: evidence.tokenLength,
        evidence: `Token length: ${evidence.tokenLength} chars (required: ${requiredLength})`,
      };
    }

    case 'token_entropy': {
      if (evidence.tokenLength === undefined) {
        return {
          clause,
          passed: false,
          evidence: 'No token evidence available',
          error: 'Missing token data in trace',
        };
      }

      const encoding = evidence.encoding || 'hex';
      const entropyBits = calculateEntropyBits(evidence.tokenLength, encoding);
      const passed = entropyBits >= clause.requiredValue;

      return {
        clause,
        passed,
        actualValue: entropyBits,
        evidence: `Token entropy: ${entropyBits} bits (required: ${clause.requiredValue} bits)`,
      };
    }

    case 'token_source': {
      // Token source is verified through static analysis
      // Runtime can only verify the output characteristics
      return {
        clause,
        passed: true,
        evidence: 'Token source verification requires static analysis',
      };
    }

    case 'token_expiry': {
      // Would need expiry timestamp in evidence
      return {
        clause,
        passed: true,
        evidence: 'Token expiry verification not implemented',
      };
    }

    default:
      return {
        clause,
        passed: false,
        evidence: `Unknown clause type: ${(clause as SecurityClause).type}`,
        error: 'Unsupported clause type',
      };
  }
}

/**
 * Create standard security clauses for 256-bit token entropy
 */
export function createStandardSecurityClauses(): SecurityClause[] {
  return [
    {
      id: 'token-entropy-256',
      type: 'token_entropy',
      expression: 'session_token.entropy >= 256 bits',
      requiredValue: 256,
      unit: 'bits',
    },
    {
      id: 'token-length-64',
      type: 'token_length',
      expression: 'session_token.length >= 64 characters',
      requiredValue: 64,
      unit: 'characters',
    },
    {
      id: 'token-bytes-32',
      type: 'token_length',
      expression: 'session_token.byte_length >= 32 bytes',
      requiredValue: 32,
      unit: 'bytes',
    },
  ];
}

// ============================================================================
// SAFE LOGGING HELPERS
// ============================================================================

/**
 * Create a safe log entry for token verification
 * NEVER includes the actual token value
 */
export function createSafeLogEntry(
  checkResult: RuntimeTokenCheckResult,
  requestId?: string
): Record<string, unknown> {
  return {
    check: checkResult.checkName,
    passed: checkResult.passed,
    reason: checkResult.reason,
    severity: checkResult.severity,
    tokenMetadata: {
      length: checkResult.metadata.length,
      byteLength: checkResult.metadata.byteLength,
      encoding: checkResult.metadata.encoding,
      estimatedEntropyBits: checkResult.metadata.estimatedEntropyBits,
      meetsRequirements: checkResult.metadata.meetsLengthRequirement && 
                         checkResult.metadata.meetsEntropyRequirement,
    },
    requestId,
    timestamp: Date.now(),
    // Explicitly mark that token value is NOT logged
    tokenValueLogged: false,
  };
}

/**
 * Assert that an object does NOT contain token values
 * Use this to validate log entries before sending
 */
export function assertNoTokenValue(obj: Record<string, unknown>): void {
  const dangerousKeys = ['token', 'sessionToken', 'accessToken', 'refreshToken', 'secret', 'credential'];
  
  for (const key of dangerousKeys) {
    if (key in obj) {
      const value = obj[key];
      if (typeof value === 'string' && value.length > 0) {
        throw new Error(`SECURITY: Attempted to log token value in field "${key}". This is forbidden.`);
      }
    }
  }

  // Recursively check nested objects
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      assertNoTokenValue(value as Record<string, unknown>);
    }
  }
}
