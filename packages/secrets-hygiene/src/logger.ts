/**
 * Safe Logger
 * 
 * Provides safe logging utilities that automatically mask secrets.
 */

import { SecretsMasker, createMasker } from './masker.js';
import type { SecretsMaskerOptions } from './types.js';

export interface SafeLoggerOptions extends SecretsMaskerOptions {
  /** Whether to enable logging (default: true) */
  enabled?: boolean;
  /** Log level threshold */
  level?: 'debug' | 'info' | 'warn' | 'error';
}

export class SafeLogger {
  private masker: SecretsMasker;
  private enabled: boolean;
  private level: 'debug' | 'info' | 'warn' | 'error';

  constructor(options: SafeLoggerOptions = {}) {
    this.masker = createMasker(options);
    this.enabled = options.enabled ?? true;
    this.level = options.level || 'info';
  }

  /**
   * Log a debug message (secrets are automatically masked)
   */
  debug(message: string, ...args: unknown[]): void {
    if (!this.enabled || this.level === 'error' || this.level === 'warn' || this.level === 'info') {
      return;
    }
    const maskedMessage = this.masker.mask(String(message));
    const maskedArgs = args.map(arg => this.masker.maskObject(arg));
    console.debug(maskedMessage, ...maskedArgs);
  }

  /**
   * Log an info message (secrets are automatically masked)
   */
  info(message: string, ...args: unknown[]): void {
    if (!this.enabled || this.level === 'error' || this.level === 'warn') {
      return;
    }
    const maskedMessage = this.masker.mask(String(message));
    const maskedArgs = args.map(arg => this.masker.maskObject(arg));
    console.info(maskedMessage, ...maskedArgs);
  }

  /**
   * Log a warning message (secrets are automatically masked)
   */
  warn(message: string, ...args: unknown[]): void {
    if (!this.enabled || this.level === 'error') {
      return;
    }
    const maskedMessage = this.masker.mask(String(message));
    const maskedArgs = args.map(arg => this.masker.maskObject(arg));
    console.warn(maskedMessage, ...maskedArgs);
  }

  /**
   * Log an error message (secrets are automatically masked)
   */
  error(message: string, ...args: unknown[]): void {
    if (!this.enabled) {
      return;
    }
    const maskedMessage = this.masker.mask(String(message));
    const maskedArgs = args.map(arg => this.masker.maskObject(arg));
    console.error(maskedMessage, ...maskedArgs);
  }

  /**
   * Log a message with automatic masking
   */
  log(message: string, ...args: unknown[]): void {
    this.info(message, ...args);
  }

  /**
   * Mask a string
   */
  mask(text: string): string {
    return this.masker.mask(text);
  }

  /**
   * Mask an object
   */
  maskObject(obj: unknown): unknown {
    return this.masker.maskObject(obj);
  }
}

/**
 * Default safe logger instance
 */
export const safeLogger = new SafeLogger();

/**
 * Create a safe logger with custom options
 */
export function createSafeLogger(options?: SafeLoggerOptions): SafeLogger {
  return new SafeLogger(options);
}
