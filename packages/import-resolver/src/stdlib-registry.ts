// ============================================================================
// ISL Standard Library Registry
// ============================================================================

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Module entry in the stdlib registry
 */
export interface StdlibModule {
  /** Semantic version of this module */
  version: string;
  /** Relative path from stdlib root to module directory */
  path: string;
  /** Map of sub-module names to ISL file names */
  files: Record<string, string>;
  /** Exported symbols from this module */
  exports: string[];
  /** Human-readable description */
  description: string;
}

/**
 * Stdlib registry structure
 */
export interface StdlibRegistry {
  /** Registry schema version */
  version: string;
  /** Description of the registry */
  description: string;
  /** Map of module names to module definitions */
  modules: Record<string, StdlibModule>;
  /** Alias mappings (e.g., "stdlib-auth" -> "@isl/auth") */
  aliases: Record<string, string>;
}

/**
 * Resolved stdlib module info
 */
export interface ResolvedStdlibModule {
  /** Canonical module name */
  name: string;
  /** Module definition */
  module: StdlibModule;
  /** Absolute path to the module directory */
  absolutePath: string;
  /** Resolved file paths for all ISL files in the module */
  files: Record<string, string>;
}

/**
 * Stdlib Registry Manager
 * 
 * Loads and manages the stdlib registry, resolving module names to paths.
 */
export class StdlibRegistryManager {
  private registry: StdlibRegistry | null = null;
  private stdlibRoot: string;
  private registryPath: string;

  constructor(options: {
    /** Path to stdlib root directory */
    stdlibRoot?: string;
    /** Path to registry JSON file */
    registryPath?: string;
  } = {}) {
    // Default to the stdlib directory relative to this package
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    this.stdlibRoot = options.stdlibRoot ?? path.resolve(__dirname, '../../../stdlib');
    this.registryPath = options.registryPath ?? path.resolve(__dirname, './stdlib-registry.json');
  }

  /**
   * Load the registry from disk
   */
  async load(): Promise<StdlibRegistry> {
    if (this.registry) {
      return this.registry;
    }

    try {
      const content = await fs.readFile(this.registryPath, 'utf-8');
      this.registry = JSON.parse(content) as StdlibRegistry;
      return this.registry;
    } catch (err) {
      // Return default empty registry if file doesn't exist
      this.registry = this.getEmbeddedRegistry();
      return this.registry;
    }
  }

  /**
   * Load registry synchronously from embedded data
   */
  loadSync(): StdlibRegistry {
    if (this.registry) {
      return this.registry;
    }

    this.registry = this.getEmbeddedRegistry();
    return this.registry;
  }

