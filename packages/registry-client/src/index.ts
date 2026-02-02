/**
 * ISL Package Registry Client
 * 
 * Discover, download, and publish ISL packages.
 */

import * as semver from 'semver';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Package manifest */
export interface PackageManifest {
  name: string;
  version: string;
  description?: string;
  author?: string | { name: string; email?: string };
  license?: string;
  repository?: string | { type: string; url: string };
  keywords?: string[];
  
  /** ISL-specific */
  isl: {
    domain: string;
    version: string;
    exports?: string[];
    dependencies?: Record<string, string>;
  };
  
  /** Files to include */
  files?: string[];
  
  /** Package metadata */
  publishedAt?: string;
  downloads?: number;
  deprecated?: string;
}

/** Package version info */
export interface PackageVersion {
  version: string;
  publishedAt: string;
  deprecated?: string;
  dist: {
    tarball: string;
    shasum: string;
    size: number;
  };
}

/** Package search result */
export interface PackageSearchResult {
  name: string;
  description?: string;
  keywords?: string[];
  version: string;
  author?: string;
  downloads: number;
  score: number;
}

/** Registry configuration */
export interface RegistryConfig {
  /** Registry URL */
  url: string;
  /** Auth token */
  token?: string;
  /** Request timeout */
  timeout?: number;
  /** Retry count */
  retries?: number;
}

/** Publish options */
export interface PublishOptions {
  /** Access level */
  access?: 'public' | 'restricted';
  /** Tag */
  tag?: string;
  /** Dry run */
  dryRun?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry Client
// ─────────────────────────────────────────────────────────────────────────────

export class RegistryClient {
  private config: Required<RegistryConfig>;

  constructor(config: RegistryConfig) {
    this.config = {
      url: config.url.replace(/\/$/, ''),
      token: config.token ?? '',
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
    };
  }

  /**
   * Search for packages
   */
  async search(
    query: string,
    options: { limit?: number; offset?: number; sort?: 'relevance' | 'downloads' | 'recent' } = {}
  ): Promise<{ results: PackageSearchResult[]; total: number }> {
    const params = new URLSearchParams({
      q: query,
      limit: String(options.limit ?? 20),
      offset: String(options.offset ?? 0),
      sort: options.sort ?? 'relevance',
    });

    const response = await this.fetch(`/-/v1/search?${params}`);
    return response;
  }

  /**
   * Get package info
   */
  async getPackage(name: string): Promise<PackageManifest & { versions: Record<string, PackageVersion> }> {
    return this.fetch(`/${encodeURIComponent(name)}`);
  }

  /**
   * Get specific version
   */
  async getVersion(name: string, version: string): Promise<PackageManifest> {
    return this.fetch(`/${encodeURIComponent(name)}/${version}`);
  }

  /**
   * Get latest version matching semver range
   */
  async resolve(name: string, range: string = 'latest'): Promise<string> {
    const pkg = await this.getPackage(name);
    
    if (range === 'latest') {
      // Get the latest non-deprecated version
      const versions = Object.keys(pkg.versions)
        .filter(v => !pkg.versions[v].deprecated)
        .sort(semver.rcompare);
      
      if (versions.length === 0) {
        throw new Error(`No versions available for ${name}`);
      }
      
      return versions[0];
    }

    // Find version matching range
    const versions = Object.keys(pkg.versions);
    const match = semver.maxSatisfying(versions, range);
    
    if (!match) {
      throw new Error(`No version of ${name} matches ${range}`);
    }
    
    return match;
  }

