/**
 * Secrets Hygiene Module
 * 
 * Prevents leaking secrets in CLI output and proof bundles.
 * 
 * Features:
 * - Environment variable allowlist
 * - Common secret pattern detection (tokens, keys, passwords)
 * - Deep object masking for JSON structures
 * - Safe logging utilities
 * - Integration utilities for CLI, proof bundles, and verifier output
 */

export * from './masker.js';
export * from './logger.js';
export * from './env-filter.js';
export * from './types.js';
export * from './integration.js';
