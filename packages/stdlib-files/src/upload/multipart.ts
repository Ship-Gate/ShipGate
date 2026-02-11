/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/upload/multipart
 */

import type { StorageAdapter } from '../storage/types';
import type {
  MultipartFile,
  MultipartUploadOptions,
  MultipartUploadResult,
  UploadedFile,
  UploadValidationResult
} from './types';
import type { FileResult } from '../types';
import { FileError, FileErrorFactory, FileErrorCode } from '../errors';
import { validateUpload } from './validation';
import { createHash } from 'crypto';

// ============================================================================
// MULTIPART UPLOAD HANDLER
// ============================================================================

export class MultipartUploadHandler {
  constructor(private storage: StorageAdapter) {}

  /**
   * Handle multipart upload
   */
  async upload(
    files: MultipartFile[],
    options?: MultipartUploadOptions
  ): Promise<FileResult<MultipartUploadResult>> {
    const startTime = Date.now();
    const uploadedFiles: UploadedFile[] = [];
    const failed: Array<{ filename: string; error: string }> = [];
    let totalSize = 0;

    try {
      // Validate batch constraints
      const batchValidation = this.validateBatch(files, options);
      if (!batchValidation.valid) {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.VALIDATION_FAILED,
            batchValidation.errors.join(', ')
          )
        };
      }

      // Process files
      if (options?.parallel) {
        await this.processFilesParallel(files, uploadedFiles, failed, totalSize, options);
      } else {
        await this.processFilesSequential(files, uploadedFiles, failed, totalSize, options);
      }

