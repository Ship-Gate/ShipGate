/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/operations/copy
 */

import type { StorageAdapter } from '../storage/types';
import type { 
  FileResult,
  CopyOptions,
  FileOperationOptions,
  FilePath,
  FileMetadata
} from '../types';
import { FileError, FileErrorFactory, FileErrorCode } from '../errors';

// ============================================================================
// COPY OPERATIONS
// ============================================================================

export class FileCopyOperations {
  constructor(private storage: StorageAdapter) {}

  /**
   * Copy a single file
   */
  async copy(
    sourcePath: FilePath,
    destinationPath: FilePath,
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    return this.storage.copyFile(sourcePath, destinationPath, options);
  }

  /**
   * Copy a file with progress tracking
   */
  async copyWithProgress(
    sourcePath: FilePath,
    destinationPath: FilePath,
    onProgress?: (progress: { bytesCopied: number; totalBytes: number; percentage: number }) => void,
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    // Get source file size
    const metadataResult = await this.storage.getFileMetadata(sourcePath);
    if (!metadataResult.ok) {
      return metadataResult;
    }

    const totalBytes = metadataResult.value.contentLength;
    let bytesCopied = 0;

    // For storage adapters that support streaming, we can track progress
    if ('createReadStream' in this.storage && 'createWriteStream' in this.storage) {
      const readStreamResult = await (this.storage as any).createReadStream(sourcePath);
      if (!readStreamResult.ok) {
        return readStreamResult;
      }

      const writeStreamResult = await (this.storage as any).createWriteStream(destinationPath, options);
      if (!writeStreamResult.ok) {
        return writeStreamResult;
      }

      const readStream = readStreamResult.value;
      const writeStream = writeStreamResult.value;

      // Track progress
      readStream.on('data', (chunk: Buffer) => {
        bytesCopied += chunk.length;
        if (onProgress) {
          onProgress({
            bytesCopied,
            totalBytes,
            percentage: totalBytes > 0 ? (bytesCopied / totalBytes) * 100 : 100
          });
        }
      });

      // Pipe streams
      const { pipeline } = await import('stream/promises');
      try {
        await pipeline(readStream, writeStream);
        
        // Get final metadata
        const destMetadata = await this.storage.getFileMetadata(destinationPath);
        return destMetadata;
      } catch (error) {
        return { ok: false, error: FileErrorFactory.fromError(error) };
      }
    } else {
      // Fallback to simple copy
      const result = await this.copy(sourcePath, destinationPath, options);
      
      if (result.ok && onProgress) {
        onProgress({
          bytesCopied: totalBytes,
          totalBytes,
          percentage: 100
        });
      }
      
      return result;
    }
  }