  /**
   * Get embedded fallback registry
   */
  private getEmbeddedRegistry(): StdlibRegistry {
    return {
      version: '1.0.0',
      description: 'ISL Standard Library Module Registry',
      modules: {
        '@isl/auth': {
          version: '1.0.0',
          path: 'stdlib/auth',
          files: {
            'oauth-login': 'oauth-login.isl',
            'password-reset': 'password-reset.isl',
            'rate-limit-login': 'rate-limit-login.isl',
            'session-create': 'session-create.isl',
          },
          exports: ['User', 'Session', 'Role', 'Permission', 'Token', 'Credential', 'AuthResult', 'LoginAttempt'],
          description: 'Authentication and authorization specifications',
        },
        '@isl/rate-limit': {
          version: '1.0.0',
          path: 'packages/stdlib-rate-limit/src',
          files: {
            'index': 'index.isl',
            'sliding-window': 'sliding-window.isl',
            'token-bucket': 'token-bucket.isl',
            'fixed-window': 'fixed-window.isl',
          },
          exports: ['RateLimitConfig', 'RateLimitResult', 'RateLimitKey', 'QuotaConfig', 'QuotaUsage', 'SlidingWindowConfig', 'TokenBucketConfig', 'FixedWindowConfig'],
          description: 'Rate limiting and quota management specifications',
        },
        '@isl/audit': {
          version: '1.0.0',
          path: 'packages/stdlib-audit/src',
          files: {
            'index': 'index.isl',
            'log-entry': 'log-entry.isl',
            'retention': 'retention.isl',
            'query': 'query.isl',
          },
          exports: ['AuditEntry', 'AuditLog', 'AuditQuery', 'AuditRetention', 'AuditEvent', 'AuditActor', 'AuditContext'],
          description: 'Audit logging and compliance specifications',
        },
        '@isl/payments': {
          version: '1.0.0',
          path: 'stdlib/payments',
          files: {
            'process-payment': 'process-payment.isl',
            'process-refund': 'process-refund.isl',
            'subscription-create': 'subscription-create.isl',
            'webhook-handle': 'webhook-handle.isl',
          },
          exports: ['Payment', 'Invoice', 'Subscription', 'Price', 'Currency', 'Transaction', 'Refund', 'Webhook'],
          description: 'Payment processing specifications',
        },
        '@isl/uploads': {
          version: '1.0.0',
          path: 'stdlib/uploads',
          files: {
            'store-blob': 'store-blob.isl',
            'upload-image': 'upload-image.isl',
            'validate-mime': 'validate-mime.isl',
          },
          exports: ['File', 'FileMetadata', 'StorageProvider', 'UploadResult', 'MimeType', 'Blob'],
          description: 'File upload and storage specifications',
        },
        '@isl/datetime': {
          version: '1.0.0',
          path: 'stdlib/datetime',
          files: {
            'index': 'index.isl',
          },
          exports: ['Timestamp', 'Duration', 'TimeZone', 'DateFormat', 'DatePart', 'DayOfWeek', 'DateTimeComponents', 'DurationComponents', 'Now', 'AddDuration', 'SubtractDuration', 'DiffTimestamps', 'FormatTimestamp', 'ParseTimestamp', 'GetDatePart', 'ToComponents', 'FromComponents', 'DurationToMs', 'MsToDuration', 'IsLeapYear', 'DaysInMonth', 'CompareTimestamps', 'IsBefore', 'IsAfter', 'IsBetween'],
          description: 'Date and time operations (deterministic subset with explicit non-deterministic Now)',
        },
        '@isl/strings': {
          version: '1.0.0',
          path: 'stdlib/strings',
          files: {
            'index': 'index.isl',
          },
          exports: ['StringCase', 'TrimMode', 'EmailFormat', 'UrlFormat', 'PhoneFormat', 'StringValidationResult', 'SplitResult', 'Length', 'IsEmpty', 'IsBlank', 'ToLowerCase', 'ToUpperCase', 'ToTitleCase', 'ChangeCase', 'Trim', 'TrimStart', 'TrimEnd', 'TrimChars', 'Contains', 'StartsWith', 'EndsWith', 'IndexOf', 'LastIndexOf', 'Substring', 'Replace', 'ReplaceAll', 'Split', 'Join', 'Concat', 'Repeat', 'PadStart', 'PadEnd', 'Reverse', 'IsValidEmail', 'IsValidUrl', 'IsValidPhone', 'MatchesPattern', 'IsAlpha', 'IsAlphanumeric', 'IsNumeric', 'IsHexadecimal', 'EncodeBase64', 'DecodeBase64', 'EncodeUrl', 'DecodeUrl', 'EscapeHtml', 'UnescapeHtml'],
          description: 'String manipulation and validation operations (all deterministic)',
        },
        '@isl/crypto': {
          version: '1.0.0',
          path: 'stdlib/crypto',
          files: {
            'index': 'index.isl',
          },
          exports: ['HashAlgorithm', 'PasswordHashAlgorithm', 'HmacAlgorithm', 'HashOutput', 'PasswordHash', 'SecureToken', 'HmacSignature', 'SecretKey', 'HashResult', 'PasswordHashConfig', 'Hash', 'HashSHA256', 'HashSHA512', 'HashSHA3', 'HashBlake3', 'HashPassword', 'VerifyPassword', 'NeedsRehash', 'Hmac', 'VerifyHmac', 'GenerateToken', 'GenerateApiKey', 'GenerateBytes', 'DeriveKey', 'ConstantTimeEquals', 'HashFile'],
          description: 'Cryptographic hashing and secure operations',
        },
        '@isl/uuid': {
          version: '1.0.0',
          path: 'stdlib/uuid',
          files: {
            'index': 'index.isl',
          },
          exports: ['UUID', 'UUIDVersion', 'UUIDNamespace', 'UUIDFormat', 'UUIDInfo', 'UUIDComponents', 'GenerateUUID', 'GenerateUUIDv7', 'GenerateUUIDv5', 'GenerateUUIDv3', 'GenerateNamespacedUUID', 'IsValidUUID', 'IsNilUUID', 'IsMaxUUID', 'ParseUUID', 'FormatUUID', 'NormalizeUUID', 'GetUUIDVersion', 'ToComponents', 'FromComponents', 'CompareUUIDs', 'UUIDsEqual'],
          description: 'UUID generation, validation, and parsing',
        },
        '@isl/json': {
          version: '1.0.0',
          path: 'stdlib/json',
          files: {
            'index': 'index.isl',
          },
          exports: ['JSONValue', 'JSONObject', 'JSONArray', 'JSONPath', 'JSONPointer', 'JSONPatchOp', 'JSONFormatOptions', 'JSONParseResult', 'JSONPatch', 'JSONDiff', 'JSONSchemaValidation', 'Parse', 'TryParse', 'Stringify', 'StringifyPretty', 'StringifyCompact', 'Get', 'GetString', 'GetNumber', 'GetBoolean', 'GetArray', 'GetObject', 'Has', 'Set', 'Remove', 'Merge', 'Clone', 'Keys', 'Values', 'Entries', 'Query', 'Equals', 'Diff', 'ApplyPatches', 'IsValid', 'IsObject', 'IsArray', 'IsString', 'IsNumber', 'IsBoolean', 'IsNull', 'Flatten', 'Unflatten', 'Pick', 'Omit'],
          description: 'JSON parsing, serialization, and manipulation (all deterministic)',
        },
      },
      aliases: {
        'stdlib-auth': '@isl/auth',
        'stdlib-rate-limit': '@isl/rate-limit',
        'stdlib-audit': '@isl/audit',
        'stdlib-payments': '@isl/payments',
        'stdlib-uploads': '@isl/uploads',
        'stdlib-billing': '@isl/payments',
        'stdlib-datetime': '@isl/datetime',
        'stdlib-strings': '@isl/strings',
        'stdlib-crypto': '@isl/crypto',
        'stdlib-uuid': '@isl/uuid',
        'stdlib-json': '@isl/json',
      },
    };
  }

