/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/storage/adapter
 */

import type { 
  StorageAdapter, 
  StorageConfig, 
  StorageProvider,
  PathSanitizer,
  AccessController,
  StorageCache,
  StorageEvent,
  StorageEventListener
} from './types';
import type { FileResult, FileOperationOptions } from '../types';
import { FileError, FileErrorFactory, FileErrorCode } from '../errors';
import { EventEmitter } from 'events';

// ============================================================================
// BASE STORAGE ADAPTER
// ============================================================================

export abstract class BaseStorageAdapter extends EventEmitter implements StorageAdapter {
  protected config?: StorageConfig;
  protected pathSanitizer: PathSanitizer;
  protected accessController?: AccessController;
  protected cache?: StorageCache;
  protected initialized = false;

  constructor(
    pathSanitizer: PathSanitizer,
    accessController?: AccessController,
    cache?: StorageCache
  ) {
    super();
    this.pathSanitizer = pathSanitizer;
    this.accessController = accessController;
    this.cache = cache;
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  async initialize(config: StorageConfig): Promise<void> {
    this.config = config;
    await this.doInitialize();
    this.initialized = true;
  }

  protected abstract doInitialize(): Promise<void>;

  async isReady(): Promise<boolean> {
    return this.initialized && await this.checkHealth();
  }

  protected abstract checkHealth(): Promise<boolean>;

  getProvider(): StorageProvider {
    if (!this.config) {
      throw new FileError(FileErrorCode.UNKNOWN, 'Storage adapter not initialized');
    }
    return this.config.provider;
  }

  async dispose(): Promise<void> {
    await this.doDispose();
    this.initialized = false;
    this.removeAllListeners();
  }

  protected abstract doDispose(): Promise<void>;

  // ============================================================================
  // PROTECTED HELPERS
  // ============================================================================

  protected ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new FileError(FileErrorCode.UNKNOWN, 'Storage adapter not initialized');
    }
  }

  protected sanitizePath(path: string): string {
    const sanitized = this.pathSanitizer.sanitize(path);
    const validation = this.pathSanitizer.validate(sanitized);
    
    if (!validation.isValid) {
      throw new FileError(
        FileErrorCode.INVALID_PATH,
        validation.error || 'Invalid path',
        { path }
      );
    }

    return sanitized;
  }

  protected async checkAccess(
    operation: 'read' | 'write' | 'delete' | 'list',
    path: string,
    options?: FileOperationOptions
  ): Promise<void> {
    if (!this.accessController || !options?.context?.userId) {
      return; // No access control or no user context
    }

    const userId = options.context.userId;
    let hasAccess = false;

    switch (operation) {
      case 'read':
        hasAccess = await this.accessController.canRead(userId, path);
        break;
      case 'write':
        hasAccess = await this.accessController.canWrite(userId, path);
        break;
      case 'delete':
        hasAccess = await this.accessController.canDelete(userId, path);
        break;
      case 'list':
        hasAccess = await this.accessController.canList(userId, path);
        break;
    }

    if (!hasAccess) {
      throw new FileError(
        FileErrorCode.ACCESS_DENIED,
        `Access denied for ${operation} operation`,
        { path, userId, operation }
      );
    }
  }

  protected async emitEvent(
    type: StorageEvent['type'],
    path: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event: StorageEvent = {
      type,
      path,
      timestamp: new Date(),
      metadata
    };

    this.emit('storage-event', event);
    this.emit(type, event);
  }

  protected async withCache<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (!this.cache) {
      return factory();
    }

    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.cache.set(key, value, ttl);
    return value;
  }

  protected async invalidateCache(pattern: string): Promise<void> {
    if (!this.cache) {
      return;
    }

    // Simple implementation - in a real adapter, you might want pattern matching
    await this.cache.clear();
  }

  // ============================================================================
  // DEFAULT IMPLEMENTATIONS
  // ============================================================================

  async fileExists(path: string): Promise<boolean> {
    try {
      await this.getFileMetadata(path);
      return true;
    } catch (error) {
      if (FileErrorFactory.hasErrorCode(error as FileError, FileErrorCode.FILE_NOT_FOUND)) {
        return false;
      }
      throw error;
    }
  }

  async directoryExists(path: string): Promise<boolean> {
    try {
      await this.listDirectory(path, { limit: 1 });
      return true;
    } catch (error) {
      if (FileErrorFactory.hasErrorCode(error as FileError, FileErrorCode.FOLDER_NOT_FOUND)) {
        return false;
      }
      throw error;
    }
  }

  async moveFile(
    sourcePath: string,
    destinationPath: string,
    options?: FileOperationOptions
  ): Promise<FileResult<any>> {
    // Default implementation: copy then delete
    const copyResult = await this.copyFile(sourcePath, destinationPath, options);
    if (!copyResult.ok) {
      return copyResult;
    }

    const deleteResult = await this.deleteFile(sourcePath, options);
    if (!deleteResult.ok) {
      return deleteResult;
    }

    return copyResult;
  }

  // ============================================================================
  // ABSTRACT METHODS
  // ============================================================================

  abstract readFile(
    path: string,
    options?: any
  ): Promise<FileResult<any>>;

  abstract writeFile(
    path: string,
    content: any,
    options?: any
  ): Promise<FileResult<any>>;

  abstract copyFile(
    sourcePath: string,
    destinationPath: string,
    options?: any
  ): Promise<FileResult<any>>;

  abstract deleteFile(
    path: string,
    options?: any
  ): Promise<FileResult<void>>;

  abstract getFileMetadata(path: string): Promise<FileResult<any>>;

  abstract updateFileMetadata(
    path: string,
    metadata: any
  ): Promise<FileResult<any>>;

  abstract createDirectory(
    path: string,
    options?: any
  ): Promise<FileResult<void>>;

  abstract listDirectory(
    path: string,
    options?: any
  ): Promise<any>;

  abstract deleteDirectory(
    path: string,
    options?: any
  ): Promise<FileResult<void>>;

  abstract generateUploadUrl(
    path: string,
    options?: any
  ): Promise<FileResult<any>>;

  abstract generateDownloadUrl(
    path: string,
    options?: any
  ): Promise<FileResult<any>>;

  abstract deleteFiles(
    paths: string[],
    options?: any
  ): Promise<FileResult<any>>;

  abstract copyFiles(
    sources: { source: string; destination: string }[],
    options?: any
  ): Promise<FileResult<any>>;

  abstract getStorageStats(path?: string): Promise<FileResult<any>>;

  abstract calculateDirectorySize(path: string): Promise<FileResult<number>>;
}

