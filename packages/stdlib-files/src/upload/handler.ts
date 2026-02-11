/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/upload/handler
 */

import type { StorageAdapter } from '../storage/types';
import type {
  UploadHandler,
  UploadOptions,
  UploadedFile,
  MultipartFile,
  MultipartUploadOptions,
  MultipartUploadResult,
  UploadValidationResult,
  UploadConfig,
  TempStorage
} from './types';
import type { FileResult, MimeType, FilePath } from '../types';
import { FileError, FileErrorFactory, FileErrorCode } from '../errors';
import { validateUpload } from './validation';
import { MultipartUploadHandler } from './multipart';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';

// ============================================================================
// UPLOAD HANDLER IMPLEMENTATION
// ============================================================================

export class FileUploadHandler extends EventEmitter implements UploadHandler {
  private multipartHandler: MultipartUploadHandler;
  private config: UploadConfig = {};

  constructor(
    private storage: StorageAdapter,
    private tempStorage?: TempStorage,
    config?: UploadConfig
  ) {
    super();
    this.multipartHandler = new MultipartUploadHandler(storage);
    this.config = { ...this.getDefaultConfig(), ...config };
  }

  /**
   * Upload a single file
   */
  async upload(
    file: Buffer | NodeJS.ReadableStream,
    filename: string,
    contentType: MimeType,
    options?: UploadOptions
  ): Promise<FileResult<UploadedFile>> {
    const startTime = Date.now();
    
    try {
      // Emit upload started event
      this.emit('upload-started', {
        type: 'upload-started',
        file: { filename, size: 0, contentType },
        timestamp: new Date()
      });

      // Convert to buffer to get size
      const buffer = file instanceof Buffer ? file : await this.streamToBuffer(file);
      
      // Merge with default options
      const mergedOptions = this.mergeOptions(options);

      // Validate file
      const validation = await validateUpload(
        filename,
        buffer.length,
        contentType,
        mergedOptions
      );

      if (!validation.valid) {
        const error = new FileError(
          FileErrorCode.VALIDATION_FAILED,
          validation.errors.join(', ')
        );
        
        this.emit('upload-failed', {
          type: 'upload-failed',
          file: { filename, size: buffer.length, contentType },
          error: error.message,
          timestamp: new Date()
        });
        
        return { ok: false, error };
      }

      // Use sanitized filename if provided
      const finalFilename = validation.sanitizedFilename || filename;
      
      // Generate unique filename if needed
      const uniqueFilename = mergedOptions.overwrite ? 
        finalFilename : 
        await this.generateUniqueFilename(finalFilename, mergedOptions.directory);

      // Construct full path
      const path = mergedOptions.directory ? 
        `${mergedOptions.directory}/${uniqueFilename}` : 
        uniqueFilename;

      // Calculate checksum if required
      let checksum: string | undefined;
      if (mergedOptions.calculateChecksum || mergedOptions.expectedChecksum) {
        checksum = createHash('sha256').update(buffer).digest('hex');

        // Verify expected checksum
        if (mergedOptions.expectedChecksum && checksum !== mergedOptions.expectedChecksum) {
          const error = new FileError(
            FileErrorCode.CHECKSUM_MISMATCH,
            `Checksum mismatch: expected ${mergedOptions.expectedChecksum}, got ${checksum}`
          );
          
          this.emit('upload-failed', {
            type: 'upload-failed',
            file: { filename: uniqueFilename, size: buffer.length, contentType },
            error: error.message,
            timestamp: new Date()
          });
          
          return { ok: false, error };
        }
      }

      // Write file with progress tracking
      const writeResult = await this.writeFileWithProgress(
        path,
        buffer,
        uniqueFilename,
        buffer.length,
        contentType,
        mergedOptions
      );

      if (!writeResult.ok) {
        this.emit('upload-failed', {
          type: 'upload-failed',
          file: { filename: uniqueFilename, size: buffer.length, contentType },
          error: writeResult.error.message,
          timestamp: new Date()
        });
        
        return writeResult;
      }

      // Update metadata
      const metadata = {
        originalName: filename,
        uploadedAt: new Date().toISOString(),
        uploadDuration: Date.now() - startTime,
        checksum: checksum || '',
        validationWarnings: validation.warnings
      };

      await this.storage.updateFileMetadata(path, { custom: metadata });

      // Create uploaded file object
      const uploadedFile: UploadedFile = {
        originalName: filename,
        filename: uniqueFilename,
        path,
        size: buffer.length,
        contentType,
        checksum,
        uploadedAt: new Date(),
        metadata
      };

      // Emit completion event
      this.emit('upload-completed', {
        type: 'upload-completed',
        file: { filename: uniqueFilename, size: buffer.length, contentType },
        timestamp: new Date()
      });

      return { ok: true, value: uploadedFile };
    } catch (error) {
      this.emit('upload-failed', {
        type: 'upload-failed',
        file: { filename, size: 0, contentType },
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Upload multiple files (multipart)
   */
  async uploadMultipart(
    files: MultipartFile[],
    options?: MultipartUploadOptions
  ): Promise<FileResult<MultipartUploadResult>> {
    // Merge with default options
    const mergedOptions = this.mergeOptions(options);

    // Forward to multipart handler
    const result = await this.multipartHandler.upload(files, mergedOptions);

    // Emit events for each file
    if (result.ok) {
      for (const file of result.value.files) {
        this.emit('upload-completed', {
          type: 'upload-completed',
          file: { filename: file.filename, size: file.size, contentType: file.contentType },
          timestamp: new Date()
        });
      }

      for (const failure of result.value.failed) {
        this.emit('upload-failed', {
          type: 'upload-failed',
          file: { filename: failure.filename, size: 0, contentType: 'application/octet-stream' },
          error: failure.error,
          timestamp: new Date()
        });
      }
    }

    return result;
  }

  /**
   * Generate unique filename
   */
  async generateUniqueFilename(
    filename: string,
    directory?: FilePath
  ): Promise<string> {
    return this.multipartHandler.generateUniqueFilename(filename, directory);
  }

  /**
   * Validate file before upload
   */
  async validate(
    filename: string,
    size: number,
    contentType: MimeType,
    options?: UploadOptions
  ): Promise<UploadValidationResult> {
    const mergedOptions = this.mergeOptions(options);
    return validateUpload(filename, size, contentType, mergedOptions);
  }

  /**
   * Upload from URL
   */
  async uploadFromUrl(
    url: string,
    filename?: string,
    options?: UploadOptions
  ): Promise<FileResult<UploadedFile>> {
    try {
      // Fetch file from URL
      const response = await fetch(url);
      
      if (!response.ok) {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.NETWORK_ERROR,
            `Failed to fetch URL: ${response.status} ${response.statusText}`
          )
        };
      }

      // Get content type
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      
      // Get filename from URL or Content-Disposition header
      if (!filename) {
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }
        
        if (!filename) {
          filename = url.split('/').pop() || 'download';
        }
      }

      // Get content as buffer
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Upload file
      return this.upload(buffer, filename, contentType, options);
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Resume interrupted upload
   */
  async resumeUpload(
    uploadId: string,
    file: Buffer | NodeJS.ReadableStream,
    options?: UploadOptions
  ): Promise<FileResult<UploadedFile>> {
    // Check if temp storage is available
    if (!this.tempStorage) {
      return { 
        ok: false, 
        error: new FileError(
          FileErrorCode.INVALID_INPUT,
          'Temp storage required for resume upload'
        )
      };
    }

    try {
      // Get upload info from temp storage
      const uploadInfo = await this.tempStorage.getInfo(uploadId);
      if (!uploadInfo) {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.FILE_NOT_FOUND,
            'Upload session not found'
          )
        };
      }

      // Get partial file
      const partialFile = await this.tempStorage.retrieve(uploadId);
      
      // Append new data
      const buffer = file instanceof Buffer ? file : await this.streamToBuffer(file);
      const combinedBuffer = Buffer.concat([
        partialFile as Buffer,
        buffer
      ]);

      // Complete upload
      return this.upload(
        combinedBuffer,
        uploadInfo.filename,
        'application/octet-stream', // Should be stored in upload info
        options
      );
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Create chunked upload session
   */
  async createChunkedUpload(
    filename: string,
    totalSize: number,
    contentType: MimeType,
    options?: UploadOptions
  ): Promise<FileResult<{ uploadId: string; chunkSize: number }>> {
    if (!this.tempStorage) {
      return { 
        ok: false, 
        error: new FileError(
          FileErrorCode.INVALID_INPUT,
          'Temp storage required for chunked upload'
        )
      };
    }

    try {
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const chunkSize = 1024 * 1024; // 1MB chunks

      // Store upload metadata
      await this.tempStorage.store(
        Buffer.from(JSON.stringify({
          filename,
          totalSize,
          contentType,
          uploaded: 0,
          chunks: []
        })),
        `${uploadId}_meta`
      );

      return { 
        ok: true, 
        value: { uploadId, chunkSize } 
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Upload chunk
   */
  async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunk: Buffer,
    options?: UploadOptions
  ): Promise<FileResult<{ received: boolean; complete: boolean }>> {
    if (!this.tempStorage) {
      return { 
        ok: false, 
        error: new FileError(
          FileErrorCode.INVALID_INPUT,
          'Temp storage required for chunked upload'
        )
      };
    }

    try {
      // Store chunk
      await this.tempStorage.store(chunk, `${uploadId}_chunk_${chunkIndex}`);
      
      // Get upload metadata
      const metaBuffer = await this.tempStorage.retrieve(`${uploadId}_meta`);
      const metadata = JSON.parse(metaBuffer.toString());
      
      metadata.chunks.push(chunkIndex);
      metadata.uploaded += chunk.length;
      
      // Update metadata
      await this.tempStorage.store(
        Buffer.from(JSON.stringify(metadata)),
        `${uploadId}_meta`
      );

      // Check if complete
      const complete = metadata.uploaded >= metadata.totalSize;
      
      // If complete, assemble and upload
      if (complete) {
        const chunks: Buffer[] = [];
        for (let i = 0; i < metadata.chunks.length; i++) {
          const chunkBuffer = await this.tempStorage.retrieve(`${uploadId}_chunk_${i}`);
          chunks.push(chunkBuffer as Buffer);
        }
        
        const fullBuffer = Buffer.concat(chunks);
        
        // Upload complete file
        const uploadResult = await this.upload(
          fullBuffer,
          metadata.filename,
          metadata.contentType,
          options
        );

        if (!uploadResult.ok) {
          return uploadResult;
        }

        // Clean up temp files
        await this.tempStorage.delete(`${uploadId}_meta`);
        for (let i = 0; i < metadata.chunks.length; i++) {
          await this.tempStorage.delete(`${uploadId}_chunk_${i}`);
        }
      }

      return { 
        ok: true, 
        value: { received: true, complete } 
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private getDefaultConfig(): UploadConfig {
    return {
      defaultMaxSize: 100 * 1024 * 1024, // 100MB
      defaultAllowedMimeTypes: [],
      defaultAllowedExtensions: [],
      defaultDirectory: 'uploads',
      defaultOverwrite: false,
      defaultCalculateChecksum: false
    };
  }

  private mergeOptions<T extends UploadOptions | MultipartUploadOptions>(
    options?: T
  ): T {
    const merged = { ...options } as T;

    // Apply defaults
    if (!merged.maxSize && this.config.defaultMaxSize) {
      (merged as any).maxSize = this.config.defaultMaxSize;
    }

    if (!merged.allowedMimeTypes && this.config.defaultAllowedMimeTypes) {
      (merged as any).allowedMimeTypes = this.config.defaultAllowedMimeTypes;
    }

    if (!merged.allowedExtensions && this.config.defaultAllowedExtensions) {
      (merged as any).allowedExtensions = this.config.defaultAllowedExtensions;
    }

    if (!merged.directory && this.config.defaultDirectory) {
      (merged as any).directory = this.config.defaultDirectory;
    }

    if (merged.overwrite === undefined && this.config.defaultOverwrite !== undefined) {
      (merged as any).overwrite = this.config.defaultOverwrite;
    }

    if (merged.calculateChecksum === undefined && this.config.defaultCalculateChecksum !== undefined) {
      (merged as any).calculateChecksum = this.config.defaultCalculateChecksum;
    }

    return merged;
  }

  private async writeFileWithProgress(
    path: string,
    buffer: Buffer,
    filename: string,
    size: number,
    contentType: MimeType,
    options: UploadOptions
  ): Promise<FileResult<any>> {
    if (!options.onProgress) {
      return this.storage.writeFile(path, buffer, options);
    }

    // Simulate progress for buffer uploads
    const chunkSize = 64 * 1024; // 64KB
    let uploaded = 0;

    const progressInterval = setInterval(() => {
      uploaded = Math.min(uploaded + chunkSize, size);
      const percentage = (uploaded / size) * 100;
      
      options.onProgress!({
        bytesUploaded: uploaded,
        totalBytes: size,
        percentage
      });

      if (uploaded >= size) {
        clearInterval(progressInterval);
      }
    }, 10);

    try {
      const result = await this.storage.writeFile(path, buffer, options);
      clearInterval(progressInterval);
      
      // Send final progress
      options.onProgress!({
        bytesUploaded: size,
        totalBytes: size,
        percentage: 100
      });
      
      return result;
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function createUploadHandler(
  storage: StorageAdapter,
  tempStorage?: TempStorage,
  config?: UploadConfig
): FileUploadHandler {
  return new FileUploadHandler(storage, tempStorage, config);
}
