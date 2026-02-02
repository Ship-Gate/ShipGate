/**
 * ISL Firewall - Allowlist Manager
 * 
 * Manages allowed routes, paths, and env vars.
 * 
 * @module @isl-lang/firewall
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { FirewallAllowlist } from './types.js';

const DEFAULT_ALLOWLIST: FirewallAllowlist = {
  allowedRoutePrefixes: [],
  allowedDynamicRoutes: [],
  ignoredPaths: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/*.gen.ts',
    '**/*.generated.*',
  ],
  allowedEnvVars: [],
};

const ALLOWLIST_FILENAME = 'firewall.allow.json';

/**
 * Allowlist Manager for the Agent Firewall
 */
export class AllowlistManager {
  private allowlist: FirewallAllowlist;
  private projectRoot: string;
  private loaded: boolean = false;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.allowlist = { ...DEFAULT_ALLOWLIST };
  }

  /**
   * Get the path to the allowlist file
   */
  private get filePath(): string {
    return path.join(this.projectRoot, '.isl-firewall', ALLOWLIST_FILENAME);
  }

  /**
   * Load the allowlist from disk
   */
  async load(): Promise<FirewallAllowlist> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<FirewallAllowlist>;
      
      this.allowlist = {
        allowedRoutePrefixes: parsed.allowedRoutePrefixes ?? [],
        allowedDynamicRoutes: parsed.allowedDynamicRoutes ?? [],
        ignoredPaths: parsed.ignoredPaths ?? DEFAULT_ALLOWLIST.ignoredPaths,
        allowedEnvVars: parsed.allowedEnvVars ?? [],
      };
      this.loaded = true;
    } catch {
      this.allowlist = { ...DEFAULT_ALLOWLIST };
      this.loaded = true;
    }

    return this.allowlist;
  }

  /**
   * Save the allowlist to disk
   */
  async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // Directory exists
    }

    const content = JSON.stringify(this.allowlist, null, 2);
    await fs.writeFile(this.filePath, content, 'utf-8');
  }

  /**
   * Get the current allowlist
   */
  get(): FirewallAllowlist {
    return this.allowlist;
  }

  /**
   * Check if a route is allowed
   */
  isRouteAllowed(routePath: string): boolean {
    // Check prefixes
    for (const prefix of this.allowlist.allowedRoutePrefixes) {
      if (routePath.startsWith(prefix)) {
        return true;
      }
    }

    // Check dynamic route patterns
    for (const pattern of this.allowlist.allowedDynamicRoutes) {
      try {
        const regex = new RegExp(pattern);
        if (regex.test(routePath)) {
          return true;
        }
      } catch {
        // Invalid regex, skip
      }
    }

    return false;
  }

  /**
   * Check if a file path should be ignored
   */
  isPathIgnored(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    
    for (const pattern of this.allowlist.ignoredPaths) {
      if (this.matchGlob(normalized, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if an env var is allowed
   */
  isEnvVarAllowed(varName: string): boolean {
    for (const allowed of this.allowlist.allowedEnvVars) {
      // Support wildcard suffix
      if (allowed.endsWith('*')) {
        const prefix = allowed.slice(0, -1);
        if (varName.startsWith(prefix)) {
          return true;
        }
      } else if (varName === allowed) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add a route prefix to the allowlist
   */
  async addRoutePrefix(prefix: string): Promise<void> {
    if (!this.allowlist.allowedRoutePrefixes.includes(prefix)) {
      this.allowlist.allowedRoutePrefixes.push(prefix);
      await this.save();
    }
  }

  /**
   * Add an ignored path pattern
   */
  async addIgnoredPath(pattern: string): Promise<void> {
    if (!this.allowlist.ignoredPaths.includes(pattern)) {
      this.allowlist.ignoredPaths.push(pattern);
      await this.save();
    }
  }

  /**
   * Add an allowed env var
   */
  async addEnvVar(varName: string): Promise<void> {
    if (!this.allowlist.allowedEnvVars.includes(varName)) {
      this.allowlist.allowedEnvVars.push(varName);
      await this.save();
    }
  }

  /**
   * Simple glob matching (supports ** and *)
   */
  private matchGlob(filePath: string, pattern: string): boolean {
    // Normalize path
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // Handle common patterns directly for performance
    // **/dirname/** - matches any path containing dirname
    if (pattern.startsWith('**/') && pattern.endsWith('/**')) {
      const dirName = pattern.slice(3, -3);
      return normalizedPath.includes(`/${dirName}/`) || 
             normalizedPath.startsWith(`${dirName}/`) ||
             normalizedPath.includes(`/${dirName}`);
    }
    
    // **/*.ext - matches any file with extension
    if (pattern.startsWith('**/') && pattern.includes('*.')) {
      const suffix = pattern.slice(3); // e.g., "*.gen.ts"
      const suffixRegex = suffix
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*');
      return new RegExp(`${suffixRegex}$`).test(normalizedPath);
    }
    
    // Convert glob pattern to regex for other patterns
    let regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    
    try {
      return new RegExp(`^${regexStr}$`).test(normalizedPath);
    } catch {
      return false;
    }
  }
}

/**
 * Create a new allowlist manager
 */
export function createAllowlistManager(projectRoot: string): AllowlistManager {
  return new AllowlistManager(projectRoot);
}
