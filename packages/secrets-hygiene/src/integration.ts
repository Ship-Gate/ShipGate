/**
 * Integration utilities for masking secrets in various output formats
 */

import { SecretsMasker, createMasker } from './masker.js';
import type { SecretsMaskerOptions } from './types.js';

/**
 * Create a safe console.log that masks secrets
 */
export function createSafeConsole(maskerOptions?: SecretsMaskerOptions) {
  const masker = createMasker(maskerOptions);
  
  return {
    log: (...args: unknown[]) => {
      const masked = args.map(arg => {
        if (typeof arg === 'string') {
          return masker.mask(arg);
        }
        return masker.maskObject(arg);
      });
      console.log(...masked);
    },
    error: (...args: unknown[]) => {
      const masked = args.map(arg => {
        if (typeof arg === 'string') {
          return masker.mask(arg);
        }
        return masker.maskObject(arg);
      });
      console.error(...masked);
    },
    warn: (...args: unknown[]) => {
      const masked = args.map(arg => {
        if (typeof arg === 'string') {
          return masker.mask(arg);
        }
        return masker.maskObject(arg);
      });
      console.warn(...masked);
    },
    info: (...args: unknown[]) => {
      const masked = args.map(arg => {
        if (typeof arg === 'string') {
          return masker.mask(arg);
        }
        return masker.maskObject(arg);
      });
      console.info(...masked);
    },
    debug: (...args: unknown[]) => {
      const masked = args.map(arg => {
        if (typeof arg === 'string') {
          return masker.mask(arg);
        }
        return masker.maskObject(arg);
      });
      console.debug(...masked);
    },
  };
}

/**
 * Safe JSON.stringify that masks secrets
 */
export function safeJSONStringify(
  obj: unknown,
  maskerOptions?: SecretsMaskerOptions,
  space?: string | number
): string {
  const masker = createMasker(maskerOptions);
  const masked = masker.maskObject(obj);
  return JSON.stringify(masked, null, space);
}

/**
 * Mask a string before output
 */
export function maskString(text: string, maskerOptions?: SecretsMaskerOptions): string {
  const masker = createMasker(maskerOptions);
  return masker.mask(text);
}

/**
 * Mask an object before output
 */
export function maskObject(obj: unknown, maskerOptions?: SecretsMaskerOptions): unknown {
  const masker = createMasker(maskerOptions);
  return masker.maskObject(obj);
}
