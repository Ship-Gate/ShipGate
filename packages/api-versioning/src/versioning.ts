/**
 * Main Versioning Module
 * 
 * High-level API for API versioning operations.
 */

import type {
  Domain,
  DomainDiff,
  CompatibilityReport,
  GeneratedTransformers,
  VersioningMiddlewareConfig,
  VersionTransformer,
} from './types.js';
import { diffDomains } from './migration/differ.js';
import { generateTransformers } from './migration/generator.js';
import { createTransformer } from './migration/transformer.js';
import { checkCompatibility, suggestMigrationStrategy } from './compatibility/checker.js';
import { generateReport, generateSummary } from './compatibility/report.js';

/**
 * Versioning API
 */
export class Versioning {
  private domains: Map<string, Domain> = new Map();
  private diffs: Map<string, DomainDiff> = new Map();
  private transformers: Map<string, GeneratedTransformers> = new Map();

  /**
   * Register a domain version
   */
  registerDomain(domain: Domain): void {
    const key = `${domain.name}@${domain.version}`;
    this.domains.set(key, domain);
  }

  /**
   * Get a registered domain
   */
  getDomain(domainKey: string): Domain | undefined {
    return this.domains.get(domainKey);
  }

  /**
   * Diff two domain versions
   */
  diff(fromKey: string, toKey: string): DomainDiff {
    const cacheKey = `${fromKey}->${toKey}`;
    
    // Check cache
    const cached = this.diffs.get(cacheKey);
    if (cached) return cached;
    
    const from = this.domains.get(fromKey);
    const to = this.domains.get(toKey);
    
    if (!from) throw new Error(`Domain not found: ${fromKey}`);
    if (!to) throw new Error(`Domain not found: ${toKey}`);
    
    const diff = diffDomains(from, to);
    this.diffs.set(cacheKey, diff);
    
    return diff;
  }

  /**
   * Check compatibility between versions
   */
  checkCompatibility(fromKey: string, toKey: string) {
    const from = this.domains.get(fromKey);
    const to = this.domains.get(toKey);
    
    if (!from) throw new Error(`Domain not found: ${fromKey}`);
    if (!to) throw new Error(`Domain not found: ${toKey}`);
    
    return checkCompatibility(from, to);
  }

  /**
   * Generate compatibility report
   */
  generateReport(fromKey: string, toKey: string): CompatibilityReport {
    const from = this.domains.get(fromKey);
    const to = this.domains.get(toKey);
    
    if (!from) throw new Error(`Domain not found: ${fromKey}`);
    if (!to) throw new Error(`Domain not found: ${toKey}`);
    
    return generateReport(from, to);
  }

  /**
   * Generate transformers between versions
   */
  generateTransformers(fromKey: string, toKey: string): GeneratedTransformers {
    const cacheKey = `${fromKey}->${toKey}`;
    
    // Check cache
    const cached = this.transformers.get(cacheKey);
    if (cached) return cached;
    
    const diff = this.diff(fromKey, toKey);
    const transformers = generateTransformers(diff);
    
    this.transformers.set(cacheKey, transformers);
    
    return transformers;
  }

  /**
   * Get version transformer functions
   */
  getTransformers(fromKey: string, toKey: string): VersionTransformer {
    const generated = this.generateTransformers(fromKey, toKey);
    return {
      request: generated.requestFn,
      response: generated.responseFn,
    };
  }

  /**
   * Get migration strategy suggestion
   */
  suggestMigration(fromKey: string, toKey: string) {
    const diff = this.diff(fromKey, toKey);
    return suggestMigrationStrategy(diff);
  }

  /**
   * Get summary of changes
   */
  getSummary(fromKey: string, toKey: string): string {
    const from = this.domains.get(fromKey);
    const to = this.domains.get(toKey);
    
    if (!from) throw new Error(`Domain not found: ${fromKey}`);
    if (!to) throw new Error(`Domain not found: ${toKey}`);
    
    return generateSummary(from, to);
  }

  /**
   * Build middleware configuration from registered domains
   */
  buildMiddlewareConfig(
    domainName: string,
    options: Partial<VersioningMiddlewareConfig> = {}
  ): VersioningMiddlewareConfig {
    const versions: Record<string, string> = {};
    const transformerMap: Record<string, VersionTransformer> = {};
    
    // Find all versions of the domain
    const domainVersions: string[] = [];
    for (const [key, domain] of this.domains) {
      if (domain.name === domainName) {
        domainVersions.push(domain.version);
        versions[domain.version] = key;
      }
    }
    
    // Sort versions
    domainVersions.sort((a, b) => compareVersions(a, b));
    
    // Generate transformers between consecutive versions
    for (let i = 0; i < domainVersions.length - 1; i++) {
      const fromVersion = domainVersions[i];
      const toVersion = domainVersions[i + 1];
      const fromKey = `${domainName}@${fromVersion}`;
      const toKey = `${domainName}@${toVersion}`;
      
      const transformerKeyStr = `${fromVersion}->${toVersion}`;
      transformerMap[transformerKeyStr] = this.getTransformers(fromKey, toKey);
    }
    
    // Default to latest version
    const defaultVersion = domainVersions[domainVersions.length - 1] ?? '1';
    
    return {
      strategy: options.strategy ?? 'header',
      header: options.header ?? 'API-Version',
      param: options.param ?? 'version',
      prefix: options.prefix ?? '/v',
      versions,
      default: options.default ?? defaultVersion,
      sunset: options.sunset ?? {},
      transformers: { ...transformerMap, ...options.transformers },
      deprecationUrl: options.deprecationUrl,
    };
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.domains.clear();
    this.diffs.clear();
    this.transformers.clear();
  }
}

/**
 * Compare semantic versions
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    
    if (numA !== numB) {
      return numA - numB;
    }
  }
  
  return 0;
}

/**
 * Create a new Versioning instance
 */
export function createVersioning(): Versioning {
  return new Versioning();
}

// Singleton instance for convenience
let defaultInstance: Versioning | null = null;

/**
 * Get the default Versioning instance
 */
export function getVersioning(): Versioning {
  if (!defaultInstance) {
    defaultInstance = new Versioning();
  }
  return defaultInstance;
}
