/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/storage/memory
 */

import type { 
  StorageAdapter,
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
  DefaultPathSanitizer
} from './adapter';
import { 
  FileError, 
  FileErrorCode,
  FileNotFoundError,
  FileAlreadyExistsError,
  FolderNotFoundError,
  FolderNotEmptyError
} from '../errors';
import { Readable, Writable } from 'stream';

// ============================================================================
// MEMORY STORAGE NODE
// ============================================================================

interface MemoryNode {
  type: 'file' | 'directory';
  name: string;
  path: string;
  parent?: MemoryNode;
  children: Map<string, MemoryNode>;
  content?: Buffer;
  metadata: FileMetadata;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// MEMORY STORAGE ADAPTER
// ============================================================================

export class MemoryStorageAdapter extends BaseStorageAdapter {
  private root: MemoryNode;
  private maxMemory = 100 * 1024 * 1024; // 100MB default

  constructor(maxMemory?: number) {
    super(new DefaultPathSanitizer());
    this.maxMemory = maxMemory || this.maxMemory;
    this.root = this.createDirectory('/', '');
  }

  protected async doInitialize(): Promise<void> {
    // Nothing to initialize for memory storage
  }

  protected async checkHealth(): Promise<boolean> {
    return true;
  }

  protected async doDispose(): Promise<void> {
    // Clear all data
    this.root.children.clear();
  }

  // ============================================================================
  // NODE UTILITIES
  // ============================================================================

  private createDirectory(name: string, path: string): MemoryNode {
    return {
      type: 'directory',
      name,
      path,
      children: new Map(),
      metadata: {
        contentType: 'application/x-directory',
        contentLength: 0,
        checksum: '',
        lastModified: new Date(),
        custom: {}
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private createFile(name: string, path: string, content: Buffer = Buffer.alloc(0)): MemoryNode {
    const now = new Date();
    return {
      type: 'file',
      name,
      path,
      children: new Map(),
      content,
      metadata: {
        contentType: 'application/octet-stream',
        contentLength: content.length,
        checksum: this.calculateChecksum(content),
        etag: `${content.length}-${now.getTime()}`,
        lastModified: now,
        custom: {}
      },
      createdAt: now,
      updatedAt: now
    };
  }

  private calculateChecksum(content: Buffer): string {
    // Simple checksum implementation - in production, use crypto
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private getNode(path: string): MemoryNode | null {
    if (path === '/' || path === '') {
      return this.root;
    }

    const parts = path.split('/').filter(p => p.length > 0);
    let current = this.root;

    for (const part of parts) {
      const child = current.children.get(part);
      if (!child) {
        return null;
      }
      current = child;
    }

    return current;
  }

  private getParentNode(path: string): MemoryNode | null {
    const parts = path.split('/').filter(p => p.length > 0);
    if (parts.length === 0) {
      return null; // Root has no parent
    }

    const parentPath = '/' + parts.slice(0, -1).join('/');
    return this.getNode(parentPath);
  }

  private ensurePathExists(path: string): MemoryNode {
    const parts = path.split('/').filter(p => p.length > 0);
    let current = this.root;
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath + '/' + part;
      let child = current.children.get(part);

      if (!child) {
        child = this.createDirectory(part, currentPath);
        child.parent = current;
        current.children.set(part, child);
      }

      if (child.type !== 'directory') {
        throw new FileError(
          FileErrorCode.INVALID_INPUT,
          `Path component is not a directory: ${part}`
        );
      }

      current = child;
    }

    return current;
  }

  private updateNodeTimestamps(node: MemoryNode): void {
    node.updatedAt = new Date();
    node.metadata.lastModified = node.updatedAt;
    if (node.parent) {
      this.updateNodeTimestamps(node.parent);
    }
  }

  private getTotalMemoryUsage(): number {
    let total = 0;

    function countNode(node: MemoryNode): void {
      if (node.type === 'file' && node.content) {
        total += node.content.length;
      }
      for (const child of node.children.values()) {
        countNode(child);
      }
    }

    countNode(this.root);
    return total;
  }

  private checkMemoryLimit(requiredSize: number): void {
    const currentUsage = this.getTotalMemoryUsage();
    if (currentUsage + requiredSize > this.maxMemory) {
      throw new FileError(
        FileErrorCode.STORAGE_FULL,
        `Memory limit exceeded: ${currentUsage + requiredSize} > ${this.maxMemory}`
      );
    }
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

      const node = this.getNode(path);
      if (!node) {
        return { ok: false, error: new FileNotFoundError(path) };
      }

      if (node.type !== 'file') {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.INVALID_INPUT,
            `Path is not a file: ${path}`
          )
        };
      }

      if (!node.content) {
        return { ok: true, value: Buffer.alloc(0) };
      }

      if (options?.stream) {
        const stream = Readable.from(node.content);
        return { ok: true, value: stream };
      }

      if (options?.encoding) {
        return { ok: true, value: node.content.toString(options.encoding) };
      }

      return { ok: true, value: node.content };
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

      // Convert content to buffer
      let buffer: Buffer;
      if (content instanceof Buffer) {
        buffer = content;
      } else if (typeof content === 'string') {
        buffer = Buffer.from(content, options?.encoding || 'utf8');
      } else if (content instanceof Readable) {
        // Collect stream into buffer
        const chunks: Buffer[] = [];
        for await (const chunk of content) {
          chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
      } else {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.INVALID_INPUT,
            'Unsupported content type'
          )
        };
      }

      // Check memory limit
      this.checkMemoryLimit(buffer.length);

      const parent = this.getParentNode(path);
      if (!parent) {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.INVALID_INPUT,
            'Invalid path: cannot create file at root'
          )
        };
      }

