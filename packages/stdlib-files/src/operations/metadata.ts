/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/operations/metadata
 */

import type { StorageAdapter } from '../storage/types';
import type { 
  FileResult,
  FileMetadata,
  FileOperationOptions,
  FilePath,
  FileEntry
} from '../types';
import { FileError, FileErrorFactory, FileErrorCode } from '../errors';
import { createHash } from 'crypto';

// ============================================================================
// METADATA OPERATIONS
// ============================================================================

export class FileMetadataOperations {
  constructor(private storage: StorageAdapter) {}

  /**
   * Get file metadata
   */
  async get(path: FilePath): Promise<FileResult<FileMetadata>> {
    return this.storage.getFileMetadata(path);
  }

  /**
   * Update file metadata
   */
  async update(
    path: FilePath,
    metadata: Partial<FileMetadata>,
    options?: FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    return this.storage.updateFileMetadata(path, metadata, options);
  }

  /**
   * Set custom metadata key-value pairs
   */
  async setCustom(
    path: FilePath,
    custom: Record<string, string>,
    options?: FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    // Get existing metadata
    const getResult = await this.get(path);
    if (!getResult.ok) {
      return getResult;
    }

    // Update custom metadata
    const updatedMetadata = {
      ...getResult.value,
      custom: { ...getResult.value.custom, ...custom }
    };

    return this.update(path, updatedMetadata, options);
  }

  /**
   * Get custom metadata value
   */
  async getCustom(
    path: FilePath,
    key: string
  ): Promise<FileResult<string | undefined>> {
    const getResult = await this.get(path);
    if (!getResult.ok) {
      return getResult;
    }

    return { ok: true, value: getResult.value.custom[key] };
  }

  /**
   * Remove custom metadata key
   */
  async removeCustom(
    path: FilePath,
    key: string,
    options?: FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    const getResult = await this.get(path);
    if (!getResult.ok) {
      return getResult;
    }

    const { [key]: removed, ...remainingCustom } = getResult.value.custom;
    
    return this.update(path, { custom: remainingCustom }, options);
  }

