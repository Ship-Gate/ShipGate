/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/download/handler
 */

import type { StorageAdapter } from '../storage/types';
import type {
  DownloadHandler,
  DownloadOptions,
  DownloadedFile,
  BatchDownloadOptions,
  BatchDownloadResult,
  DownloadConfig
} from './types';
import type { 
  FileResult, 
  FilePath,
  ProgressCallback,
  FileMetadata
} from '../types';
import { FileError, FileErrorFactory, FileErrorCode } from '../errors';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';

// ============================================================================
// DOWNLOAD HANDLER IMPLEMENTATION
// ============================================================================

export class FileDownloadHandler extends EventEmitter implements DownloadHandler {
  private config: DownloadConfig = {};

  constructor(
    private storage: StorageAdapter,
    config?: DownloadConfig
  ) {
    super();
    this.config = { ...this.getDefaultConfig(), ...config };
  }

  /**
   * Download a file
   */
  async download(
    path: FilePath,
    options?: DownloadOptions
  ): Promise<FileResult<Buffer | string | NodeJS.ReadableStream>> {
    const startTime = Date.now();
    
    try {
      // Get file metadata first
      const metadataResult = await this.storage.getFileMetadata(path);
      if (!metadataResult.ok) {
        return metadataResult;
      }

      const metadata = metadataResult.value;
      
      // Emit download started event
      this.emit('download-started', {
        type: 'download-started',
        file: { path, size: metadata.contentLength },
        timestamp: new Date()
      });

      // Merge with default options
      const mergedOptions = this.mergeOptions(options);

      // Download file
      const result = await this.storage.readFile(path, {
        range: mergedOptions.range,
        encoding: mergedOptions.encoding,
        stream: mergedOptions.stream
      });

      if (!result.ok) {
        this.emit('download-failed', {
          type: 'download-failed',
          file: { path },
          error: result.error.message,
          timestamp: new Date()
        });
        return result;
      }

      // Handle streaming with progress
      if (mergedOptions.stream && this.isReadableStream(result.value)) {
        const stream = result.value as NodeJS.ReadableStream;
        const progressStream = this.createProgressStream(
          stream,
          metadata.contentLength,
          mergedOptions.onProgress
        );
        
        return { ok: true, value: progressStream };
      }

      // Verify checksum if required
      if (mergedOptions.verifyChecksum && metadata.checksum) {
        const buffer = result.value instanceof Buffer ? 
          result.value : 
          Buffer.from(result.value as string);
        
        const actualChecksum = createHash(
          mergedOptions.checksumAlgorithm || 'sha256'
        ).update(buffer).digest('hex');

        if (actualChecksum !== metadata.checksum) {
          const error = new FileError(
            FileErrorCode.CHECKSUM_MISMATCH,
            `Checksum mismatch: expected ${metadata.checksum}, got ${actualChecksum}`
          );
          
          this.emit('download-failed', {
            type: 'download-failed',
            file: { path },
            error: error.message,
            timestamp: new Date()
          });
          
          return { ok: false, error };
        }
      }

      // Emit completion event
      this.emit('download-completed', {
        type: 'download-completed',
        file: { path, size: metadata.contentLength },
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      this.emit('download-failed', {
        type: 'download-failed',
        file: { path },
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Download file to destination
   */
  async downloadTo(
    sourcePath: FilePath,
    destinationPath: FilePath,
    options?: DownloadOptions
  ): Promise<FileResult<DownloadedFile>> {
    const startTime = Date.now();
    
    try {
      // Get source metadata
      const metadataResult = await this.storage.getFileMetadata(sourcePath);
      if (!metadataResult.ok) {
        return metadataResult;
      }

      const metadata = metadataResult.value;
      
      // Merge with default options
      const mergedOptions = this.mergeOptions(options);

      // Download source file
      const downloadResult = await this.download(sourcePath, {
        ...mergedOptions,
        stream: true
      });

      if (!downloadResult.ok) {
        return downloadResult;
      }

      const stream = downloadResult.value as NodeJS.ReadableStream;
      
      // Create destination write stream
      const writeStream = createWriteStream(destinationPath);
      
      // Add progress tracking
      if (mergedOptions.onProgress) {
        let downloaded = 0;
        const total = metadata.contentLength;
        
        stream.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          const percentage = total > 0 ? (downloaded / total) * 100 : 0;
          
          mergedOptions.onProgress!({
            bytesDownloaded: downloaded,
            totalBytes: total,
            percentage
          });
        });
      }

      // Pipe streams
      await pipeline(stream, writeStream);

      // Get destination metadata
      const destMetadata = await this.storage.getFileMetadata(destinationPath);
      if (!destMetadata.ok) {
        return destMetadata;
      }

      const duration = Date.now() - startTime;
      
      // Create downloaded file object
      const downloadedFile: DownloadedFile = {
        path: destinationPath,
        filename: destinationPath.split('/').pop() || '',
        size: destMetadata.value.contentLength,
        contentType: destMetadata.value.contentType,
        checksum: destMetadata.value.checksum,
        downloadedAt: new Date(),
        duration,
        metadata: {
          sourcePath,
          downloadDuration: duration.toString()
        }
      };

      return { ok: true, value: downloadedFile };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Download multiple files
   */
  async downloadBatch(
    paths: FilePath[],
    options?: BatchDownloadOptions
  ): Promise<FileResult<BatchDownloadResult>> {
    const startTime = Date.now();
    const downloadedFiles: DownloadedFile[] = [];
    const failed: Array<{ path: FilePath; error: string }> = [];
    let totalSize = 0;

    try {
      const maxConcurrency = options?.maxConcurrency || 3;
      const chunks = this.chunkArray(paths, maxConcurrency);

      for (const chunk of chunks) {
        const promises = chunk.map(async (path) => {
          try {
            // Determine destination path
            const filename = path.split('/').pop() || '';
            const destinationPath = options?.baseDirectory ? 
              `${options.baseDirectory}/${filename}` : 
              filename;

            // Download file
            const result = await this.downloadTo(path, destinationPath, options);
            
            if (result.ok) {
              downloadedFiles.push(result.value);
              totalSize += result.value.size;
              return { success: true, file: result.value };
            } else {
              failed.push({
                path,
                error: result.error.message
              });
              
              if (!options?.continueOnError) {
                throw result.error;
              }
              
              return { success: false, error: result.error };
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            failed.push({ path, error: errorMessage });
            
            if (!options?.continueOnError) {
              throw error;
            }
            
            return { success: false, error: error as Error };
          }
        });

        const results = await Promise.all(promises);
        
        // Check if any failed and we shouldn't continue
        if (!options?.continueOnError) {
          const failures = results.filter(r => !r.success);
          if (failures.length > 0) {
            return { 
              ok: false, 
              error: failures[0].error as FileError 
            };
          }
        }
      }

      const duration = Date.now() - startTime;

      return {
        ok: true,
        value: {
          files: downloadedFiles,
          failed,
          totalSize,
          duration,
          processed: paths.length
        }
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Stream a file
   */
  async stream(
    path: FilePath,
    options?: DownloadOptions
  ): Promise<FileResult<NodeJS.ReadableStream>> {
    const result = await this.download(path, { ...options, stream: true });
    
    if (!result.ok) {
      return result;
    }

    const value = result.value;
    
    if (this.isReadableStream(value)) {
      return { ok: true, value: value as NodeJS.ReadableStream };
    }

    // Convert buffer/string to stream
    const { Readable } = await import('stream');
    const stream = Readable.from(value);
    
    return { ok: true, value: stream as NodeJS.ReadableStream };
  }

  /**
   * Get download URL if supported
   */
  async getDownloadUrl(
    path: FilePath,
    expiresIn: number = 3600
  ): Promise<FileResult<string>> {
    try {
      const result = await this.storage.generateDownloadUrl(path, { expiresIn });
      
      if (!result.ok) {
        return result;
      }

      return { ok: true, value: result.value.downloadUrl };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Download with resume capability
   */
  async downloadWithResume(
    path: FilePath,
    destinationPath: FilePath,
    resumeFrom: number = 0,
    options?: DownloadOptions
  ): Promise<FileResult<DownloadedFile>> {
    // Get file metadata to check if resume is possible
    const metadataResult = await this.storage.getFileMetadata(path);
    if (!metadataResult.ok) {
      return metadataResult;
    }

    const metadata = metadataResult.value;
    
    if (resumeFrom >= metadata.contentLength) {
      return { 
        ok: false, 
        error: new FileError(
          FileErrorCode.INVALID_INPUT,
          'Resume position exceeds file size'
        )
      };
    }

    // Download with range
    return this.downloadTo(path, destinationPath, {
      ...options,
      range: { start: resumeFrom }
    });
  }

  /**
   * Download as base64 string
   */
  async downloadAsBase64(
    path: FilePath,
    options?: DownloadOptions
  ): Promise<FileResult<string>> {
    const result = await this.download(path, options);
    
    if (!result.ok) {
      return result;
    }

    const value = result.value;
    
    if (typeof value === 'string') {
      // Convert to buffer then to base64
      const buffer = Buffer.from(value, options?.encoding || 'utf8');
      return { ok: true, value: buffer.toString('base64') };
    }
    
    if (value instanceof Buffer) {
      return { ok: true, value: value.toString('base64') };
    }

    // Stream - collect and convert
    const chunks: Buffer[] = [];
    for await (const chunk of value as NodeJS.ReadableStream) {
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
    return { ok: true, value: buffer.toString('base64') };
  }

  /**
   * Download and extract archive
   */
  async downloadAndExtract(
    path: FilePath,
    extractTo: FilePath,
    options?: DownloadOptions
  ): Promise<FileResult<{ extracted: string[]; totalSize: number }>> {
    // For now, just download the file
    // In a real implementation, you would use an extraction library
    const downloadResult = await this.download(path, options);
    
    if (!downloadResult.ok) {
      return downloadResult;
    }

    // TODO: Implement archive extraction
    return { 
      ok: false, 
      error: new FileError(
        FileErrorCode.INVALID_INPUT,
        'Archive extraction not implemented'
      )
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private getDefaultConfig(): DownloadConfig {
    return {
      defaultChunkSize: 64 * 1024, // 64KB
      defaultTimeout: 30000, // 30 seconds
      defaultVerifyChecksum: false,
      defaultChecksumAlgorithm: 'sha256',
      cache: {
        enabled: false,
        maxSize: 100 * 1024 * 1024, // 100MB
        ttl: 3600000 // 1 hour
      },
      rateLimit: {
        enabled: false,
        maxBytesPerSecond: 1024 * 1024 // 1MB/s
      }
    };
  }

  private mergeOptions(options?: DownloadOptions): DownloadOptions {
    const merged = { ...options } as DownloadOptions;

    // Apply defaults
    if (merged.verifyChecksum === undefined && this.config.defaultVerifyChecksum !== undefined) {
      merged.verifyChecksum = this.config.defaultVerifyChecksum;
    }

    if (!merged.checksumAlgorithm && this.config.defaultChecksumAlgorithm) {
      merged.checksumAlgorithm = this.config.defaultChecksumAlgorithm;
    }

    return merged;
  }

  private isReadableStream(value: unknown): boolean {
    return (
      value !== null &&
      typeof value === 'object' &&
      'readable' in value &&
      typeof (value as any).pipe === 'function'
    );
  }

  private createProgressStream(
    stream: NodeJS.ReadableStream,
    totalSize: number,
    onProgress?: ProgressCallback
  ): NodeJS.ReadableStream {
    if (!onProgress) {
      return stream;
    }

    const { Transform } = require('stream');
    let downloaded = 0;

    const progressStream = new Transform({
      transform(chunk: Buffer, encoding: BufferEncoding, callback) {
        downloaded += chunk.length;
        const percentage = totalSize > 0 ? (downloaded / totalSize) * 100 : 0;
        
        onProgress({
          bytesDownloaded: downloaded,
          totalBytes: totalSize,
          percentage
        });

        this.push(chunk, encoding);
        callback();
      }
    });

    stream.pipe(progressStream);
    return progressStream;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function createDownloadHandler(
  storage: StorageAdapter,
  config?: DownloadConfig
): FileDownloadHandler {
  return new FileDownloadHandler(storage, config);
}