  /**
   * Copy multiple files
   */
  async copyBatch(
    sources: Array<{ source: FilePath; destination: FilePath }>,
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<Array<{ source: FilePath; destination: FilePath; success: boolean; error?: string }>>> {
    const result = await this.storage.copyFiles(
      sources.map(s => ({ source: s.source, destination: s.destination })),
      options
    );

    if (!result.ok) {
      return result;
    }

    const { copied, failed } = result.value;
    const results: Array<{ source: FilePath; destination: FilePath; success: boolean; error?: string }> = [
      ...copied.map(path => ({ 
        source: sources.find(s => s.source === path)?.source || path,
        destination: sources.find(s => s.source === path)?.destination || '',
        success: true 
      })),
      ...failed.map(f => ({ 
        source: f.path,
        destination: sources.find(s => s.source === f.path)?.destination || '',
        success: false,
        error: f.error 
      }))
    ];

    return { ok: true, value: results };
  }

  /**
   * Copy a directory recursively
   */
  async copyDirectory(
    sourcePath: FilePath,
    destinationPath: FilePath,
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<{ filesCopied: number; directoriesCreated: number; totalSize: number }>> {
    let filesCopied = 0;
    let directoriesCreated = 0;
    let totalSize = 0;

    // Helper function to copy directory recursively
    const copyRecursive = async (srcPath: string, destPath: string): Promise<void> => {
      // Create destination directory
      const createResult = await this.storage.createDirectory(destPath, { recursive: true });
      if (createResult.ok) {
        directoriesCreated++;
      }

      // List source directory
      const listResult = await this.storage.listDirectory(srcPath);
      if (!listResult.ok) {
        throw listResult.error;
      }

      const { files, folders } = listResult.value;

      // Copy files
      for (const file of files) {
        const fileDestPath = destPath + '/' + file.name;
        const copyResult = await this.copy(file.path, fileDestPath, options);
        
        if (copyResult.ok) {
          filesCopied++;
          totalSize += copyResult.value.contentLength;
        }
      }

      // Recursively copy subdirectories
      for (const folder of folders) {
        const folderDestPath = destPath + '/' + folder.name;
        await copyRecursive(folder.path, folderDestPath);
      }
    };

    try {
      await copyRecursive(sourcePath, destinationPath);
      
      return { 
        ok: true, 
        value: { filesCopied, directoriesCreated, totalSize } 
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Copy with verification (checksum comparison)
   */
  async copyWithVerification(
    sourcePath: FilePath,
    destinationPath: FilePath,
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata & { verified: boolean }>> {
    // Get source metadata
    const sourceMetaResult = await this.storage.getFileMetadata(sourcePath);
    if (!sourceMetaResult.ok) {
      return sourceMetaResult;
    }

    // Copy file
    const copyResult = await this.copy(sourcePath, destinationPath, options);
    if (!copyResult.ok) {
      return copyResult;
    }

    // Get destination metadata
    const destMetaResult = await this.storage.getFileMetadata(destinationPath);
    if (!destMetaResult.ok) {
      return destMetaResult;
    }

    // Compare sizes
    if (sourceMetaResult.value.contentLength !== destMetaResult.value.contentLength) {
      return { 
        ok: false, 
        error: new FileError(
          FileErrorCode.CHECKSUM_MISMATCH,
          'File size mismatch after copy',
          { 
            source: sourcePath,
            destination: destinationPath,
            sourceSize: sourceMetaResult.value.contentLength,
            destSize: destMetaResult.value.contentLength
          }
        )
      };
    }

    // Compare checksums if available
    if (sourceMetaResult.value.checksum && destMetaResult.value.checksum) {
      if (sourceMetaResult.value.checksum !== destMetaResult.value.checksum) {
        return { 
          ok: false, 
          error: new FileError(
            FileErrorCode.CHECKSUM_MISMATCH,
            'Checksum mismatch after copy',
            { 
              source: sourcePath,
              destination: destinationPath,
              sourceChecksum: sourceMetaResult.value.checksum,
              destChecksum: destMetaResult.value.checksum
            }
          )
        };
      }
    }

    return { 
      ok: true, 
      value: { ...copyResult.value, verified: true } 
    };
  }

  /**
   * Duplicate file with timestamp suffix
   */
  async duplicate(
    sourcePath: FilePath,
    suffix?: string,
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<{ original: FilePath; duplicate: FilePath; metadata: FileMetadata }>> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nameSuffix = suffix || `.${timestamp}`;
    
    const parts = sourcePath.split('/');
    const name = parts.pop() || '';
    const dir = parts.join('/');
    
    const nameParts = name.split('.');
    if (nameParts.length > 1) {
      nameParts[nameParts.length - 2] += nameSuffix;
    } else {
      nameParts[0] += nameSuffix;
    }
    
    const duplicateName = nameParts.join('.');
    const duplicatePath = dir ? `${dir}/${duplicateName}` : duplicateName;

    const copyResult = await this.copy(sourcePath, duplicatePath, options);
    
    if (!copyResult.ok) {
      return copyResult;
    }

    return { 
      ok: true, 
      value: { 
        original: sourcePath, 
        duplicate: duplicatePath,
        metadata: copyResult.value 
      } 
    };
  }

  /**
   * Sync copy (overwrite if newer)
   */
  async syncCopy(
    sourcePath: FilePath,
    destinationPath: FilePath,
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<{ copied: boolean; metadata?: FileMetadata; reason?: string }>> {
    // Check if destination exists
    const destExists = await this.storage.fileExists(destinationPath);
    
    if (destExists.ok && destExists.value) {
      // Get both metadata
      const [sourceMeta, destMeta] = await Promise.all([
        this.storage.getFileMetadata(sourcePath),
        this.storage.getFileMetadata(destinationPath)
      ]);

      if (!sourceMeta.ok) {
        return sourceMeta;
      }

      if (!destMeta.ok) {
        return destMeta;
      }

      // Compare modification times
      if (sourceMeta.value.lastModified <= destMeta.value.lastModified) {
        return { 
          ok: true, 
          value: { 
            copied: false, 
            reason: 'Destination is newer or same age' 
          } 
        };
      }

      // Copy if source is newer
      const copyResult = await this.copy(sourcePath, destinationPath, { 
        ...options, 
        overwrite: true 
      });

      if (!copyResult.ok) {
        return copyResult;
      }

      return { 
        ok: true, 
        value: { 
          copied: true, 
          metadata: copyResult.value,
          reason: 'Source is newer' 
        } 
      };
    } else {
      // Destination doesn't exist, just copy
      const copyResult = await this.copy(sourcePath, destinationPath, options);
      
      if (!copyResult.ok) {
        return copyResult;
      }

      return { 
        ok: true, 
        value: { 
          copied: true, 
          metadata: copyResult.value,
          reason: 'Destination does not exist' 
        } 
      };
    }
  }

  /**
   * Copy with pattern matching (wildcards)
   */
  async copyPattern(
    sourcePattern: FilePath,
    destinationDir: FilePath,
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<Array<{ source: FilePath; destination: FilePath; success: boolean }>>> {
    // Convert pattern to regex
    const pattern = sourcePattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${pattern}$`);

    // Find matching files
    const sourceDir = sourcePattern.substring(0, sourcePattern.lastIndexOf('/')) || '/';
    const listResult = await this.storage.listDirectory(sourceDir);
    
    if (!listResult.ok) {
      return listResult;
    }

    const { files } = listResult.value;
    const matchingFiles = files.filter(file => regex.test(file.path));

    // Copy matching files
    const results: Array<{ source: FilePath; destination: FilePath; success: boolean }> = [];

    for (const file of matchingFiles) {
      const fileName = file.path.substring(file.path.lastIndexOf('/') + 1);
      const destPath = destinationDir + '/' + fileName;
      
      const copyResult = await this.copy(file.path, destPath, options);
      results.push({
        source: file.path,
        destination: destPath,
        success: copyResult.ok
      });
    }

    return { ok: true, value: results };
  }

  /**
   * Copy with retry on failure
   */
  async copyWithRetry(
    sourcePath: FilePath,
    destinationPath: FilePath,
    maxRetries: number = 3,
    delay: number = 1000,
    options?: CopyOptions & FileOperationOptions
  ): Promise<FileResult<FileMetadata>> {
    let lastError: FileError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.copy(sourcePath, destinationPath, options);
      
      if (result.ok) {
        return result;
      }

      lastError = result.error;

      // Don't retry on certain errors
      if (result.error.code === FileErrorCode.ACCESS_DENIED ||
          result.error.code === FileErrorCode.INVALID_PATH ||
          result.error.code === FileErrorCode.FILE_NOT_FOUND) {
        break;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }

    return { ok: false, error: lastError! };
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function createCopyOperations(storage: StorageAdapter): FileCopyOperations {
  return new FileCopyOperations(storage);
}