  /**
   * Calculate and update file checksum
   */
  async updateChecksum(
    path: FilePath,
    algorithm: 'sha256' | 'md5' | 'sha1' = 'sha256',
    options?: FileOperationOptions
  ): Promise<FileResult<{ checksum: string; algorithm: string }>> {
    try {
      // Read file content
      const readResult = await this.storage.readFile(path);
      if (!readResult.ok) {
        return readResult;
      }

      const content = readResult.value;
      let buffer: Buffer;

      if (typeof content === 'string') {
        buffer = Buffer.from(content);
      } else if (content instanceof Buffer) {
        buffer = content;
      } else {
        // Stream - collect all chunks
        const chunks: Buffer[] = [];
        for await (const chunk of content) {
          chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
      }

      // Calculate checksum
      const hash = createHash(algorithm).update(buffer).digest('hex');

      // Update metadata
      const updateResult = await this.update(path, { checksum }, options);
      if (!updateResult.ok) {
        return updateResult;
      }

      return { 
        ok: true, 
        value: { checksum: hash, algorithm } 
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Verify file checksum
   */
  async verifyChecksum(
    path: FilePath,
    expectedChecksum: string,
    algorithm: 'sha256' | 'md5' | 'sha1' = 'sha256'
  ): Promise<FileResult<{ valid: boolean; actual: string }>> {
    const updateResult = await this.updateChecksum(path, algorithm);
    
    if (!updateResult.ok) {
      return updateResult;
    }

    const { checksum: actual } = updateResult.value;
    const valid = actual === expectedChecksum;

    return { 
      ok: true, 
      value: { valid, actual } 
    };
  }

  /**
   * Update content type
   */
  async updateContentType(
    path: FilePath,
    contentType: string,
    options?: FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    return this.update(path, { contentType }, options);
  }

  /**
   * Detect content type from file extension
   */
  async detectContentType(path: FilePath): Promise<FileResult<string>> {
    const ext = path.split('.').pop()?.toLowerCase();
    
    if (!ext) {
      return { ok: true, value: 'application/octet-stream' };
    }

    // Simple MIME type mapping - in production, use a proper MIME type library
    const mimeTypes: Record<string, string> = {
      // Text
      txt: 'text/plain',
      html: 'text/html',
      htm: 'text/html',
      css: 'text/css',
      js: 'text/javascript',
      json: 'application/json',
      xml: 'application/xml',
      csv: 'text/csv',
      md: 'text/markdown',

      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      ico: 'image/x-icon',

      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
      aac: 'audio/aac',

      // Video
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      wmv: 'video/x-ms-wmv',
      flv: 'video/x-flv',
      webm: 'video/webm',

      // Documents
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

      // Archives
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      tar: 'application/x-tar',
      gz: 'application/gzip',
      '7z': 'application/x-7z-compressed',

      // Other
      exe: 'application/x-msdownload',
      dmg: 'application/x-apple-diskimage',
      iso: 'application/x-iso9660-image'
    };

    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    return { ok: true, value: mimeType };
  }

  /**
   * Auto-detect and update content type
   */
  async autoDetectContentType(
    path: FilePath,
    options?: FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    const detectResult = await this.detectContentType(path);
    if (!detectResult.ok) {
      return detectResult;
    }

    return this.updateContentType(path, detectResult.value, options);
  }

  /**
   * Copy metadata from one file to another
   */
  async copyMetadata(
    sourcePath: FilePath,
    destinationPath: FilePath,
    options?: FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    const getResult = await this.get(sourcePath);
    if (!getResult.ok) {
      return getResult;
    }

    // Don't copy size-related metadata
    const { contentLength, lastModified, ...metadataToCopy } = getResult.value;
    
    return this.update(destinationPath, metadataToCopy, options);
  }

  /**
   * Batch update metadata
   */
  async batchUpdate(
    updates: Array<{ path: FilePath; metadata: Partial<FileMetadata> }>,
    options?: FileOperationOptions
  ): Promise<FileResult<Array<{ path: FilePath; success: boolean; error?: string }>>> {
    const results: Array<{ path: FilePath; success: boolean; error?: string }> = [];

    for (const { path, metadata } of updates) {
      const result = await this.update(path, metadata, options);
      
      results.push({
        path,
        success: result.ok,
        error: result.ok ? undefined : result.error.message
      });
    }

    return { ok: true, value: results };
  }

  /**
   * Get extended file info (metadata + additional computed fields)
   */
  async getExtendedInfo(
    path: FilePath
  ): Promise<FileResult<{
    metadata: FileMetadata;
    extension?: string;
    isImage: boolean;
    isVideo: boolean;
    isAudio: boolean;
    isDocument: boolean;
    isArchive: boolean;
    isText: boolean;
    sizeHuman: string;
  }>> {
    const metadataResult = await this.get(path);
    if (!metadataResult.ok) {
      return metadataResult;
    }

    const metadata = metadataResult.value;
    const extension = path.split('.').pop()?.toLowerCase();
    
    // Determine file type categories
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
    const videoTypes = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    const audioTypes = ['mp3', 'wav', 'ogg', 'flac', 'aac'];
    const documentTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    const archiveTypes = ['zip', 'rar', 'tar', 'gz', '7z'];
    const textTypes = ['txt', 'html', 'htm', 'css', 'js', 'json', 'xml', 'csv', 'md'];

    const isImage = extension ? imageTypes.includes(extension) : metadata.contentType.startsWith('image/');
    const isVideo = extension ? videoTypes.includes(extension) : metadata.contentType.startsWith('video/');
    const isAudio = extension ? audioTypes.includes(extension) : metadata.contentType.startsWith('audio/');
    const isDocument = extension ? documentTypes.includes(extension) : 
      metadata.contentType === 'application/pdf' ||
      metadata.contentType.includes('document') ||
      metadata.contentType.includes('spreadsheet') ||
      metadata.contentType.includes('presentation');
    const isArchive = extension ? archiveTypes.includes(extension) : 
      metadata.contentType.includes('zip') ||
      metadata.contentType.includes('tar') ||
      metadata.contentType.includes('archive');
    const isText = extension ? textTypes.includes(extension) : metadata.contentType.startsWith('text/');

    // Human-readable size
    const sizeHuman = this.formatBytes(metadata.contentLength);

    return { 
      ok: true, 
      value: {
        metadata,
        extension,
        isImage,
        isVideo,
        isAudio,
        isDocument,
        isArchive,
        isText,
        sizeHuman
      }
    };
  }

  /**
   * Search by custom metadata
   */
  async searchByCustomMetadata(
    basePath: FilePath,
    key: string,
    value?: string,
    options?: FileOperationOptions
  ): Promise<FileResult<FileEntry[]>> {
    // List all files in directory
    const listResult = await this.storage.listDirectory(basePath, options);
    if (!listResult.ok) {
      return listResult;
    }

    const { files } = listResult.value;
    const matches: FileEntry[] = [];

    // Check each file's custom metadata
    for (const file of files) {
      const customResult = await this.getCustom(file.path, key);
      if (customResult.ok) {
        const customValue = customResult.value;
        if (value === undefined || customValue === value) {
          matches.push(file);
        }
      }
    }

    return { ok: true, value: matches };
  }

  /**
   * Add tags to file (using custom metadata)
   */
  async addTags(
    path: FilePath,
    tags: string[],
    options?: FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    const getResult = await this.get(path);
    if (!getResult.ok) {
      return getResult;
    }

    const existingTags = getResult.value.custom.tags || '';
    const tagArray = existingTags ? existingTags.split(',') : [];
    const uniqueTags = [...new Set([...tagArray, ...tags])];
    
    return this.setCustom(path, { tags: uniqueTags.join(',') }, options);
  }

  /**
   * Remove tags from file
   */
  async removeTags(
    path: FilePath,
    tags: string[],
    options?: FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    const getResult = await this.get(path);
    if (!getResult.ok) {
      return getResult;
    }

    const existingTags = getResult.value.custom.tags || '';
    const tagArray = existingTags ? existingTags.split(',') : [];
    const filteredTags = tagArray.filter(tag => !tags.includes(tag));
    
    return this.setCustom(path, { tags: filteredTags.join(',') }, options);
  }

  /**
   * Get file tags
   */
  async getTags(path: FilePath): Promise<FileResult<string[]>> {
    const getResult = await this.getCustom(path, 'tags');
    if (!getResult.ok) {
      return getResult;
    }

    const tagsString = getResult.value;
    const tags = tagsString ? tagsString.split(',').filter(t => t.length > 0) : [];
    
    return { ok: true, value: tags };
  }

  /**
   * Search files by tags
   */
  async searchByTags(
    basePath: FilePath,
    tags: string[],
    matchAll: boolean = false,
    options?: FileOperationOptions
  ): Promise<FileResult<FileEntry[]>> {
    const listResult = await this.storage.listDirectory(basePath, options);
    if (!listResult.ok) {
      return listResult;
    }

    const { files } = listResult.value;
    const matches: FileEntry[] = [];

    for (const file of files) {
      const tagsResult = await this.getTags(file.path);
      if (tagsResult.ok) {
        const fileTags = tagsResult.value;
        
        if (matchAll) {
          // File must have all specified tags
          if (tags.every(tag => fileTags.includes(tag))) {
            matches.push(file);
          }
        } else {
          // File must have at least one specified tag
          if (tags.some(tag => fileTags.includes(tag))) {
            matches.push(file);
          }
        }
      }
    }

    return { ok: true, value: matches };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function createMetadataOperations(storage: StorageAdapter): FileMetadataOperations {
  return new FileMetadataOperations(storage);
}
