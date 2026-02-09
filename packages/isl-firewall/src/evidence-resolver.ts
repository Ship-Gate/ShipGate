/**
 * ISL Firewall - Evidence Resolver
 * 
 * Resolves evidence for claims by querying truthpack, filesystem, and package.json.
 * 
 * @module @isl-lang/firewall
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Claim, ClaimType, Evidence, EvidenceSource } from './types.js';
import { parseGoModContent } from './go/go-mod.js';
import { isGoStdlib } from './go/stdlib.js';

// Node.js built-in modules
const BUILTIN_MODULES = new Set([
  'fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util',
  'stream', 'buffer', 'events', 'child_process', 'cluster',
  'dns', 'net', 'readline', 'tls', 'zlib', 'assert', 'async_hooks',
  'fs/promises', 'path/posix', 'path/win32', 'querystring',
  'timers', 'timers/promises', 'perf_hooks', 'worker_threads',
  'v8', 'vm', 'inspector', 'string_decoder',
]);

/**
 * Resolver configuration
 */
export interface ResolverConfig {
  projectRoot: string;
  truthpackPath: string;
  timeout: number;
}

const DEFAULT_CONFIG: ResolverConfig = {
  projectRoot: process.cwd(),
  truthpackPath: '.vibecheck/truthpack',
  timeout: 5000,
};

/**
 * Evidence Resolver - resolves claims against multiple sources
 */
export class EvidenceResolver {
  private config: ResolverConfig;
  private packageJsonCache: Record<string, unknown> | null = null;
  private truthpackCache: Map<string, unknown> = new Map();
  private goModCache: { modulePath: string; require: Map<string, string> } | null | undefined = undefined;

  constructor(config: Partial<ResolverConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Resolve evidence for a single claim
   */
  async resolve(claim: Claim): Promise<Evidence> {
    const resolvers = this.getResolversForType(claim.type);

    for (const resolver of resolvers) {
      try {
        const evidence = await resolver(claim);
        if (evidence.found) {
          return evidence;
        }
      } catch {
        // Continue to next resolver
      }
    }

    return this.createNotFoundEvidence(claim);
  }

  /**
   * Resolve evidence for multiple claims
   */
  async resolveAll(claims: Claim[]): Promise<Evidence[]> {
    const results = await Promise.all(
      claims.map(claim => this.resolve(claim))
    );
    return results;
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.packageJsonCache = null;
    this.truthpackCache.clear();
    this.goModCache = undefined;
  }

  private getResolversForType(type: ClaimType): Array<(claim: Claim) => Promise<Evidence>> {
    const resolverMap: Record<ClaimType, Array<(claim: Claim) => Promise<Evidence>>> = {
      import: [
        this.resolveGoImport.bind(this),
        this.resolveFromPackageJson.bind(this),
        this.resolveFromFilesystem.bind(this),
      ],
      function_call: [
        this.resolveFromTruthpack.bind(this),
      ],
      type_reference: [
        this.resolveFromTruthpack.bind(this),
      ],
      api_endpoint: [
        this.resolveFromTruthpack.bind(this),
      ],
      env_variable: [
        this.resolveFromTruthpack.bind(this),
        this.resolveFromEnvFiles.bind(this),
      ],
      file_reference: [
        this.resolveFromFilesystem.bind(this),
      ],
      package_dependency: [
        this.resolveGoPackageDependency.bind(this),
        this.resolveFromPackageJson.bind(this),
      ],
    };

    return resolverMap[type] ?? [];
  }

  /**
   * Load a truthpack file
   */
  private async loadTruthpack<T>(name: string): Promise<T | null> {
    const cached = this.truthpackCache.get(name);
    if (cached) return cached as T;

    const filePath = path.join(this.config.projectRoot, this.config.truthpackPath, `${name}.json`);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as T;
      this.truthpackCache.set(name, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Resolve from truthpack
   */
  private async resolveFromTruthpack(claim: Claim): Promise<Evidence> {
    switch (claim.type) {
      case 'api_endpoint':
        return this.resolveRouteFromTruthpack(claim);
      case 'env_variable':
        return this.resolveEnvFromTruthpack(claim);
      default:
        return this.createNotFoundEvidence(claim);
    }
  }

  /**
   * Resolve API route from truthpack
   */
  private async resolveRouteFromTruthpack(claim: Claim): Promise<Evidence> {
    interface RoutesData {
      routes: Array<{ path: string; method: string; file: string; line: number }>;
    }

    const routes = await this.loadTruthpack<RoutesData>('routes');
    if (!routes?.routes) {
      return this.createNotFoundEvidence(claim);
    }

    const claimedPath = claim.value;

    for (const route of routes.routes) {
      if (this.pathsMatch(claimedPath, route.path)) {
        return {
          claimId: claim.id,
          found: true,
          source: 'truthpack',
          location: { file: route.file, line: route.line },
          confidence: 1.0,
          details: { matchedRoute: route.path, method: route.method },
        };
      }
    }

    return this.createNotFoundEvidence(claim);
  }

  /**
   * Resolve env var from truthpack
   */
  private async resolveEnvFromTruthpack(claim: Claim): Promise<Evidence> {
    interface EnvData {
      variables: Array<{ name: string; usedIn?: Array<{ file: string; line: number }> }>;
    }

    const env = await this.loadTruthpack<EnvData>('env');
    if (!env?.variables) {
      return this.createNotFoundEvidence(claim);
    }

    const varName = claim.value.replace(/^process\.env\./, '');
    const variable = env.variables.find(v => v.name === varName);

    if (variable) {
      const location = variable.usedIn?.[0];
      return {
        claimId: claim.id,
        found: true,
        source: 'truthpack',
        location: location ? { file: location.file, line: location.line } : undefined,
        confidence: 1.0,
        details: { variableName: variable.name },
      };
    }

    return this.createNotFoundEvidence(claim);
  }

  /**
   * Resolve from .env files
   */
  private async resolveFromEnvFiles(claim: Claim): Promise<Evidence> {
    const envFiles = ['.env', '.env.local', '.env.development', '.env.production', '.env.example'];
    const varName = claim.value.replace(/^process\.env\./, '');

    for (const envFile of envFiles) {
      const filePath = path.join(this.config.projectRoot, envFile);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('#')) continue;
          
          if (line.match(new RegExp(`^${varName}\\s*=`))) {
            return {
              claimId: claim.id,
              found: true,
              source: 'filesystem',
              location: { file: envFile, line: i + 1 },
              confidence: 1.0,
              details: { foundIn: envFile },
            };
          }
        }
      } catch {
        continue;
      }
    }

    return this.createNotFoundEvidence(claim);
  }

