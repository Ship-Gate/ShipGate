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
        // ======= Canonical 6 Stdlib Modules =======
        '@isl/core': {
          version: '1.0.0',
          path: 'stdlib/core',
          files: {
            'base-types': 'base-types.isl',
          },
          exports: ['Email', 'URL', 'Phone', 'Slug', 'Locale', 'CountryCode', 'IPv4', 'IPv6', 'IPAddress', 'SemVer', 'MimeType', 'UUID', 'ULID', 'CUID', 'Timestamp', 'Duration', 'DateString', 'TimeString', 'DateTimeString', 'TimeZone', 'Currency', 'Money', 'MonetaryAmount', 'Percentage', 'PositiveInt', 'NonNegativeInt', 'ByteSize', 'Markdown', 'HTML', 'JSON', 'PageSize', 'PageOffset', 'Cursor', 'SortDirection', 'PageInfo', 'AuditMetadata'],
          description: 'Base types and primitives (Email, URL, UUID, Timestamp, Currency, pagination)',
        },
        '@isl/auth': {
          version: '1.0.0',
          path: 'stdlib/auth',
          files: {
            'oauth-login': 'oauth-login.isl',
            'password-reset': 'password-reset.isl',
            'rate-limit-login': 'rate-limit-login.isl',
            'session-create': 'session-create.isl',
          },
          exports: ['OAuthCredential', 'PasswordResetRequest', 'LoginAttempt', 'RateLimitBucket', 'LoginBlock', 'Session', 'InitiateOAuth', 'ExchangeOAuthCode', 'RefreshOAuthToken', 'RevokeOAuthCredential', 'RequestPasswordReset', 'ValidateResetToken', 'ResetPassword', 'CheckPasswordStrength', 'CheckLoginRateLimit', 'RecordLoginAttempt', 'CreateSession', 'ValidateSession', 'RevokeSession'],
          description: 'Authentication and authorization (OAuth, sessions, rate limiting)',
        },
        '@isl/http': {
          version: '1.0.0',
          path: 'stdlib/http',
          files: {
            'request-response': 'request-response.isl',
            'middleware': 'middleware.isl',
          },
          exports: ['HTTPRequest', 'HTTPResponse', 'HTTPError', 'CacheControl', 'RequestLog', 'RetryConfig', 'CircuitBreakerConfig', 'SendRequest', 'ParseRequest', 'BuildErrorResponse', 'ValidateContentType', 'LogRequest', 'CompressResponse', 'CalculateRetryDelay', 'CheckCircuitBreaker', 'HTTPMethod', 'HTTPStatusCode', 'ContentType', 'AuthScheme'],
          description: 'HTTP contracts (Request, Response, StatusCode, Headers, middleware)',
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
          exports: ['Payment', 'PaymentCard', 'Refund', 'Plan', 'Subscription', 'SubscriptionInvoice', 'WebhookEvent', 'WebhookEndpoint', 'CreatePayment', 'ProcessPaymentIntent', 'CancelPayment', 'CreateRefund', 'CreateSubscription', 'ReceiveWebhook'],
          description: 'PCI-compliant payment processing (payments, refunds, subscriptions, webhooks)',
        },
        '@isl/storage': {
          version: '1.0.0',
          path: 'stdlib/storage',
          files: {
            'crud': 'crud.isl',
            'search': 'search.isl',
          },
          exports: ['SortSpec', 'FilterSpec', 'PaginationSpec', 'PaginatedResult', 'SoftDeleteMetadata', 'SearchResult', 'SearchFacet', 'SearchIndex', 'Create', 'Read', 'Update', 'Delete', 'List', 'Restore', 'BatchCreate', 'Search', 'Suggest', 'IndexDocument'],
          description: 'Data persistence patterns (CRUD, pagination, search, soft-delete)',
        },
        '@isl/security': {
          version: '1.0.0',
          path: 'stdlib/security',
          files: {
            'rate-limit': 'rate-limit.isl',
            'input-validation': 'input-validation.isl',
            'cors': 'cors.isl',
          },
          exports: ['RateLimitConfig', 'RateLimitState', 'RateLimitResult', 'TokenBucketState', 'ValidationError', 'ValidationResult', 'SanitizationConfig', 'CORSConfig', 'CSRFConfig', 'CSRFToken', 'CheckRateLimit', 'ConsumeToken', 'ValidateInput', 'SanitizeString', 'DetectInjection', 'ValidateEmail', 'ValidateURL', 'CheckCORS', 'HandlePreflight', 'GenerateCSRFToken', 'ValidateCSRFToken'],
          description: 'Security primitives (rate limiting, CORS, CSRF, input validation)',
        },
        // ======= Utility Modules (available via stdlib-* aliases) =======
        '@isl/datetime': {
          version: '1.0.0',
          path: 'stdlib/datetime',
          files: { 'index': 'index.isl' },
          exports: ['Timestamp', 'Duration', 'TimeZone', 'DateFormat', 'DatePart', 'DayOfWeek', 'DateTimeComponents', 'DurationComponents', 'Now', 'AddDuration', 'SubtractDuration', 'DiffTimestamps', 'FormatTimestamp', 'ParseTimestamp', 'GetDatePart', 'ToComponents', 'FromComponents', 'DurationToMs', 'MsToDuration', 'IsLeapYear', 'DaysInMonth', 'CompareTimestamps', 'IsBefore', 'IsAfter', 'IsBetween'],
          description: 'Date and time operations',
        },
        '@isl/strings': {
          version: '1.0.0',
          path: 'stdlib/strings',
          files: { 'index': 'index.isl' },
          exports: ['StringCase', 'TrimMode', 'Length', 'IsEmpty', 'IsBlank', 'ToLowerCase', 'ToUpperCase', 'ToTitleCase', 'Contains', 'StartsWith', 'EndsWith', 'Split', 'Join', 'Concat', 'Replace', 'ReplaceAll', 'Trim', 'IsValidEmail', 'IsValidUrl', 'IsValidPhone', 'MatchesPattern'],
          description: 'String manipulation and validation operations',
        },
        '@isl/crypto': {
          version: '1.0.0',
          path: 'stdlib/crypto',
          files: { 'index': 'index.isl' },
          exports: ['HashAlgorithm', 'PasswordHashAlgorithm', 'HmacAlgorithm', 'HashOutput', 'PasswordHash', 'SecureToken', 'HmacSignature', 'SecretKey', 'HashResult', 'PasswordHashConfig', 'Hash', 'HashSHA256', 'HashSHA512', 'HashPassword', 'VerifyPassword', 'Hmac', 'VerifyHmac', 'GenerateToken', 'GenerateApiKey', 'DeriveKey', 'ConstantTimeEquals'],
          description: 'Cryptographic hashing and secure operations',
        },
        '@isl/uuid': {
          version: '1.0.0',
          path: 'stdlib/uuid',
          files: { 'index': 'index.isl' },
          exports: ['UUID', 'UUIDVersion', 'UUIDNamespace', 'UUIDFormat', 'UUIDInfo', 'UUIDComponents', 'GenerateUUID', 'GenerateUUIDv7', 'GenerateUUIDv5', 'IsValidUUID', 'ParseUUID', 'FormatUUID', 'NormalizeUUID', 'GetUUIDVersion', 'CompareUUIDs', 'UUIDsEqual'],
          description: 'UUID generation, validation, and parsing',
        },
        '@isl/json': {
          version: '1.0.0',
          path: 'stdlib/json',
          files: { 'index': 'index.isl' },
          exports: ['JSONValue', 'JSONObject', 'JSONArray', 'JSONPath', 'JSONPatchOp', 'Parse', 'TryParse', 'Stringify', 'Get', 'Has', 'Set', 'Remove', 'Merge', 'Clone', 'Keys', 'Values', 'Entries', 'Equals', 'Diff', 'IsValid', 'Flatten', 'Unflatten', 'Pick', 'Omit'],
          description: 'JSON parsing, serialization, and manipulation',
        },
      },
      aliases: {
        // Canonical stdlib-* → @isl/* mappings
        'stdlib-core': '@isl/core',
        'stdlib-auth': '@isl/auth',
        'stdlib-http': '@isl/http',
        'stdlib-payments': '@isl/payments',
        'stdlib-storage': '@isl/storage',
        'stdlib-security': '@isl/security',
        // Utility module aliases
        'stdlib-datetime': '@isl/datetime',
        'stdlib-strings': '@isl/strings',
        'stdlib-crypto': '@isl/crypto',
        'stdlib-uuid': '@isl/uuid',
        'stdlib-json': '@isl/json',
        // Convenience aliases (backward compatibility)
        'stdlib-billing': '@isl/payments',
        'stdlib-uploads': '@isl/storage',
        'stdlib-rate-limit': '@isl/security',
        'stdlib-audit': '@isl/security',
        'stdlib-validation': '@isl/security',
        'stdlib-cors': '@isl/security',
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