// ============================================================================
// PATH SANITIZER IMPLEMENTATION
// ============================================================================

export class DefaultPathSanitizer implements PathSanitizer {
  private readonly maxPathLength = 1024;
  private readonly forbiddenChars = /[<>:"|?*\x00-\x1f]/;

  sanitize(path: string): string {
    // Normalize path separators
    path = path.replace(/\\/g, '/');

    // Remove duplicate slashes
    path = path.replace(/\/+/g, '/');

    // Remove leading/trailing slashes (except for root)
    if (path.length > 1) {
      path = path.replace(/^\/+/, '').replace(/\/+$/, '');
    }

    // Encode forbidden characters
    path = path.replace(this.forbiddenChars, (char) => {
      return encodeURIComponent(char);
    });

    return path;
  }

  validate(path: string): { isValid: boolean; error?: string } {
    // Check for path traversal attempts
    if (path.includes('../') || path.includes('..\\')) {
      return { isValid: false, error: 'Path traversal detected' };
    }

    // Check for absolute paths (should be relative)
    if (path.startsWith('/') && path !== '/') {
      return { isValid: false, error: 'Absolute paths not allowed' };
    }

    // Check path length
    if (path.length > this.maxPathLength) {
      return { isValid: false, error: `Path too long (max ${this.maxPathLength} characters)` };
    }

    // Check for null bytes
    if (path.includes('\0')) {
      return { isValid: false, error: 'Null bytes not allowed in path' };
    }

    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
    const parts = path.split('/');
    for (const part of parts) {
      if (reservedNames.test(part)) {
        return { isValid: false, error: `Reserved name not allowed: ${part}` };
      }
    }

    return { isValid: true };
  }

  isSafe(path: string): boolean {
    return this.validate(this.sanitize(path)).isValid;
  }
}

// ============================================================================
// NO-OP ACCESS CONTROLLER
// ============================================================================

export class NoOpAccessController implements AccessController {
  async canRead(): Promise<boolean> { return true; }
  async canWrite(): Promise<boolean> { return true; }
  async canDelete(): Promise<boolean> { return true; }
  async canList(): Promise<boolean> { return true; }
}

// ============================================================================
// MEMORY CACHE IMPLEMENTATION
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expires: number;
}

export class MemoryStorageCache implements StorageCache {
  private cache = new Map<string, CacheEntry<any>>();
  private timer?: NodeJS.Timeout;

  constructor(private readonly defaultTtl = 300000) { // 5 minutes default
    // Clean up expired entries every minute
    this.timer = setInterval(() => this.cleanup(), 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expires = Date.now() + (ttl || this.defaultTtl);
    this.cache.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.cache.clear();
  }
}