  /**
   * Resolve a module name to canonical form
   * Handles aliases like "stdlib-auth" -> "@isl/auth"
   */
  resolveAlias(moduleName: string): string {
    const registry = this.loadSync();
    return registry.aliases[moduleName] ?? moduleName;
  }

  /**
   * Check if a module name is a stdlib module
   */
  isStdlibModule(moduleName: string): boolean {
    const registry = this.loadSync();
    const canonical = this.resolveAlias(moduleName);
    return canonical in registry.modules || canonical.startsWith('@isl/');
  }

  /**
   * Get a stdlib module by name
   */
  getModule(moduleName: string): StdlibModule | null {
    const registry = this.loadSync();
    const canonical = this.resolveAlias(moduleName);
    return registry.modules[canonical] ?? null;
  }

  /**
   * Resolve a stdlib module to absolute paths
   */
  resolveModule(moduleName: string): ResolvedStdlibModule | null {
    const canonical = this.resolveAlias(moduleName);
    const module = this.getModule(canonical);
    
    if (!module) {
      return null;
    }

    const absolutePath = path.resolve(this.stdlibRoot, '..', module.path);
    const files: Record<string, string> = {};
    
    for (const [name, filename] of Object.entries(module.files)) {
      files[name] = path.join(absolutePath, filename);
    }

    return {
      name: canonical,
      module,
      absolutePath,
      files,
    };
  }

  /**
   * Resolve a specific file from a stdlib module
   * e.g., "@isl/auth/oauth-login" -> "/path/to/stdlib/auth/oauth-login.isl"
   */
  resolveModuleFile(importPath: string): string | null {
    // Parse import path: @isl/module/file or @isl/module
    const match = importPath.match(/^(@isl\/[^/]+)(?:\/(.+))?$/);
    if (!match) {
      // Try alias format: stdlib-auth/file
      const aliasMatch = importPath.match(/^(stdlib-[^/]+)(?:\/(.+))?$/);
      if (!aliasMatch) {
        return null;
      }
      const [, alias, file] = aliasMatch;
      const canonical = this.resolveAlias(alias);
      return this.resolveModuleFile(file ? `${canonical}/${file}` : canonical);
    }

    const [, moduleName, subPath] = match;
    const resolved = this.resolveModule(moduleName);
    
    if (!resolved) {
      return null;
    }

    // If no subpath, return the main module path (first file or index)
    if (!subPath) {
      const firstFile = Object.values(resolved.files)[0];
      return firstFile ?? null;
    }

    // Try to match the subpath to a file
    const fileName = subPath.replace(/\.isl$/, '');
    if (fileName in resolved.files) {
      return resolved.files[fileName];
    }

    // Try direct file lookup
    return path.join(resolved.absolutePath, subPath.endsWith('.isl') ? subPath : `${subPath}.isl`);
  }

  /**
   * Get all available module names
   */
  getAvailableModules(): string[] {
    const registry = this.loadSync();
    return Object.keys(registry.modules);
  }

  /**
   * Get all aliases
   */
  getAliases(): Record<string, string> {
    const registry = this.loadSync();
    return { ...registry.aliases };
  }

  /**
   * Get exports from a module
   */
  getModuleExports(moduleName: string): string[] {
    const module = this.getModule(moduleName);
    return module?.exports ?? [];
  }

  /**
   * Check if a symbol is exported from a module
   */
  isExported(moduleName: string, symbolName: string): boolean {
    const exports = this.getModuleExports(moduleName);
    return exports.includes(symbolName);
  }

  /**
   * Set the stdlib root path
   */
  setStdlibRoot(rootPath: string): void {
    this.stdlibRoot = rootPath;
  }

  /**
   * Get the stdlib root path
   */
  getStdlibRoot(): string {
    return this.stdlibRoot;
  }
}

// Singleton instance
let defaultRegistry: StdlibRegistryManager | null = null;

/**
 * Get the default stdlib registry manager
 */
export function getStdlibRegistry(): StdlibRegistryManager {
  if (!defaultRegistry) {
    defaultRegistry = new StdlibRegistryManager();
  }
  return defaultRegistry;
}

/**
 * Create a new stdlib registry manager with custom options
 */
export function createStdlibRegistry(options: {
  stdlibRoot?: string;
  registryPath?: string;
}): StdlibRegistryManager {
  return new StdlibRegistryManager(options);
}

/**
 * Reset the default registry (useful for testing)
 */
export function resetStdlibRegistry(): void {
  defaultRegistry = null;
}
