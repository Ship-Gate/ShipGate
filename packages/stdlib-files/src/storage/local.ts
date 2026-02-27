/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/storage/local
 */

import { promises as fs, createReadStream, createWriteStream, constants, Stats } from 'fs';
import { join, resolve, dirname, relative, sep } from 'path';
import { pipeline } from 'stream/promises';
import type { 
  StorageAdapter, 
  StorageConfig,
  ReadableStream,
  WritableStream
} from './types';
import type { 
  FileResult, 
  FileListResult,
  ReadOptions,
  WriteOptions,
  CopyOptions,
  DeleteOptions,
  ListOptions,
  FileMetadata,
  UploadResult,
  DownloadResult,
  FileOperationOptions,
  FileEntry,
  FolderEntry
} from '../types';
import { 
  BaseStorageAdapter,
  DefaultPathSanitizer,
  MemoryStorageCache
} from './adapter';
import { 
  FileError, 
  FileErrorCode,
  FileNotFoundError,
  FileAlreadyExistsError,
  AccessDeniedError,
  FolderNotFoundError,
  FolderNotEmptyError
} from '../errors';
import { createHash } from 'crypto';

// ============================================================================
// LOCAL STORAGE CONFIGURATION
// ============================================================================

export interface LocalStorageConfig extends StorageConfig {
  provider: 'LOCAL';
  basePath: string;
  createBasePath?: boolean;
  preserveCase?: boolean;
}

// ============================================================================
// LOCAL STORAGE ADAPTER
// ============================================================================

export class LocalStorageAdapter extends BaseStorageAdapter {
  private basePath = '';
  private preserveCase = true;

  constructor() {
    super(new DefaultPathSanitizer());
  }

  protected async doInitialize(): Promise<void> {
    if (!this.config || this.config.provider !== 'LOCAL') {
      throw new FileError(FileErrorCode.INVALID_INPUT, 'Invalid config for LOCAL storage');
    }

    const localConfig = this.config as LocalStorageConfig;
    this.basePath = resolve(localConfig.basePath);
    this.preserveCase = localConfig.preserveCase ?? true;

    // Ensure base path exists
    try {
      await fs.access(this.basePath);
    } catch {
      if (localConfig.createBasePath) {
        await fs.mkdir(this.basePath, { recursive: true });
      } else {
        throw new FileError(
          FileErrorCode.INVALID_INPUT,
          `Base path does not exist: ${this.basePath}`,
          { basePath: this.basePath }
        );
      }
    }

    // Verify we can write to the base path
    try {
      await fs.access(this.basePath, constants.W_OK);
    } catch {
      throw new FileError(
        FileErrorCode.ACCESS_DENIED,
        `No write access to base path: ${this.basePath}`,
        { basePath: this.basePath }
      );
    }
  }

