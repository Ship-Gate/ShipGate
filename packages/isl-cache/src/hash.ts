/**
 * SHA-256 hashing for cache keys
 */

import { createHash } from 'crypto';

/**
 * Hash a string (e.g. NL prompt) to SHA-256 hex digest
 */
export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
