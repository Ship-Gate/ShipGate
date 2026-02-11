/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/operations/delete
 */

import type { StorageAdapter } from '../storage/types';
import type { 
  FileResult,
  DeleteOptions,
  FileOperationOptions,
  FilePath
} from '../types';
import { FileError, FileErrorFactory, FileErrorCode } from '../errors';

// ============================================================================
// DELETE OPERATIONS
// ============================================================================

export class FileDeleteOperations {
  constructor(private storage: StorageAdapter) {}

  /**
   * Delete a single file
   */
  async delete(
    path: FilePath,
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<void>> {
    return this.storage.deleteFile(path, options);
  }

  /**
   * Delete multiple files
   */
  async deleteBatch(
    paths: FilePath[],
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<{ deleted: FilePath[]; failed: { path: FilePath; error: string }[] }>> {
    const result = await this.storage.deleteFiles(paths, options);
    
    if (!result.ok) {
      return result;
    }

    return { ok: true, value: result.value };
  }

  /**
   * Delete a directory (optionally recursive)
   */
  async deleteDirectory(
    path: FilePath,
    options?: { recursive?: boolean } & FileOperationOptions
  ): Promise<FileResult<void>> {
    return this.storage.deleteDirectory(path, options);
  }

  /**
   * Delete directory recursively with progress tracking
   */
  async deleteDirectoryRecursive(
    path: FilePath,
    onProgress?: (progress: { filesDeleted: number; directoriesDeleted: number; currentPath: string }) => void,
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<{ filesDeleted: number; directoriesDeleted: number }>> {
    let filesDeleted = 0;
    let directoriesDeleted = 0;

    // Helper function to delete recursively
    const deleteRecursive = async (dirPath: string): Promise<void> => {
      // List directory contents
      const listResult = await this.storage.listDirectory(dirPath);
      if (!listResult.ok) {
        throw listResult.error;
      }

      const { files, folders } = listResult.value;

      // Delete files
      for (const file of files) {
        const deleteResult = await this.delete(file.path, options);
        if (deleteResult.ok) {
          filesDeleted++;
          if (onProgress) {
            onProgress({ 
              filesDeleted, 
              directoriesDeleted, 
              currentPath: file.path 
            });
          }
        }
      }

      // Delete subdirectories
      for (const folder of folders) {
        await deleteRecursive(folder.path);
        const deleteResult = await this.storage.deleteDirectory(folder.path, options);
        if (deleteResult.ok) {
          directoriesDeleted++;
          if (onProgress) {
            onProgress({ 
              filesDeleted, 
              directoriesDeleted, 
              currentPath: folder.path 
            });
          }
        }
      }
    };

    try {
      await deleteRecursive(path);
      
      // Delete the root directory itself
      const deleteResult = await this.storage.deleteDirectory(path, options);
      if (deleteResult.ok) {
        directoriesDeleted++;
      }

      return { 
        ok: true, 
        value: { filesDeleted, directoriesDeleted } 
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Delete files matching a pattern
   */
  async deletePattern(
    pattern: FilePath,
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<{ deleted: FilePath[]; failed: { path: FilePath; error: string }[] }>> {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);

    // Find matching files
    const dir = pattern.substring(0, pattern.lastIndexOf('/')) || '/';
    const listResult = await this.storage.listDirectory(dir);
    
    if (!listResult.ok) {
      return listResult;
    }

    const { files } = listResult.value;
    const matchingFiles = files.filter(file => regex.test(file.path));

    // Delete matching files
    const paths = matchingFiles.map(file => file.path);
    return this.deleteBatch(paths, options);
  }

  /**
   * Delete files older than a certain date
   */
  async deleteOlderThan(
    path: FilePath,
    date: Date,
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<{ deleted: FilePath[]; failed: { path: FilePath; error: string }[] }>> {
    // List directory
    const listResult = await this.storage.listDirectory(path);
    
    if (!listResult.ok) {
      return listResult;
    }

    const { files } = listResult.value;
    const oldFiles = files.filter(file => file.updatedAt < date);

    // Delete old files
    const paths = oldFiles.map(file => file.path);
    return this.deleteBatch(paths, options);
  }

  /**
   * Delete files larger than a certain size
   */
  async deleteLargerThan(
    path: FilePath,
    maxSize: number,
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<{ deleted: FilePath[]; failed: { path: FilePath; error: string }[] }>> {
    // List directory
    const listResult = await this.storage.listDirectory(path);
    
    if (!listResult.ok) {
      return listResult;
    }

    const { files } = listResult.value;
    const largeFiles = files.filter(file => file.size > maxSize);

    // Delete large files
    const paths = largeFiles.map(file => file.path);
    return this.deleteBatch(paths, options);
  }

  /**
   * Delete with backup (move to backup location before deleting)
   */
  async deleteWithBackup(
    path: FilePath,
    backupPath: FilePath,
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<{ backup: FilePath; deleted: boolean }>> {
    try {
      // Create backup
      const copyResult = await this.storage.copyFile(path, backupPath, {
        ...options,
        overwrite: true
      });

      if (!copyResult.ok) {
        return copyResult;
      }

      // Delete original
      const deleteResult = await this.delete(path, options);
      
      if (!deleteResult.ok) {
        // Try to restore from backup
        await this.storage.copyFile(backupPath, path, { overwrite: true }).catch(() => {
          // Ignore restore errors
        });
        return deleteResult;
      }

      return { 
        ok: true, 
        value: { backup: backupPath, deleted: true } 
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Safe delete (move to trash instead of permanent delete)
   */
  async moveToTrash(
    path: FilePath,
    trashPath: FilePath = '/trash',
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<{ trashPath: FilePath }>> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const parts = path.split('/');
    const fileName = parts.pop() || '';
    const uniqueTrashName = `${timestamp}.${fileName}`;
    const finalTrashPath = `${trashPath}/${uniqueTrashName}`;

    try {
      // Ensure trash directory exists
      await this.storage.createDirectory(trashPath, { recursive: true });

      // Move to trash
      const moveResult = await this.storage.moveFile(path, finalTrashPath, options);
      
      if (!moveResult.ok) {
        return moveResult;
      }

      return { 
        ok: true, 
        value: { trashPath: finalTrashPath } 
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Empty trash directory
   */
  async emptyTrash(
    trashPath: FilePath = '/trash',
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<{ filesDeleted: number; directoriesDeleted: number }>> {
    return this.deleteDirectoryRecursive(trashPath, undefined, {
      ...options,
      permanent: true
    });
  }

  /**
   * Delete with retry on failure
   */
  async deleteWithRetry(
    path: FilePath,
    maxRetries: number = 3,
    delay: number = 1000,
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<void>> {
    let lastError: FileError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.delete(path, options);
      
      if (result.ok) {
        return result;
      }

      lastError = result.error;

      // Don't retry on certain errors
      if (result.error.code === FileErrorCode.ACCESS_DENIED ||
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

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(
    tempPath: FilePath = '/tmp',
    maxAge: number = 24 * 60 * 60 * 1000, // 24 hours
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<{ filesDeleted: FilePath[]; spaceFreed: number }>> {
    const cutoffDate = new Date(Date.now() - maxAge);
    const filesDeleted: FilePath[] = [];
    let spaceFreed = 0;

    try {
      // List temp directory
      const listResult = await this.storage.listDirectory(tempPath);
      
      if (!listResult.ok) {
        return listResult;
      }

      const { files } = listResult.value;
      const oldFiles = files.filter(file => file.updatedAt < cutoffDate);

      // Delete old temp files
      for (const file of oldFiles) {
        const deleteResult = await this.delete(file.path, options);
        if (deleteResult.ok) {
          filesDeleted.push(file.path);
          spaceFreed += file.size;
        }
      }

      return { 
        ok: true, 
        value: { filesDeleted, spaceFreed } 
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Delete by content type
   */
  async deleteByContentType(
    path: FilePath,
    contentType: string,
    options?: DeleteOptions & FileOperationOptions
  ): Promise<FileResult<{ deleted: FilePath[]; failed: { path: FilePath; error: string }[] }>> {
    // List directory
    const listResult = await this.storage.listDirectory(path);
    
    if (!listResult.ok) {
      return listResult;
    }

    const { files } = listResult.value;
    const matchingFiles = files.filter(file => 
      file.mimeType === contentType || file.mimeType.startsWith(contentType + '/')
    );

    // Delete matching files
    const paths = matchingFiles.map(file => file.path);
    return this.deleteBatch(paths, options);
  }

  /**
   * Delete empty directories
   */
  async deleteEmptyDirectories(
    path: FilePath,
    options?: FileOperationOptions
  ): Promise<FileResult<{ deleted: FilePath[] }>> {
    const deleted: FilePath[] = [];

    // Helper function to check and delete empty directories recursively
    const checkAndDelete = async (dirPath: string): Promise<void> => {
      const listResult = await this.storage.listDirectory(dirPath);
      
      if (!listResult.ok) {
        return;
      }

      const { files, folders } = listResult.value;

      // Check subdirectories first
      for (const folder of folders) {
        await checkAndDelete(folder.path);
      }

      // Re-check if directory is now empty
      const recheckResult = await this.storage.listDirectory(dirPath);
      if (recheckResult.ok && recheckResult.value.files.length === 0 && recheckResult.value.folders.length === 0) {
        const deleteResult = await this.storage.deleteDirectory(dirPath, options);
        if (deleteResult.ok) {
          deleted.push(dirPath);
        }
      }
    };

    try {
      await checkAndDelete(path);
      return { ok: true, value: { deleted } };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function createDeleteOperations(storage: StorageAdapter): FileDeleteOperations {
  return new FileDeleteOperations(storage);
}
