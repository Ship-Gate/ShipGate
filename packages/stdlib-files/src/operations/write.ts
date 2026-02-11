/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/operations/write
 */

import type { StorageAdapter } from '../storage/types';
import type { 
  FileResult,
  WriteOptions,
  FileOperationOptions,
  WritableStream,
  ReadableStream,
  FilePath,
  FileMetadata
} from '../types';
import { FileError, FileErrorFactory } from '../errors';
import { FileErrorCode } from '../types';
import { createHash } from 'crypto';

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

export class FileWriteOperations {
  constructor(private storage: StorageAdapter) {}

  /**
   * Write buffer to file
   */
  async writeBuffer(
    path: FilePath,
    buffer: Buffer,
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    return this.storage.writeFile(path, buffer, options);
  }

  /**
   * Write string to file
   */
  async writeString(
    path: FilePath,
    content: string,
    encoding: BufferEncoding = 'utf8',
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    return this.storage.writeFile(path, content, { ...options, encoding });
  }

  /**
   * Write JSON to file
   */
  async writeJson(
    path: FilePath,
    data: any,
    encoding: BufferEncoding = 'utf8',
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      return this.writeString(path, jsonString, encoding, options);
    } catch (error) {
      return { 
        ok: false, 
        error: new FileError(
          FileErrorCode.INVALID_INPUT,
          `Failed to serialize JSON: ${error instanceof Error ? error.message : String(error)}`,
          { path }
        )
      };
    }
  }

  /**
   * Write stream to file
   */
  async writeStream(
    path: FilePath,
    stream: ReadableStream,
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    return this.storage.writeFile(path, stream, { ...options, stream: true });
  }

  /**
   * Create a writable stream for a file
   */
  async createWriteStream(
    path: FilePath,
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<WritableStream>> {
    // Check if storage adapter supports streaming
    if ('createWriteStream' in this.storage) {
      return (this.storage as any).createWriteStream(path, options);
    }

    // Fallback: create a memory stream that writes on end
    const chunks: Buffer[] = [];
    const { Writable } = await import('stream');

    const writeStream = new Writable({
      write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        chunks.push(chunk);
        callback();
      },
      final: async (callback: (error?: Error | null) => void) => {
        try {
          const buffer = Buffer.concat(chunks);
          const result = await this.writeBuffer(path, buffer, options);
          
          if (!result.ok) {
            callback(result.error);
            return;
          }
          
          callback();
        } catch (error) {
          callback(error as Error);
        }
      }
    });

    return { ok: true, value: writeStream as WritableStream };
  }

  /**
   * Append content to file
   */
  async append(
    path: FilePath,
    content: Buffer | string,
    encoding: BufferEncoding = 'utf8',
    options?: FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    // Read existing content
    const existingResult = await this.storage.readFile(path, { encoding });
    
    if (!existingResult.ok) {
      if (existingResult.error.code === FileErrorCode.FILE_NOT_FOUND) {
        // File doesn't exist, just write new content
        return this.writeString(path, content as string, encoding, options);
      }
      return existingResult;
    }

    // Combine existing and new content
    const existing = existingResult.value;
    let combined: Buffer | string;

    if (typeof existing === 'string') {
      combined = existing + (typeof content === 'string' ? content : content.toString(encoding));
    } else if (existing instanceof Buffer) {
      const contentBuffer = typeof content === 'string' ? 
        Buffer.from(content, encoding) : content;
      combined = Buffer.concat([existing, contentBuffer]);
    } else {
      // Stream - read fully and append
      const chunks: Buffer[] = [];
      for await (const chunk of existing) {
        chunks.push(chunk);
      }
      const contentBuffer = typeof content === 'string' ? 
        Buffer.from(content, encoding) : content;
      combined = Buffer.concat([...chunks, contentBuffer]);
    }

    // Write combined content
    return this.storage.writeFile(path, combined, { ...options, encoding, overwrite: true });
  }

  /**
   * Write file with integrity check
   */
  async writeWithChecksum(
    path: FilePath,
    content: Buffer | string,
    expectedChecksum?: string,
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata & { checksum: string }>> {
    // Convert to buffer if needed
    const buffer = typeof content === 'string' ? 
      Buffer.from(content, options?.encoding || 'utf8') : content;

    // Calculate checksum
    const checksum = createHash('sha256').update(buffer).digest('hex');

    // Verify if expected checksum provided
    if (expectedChecksum && checksum !== expectedChecksum) {
      return { 
        ok: false, 
        error: new FileError(
          FileErrorCode.CHECKSUM_MISMATCH,
          `Checksum mismatch: expected ${expectedChecksum}, got ${checksum}`,
          { path, expected: expectedChecksum, actual: checksum }
        )
      };
    }

    // Write file
    const result = await this.writeBuffer(path, buffer, options);
    
    if (!result.ok) {
      return result;
    }

    // Update metadata with checksum
    const metadata = { ...result.value, checksum };
    await this.storage.updateFileMetadata(path, { checksum });

    return { ok: true, value: metadata };
  }

  /**
   * Write file atomically (write to temp then move)
   */
  async writeAtomic(
    path: FilePath,
    content: Buffer | string,
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    const tempPath = `${path}.tmp.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Write to temporary file
      const tempResult = await this.storage.writeFile(tempPath, content, {
        ...options,
        overwrite: true
      });

      if (!tempResult.ok) {
        return tempResult;
      }

      // Move to final location
      const moveResult = await this.storage.moveFile(tempPath, path, options);
      
      if (!moveResult.ok) {
        // Clean up temp file
        await this.storage.deleteFile(tempPath).catch(() => {
          // Ignore cleanup errors
        });
        return moveResult;
      }

      return moveResult;
    } catch (error) {
      // Clean up temp file
      await this.storage.deleteFile(tempPath).catch(() => {
        // Ignore cleanup errors
      });
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Write file with backup
   */
  async writeWithBackup(
    path: FilePath,
    content: Buffer | string,
    backupSuffix: string = '.bak',
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<{ metadata: FileMetadata; backup?: FileMetadata }>> {
    // Check if file exists
    const existsResult = await this.storage.fileExists(path);
    
    if (existsResult.ok && existsResult.value) {
      // Create backup
      const backupPath = path + backupSuffix;
      const backupResult = await this.storage.copyFile(path, backupPath, {
        ...options,
        overwrite: true
      });

      if (!backupResult.ok) {
        return backupResult;
      }

      // Write new content
      const writeResult = await this.storage.writeFile(path, content, options);
      
      if (!writeResult.ok) {
        // Restore from backup
        await this.storage.copyFile(backupPath, path, { overwrite: true }).catch(() => {
          // Ignore restore errors
        });
        return writeResult;
      }

      return { 
        ok: true, 
        value: { 
          metadata: writeResult.value, 
          backup: backupResult.value 
        } 
      };
    } else {
      // File doesn't exist, just write
      const result = await this.storage.writeFile(path, content, options);
      
      if (!result.ok) {
        return result;
      }

      return { 
        ok: true, 
        value: { metadata: result.value } 
      };
    }
  }

  /**
   * Write file if it doesn't exist (create only)
   */
  async writeIfNotExists(
    path: FilePath,
    content: Buffer | string,
    options?: Omit<WriteOptions, 'overwrite'> & FileOperationOptions
  ): Promise<FileResult<FileMetadata | null>> {
    const existsResult = await this.storage.fileExists(path);
    
    if (!existsResult.ok) {
      return existsResult;
    }

    if (existsResult.value) {
      // File already exists
      return { ok: true, value: null };
    }

    // Write new file
    return this.storage.writeFile(path, content, { ...options, overwrite: false });
  }

  /**
   * Write file with retry on failure
   */
  async writeWithRetry(
    path: FilePath,
    content: Buffer | string,
    maxRetries: number = 3,
    delay: number = 1000,
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    let lastError: FileError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.storage.writeFile(path, content, options);
      
      if (result.ok) {
        return result;
      }

      lastError = result.error;

      // Don't retry on certain errors
      if (result.error.code === FileErrorCode.ACCESS_DENIED ||
          result.error.code === FileErrorCode.INVALID_PATH ||
          result.error.code === FileErrorCode.FILE_TOO_LARGE ||
          result.error.code === FileErrorCode.INVALID_FILE_TYPE) {
        break;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }

    return { ok: false, error: lastError! };
  }

  /**
   * Batch write multiple files
   */
  async writeBatch(
    files: Array<{ path: FilePath; content: Buffer | string }>,
    options?: WriteOptions & FileOperationOptions
  ): Promise<FileResult<Array<{ path: FilePath; success: boolean; error?: string }>>> {
    const results: Array<{ path: FilePath; success: boolean; error?: string }> = [];

    for (const file of files) {
      const result = await this.storage.writeFile(file.path, file.content, options);
      
      results.push({
        path: file.path,
        success: result.ok,
        error: result.ok ? undefined : result.error.message
      });
    }

    return { ok: true, value: results };
  }

  // ============================================================================
  // CONVENIENCE FUNCTIONS
  // ============================================================================

  /**
   * Ensure a directory exists for a file path
   */
  async ensureDirectory(path: FilePath, options?: FileOperationOptions): Promise<FileResult<void>> {
    const dirPath = path.substring(0, path.lastIndexOf('/'));
    
    if (!dirPath || dirPath === path) {
      return { ok: true, value: undefined }; // No directory to create
    }

    return this.storage.createDirectory(dirPath, { recursive: true, ...options });
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function createWriteOperations(storage: StorageAdapter): FileWriteOperations {
  return new FileWriteOperations(storage);
}