      const duration = Date.now() - startTime;
      totalSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);

      return {
        ok: true,
        value: {
          files: uploadedFiles,
          failed,
          totalSize,
          duration,
          processed: files.length
        }
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Process files sequentially
   */
  private async processFilesSequential(
    files: MultipartFile[],
    uploadedFiles: UploadedFile[],
    failed: Array<{ filename: string; error: string }>,
    totalSize: number,
    options?: MultipartUploadOptions
  ): Promise<void> {
    for (const file of files) {
      const result = await this.processSingleFile(file, options);
      
      if (result.ok) {
        uploadedFiles.push(result.value);
        totalSize += result.value.size;
      } else {
        failed.push({
          filename: file.filename,
          error: result.error.message
        });
      }
    }
  }

  /**
   * Process files in parallel
   */
  private async processFilesParallel(
    files: MultipartFile[],
    uploadedFiles: UploadedFile[],
    failed: Array<{ filename: string; error: string }>,
    totalSize: number,
    options?: MultipartUploadOptions
  ): Promise<void> {
    const maxConcurrency = options?.maxConcurrency || 5;
    const chunks = this.chunkArray(files, maxConcurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(async (file) => {
        const result = await this.processSingleFile(file, options);
        
        if (result.ok) {
          uploadedFiles.push(result.value);
          return { success: true, file: result.value };
        } else {
          failed.push({
            filename: file.filename,
            error: result.error.message
          });
          return { success: false, error: result.error };
        }
      });

      await Promise.all(promises);
    }
  }

  /**
   * Process a single file
   */
  private async processSingleFile(
    file: MultipartFile,
    options?: MultipartUploadOptions
  ): Promise<FileResult<UploadedFile>> {
    try {
      // Validate file
      const validation = await validateUpload(
        file.filename,
        file.size,
        file.contentType,
        options
      );

      if (!validation.valid) {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.VALIDATION_FAILED,
            validation.errors.join(', ')
          )
        };
      }

      // Use sanitized filename if provided
      const filename = validation.sanitizedFilename || file.filename;
      
      // Generate unique filename if needed
      const finalFilename = options?.overwrite ? 
        filename : 
        await this.generateUniqueFilename(filename, options?.directory);

      // Construct full path
      const path = options?.directory ? 
        `${options.directory}/${finalFilename}` : 
        finalFilename;

      // Calculate checksum if required
      let checksum: string | undefined;
      if (options?.calculateChecksum || options?.expectedChecksum) {
        const buffer = await this.bufferFromContent(file.content);
        checksum = createHash('sha256').update(buffer).digest('hex');

        // Verify expected checksum
        if (options.expectedChecksum && checksum !== options.expectedChecksum) {
          return { 
            ok: false, 
            error: new FileError(
              FileErrorCode.CHECKSUM_MISMATCH,
              `Checksum mismatch: expected ${options.expectedChecksum}, got ${checksum}`
            )
          };
        }
      }

      // Write file to storage
      const writeResult = await this.storage.writeFile(path, file.content, {
        overwrite: options?.overwrite,
        context: options?.context
      });

      if (!writeResult.ok) {
        return writeResult;
      }

      // Update metadata
      const metadata = {
        originalName: file.filename,
        uploadedAt: new Date().toISOString(),
        checksum: checksum || '',
        ...file.metadata
      };

      await this.storage.updateFileMetadata(path, { custom: metadata });

      // Create uploaded file object
      const uploadedFile: UploadedFile = {
        originalName: file.filename,
        filename: finalFilename,
        path,
        size: file.size,
        contentType: file.contentType,
        checksum,
        uploadedAt: new Date(),
        metadata
      };

      return { ok: true, value: uploadedFile };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Generate unique filename
   */
  async generateUniqueFilename(
    filename: string,
    directory?: string
  ): Promise<string> {
    const path = directory ? `${directory}/${filename}` : filename;
    
    // Check if file exists
    const exists = await this.storage.fileExists(path);
    if (!exists.ok || !exists.value) {
      return filename;
    }

    // File exists, generate unique name
    const parts = filename.split('.');
    const ext = parts.length > 1 ? parts.pop() : '';
    const name = parts.join('.');
    
    let counter = 1;
    let uniqueFilename: string;
    
    do {
      uniqueFilename = ext ? 
        `${name}_${counter}.${ext}` : 
        `${name}_${counter}`;
      
      const testPath = directory ? 
        `${directory}/${uniqueFilename}` : 
        uniqueFilename;
      
      const testExists = await this.storage.fileExists(testPath);
      if (!testExists.ok || !testExists.value) {
        break;
      }
      
      counter++;
    } while (counter < 1000); // Prevent infinite loop

    return uniqueFilename;
  }

  /**
   * Validate batch constraints
   */
  private validateBatch(
    files: MultipartFile[],
    options?: MultipartUploadOptions
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file count
    if (options?.maxFiles && files.length > options.maxFiles) {
      errors.push(
        `Too many files: ${files.length} (max: ${options.maxFiles})`
      );
    }

    // Check total size
    if (options?.maxTotalSize) {
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      if (totalSize > options.maxTotalSize) {
        errors.push(
          `Total size too large: ${totalSize} bytes (max: ${options.maxTotalSize} bytes)`
        );
      }
    }

    // Check for duplicate filenames
    const filenames = files.map(f => f.filename.toLowerCase());
    const uniqueFilenames = new Set(filenames);
    if (filenames.length !== uniqueFilenames.size) {
      errors.push('Duplicate filenames detected');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert content to buffer
   */
  private async bufferFromContent(
    content: Buffer | NodeJS.ReadableStream
  ): Promise<Buffer> {
    if (content instanceof Buffer) {
      return content;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of content) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Parse multipart form data
   */
  async parseMultipart(
    boundary: string,
    data: Buffer | NodeJS.ReadableStream
  ): Promise<FileResult<MultipartFile[]>> {
    try {
      const files: MultipartFile[] = [];
      const buffer = data instanceof Buffer ? 
        data : 
        await this.streamToBuffer(data);

      const parts = this.parseMultipartData(buffer, boundary);
      
      for (const part of parts) {
        if (part.filename) {
          files.push({
            field: part.name,
            filename: part.filename,
            contentType: part.contentType || 'application/octet-stream',
            size: part.data.length,
            content: part.data,
            metadata: {}
          });
        }
      }

      return { ok: true, value: files };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Parse multipart data
   */
  private parseMultipartData(
    buffer: Buffer,
    boundary: string
  ): Array<{
    name: string;
    filename?: string;
    contentType?: string;
    data: Buffer;
  }> {
    const parts: Array<{
      name: string;
      filename?: string;
      contentType?: string;
      data: Buffer;
    }> = [];

    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const endBoundaryBuffer = Buffer.from(`--${boundary}--`);

    let start = 0;
    let end = buffer.indexOf(boundaryBuffer);

    while (end !== -1) {
      // Find next boundary
      const nextBoundary = buffer.indexOf(boundaryBuffer, end + boundaryBuffer.length);
      
      if (nextBoundary === -1) {
        // Check for end boundary
        const endBoundaryPos = buffer.indexOf(endBoundaryBuffer, end + boundaryBuffer.length);
        if (endBoundaryPos !== -1) {
          end = endBoundaryPos;
        } else {
          break;
        }
      } else {
        end = nextBoundary;
      }

      // Extract part data
      const partData = buffer.slice(
        end + boundaryBuffer.length,
        buffer.indexOf(boundaryBuffer, end + boundaryBuffer.length)
      );

      // Parse headers
      const headerEnd = partData.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;

      const headerBuffer = partData.slice(0, headerEnd);
      const dataBuffer = partData.slice(headerEnd + 4);

      const headers = this.parseHeaders(headerBuffer.toString());
      
      const contentDisposition = headers['content-disposition'];
      if (!contentDisposition) continue;

      const nameMatch = contentDisposition.match(/name="([^"]+)"/);
      const filenameMatch = contentDisposition.match(/filename="([^"]*)"/);
      
      if (nameMatch) {
        parts.push({
          name: nameMatch[1],
          filename: filenameMatch ? filenameMatch[1] : undefined,
          contentType: headers['content-type'],
          data: dataBuffer
        });
      }

      start = end;
      end = buffer.indexOf(boundaryBuffer, end + boundaryBuffer.length);
    }

    return parts;
  }

  /**
   * Parse headers
   */
  private parseHeaders(headerString: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = headerString.split('\r\n');

    for (const line of lines) {
      const colon = line.indexOf(':');
      if (colon > 0) {
        const name = line.substring(0, colon).trim().toLowerCase();
        const value = line.substring(colon + 1).trim();
        headers[name] = value;
      }
    }

    return headers;
  }

  /**
   * Convert stream to buffer
   */
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

export function createMultipartUploadHandler(storage: StorageAdapter): MultipartUploadHandler {
  return new MultipartUploadHandler(storage);
}