  protected async checkHealth(): Promise<boolean> {
    try {
      await fs.access(this.basePath, constants.R_OK | constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  protected async doDispose(): Promise<void> {
    // Nothing to dispose for local storage
  }

  // ============================================================================
  // PATH UTILITIES
  // ============================================================================

  private getFullPath(path: string): string {
    const sanitizedPath = this.sanitizePath(path);
    const fullPath = join(this.basePath, sanitizedPath);
    
    // Ensure the resolved path is within the base path (security check)
    const relativePath = relative(this.basePath, fullPath);
    if (relativePath.startsWith('..') || relativePath.includes('..')) {
      throw new FileError(
        FileErrorCode.PATH_TRAVERSAL,
        `Path traversal attempt detected: ${path}`,
        { path, fullPath }
      );
    }

    return fullPath;
  }

  private getRelativePath(fullPath: string): string {
    return relative(this.basePath, fullPath).replace(/\\/g, '/');
  }

  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private statsToMetadata(stats: Stats, path: string): FileMetadata {
    return {
      contentType: 'application/octet-stream', // Default, can be updated
      contentLength: stats.size,
      checksum: '', // Will be calculated if needed
      etag: `${stats.size}-${stats.mtime.getTime()}`,
      lastModified: stats.mtime,
      custom: {}
    };
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  async readFile(
    path: string,
    options?: ReadOptions & FileOperationOptions
  ): Promise<FileResult<Buffer | string | ReadableStream>> {
    try {
      this.ensureInitialized();
      await this.checkAccess('read', path, options);

      const fullPath = this.getFullPath(path);

      try {
        await fs.access(fullPath);
      } catch {
        return { ok: false, error: new FileNotFoundError(path) };
      }

      if (options?.stream) {
        const stream = createReadStream(fullPath, {
          encoding: options.encoding,
          start: options.range?.start,
          end: options.range?.end,
          highWaterMark: 64 * 1024 // 64KB chunks
        });
        return { ok: true, value: stream };
      }

      const content = await fs.readFile(fullPath, options?.encoding);
      return { ok: true, value: content };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  async writeFile(
    path: string,
    content: Buffer | string | ReadableStream,
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    try {
      this.ensureInitialized();
      await this.checkAccess('write', path, options);

      const fullPath = this.getFullPath(path);

      // Check if file exists and overwrite is false
      if (!options?.overwrite) {
        try {
          await fs.access(fullPath);
          return { ok: false, error: new FileAlreadyExistsError(path) };
        } catch {
          // File doesn't exist, continue
        }
      }

      // Ensure directory exists
      if (options?.createPath) {
        await this.ensureDirectoryExists(fullPath);
      }

      // Write the file
      if (content instanceof require('stream').Readable) {
        await this.ensureDirectoryExists(fullPath);
        const writeStream = createWriteStream(fullPath);
        await pipeline(content, writeStream);
      } else {
        await fs.writeFile(fullPath, content, options?.encoding);
      }

      // Get file stats
      const stats = await fs.stat(fullPath);
      const metadata = this.statsToMetadata(stats, path);
      
      // Calculate checksum if needed
      if (stats.size < 100 * 1024 * 1024) { // Only for files < 100MB
        metadata.checksum = await this.calculateChecksum(fullPath);
      }

      await this.emitEvent('file-created', path, { size: stats.size });
      await this.invalidateCache(path);

      return { ok: true, value: metadata };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  async copyFile(
    sourcePath: string,
    destinationPath: string,
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    try {
      this.ensureInitialized();
      await this.checkAccess('read', sourcePath, options);
      await this.checkAccess('write', destinationPath, options);

      const fullSourcePath = this.getFullPath(sourcePath);
      const fullDestPath = this.getFullPath(destinationPath);

      // Check source exists
      try {
        await fs.access(fullSourcePath);
      } catch {
        return { ok: false, error: new FileNotFoundError(sourcePath) };
      }

      // Check destination exists
      if (!options?.overwrite) {
        try {
          await fs.access(fullDestPath);
          return { ok: false, error: new FileAlreadyExistsError(destinationPath) };
        } catch {
          // File doesn't exist, continue
        }
      }

      // Ensure destination directory exists
      await this.ensureDirectoryExists(fullDestPath);

      // Copy the file
      await fs.copyFile(fullSourcePath, fullDestPath);

      // Get metadata
      const stats = await fs.stat(fullDestPath);
      const metadata = this.statsToMetadata(stats, destinationPath);

      if (options?.preserveMetadata) {
        // Copy original file stats
        const sourceStats = await fs.stat(fullSourcePath);
        await fs.utimes(fullDestPath, sourceStats.atime, sourceStats.mtime);
        metadata.lastModified = sourceStats.mtime;
      }

      await this.emitEvent('file-created', destinationPath, { 
        source: sourcePath,
        size: stats.size 
      });
      await this.invalidateCache(destinationPath);

      return { ok: true, value: metadata };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  async deleteFile(
    path: string,
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<void>> {
    try {
      this.ensureInitialized();
      await this.checkAccess('delete', path, options);

      const fullPath = this.getFullPath(path);

      try {
        await fs.access(fullPath);
      } catch {
        return { ok: false, error: new FileNotFoundError(path) };
      }

      await fs.unlink(fullPath);
      await this.emitEvent('file-deleted', path);
      await this.invalidateCache(path);

      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  async getFileMetadata(path: string): Promise<FileResult<FileMetadata>> {
    try {
      this.ensureInitialized();
      const fullPath = this.getFullPath(path);

      const stats = await fs.stat(fullPath);
      const metadata = this.statsToMetadata(stats, path);

      // Try to determine content type from extension
      const ext = path.split('.').pop()?.toLowerCase();
      if (ext) {
        // Simple content type mapping - in production, use a proper MIME type library
        const mimeTypes: Record<string, string> = {
          txt: 'text/plain',
          json: 'application/json',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          gif: 'image/gif',
          pdf: 'application/pdf',
          zip: 'application/zip',
        };
        metadata.contentType = mimeTypes[ext] || 'application/octet-stream';
      }

      return { ok: true, value: metadata };
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return { ok: false, error: new FileNotFoundError(path) };
      }
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  async updateFileMetadata(
    path: string,
    metadata: Partial<FileMetadata>
  ): Promise<FileResult<FileMetadata>> {
    try {
      this.ensureInitialized();
      
      // For local storage, we can't store custom metadata in the filesystem
      // In a real implementation, you might use extended attributes (xattr) or a side database
      const result = await this.getFileMetadata(path);
      if (!result.ok) {
        return result;
      }

      const updatedMetadata = { ...result.value, ...metadata };
      
      // Update custom metadata in a side file if needed
      if (metadata.custom && Object.keys(metadata.custom).length > 0) {
        const metaPath = this.getFullPath(`${path}.metadata.json`);
        await fs.writeFile(metaPath, JSON.stringify(metadata.custom, null, 2));
      }

      return { ok: true, value: updatedMetadata };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  // ============================================================================
  // DIRECTORY OPERATIONS
  // ============================================================================

  async createDirectory(
    path: string,
    options?: { recursive?: boolean } & FileOperationOptions
  ): Promise<FileResult<void>> {
    try {
      this.ensureInitialized();
      await this.checkAccess('write', path, options);

      const fullPath = this.getFullPath(path);

      try {
        await fs.mkdir(fullPath, { recursive: options?.recursive });
        await this.emitEvent('directory-created', path);
        return { ok: true, value: undefined };
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          return { ok: true, value: undefined }; // Directory already exists
        }
        throw error;
      }
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  async listDirectory(
    path: string,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileListResult> {
    try {
      this.ensureInitialized();
      await this.checkAccess('list', path, options);

      const fullPath = this.getFullPath(path);

      try {
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        const files: FileEntry[] = [];
        const folders: FolderEntry[] = [];
        let totalCount = entries.length;

        // Apply filters
        for (const entry of entries) {
          const entryPath = join(path, entry.name);
          
          if (entry.isDirectory()) {
            folders.push({
              id: '' as any, // TODO: Generate ID
              name: entry.name,
              path: entryPath,
              ownerId: '' as any, // TODO: Get from context
              accessLevel: 'PRIVATE' as any,
              sharedWith: [],
              inheritPermissions: true,
              metadata: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } else if (entry.isFile()) {
            const stats = await fs.stat(join(fullPath, entry.name));
            
            // Apply filters
            if (options?.filter) {
              if (options.filter.mimeTypes) {
                const ext = entry.name.split('.').pop()?.toLowerCase();
                // Skip if MIME type not in allowed list
              }
              
              if (options.filter.sizeRange) {
                if (options.filter.sizeRange.min && stats.size < options.filter.sizeRange.min) continue;
                if (options.filter.sizeRange.max && stats.size > options.filter.sizeRange.max) continue;
              }
            }

            files.push({
              id: '' as any, // TODO: Generate ID
              name: entry.name,
              path: entryPath,
              mimeType: 'application/octet-stream', // TODO: Determine from extension
              size: stats.size,
              checksum: '',
              status: 'READY' as any,
              ownerId: '' as any, // TODO: Get from context
              storageProvider: 'LOCAL' as any,
              storageKey: entryPath,
              storageBucket: this.basePath,
              metadata: {},
              createdAt: stats.birthtime,
              updatedAt: stats.mtime,
              accessLevel: 'PRIVATE' as any,
              sharedWith: [],
            });
          }
        }

        // Apply sorting
        if (options?.sort) {
          const { field, order } = options.sort;
          const multiplier = order === 'desc' ? -1 : 1;
          
          files.sort((a, b) => {
            let aVal: any = a[field];
            let bVal: any = b[field];
            
            if (aVal < bVal) return -1 * multiplier;
            if (aVal > bVal) return 1 * multiplier;
            return 0;
          });
        }

        // Apply pagination
        if (options?.pagination) {
          const { offset = 0, limit = 100 } = options.pagination;
          files.splice(0, offset);
          files.splice(limit);
          folders.splice(0, offset);
          folders.splice(limit);
        }

        return {
          ok: true,
          value: {
            files,
            folders,
            totalCount,
            hasMore: options?.pagination ? 
              totalCount > (options.pagination.offset || 0) + (options.pagination.limit || 100) : 
              false
          }
        };
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return { ok: false, error: new FolderNotFoundError(path) };
        }
        if (error.code === 'ENOTDIR') {
          return { ok: false, error: new FileError(FileErrorCode.INVALID_INPUT, `Path is not a directory: ${path}`) };
        }
        throw error;
      }
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  async deleteDirectory(
    path: string,
    options?: { recursive?: boolean } & FileOperationOptions
  ): Promise<FileResult<void>> {
    try {
      this.ensureInitialized();
      await this.checkAccess('delete', path, options);

      const fullPath = this.getFullPath(path);

      try {
        const stats = await fs.stat(fullPath);
        if (!stats.isDirectory()) {
          return { ok: false, error: new FileError(FileErrorCode.INVALID_INPUT, `Path is not a directory: ${path}`) };
        }

        if (options?.recursive) {
          await fs.rm(fullPath, { recursive: true, force: true });
        } else {
          try {
            await fs.rmdir(fullPath);
          } catch (error: any) {
            if (error.code === 'ENOTEMPTY') {
              return { ok: false, error: new FolderNotEmptyError(path) };
            }
            throw error;
          }
        }

        await this.emitEvent('directory-deleted', path);
        return { ok: true, value: undefined };
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return { ok: false, error: new FolderNotFoundError(path) };
        }
        throw error;
      }
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  // ============================================================================
  // UPLOAD/DOWNLOAD URLS (NOT SUPPORTED FOR LOCAL STORAGE)
  // ============================================================================

  async generateUploadUrl(
    path: string,
    options?: any
  ): Promise<FileResult<UploadResult>> {
    return { 
      ok: false, 
      error: new FileError(
        FileErrorCode.INVALID_INPUT,
        'Upload URLs not supported for local storage'
      )
    };
  }

  async generateDownloadUrl(
    path: string,
    options?: any
  ): Promise<FileResult<DownloadResult>> {
    return { 
      ok: false, 
      error: new FileError(
        FileErrorCode.INVALID_INPUT,
        'Download URLs not supported for local storage'
      )
    };
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  async deleteFiles(
    paths: string[],
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<{ deleted: string[]; failed: { path: string; error: string }[] }>> {
    const deleted: string[] = [];
    const failed: { path: string; error: string }[] = [];

    for (const path of paths) {
      const result = await this.deleteFile(path, options);
      if (result.ok) {
        deleted.push(path);
      } else {
        failed.push({ path, error: result.error.message });
      }
    }

    return { ok: true, value: { deleted, failed } };
  }

  async copyFiles(
    sources: { source: string; destination: string }[],
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<{ copied: string[]; failed: { path: string; error: string }[] }>> {
    const copied: string[] = [];
    const failed: { path: string; error: string }[] = [];

    for (const { source, destination } of sources) {
      const result = await this.copyFile(source, destination, options);
      if (result.ok) {
        copied.push(source);
      } else {
        failed.push({ path: source, error: result.error.message });
      }
    }

    return { ok: true, value: { copied, failed } };
  }

  // ============================================================================
  // STORAGE STATISTICS
  // ============================================================================

  async getStorageStats(path?: string): Promise<FileResult<{
    fileCount: number;
    totalSize: number;
    lastModified: Date;
  }>> {
    try {
      this.ensureInitialized();
      const scanPath = path ? this.getFullPath(path) : this.basePath;
      
      let fileCount = 0;
      let totalSize = 0;
      let lastModified = new Date(0);

      async function scanDirectory(dirPath: string): Promise<void> {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dirPath, entry.name);
          
          if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            fileCount++;
            totalSize += stats.size;
            if (stats.mtime > lastModified) {
              lastModified = stats.mtime;
            }
          } else if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          }
        }
      }

      await scanDirectory(scanPath);

      return { 
        ok: true, 
        value: { fileCount, totalSize, lastModified } 
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  async calculateDirectorySize(path: string): Promise<FileResult<number>> {
    try {
      this.ensureInitialized();
      const fullPath = this.getFullPath(path);
      
      let totalSize = 0;

      async function scanDirectory(dirPath: string): Promise<void> {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dirPath, entry.name);
          
          if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
          } else if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          }
        }
      }

      await scanDirectory(fullPath);

      return { ok: true, value: totalSize };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }
}