      const name = path.split('/').pop() || '';
      const existingNode = parent.children.get(name);

      if (existingNode) {
        if (!options?.overwrite) {
          return { ok: false, error: new FileAlreadyExistsError(path) };
        }
        if (existingNode.type !== 'file') {
          return { 
            ok: false, 
            error: new FileError(
              FileErrorCode.INVALID_INPUT,
              `Path exists but is not a file: ${path}`
            )
          };
        }
      }

      // Create or update file node
      const node = this.createFile(name, path, buffer);
      node.parent = parent;
      parent.children.set(name, node);
      this.updateNodeTimestamps(node);

      await this.emitEvent('file-created', path, { size: buffer.length });
      await this.invalidateCache(path);

      return { ok: true, value: { ...node.metadata } };
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

      const sourceNode = this.getNode(sourcePath);
      if (!sourceNode) {
        return { ok: false, error: new FileNotFoundError(sourcePath) };
      }

      if (sourceNode.type !== 'file') {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.INVALID_INPUT,
            `Source is not a file: ${sourcePath}`
          )
        };
      }

      const destParent = this.getParentNode(destinationPath);
      if (!destParent) {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.INVALID_INPUT,
            'Invalid destination path'
          )
        };
      }

      const destName = destinationPath.split('/').pop() || '';
      const existingDestNode = destParent.children.get(destName);

      if (existingDestNode && !options?.overwrite) {
        return { ok: false, error: new FileAlreadyExistsError(destinationPath) };
      }

      // Check memory limit
      const contentSize = sourceNode.content?.length || 0;
      if (!existingDestNode) {
        this.checkMemoryLimit(contentSize);
      }

      // Create copy
      const copyNode = this.createFile(
        destName,
        destinationPath,
        sourceNode.content
      );
      copyNode.parent = destParent;
      copyNode.metadata = { ...sourceNode.metadata };
      
      if (options?.preserveMetadata) {
        copyNode.createdAt = sourceNode.createdAt;
        copyNode.updatedAt = sourceNode.updatedAt;
      }

      destParent.children.set(destName, copyNode);
      this.updateNodeTimestamps(copyNode);

      await this.emitEvent('file-created', destinationPath, { 
        source: sourcePath,
        size: contentSize 
      });
      await this.invalidateCache(destinationPath);

      return { ok: true, value: { ...copyNode.metadata } };
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

      const parent = this.getParentNode(path);
      if (!parent) {
        return { ok: false, error: new FileNotFoundError(path) };
      }

      const name = path.split('/').pop() || '';
      const node = parent.children.get(name);

      if (!node) {
        return { ok: false, error: new FileNotFoundError(path) };
      }

      if (node.type !== 'file') {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.INVALID_INPUT,
            `Path is not a file: ${path}`
          )
        };
      }

      parent.children.delete(name);
      this.updateNodeTimestamps(parent);

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
      const node = this.getNode(path);

      if (!node) {
        return { ok: false, error: new FileNotFoundError(path) };
      }

      if (node.type !== 'file') {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.INVALID_INPUT,
            `Path is not a file: ${path}`
          )
        };
      }

      return { ok: true, value: { ...node.metadata } };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  async updateFileMetadata(
    path: string,
    metadata: Partial<FileMetadata>
  ): Promise<FileResult<FileMetadata>> {
    try {
      this.ensureInitialized();
      const node = this.getNode(path);

      if (!node) {
        return { ok: false, error: new FileNotFoundError(path) };
      }

      if (node.type !== 'file') {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.INVALID_INPUT,
            `Path is not a file: ${path}`
          )
        };
      }

      node.metadata = { ...node.metadata, ...metadata };
      this.updateNodeTimestamps(node);

      return { ok: true, value: { ...node.metadata } };
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

      const parent = this.getParentNode(path);
      if (!parent) {
        // Creating root
        return { ok: true, value: undefined };
      }

      const name = path.split('/').pop() || '';
      const existingNode = parent.children.get(name);

      if (existingNode) {
        if (existingNode.type !== 'directory') {
          return { 
            ok: false, 
            error: new FileError(
              FileErrorCode.INVALID_INPUT,
              `Path exists but is not a directory: ${path}`
            )
          };
        }
        return { ok: true, value: undefined }; // Already exists
      }

      if (!options?.recursive && parent !== this.root) {
        // Check if parent exists
        const parentNode = this.getNode(parent.path);
        if (!parentNode) {
          return { 
            ok: false, 
            error: new FolderNotFoundError(parent.path)
          };
        }
      }

      // Ensure parent path exists
      this.ensurePathExists(parent.path);

      // Create directory
      const node = this.createDirectory(name, path);
      node.parent = parent;
      parent.children.set(name, node);
      this.updateNodeTimestamps(node);

      await this.emitEvent('directory-created', path);
      return { ok: true, value: undefined };
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

      const node = this.getNode(path);
      if (!node) {
        return { ok: false, error: new FolderNotFoundError(path) };
      }

      if (node.type !== 'directory') {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.INVALID_INPUT,
            `Path is not a directory: ${path}`
          )
        };
      }

      const files: FileEntry[] = [];
      const folders: FolderEntry[] = [];
      let totalCount = node.children.size;

      for (const [name, child] of node.children) {
        if (child.type === 'file') {
          // Apply filters
          if (options?.filter) {
            if (options.filter.sizeRange) {
              const size = child.content?.length || 0;
              if (options.filter.sizeRange.min && size < options.filter.sizeRange.min) continue;
              if (options.filter.sizeRange.max && size > options.filter.sizeRange.max) continue;
            }
          }

          files.push({
            id: '' as any, // TODO: Generate ID
            name,
            path: child.path,
            mimeType: child.metadata.contentType,
            size: child.metadata.contentLength,
            checksum: child.metadata.checksum,
            status: 'READY' as any,
            ownerId: '' as any, // TODO: Get from context
            storageProvider: 'MEMORY' as any,
            storageKey: child.path,
            storageBucket: 'memory',
            metadata: { ...child.metadata.custom },
            createdAt: child.createdAt,
            updatedAt: child.updatedAt,
            accessLevel: 'PRIVATE' as any,
            sharedWith: [],
          });
        } else if (child.type === 'directory') {
          folders.push({
            id: '' as any, // TODO: Generate ID
            name,
            path: child.path,
            parentId: child.parent?.id as any,
            depth: child.path.split('/').length - 1,
            ownerId: '' as any, // TODO: Get from context
            accessLevel: 'PRIVATE' as any,
            sharedWith: [],
            inheritPermissions: true,
            metadata: { ...child.metadata.custom },
            createdAt: child.createdAt,
            updatedAt: child.updatedAt,
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

      const parent = this.getParentNode(path);
      if (!parent) {
        return { ok: false, error: new FolderNotFoundError(path) };
      }

      const name = path.split('/').pop() || '';
      const node = parent.children.get(name);

      if (!node) {
        return { ok: false, error: new FolderNotFoundError(path) };
      }

      if (node.type !== 'directory') {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.INVALID_INPUT,
            `Path is not a directory: ${path}`
          )
        };
      }

      if (!options?.recursive && node.children.size > 0) {
        return { ok: false, error: new FolderNotEmptyError(path) };
      }

      parent.children.delete(name);
      this.updateNodeTimestamps(parent);

      await this.emitEvent('directory-deleted', path);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  // ============================================================================
  // UPLOAD/DOWNLOAD URLS (NOT SUPPORTED FOR MEMORY STORAGE)
  // ============================================================================

  async generateUploadUrl(
    path: string,
    options?: any
  ): Promise<FileResult<UploadResult>> {
    return { 
      ok: false, 
      error: new FileError(
        FileErrorCode.INVALID_INPUT,
        'Upload URLs not supported for memory storage'
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
        'Download URLs not supported for memory storage'
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
      const node = path ? this.getNode(path) : this.root;
      
      if (!node) {
        return { ok: false, error: new FolderNotFoundError(path || '/') };
      }

      let fileCount = 0;
      let totalSize = 0;
      let lastModified = new Date(0);

      function countFiles(n: MemoryNode): void {
        if (n.type === 'file') {
          fileCount++;
          totalSize += n.content?.length || 0;
          if (n.updatedAt > lastModified) {
            lastModified = n.updatedAt;
          }
        }
        for (const child of n.children.values()) {
          countFiles(child);
        }
      }

      countFiles(node);

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
      const node = this.getNode(path);
      
      if (!node) {
        return { ok: false, error: new FolderNotFoundError(path) };
      }

      let totalSize = 0;

      function calculateSize(n: MemoryNode): void {
        if (n.type === 'file') {
          totalSize += n.content?.length || 0;
        }
        for (const child of n.children.values()) {
          calculateSize(child);
        }
      }

      calculateSize(node);

      return { ok: true, value: totalSize };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }
}
