/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/operations/read
 */

import type { StorageAdapter } from '../storage/types';
import type { 
  FileResult,
  ReadOptions,
  FileOperationOptions,
  ReadableStream,
  FilePath
} from '../types';
import { FileError, FileErrorFactory, FileErrorCode } from '../errors';

// ============================================================================
// READ OPERATIONS
// ============================================================================

export class FileReadOperations {
  constructor(private storage: StorageAdapter) {}

  /**
   * Read a file as buffer
   */
  async readAsBuffer(
    path: FilePath,
    options?: FileOperationOptions
  ): Promise<FileResult<Buffer>> {
    const result = await this.storage.readFile(path, options);
    
    if (!result.ok) {
      return result;
    }

    const value = result.value;
    if (typeof value === 'string') {
      return { ok: true, value: Buffer.from(value) };
    }
    
    if (value instanceof Buffer) {
      return { ok: true, value };
    }

    // Stream - convert to buffer
    if (this.isReadableStream(value)) {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of value) {
          chunks.push(chunk);
        }
        return { ok: true, value: Buffer.concat(chunks) };
      } catch (error) {
        return { ok: false, error: FileErrorFactory.fromError(error) };
      }
    }

    return { 
      ok: false, 
      error: new FileError(
        FileErrorCode.UNKNOWN,
        'Unexpected return type from storage adapter'
      )
    };
  }

  /**
   * Read a file as string
   */
  async readAsString(
    path: FilePath,
    encoding: BufferEncoding = 'utf8',
    options?: FileOperationOptions
  ): Promise<FileResult<string>> {
    const result = await this.storage.readFile(path, { ...options, encoding });
    
    if (!result.ok) {
      return result;
    }

    const value = result.value;
    if (typeof value === 'string') {
      return { ok: true, value };
    }
    
    if (value instanceof Buffer) {
      return { ok: true, value: value.toString(encoding) };
    }

    // Stream - convert to string
    if (this.isReadableStream(value)) {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of value) {
          chunks.push(chunk);
        }
        return { ok: true, value: Buffer.concat(chunks).toString(encoding) };
      } catch (error) {
        return { ok: false, error: FileErrorFactory.fromError(error) };
      }
    }

    return { 
      ok: false, 
      error: new FileError(
        FileErrorCode.UNKNOWN,
        'Unexpected return type from storage adapter'
      )
    };
  }

  /**
   * Read a file as JSON
   */
  async readAsJson<T = any>(
    path: FilePath,
    encoding: BufferEncoding = 'utf8',
    options?: FileOperationOptions
  ): Promise<FileResult<T>> {
    const stringResult = await this.readAsString(path, encoding, options);
    
    if (!stringResult.ok) {
      return stringResult;
    }

    try {
      const parsed = JSON.parse(stringResult.value);
      return { ok: true, value: parsed };
    } catch (error) {
      return { 
        ok: false, 
        error: new FileError(
          FileErrorCode.CORRUPTED_FILE,
          `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
          { path }
        )
      };
    }
  }

  /**
   * Read a file as a stream
   */
  async readAsStream(
    path: FilePath,
    options?: ReadOptions & FileOperationOptions
  ): Promise<FileResult<ReadableStream>> {
    const result = await this.storage.readFile(path, { ...options, stream: true });
    
    if (!result.ok) {
      return result;
    }

    const value = result.value;
    
    if (this.isReadableStream(value)) {
      return { ok: true, value };
    }

    // Convert buffer/string to stream
    if (value instanceof Buffer || typeof value === 'string') {
      const { Readable } = await import('stream');
      const stream = Readable.from(value);
      return { ok: true, value: stream as ReadableStream };
    }

    return { 
      ok: false, 
      error: new FileError(
        FileErrorCode.UNKNOWN,
        'Could not create stream from storage result'
      )
    };
  }

  /**
   * Read a file in chunks
   */
  async readInChunks(
    path: FilePath,
    chunkSize: number = 64 * 1024, // 64KB default
    options?: FileOperationOptions
  ): Promise<FileResult<AsyncIterable<Buffer>>> {
    const streamResult = await this.readAsStream(path, options);
    
    if (!streamResult.ok) {
      return streamResult;
    }

    const stream = streamResult.value;
    
    return { 
      ok: true, 
      value: this.createChunkIterable(stream, chunkSize) 
    };
  }

  /**
   * Read a file range (partial content)
   */
  async readRange(
    path: FilePath,
    start: number,
    end?: number,
    options?: FileOperationOptions
  ): Promise<FileResult<Buffer>> {
    const result = await this.storage.readFile(path, {
      ...options,
      range: { start, end }
    });
    
    if (!result.ok) {
      return result;
    }

    const value = result.value;
    
    if (value instanceof Buffer) {
      return { ok: true, value };
    }
    
    if (typeof value === 'string') {
      return { ok: true, value: Buffer.from(value) };
    }

    // Stream - read range and convert to buffer
    if (this.isReadableStream(value)) {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of value) {
          chunks.push(chunk);
        }
        return { ok: true, value: Buffer.concat(chunks) };
      } catch (error) {
        return { ok: false, error: FileErrorFactory.fromError(error) };
      }
    }

    return { 
      ok: false, 
      error: new FileError(
        FileErrorCode.UNKNOWN,
        'Unexpected return type from storage adapter'
      )
    };
  }

  /**
   * Check if a file exists and is readable
   */
  async canRead(path: FilePath, options?: FileOperationOptions): Promise<boolean> {
    try {
      const result = await this.storage.getFileMetadata(path);
      return result.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get file size without reading content
   */
  async getFileSize(path: FilePath): Promise<FileResult<number>> {
    const result = await this.storage.getFileMetadata(path);
    
    if (!result.ok) {
      return result;
    }

    return { ok: true, value: result.value.contentLength };
  }

  /**
   * Get file MIME type
   */
  async getFileMimeType(path: FilePath): Promise<FileResult<string>> {
    const result = await this.storage.getFileMetadata(path);
    
    if (!result.ok) {
      return result;
    }

    return { ok: true, value: result.value.contentType };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private isReadableStream(value: unknown): value is ReadableStream {
    return (
      value !== null &&
      typeof value === 'object' &&
      'readable' in value &&
      typeof (value as any).pipe === 'function'
    );
  }

  private async *createChunkIterable(
    stream: ReadableStream,
    chunkSize: number
  ): AsyncIterable<Buffer> {
    for await (const chunk of stream) {
      if (chunk instanceof Buffer) {
        yield chunk;
      } else {
        yield Buffer.from(chunk);
      }
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function createReadOperations(storage: StorageAdapter): FileReadOperations {
  return new FileReadOperations(storage);
}
