/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/operations/list
 */

import type { StorageAdapter } from '../storage/types';
import type { 
  FileResult,
  FileListResult,
  ListOptions,
  FileOperationOptions,
  FilePath,
  FileEntry,
  FolderEntry,
  MimeType,
  FileSize
} from '../types';
import { FileError, FileErrorFactory, FileErrorCode } from '../errors';

// ============================================================================
// LIST OPERATIONS
// ============================================================================

export class FileListOperations {
  constructor(private storage: StorageAdapter) {}

  /**
   * List directory contents
   */
  async list(
    path: FilePath,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileListResult> {
    return this.storage.listDirectory(path, options);
  }

  /**
   * List only files
   */
  async listFiles(
    path: FilePath,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileResult<FileEntry[]>> {
    const result = await this.list(path, options);
    
    if (!result.ok) {
      return result;
    }

    return { ok: true, value: result.value.files };
  }

  /**
   * List only directories
   */
  async listDirectories(
    path: FilePath,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileResult<FolderEntry[]>> {
    const result = await this.list(path, options);
    
    if (!result.ok) {
      return result;
    }

    return { ok: true, value: result.value.folders };
  }

  /**
   * List directory recursively
   */
  async listRecursive(
    path: FilePath,
    options?: Omit<ListOptions, 'recursive'> & FileOperationOptions
  ): Promise<FileResult<{ files: FileEntry[]; folders: FolderEntry[]; totalCount: number }>> {
    const allFiles: FileEntry[] = [];
    const allFolders: FolderEntry[] = [];

    // Helper function to list recursively
    const listRecursiveHelper = async (dirPath: string, depth = 0): Promise<void> => {
      const result = await this.list(dirPath, { ...options, recursive: false });
      
      if (!result.ok) {
        throw result.error;
      }

      const { files, folders } = result.value;

      // Add files
      allFiles.push(...files);

      // Add folders and recurse into them
      for (const folder of folders) {
        allFolders.push(folder);
        await listRecursiveHelper(folder.path, depth + 1);
      }
    };

    try {
      await listRecursiveHelper(path);
      
      // Apply sorting if specified
      if (options?.sort) {
        const { field, order } = options.sort;
        const multiplier = order === 'desc' ? -1 : 1;
        
        allFiles.sort((a, b) => {
          let aVal: any = a[field];
          let bVal: any = b[field];
          
          if (aVal < bVal) return -1 * multiplier;
          if (aVal > bVal) return 1 * multiplier;
          return 0;
        });
      }

      // Apply pagination if specified
      if (options?.pagination) {
        const { offset = 0, limit = 100 } = options.pagination;
        allFiles.splice(0, offset);
        allFiles.splice(limit);
        allFolders.splice(0, offset);
        allFolders.splice(limit);
      }

      return { 
        ok: true, 
        value: { 
          files: allFiles, 
          folders: allFolders, 
          totalCount: allFiles.length + allFolders.length 
        } 
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * List files by MIME type
   */
  async listByMimeType(
    path: FilePath,
    mimeType: MimeType,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileResult<FileEntry[]>> {
    const result = await this.list(path, {
      ...options,
      filter: {
        ...options?.filter,
        mimeTypes: [mimeType]
      }
    });
    
    if (!result.ok) {
      return result;
    }

    return { ok: true, value: result.value.files };
  }

  /**
   * List files by size range
   */
  async listBySizeRange(
    path: FilePath,
    minSize?: FileSize,
    maxSize?: FileSize,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileResult<FileEntry[]>> {
    const result = await this.list(path, {
      ...options,
      filter: {
        ...options?.filter,
        sizeRange: { min: minSize, max: maxSize }
      }
    });
    
    if (!result.ok) {
      return result;
    }

    return { ok: true, value: result.value.files };
  }

  /**
   * List files by date range
   */
  async listByDateRange(
    path: FilePath,
    startDate?: Date,
    endDate?: Date,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileResult<FileEntry[]>> {
    const result = await this.list(path, options);
    
    if (!result.ok) {
      return result;
    }

    const { files } = result.value;
    
    // Filter by date range
    const filteredFiles = files.filter(file => {
      const fileDate = file.updatedAt;
      
      if (startDate && fileDate < startDate) {
        return false;
      }
      
      if (endDate && fileDate > endDate) {
        return false;
      }
      
      return true;
    });

    return { ok: true, value: filteredFiles };
  }

  /**
   * List with pattern matching (wildcards)
   */
  async listByPattern(
    path: FilePath,
    pattern: string,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileResult<{ files: FileEntry[]; folders: FolderEntry[] }>> {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');

    const result = await this.list(path, options);
    
    if (!result.ok) {
      return result;
    }

    const { files, folders } = result.value;
    
    // Filter by pattern
    const filteredFiles = files.filter(file => regex.test(file.name));
    const filteredFolders = folders.filter(folder => regex.test(folder.name));

    return { 
      ok: true, 
      value: { files: filteredFiles, folders: filteredFolders } 
    };
  }

  /**
   * List with search (name contains)
   */
  async search(
    path: FilePath,
    query: string,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileResult<{ files: FileEntry[]; folders: FolderEntry[] }>> {
    const result = await this.list(path, options);
    
    if (!result.ok) {
      return result;
    }

    const { files, folders } = result.value;
    const queryLower = query.toLowerCase();
    
    // Filter by search query
    const filteredFiles = files.filter(file => 
      file.name.toLowerCase().includes(queryLower)
    );
    const filteredFolders = folders.filter(folder => 
      folder.name.toLowerCase().includes(queryLower)
    );

    return { 
      ok: true, 
      value: { files: filteredFiles, folders: filteredFolders } 
    };
  }

  /**
   * List duplicates (files with same name)
   */
  async listDuplicates(
    path: FilePath,
    options?: FileOperationOptions
  ): Promise<FileResult<{ name: string; files: FileEntry[] }[]>> {
    const result = await this.listRecursive(path, options);
    
    if (!result.ok) {
      return result;
    }

    const { files } = result.value;
    const nameMap = new Map<string, FileEntry[]>();

    // Group by name
    for (const file of files) {
      const name = file.name.toLowerCase();
      if (!nameMap.has(name)) {
        nameMap.set(name, []);
      }
      nameMap.get(name)!.push(file);
    }

    // Filter duplicates
    const duplicates = Array.from(nameMap.entries())
      .filter(([, files]) => files.length > 1)
      .map(([name, files]) => ({ name, files }));

    return { ok: true, value: duplicates };
  }

  /**
   * List large files
   */
  async listLargeFiles(
    path: FilePath,
    threshold: FileSize,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileResult<FileEntry[]>> {
    return this.listBySizeRange(path, threshold, undefined, options);
  }

  /**
   * List recent files
   */
  async listRecentFiles(
    path: FilePath,
    hours: number = 24,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileResult<FileEntry[]>> {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.listByDateRange(path, cutoffDate, undefined, options);
  }

  /**
   * List tree structure (hierarchical view)
   */
  async listTree(
    path: FilePath,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileResult<TreeNode>> {
    // Helper function to build tree
    const buildTree = async (dirPath: string, name: string): Promise<TreeNode> => {
      const result = await this.list(dirPath, { ...options, recursive: false });
      
      if (!result.ok) {
        throw result.error;
      }

      const { files, folders } = result.value;
      const node: TreeNode = {
        name,
        path: dirPath,
        type: 'directory',
        children: []
      };

      // Add files
      for (const file of files) {
        node.children.push({
          name: file.name,
          path: file.path,
          type: 'file',
          size: file.size,
          mimeType: file.mimeType,
          modified: file.updatedAt
        });
      }

      // Add subdirectories
      for (const folder of folders) {
        const childNode = await buildTree(folder.path, folder.name);
        node.children.push(childNode);
      }

      return node;
    };

    try {
      const tree = await buildTree(path, path.split('/').pop() || path);
      return { ok: true, value: tree };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Get directory statistics
   */
  async getDirectoryStats(
    path: FilePath,
    options?: FileOperationOptions
  ): Promise<FileResult<{
    fileCount: number;
    directoryCount: number;
    totalSize: number;
    sizeByType: Record<string, number>;
    largestFiles: FileEntry[];
    averageFileSize: number;
  }>> {
    const result = await this.listRecursive(path, options);
    
    if (!result.ok) {
      return result;
    }

    const { files, folders } = result.value;
    const sizeByType: Record<string, number> = {};
    let totalSize = 0;

    // Calculate statistics
    for (const file of files) {
      totalSize += file.size;
      
      const type = file.mimeType.split('/')[0] || 'unknown';
      sizeByType[type] = (sizeByType[type] || 0) + file.size;
    }

    // Sort files by size to get largest
    const largestFiles = [...files]
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    const averageFileSize = files.length > 0 ? totalSize / files.length : 0;

    return { 
      ok: true, 
      value: {
        fileCount: files.length,
        directoryCount: folders.length,
        totalSize,
        sizeByType,
        largestFiles,
        averageFileSize
      }
    };
  }

  /**
   * List with pagination
   */
  async listPaginated(
    path: FilePath,
    page: number = 1,
    pageSize: number = 100,
    options?: ListOptions & FileOperationOptions
  ): Promise<FileResult<{
    files: FileEntry[];
    folders: FolderEntry[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>> {
    const offset = (page - 1) * pageSize;
    
    const result = await this.list(path, {
      ...options,
      pagination: { offset, limit: pageSize }
    });
    
    if (!result.ok) {
      return result;
    }

    const { files, folders, totalCount } = result.value;
    const totalPages = Math.ceil(totalCount / pageSize);

    return { 
      ok: true, 
      value: {
        files,
        folders,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    };
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  mimeType?: string;
  modified?: Date;
  children?: TreeNode[];
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function createListOperations(storage: StorageAdapter): FileListOperations {
  return new FileListOperations(storage);
}
