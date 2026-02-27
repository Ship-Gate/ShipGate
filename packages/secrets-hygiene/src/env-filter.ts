/**
 * Environment Variable Filter
 * 
 * Filters environment variables based on an allowlist to prevent
 * leaking secrets through env var exposure.
 */

import type { EnvFilterOptions } from './types.js';

export class EnvFilter {
  private allowedEnvVars: Set<string>;
  private maskDisallowed: boolean;

  constructor(options: EnvFilterOptions = {}) {
    this.allowedEnvVars = new Set(
      options.allowedEnvVars || ['PATH', 'HOME', 'USER', 'SHELL', 'NODE_ENV', 'PWD']
    );
    this.maskDisallowed = options.maskDisallowed ?? true;
  }

  /**
   * Filter environment variables, returning only allowed ones
   */
  filter(env: Record<string, string | undefined>): Record<string, string | undefined> {
    const filtered: Record<string, string | undefined> = {};
    
    for (const [key, value] of Object.entries(env)) {
      if (this.allowedEnvVars.has(key)) {
        filtered[key] = value;
      } else if (this.maskDisallowed) {
        // Include but mask the value
        filtered[key] = '***';
      }
      // Otherwise exclude entirely
    }
    
    return filtered;
  }

  /**
   * Check if an environment variable is allowed
   */
  isAllowed(varName: string): boolean {
    return this.allowedEnvVars.has(varName);
  }

  /**
   * Add an environment variable to the allowlist
   */
  addAllowed(varName: string): void {
    this.allowedEnvVars.add(varName);
  }

  /**
   * Remove an environment variable from the allowlist
   */
  removeAllowed(varName: string): void {
    this.allowedEnvVars.delete(varName);
  }

  /**
   * Get all allowed environment variable names
   */
  getAllowed(): string[] {
    return Array.from(this.allowedEnvVars);
  }
}

/**
 * Default instance for convenience
 */
export const defaultEnvFilter = new EnvFilter();

/**
 * Create an env filter with custom options
 */
export function createEnvFilter(options?: EnvFilterOptions): EnvFilter {
  return new EnvFilter(options);
}