  /**
   * Resolve from filesystem
   */
  private async resolveFromFilesystem(claim: Claim): Promise<Evidence> {
    const filePath = path.resolve(this.config.projectRoot, claim.value);

    if (await this.fileExists(filePath)) {
      return {
        claimId: claim.id,
        found: true,
        source: 'filesystem',
        location: { file: claim.value },
        confidence: 1.0,
        details: { resolvedPath: filePath },
      };
    }

    // Try with common extensions
    if (!path.extname(claim.value)) {
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.js'];
      for (const ext of extensions) {
        const fullPath = filePath + ext;
        if (await this.fileExists(fullPath)) {
          return {
            claimId: claim.id,
            found: true,
            source: 'filesystem',
            location: { file: claim.value + ext },
            confidence: 0.9,
            details: { resolvedPath: fullPath, addedExtension: ext },
          };
        }
      }
    }

    return this.createNotFoundEvidence(claim);
  }

  /**
   * Resolve from package.json
   */
  private async resolveFromPackageJson(claim: Claim): Promise<Evidence> {
    if (!this.packageJsonCache) {
      try {
        const content = await fs.readFile(
          path.join(this.config.projectRoot, 'package.json'),
          'utf-8'
        );
        this.packageJsonCache = JSON.parse(content);
      } catch {
        return this.createNotFoundEvidence(claim);
      }
    }

    const pkg = this.packageJsonCache as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    let packageName = claim.value;

    // Handle node: protocol
    if (packageName.startsWith('node:')) {
      packageName = packageName.slice(5);
    }

    // Handle subpath imports
    if (!packageName.startsWith('@')) {
      packageName = packageName.split('/')[0];
    } else {
      const parts = packageName.split('/');
      packageName = parts.slice(0, 2).join('/');
    }

    // Check built-in modules
    if (BUILTIN_MODULES.has(packageName)) {
      return {
        claimId: claim.id,
        found: true,
        source: 'package_json',
        confidence: 1.0,
        details: { packageName, isBuiltin: true },
      };
    }

    // Check dependencies
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };

    if (packageName in allDeps) {
      return {
        claimId: claim.id,
        found: true,
        source: 'package_json',
        location: { file: 'package.json' },
        confidence: 1.0,
        details: { packageName, version: allDeps[packageName] },
      };
    }

    return this.createNotFoundEvidence(claim);
  }

  /**
   * Check if paths match (handling route parameters)
   */
  private pathsMatch(claimed: string, defined: string): boolean {
    if (claimed === defined) return true;

    const claimedParts = claimed.split('/').filter(Boolean);
    const definedParts = defined.split('/').filter(Boolean);

    if (claimedParts.length !== definedParts.length) return false;

    for (let i = 0; i < claimedParts.length; i++) {
      const d = definedParts[i];
      if (d.startsWith(':') || d.startsWith('[') || d.startsWith('{')) continue;
      if (d === '*' || d === '**') continue;
      if (claimedParts[i] !== d) return false;
    }

    return true;
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolve Go import: check stdlib then go.mod
   */
  private async resolveGoImport(claim: Claim): Promise<Evidence> {
    const importPath = claim.value;

    // Skip non-Go imports: JS/TS relative paths, scoped packages, node: protocol
    if (
      importPath.startsWith('./') ||
      importPath.startsWith('../') ||
      importPath.startsWith('@') ||
      importPath.startsWith('node:')
    ) {
      return this.createNotFoundEvidence(claim);
    }

    // Check Go stdlib
    if (isGoStdlib(importPath)) {
      return {
        claimId: claim.id,
        found: true,
        source: 'package_json', // reuse source type
        confidence: 1.0,
        details: { importPath, isGoStdlib: true },
      };
    }

    // Check go.mod for external modules
    const goMod = await this.loadGoMod();
    if (!goMod) return this.createNotFoundEvidence(claim);

    // Check if import is internal to the module
    if (importPath === goMod.modulePath || importPath.startsWith(goMod.modulePath + '/')) {
      return {
        claimId: claim.id,
        found: true,
        source: 'filesystem',
        confidence: 0.9,
        details: { importPath, isInternalModule: true, modulePath: goMod.modulePath },
      };
    }

    // Check if the import's module root is in go.mod require
    for (const [modPath] of goMod.require) {
      if (importPath === modPath || importPath.startsWith(modPath + '/')) {
        return {
          claimId: claim.id,
          found: true,
          source: 'package_json',
          location: { file: 'go.mod' },
          confidence: 1.0,
          details: { importPath, goModule: modPath, version: goMod.require.get(modPath) },
        };
      }
    }

    return this.createNotFoundEvidence(claim);
  }

  /**
   * Resolve Go package dependency: same logic as resolveGoImport but for package_dependency claims
   */
  private async resolveGoPackageDependency(claim: Claim): Promise<Evidence> {
    return this.resolveGoImport(claim);
  }

  /**
   * Load and cache go.mod
   */
  private async loadGoMod(): Promise<{ modulePath: string; require: Map<string, string> } | null> {
    if (this.goModCache !== undefined) return this.goModCache;

    const goModPath = path.join(this.config.projectRoot, 'go.mod');
    try {
      const content = await fs.readFile(goModPath, 'utf-8');
      const dir = path.dirname(goModPath);
      const result = parseGoModContent(content, dir);
      if ('ok' in result && !result.ok) {
        this.goModCache = null;
        return null;
      }
      const goMod = result as { modulePath: string; require: Map<string, string> };
      this.goModCache = goMod;
      return goMod;
    } catch {
      this.goModCache = null;
      return null;
    }
  }

  private createNotFoundEvidence(claim: Claim): Evidence {
    return {
      claimId: claim.id,
      found: false,
      source: 'truthpack',
      confidence: 0,
      details: { searchedValue: claim.value, searchedType: claim.type },
    };
  }
}

/**
 * Create an evidence resolver instance
 */
export function createEvidenceResolver(config?: Partial<ResolverConfig>): EvidenceResolver {
  return new EvidenceResolver(config);
}
