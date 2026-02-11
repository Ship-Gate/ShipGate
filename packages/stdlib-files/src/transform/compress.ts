/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/transform/compress
 */

import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip, createDeflate, createInflate } from 'zlib';
import type { FileResult } from '../types';
import { FileError, FileErrorFactory, FileErrorCode } from '../errors';
import { createHash } from 'crypto';

// ============================================================================
// COMPRESSION TYPES
// ============================================================================

export type CompressionFormat = 'gzip' | 'deflate' | 'zip';

export interface CompressionOptions {
  /** Compression level (1-9) */
  level?: number;
  
  /** Chunk size for streaming */
  chunkSize?: number;
  
  /** Whether to include original filename in zip */
  includeFilename?: boolean;
  
  /** Password for zip encryption (not implemented) */
  password?: string;
}

export interface DecompressionOptions {
  /** Chunk size for streaming */
  chunkSize?: number;
  
  /** Password for encrypted zip (not implemented) */
  password?: string;
}

export interface CompressionResult {
  /** Original file size */
  originalSize: number;
  
  /** Compressed file size */
  compressedSize: number;
  
  /** Compression ratio */
  compressionRatio: number;
  
  /** Checksum of compressed file */
  checksum: string;
  
  /** Time taken to compress */
  duration: number;
}

// ============================================================================
// COMPRESSION HANDLER
// ============================================================================

