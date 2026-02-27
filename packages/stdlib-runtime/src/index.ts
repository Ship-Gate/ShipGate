/**
 * ISL Standard Library Runtime
 * 
 * This package provides TypeScript implementations for the 10 core stdlib modules
 * included in ISL 1.0 release.
 * 
 * Modules:
 * 1. @isl/string - String manipulation (100% deterministic)
 * 2. @isl/math - Mathematical operations (100% deterministic)
 * 3. @isl/collections - List and Map operations (100% deterministic)
 * 4. @isl/json - JSON parsing and manipulation (100% deterministic)
 * 5. @isl/datetime - Date and time operations (Now is non-deterministic)
 * 6. @isl/uuid - UUID generation and validation (v4/v7 non-deterministic)
 * 7. @isl/crypto - Cryptographic operations (random generation non-deterministic)
 * 8. @isl/encoding - Encoding/decoding operations (100% deterministic)
 * 9. @isl/regex - Regex pattern matching (100% deterministic)
 * 10. @isl/url - URL parsing and manipulation (100% deterministic)
 */

// Re-export all modules
export * as String from './string.js';
export * as Math from './math.js';
export * as Collections from './collections.js';
export * as JSON from './json.js';
export * as DateTime from './datetime.js';
export * as UUID from './uuid.js';
export * as Crypto from './crypto.js';
export * as Encoding from './encoding.js';
export * as Regex from './regex.js';
export * as URL from './url.js';

// Import default exports
import String from './string.js';
import Math from './math.js';
import Collections from './collections.js';
import JSON from './json.js';
import DateTime from './datetime.js';
import UUID from './uuid.js';
import Crypto from './crypto.js';
import Encoding from './encoding.js';
import Regex from './regex.js';
import URL from './url.js';

/**
 * ISL Standard Library
 * 
 * Unified namespace for all stdlib modules
 */
export const StdLib = {
  String,
  Math,
  Collections,
  JSON,
  DateTime,
  UUID,
  Crypto,
  Encoding,
  Regex,
  URL,
};

export default StdLib;

/**
 * Module metadata for runtime introspection
 */
export const STDLIB_VERSION = '1.0.0';

export const STDLIB_MODULES = [
  '@isl/string',
  '@isl/math',
  '@isl/collections',
  '@isl/json',
  '@isl/datetime',
  '@isl/uuid',
  '@isl/crypto',
  '@isl/encoding',
  '@isl/regex',
  '@isl/url',
] as const;

export type StdLibModule = typeof STDLIB_MODULES[number];

/**
 * Determinism information for verification
 */
export const DETERMINISM_INFO = {
  fully_deterministic: [
    '@isl/string',
    '@isl/math',
    '@isl/collections',
    '@isl/json',
    '@isl/encoding',
    '@isl/regex',
    '@isl/url',
  ],
  mixed_determinism: [
    '@isl/datetime',
    '@isl/uuid',
    '@isl/crypto',
  ],
  nondeterministic_functions: {
    '@isl/datetime': ['now'],
    '@isl/uuid': ['generateUUID', 'generateUUIDv7'],
    '@isl/crypto': ['generateToken', 'generateApiKey', 'generateBytes', 'hashPassword'],
  },
} as const;

/**
 * Check if a function is deterministic
 */
export function isDeterministic(module: string, functionName: string): boolean {
  const nonDetFunctions = DETERMINISM_INFO.nondeterministic_functions as Record<string, readonly string[]>;
  const moduleFunctions = nonDetFunctions[module];
  
  if (!moduleFunctions) {
    // Module not in mixed determinism list, so all functions are deterministic
    return true;
  }
  
  return !moduleFunctions.includes(functionName);
}

/**
 * Get all non-deterministic functions
 */
export function getNonDeterministicFunctions(): Array<{ module: string; function: string }> {
  const result: Array<{ module: string; function: string }> = [];
  
  for (const [module, functions] of Object.entries(DETERMINISM_INFO.nondeterministic_functions)) {
    for (const fn of functions) {
      result.push({ module, function: fn });
    }
  }
  
  return result;
}