  /**
   * Download package tarball
   */
  async download(name: string, version: string): Promise<ArrayBuffer> {
    const manifest = await this.getVersion(name, version);
    const pkg = await this.getPackage(name);
    const versionInfo = pkg.versions[version];
    
    if (!versionInfo?.dist?.tarball) {
      throw new Error(`No tarball URL for ${name}@${version}`);
    }

    const response = await fetch(versionInfo.dist.tarball, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to download ${name}@${version}: ${response.statusText}`);
    }

    return response.arrayBuffer();
  }

  /**
   * Publish a package
   */
  async publish(manifest: PackageManifest, tarball: ArrayBuffer, options: PublishOptions = {}): Promise<void> {
    if (options.dryRun) {
      console.log(`[dry-run] Would publish ${manifest.name}@${manifest.version}`);
      return;
    }

    const body = {
      name: manifest.name,
      version: manifest.version,
      manifest,
      tarball: Buffer.from(tarball).toString('base64'),
      access: options.access ?? 'public',
      tag: options.tag ?? 'latest',
    };

    await this.fetch(`/${encodeURIComponent(manifest.name)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * Deprecate a version
   */
  async deprecate(name: string, version: string, message: string): Promise<void> {
    await this.fetch(`/${encodeURIComponent(name)}/${version}/deprecate`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  /**
   * Unpublish a version
   */
  async unpublish(name: string, version?: string): Promise<void> {
    const path = version 
      ? `/${encodeURIComponent(name)}/${version}` 
      : `/${encodeURIComponent(name)}`;
    
    await this.fetch(path, { method: 'DELETE' });
  }

  /**
   * Add/update dist-tags
   */
  async tag(name: string, version: string, tag: string): Promise<void> {
    await this.fetch(`/${encodeURIComponent(name)}/dist-tags/${tag}`, {
      method: 'PUT',
      body: JSON.stringify({ version }),
    });
  }

  /**
   * Get dist-tags
   */
  async getTags(name: string): Promise<Record<string, string>> {
    return this.fetch(`/${encodeURIComponent(name)}/dist-tags`);
  }

  /**
   * Get download stats
   */
  async getDownloads(name: string, period: 'day' | 'week' | 'month' | 'year' = 'week'): Promise<{ downloads: number; start: string; end: string }> {
    return this.fetch(`/-/downloads/${period}/${encodeURIComponent(name)}`);
  }

  /**
   * Check if user is logged in
   */
  async whoami(): Promise<{ username: string }> {
    return this.fetch('/-/whoami');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────────

  private async fetch(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.config.url}${path}`;
    const headers = this.getHeaders();

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          headers: {
            ...headers,
            ...(options.headers ?? {}),
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
          throw new RegistryError(error.message ?? response.statusText, response.status);
        }

        return response.json();
      } catch (error) {
        lastError = error as Error;
        
        if (error instanceof RegistryError && error.status < 500) {
          throw error;
        }

        if (attempt < this.config.retries) {
          await sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError ?? new Error('Request failed');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    return headers;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class RegistryError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'RegistryError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a registry client for the default ISL registry
 */
export function createClient(token?: string): RegistryClient {
  return new RegistryClient({
    url: process.env.ISL_REGISTRY_URL ?? 'https://registry.intentos.dev',
    token: token ?? process.env.ISL_REGISTRY_TOKEN,
  });
}

/**
 * Validate package name
 */
export function validatePackageName(name: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!name) {
    errors.push('Package name is required');
  }

  if (name.length > 214) {
    errors.push('Package name cannot be longer than 214 characters');
  }

  if (name.startsWith('.') || name.startsWith('_')) {
    errors.push('Package name cannot start with . or _');
  }

  if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    errors.push('Package name contains invalid characters');
  }

  if (name !== name.toLowerCase()) {
    errors.push('Package name must be lowercase');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse package specifier (name@version)
 */
export function parseSpecifier(spec: string): { name: string; version: string } {
  const atIndex = spec.lastIndexOf('@');
  
  if (atIndex <= 0 || (spec.startsWith('@') && atIndex === spec.indexOf('@'))) {
    return { name: spec, version: 'latest' };
  }

  return {
    name: spec.slice(0, atIndex),
    version: spec.slice(atIndex + 1),
  };
}