export class CompressionHandler {
  /**
   * Compress a file
   */
  async compressFile(
    inputPath: string,
    outputPath: string,
    format: CompressionFormat = 'gzip',
    options?: CompressionOptions
  ): Promise<FileResult<CompressionResult>> {
    const startTime = Date.now();
    
    try {
      // Create read stream
      const readStream = createReadStream(inputPath, {
        highWaterMark: options?.chunkSize || 64 * 1024
      });

      // Create appropriate compression stream
      let compressStream: NodeJS.ReadWriteStream;
      
      switch (format) {
        case 'gzip':
          compressStream = createGzip({ level: options?.level || 6 });
          break;
        case 'deflate':
          compressStream = createDeflate({ level: options?.level || 6 });
          break;
        case 'zip':
          // For zip, we'd need a proper zip library
          return { 
            ok: false, 
            error: new FileError(
              FileErrorCode.INVALID_INPUT,
              'ZIP compression not implemented - use gzip or deflate'
            )
          };
        default:
          return { 
            ok: false, 
            error: new FileError(
              FileErrorCode.INVALID_INPUT,
              `Unsupported compression format: ${format}`
            )
          };
      }

      // Create write stream
      const writeStream = createWriteStream(outputPath);

      // Track sizes
      let originalSize = 0;
      let compressedSize = 0;

      readStream.on('data', (chunk: Buffer) => {
        originalSize += chunk.length;
      });

      compressStream.on('data', (chunk: Buffer) => {
        compressedSize += chunk.length;
      });

      // Pipe streams
      await pipeline(readStream, compressStream, writeStream);

      // Calculate checksum
      const checksum = await this.calculateChecksum(outputPath);
      const duration = Date.now() - startTime;
      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 0;

      return {
        ok: true,
        value: {
          originalSize,
          compressedSize,
          compressionRatio,
          checksum,
          duration
        }
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Decompress a file
   */
  async decompressFile(
    inputPath: string,
    outputPath: string,
    format: CompressionFormat = 'gzip',
    options?: DecompressionOptions
  ): Promise<FileResult<{ originalSize: number; decompressedSize: number; duration: number }>> {
    const startTime = Date.now();
    
    try {
      // Create read stream
      const readStream = createReadStream(inputPath, {
        highWaterMark: options?.chunkSize || 64 * 1024
      });

      // Create appropriate decompression stream
      let decompressStream: NodeJS.ReadWriteStream;
      
      switch (format) {
        case 'gzip':
          decompressStream = createGunzip();
          break;
        case 'deflate':
          decompressStream = createInflate();
          break;
        case 'zip':
          return { 
            ok: false, 
            error: new FileError(
              FileErrorCode.INVALID_INPUT,
              'ZIP decompression not implemented - use gzip or deflate'
            )
          };
        default:
          return { 
            ok: false, 
            error: new FileError(
              FileErrorCode.INVALID_INPUT,
              `Unsupported compression format: ${format}`
            )
          };
      }

      // Create write stream
      const writeStream = createWriteStream(outputPath);

      // Track sizes
      let originalSize = 0;
      let decompressedSize = 0;

      readStream.on('data', (chunk: Buffer) => {
        originalSize += chunk.length;
      });

      decompressStream.on('data', (chunk: Buffer) => {
        decompressedSize += chunk.length;
      });

      // Pipe streams
      await pipeline(readStream, decompressStream, writeStream);

      const duration = Date.now() - startTime;

      return {
        ok: true,
        value: {
          originalSize,
          decompressedSize,
          duration
        }
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Compress a buffer
   */
  async compressBuffer(
    buffer: Buffer,
    format: CompressionFormat = 'gzip',
    options?: CompressionOptions
  ): Promise<FileResult<{ compressed: Buffer; result: CompressionResult }>> {
    const startTime = Date.now();
    const originalSize = buffer.length;
    
    try {
      let compressed: Buffer;
      
      switch (format) {
        case 'gzip':
          compressed = await this.compressBufferGzip(buffer, options?.level);
          break;
        case 'deflate':
          compressed = await this.compressBufferDeflate(buffer, options?.level);
          break;
        case 'zip':
          return { 
            ok: false, 
            error: new FileError(
              FileErrorCode.INVALID_INPUT,
              'ZIP compression not implemented - use gzip or deflate'
            )
          };
        default:
          return { 
            ok: false, 
            error: new FileError(
              FileErrorCode.INVALID_INPUT,
              `Unsupported compression format: ${format}`
            )
          };
      }

      const checksum = createHash('sha256').update(compressed).digest('hex');
      const duration = Date.now() - startTime;
      const compressionRatio = originalSize > 0 ? compressed.length / originalSize : 0;

      return {
        ok: true,
        value: {
          compressed,
          result: {
            originalSize,
            compressedSize: compressed.length,
            compressionRatio,
            checksum,
            duration
          }
        }
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Decompress a buffer
   */
  async decompressBuffer(
    buffer: Buffer,
    format: CompressionFormat = 'gzip',
    options?: DecompressionOptions
  ): Promise<FileResult<{ decompressed: Buffer; originalSize: number; decompressedSize: number }>> {
    try {
      let decompressed: Buffer;
      
      switch (format) {
        case 'gzip':
          decompressed = await this.decompressBufferGzip(buffer);
          break;
        case 'deflate':
          decompressed = await this.decompressBufferDeflate(buffer);
          break;
        case 'zip':
          return { 
            ok: false, 
            error: new FileError(
              FileErrorCode.INVALID_INPUT,
              'ZIP decompression not implemented - use gzip or deflate'
            )
          };
        default:
          return { 
            ok: false, 
            error: new FileError(
              FileErrorCode.INVALID_INPUT,
              `Unsupported compression format: ${format}`
            )
          };
      }

      return {
        ok: true,
        value: {
          decompressed,
          originalSize: buffer.length,
          decompressedSize: decompressed.length
        }
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Detect compression format from buffer
   */
  detectFormat(buffer: Buffer): CompressionFormat | null {
    // Check magic numbers
    if (buffer.length >= 2) {
      // GZIP magic number: 0x1F 0x8B
      if (buffer[0] === 0x1F && buffer[1] === 0x8B) {
        return 'gzip';
      }
      
      // Deflate magic number (zlib): 0x78
      if (buffer[0] === 0x78) {
        return 'deflate';
      }
    }
    
    return null;
  }

  /**
   * Auto-detect and decompress
   */
  async autoDecompress(
    inputPath: string,
    outputPath: string,
    options?: DecompressionOptions
  ): Promise<FileResult<{ format: CompressionFormat; result: any }>> {
    try {
      // Read first few bytes to detect format
      const fs = await import('fs/promises');
      const file = await fs.open(inputPath, 'r');
      const buffer = Buffer.allocUnsafe(10);
      await file.read(buffer, 0, 10, 0);
      await file.close();

      const format = this.detectFormat(buffer);
      if (!format) {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.INVALID_INPUT,
            'Could not detect compression format'
          )
        };
      }

      // Decompress with detected format
      const result = await this.decompressFile(inputPath, outputPath, format, options);
      
      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        value: { format, result: result.value }
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async compressBufferGzip(buffer: Buffer, level = 6): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      createGzip({ level })
        .on('data', resolve)
        .on('error', reject)
        .end(buffer);
    });
  }

  private async compressBufferDeflate(buffer: Buffer, level = 6): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      createDeflate({ level })
        .on('data', resolve)
        .on('error', reject)
        .end(buffer);
    });
  }

  private async decompressBufferGzip(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      createGunzip()
        .on('data', (chunk: Buffer) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', reject)
        .end(buffer);
    });
  }

  private async decompressBufferDeflate(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      createInflate()
        .on('data', (chunk: Buffer) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', reject)
        .end(buffer);
    });
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const fs = await import('fs/promises');
    const hash = createHash('sha256');
    const file = await fs.open(filePath, 'r');
    
    try {
      const buffer = Buffer.allocUnsafe(64 * 1024);
      let bytesRead = 0;
      
      do {
        bytesRead = (await file.read(buffer, 0, buffer.length, null)).bytesRead;
        if (bytesRead > 0) {
          hash.update(buffer.subarray(0, bytesRead));
        }
      } while (bytesRead > 0);
      
      return hash.digest('hex');
    } finally {
      await file.close();
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export const compressionHandler = new CompressionHandler();

export async function compressFile(
  inputPath: string,
  outputPath: string,
  format?: CompressionFormat,
  options?: CompressionOptions
): Promise<FileResult<CompressionResult>> {
  return compressionHandler.compressFile(inputPath, outputPath, format, options);
}

export async function decompressFile(
  inputPath: string,
  outputPath: string,
  format?: CompressionFormat,
  options?: DecompressionOptions
): Promise<FileResult<{ originalSize: number; decompressedSize: number; duration: number }>> {
  return compressionHandler.decompressFile(inputPath, outputPath, format, options);
}

export async function compressBuffer(
  buffer: Buffer,
  format?: CompressionFormat,
  options?: CompressionOptions
): Promise<FileResult<{ compressed: Buffer; result: CompressionResult }>> {
  return compressionHandler.compressBuffer(buffer, format, options);
}

export async function decompressBuffer(
  buffer: Buffer,
  format?: CompressionFormat,
  options?: DecompressionOptions
): Promise<FileResult<{ decompressed: Buffer; originalSize: number; decompressedSize: number }>> {
  return compressionHandler.decompressBuffer(buffer, format, options);
}
