/**
 * Multi-File Output
 *
 * Utilities for organizing and managing multiple generated files.
 */

import type { GeneratedFile } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for multi-file output.
 */
export interface MultiFileConfig {
  /** Base output directory */
  baseDir: string;
  /** File groups configuration */
  groups: FileGroupConfig[];
  /** Generate index files for each group */
  generateIndex?: boolean;
  /** Index file name */
  indexFileName?: string;
}

/**
 * Configuration for a file group.
 */
export interface FileGroupConfig {
  /** Group name/identifier */
  name: string;
  /** Subdirectory for this group */
  directory: string;
  /** File pattern/extension */
  pattern?: string;
  /** Index file content generator */
  indexGenerator?: (files: GeneratedFile[]) => string;
}

/**
 * A group of related files.
 */
export interface FileGroup {
  /** Group name */
  name: string;
  /** Directory path */
  directory: string;
  /** Files in this group */
  files: GeneratedFile[];
  /** Index file (if generated) */
  index?: GeneratedFile;
}

// ============================================================================
// Multi-File Output Class
// ============================================================================

/**
 * Manages organization of multiple generated files.
 *
 * @example
 * ```typescript
 * const output = new MultiFileOutput({
 *   baseDir: 'src/generated',
 *   groups: [
 *     { name: 'entities', directory: 'entities' },
 *     { name: 'behaviors', directory: 'behaviors' },
 *     { name: 'types', directory: 'types' },
 *   ],
 *   generateIndex: true,
 * });
 *
 * output.addFile('entities', {
 *   path: 'user.ts',
 *   content: '// User entity',
 * });
 *
 * const allFiles = output.getAllFiles();
 * ```
 */
export class MultiFileOutput {
  private config: Required<MultiFileConfig>;
  private groups: Map<string, FileGroup> = new Map();

  constructor(config: MultiFileConfig) {
    this.config = {
      baseDir: config.baseDir,
      groups: config.groups,
      generateIndex: config.generateIndex ?? true,
      indexFileName: config.indexFileName ?? 'index.ts',
    };

    // Initialize groups
    for (const groupConfig of config.groups) {
      this.groups.set(groupConfig.name, {
        name: groupConfig.name,
        directory: groupConfig.directory,
        files: [],
      });
    }
  }

  // ==========================================================================
  // File Management
  // ==========================================================================

  /**
   * Add a file to a group.
   *
   * @param groupName - Name of the group
   * @param file - File to add
   */
  addFile(groupName: string, file: GeneratedFile): void {
    const group = this.groups.get(groupName);
    if (!group) {
      throw new Error(`Unknown group: ${groupName}. Available: ${this.getGroupNames().join(', ')}`);
    }

    // Adjust path to include group directory
    const adjustedFile: GeneratedFile = {
      ...file,
      path: `${group.directory}/${file.path}`,
    };

    group.files.push(adjustedFile);
  }

  /**
   * Add multiple files to a group.
   */
  addFiles(groupName: string, files: GeneratedFile[]): void {
    for (const file of files) {
      this.addFile(groupName, file);
    }
  }

  /**
   * Get all files from a specific group.
   */
  getGroupFiles(groupName: string): GeneratedFile[] {
    const group = this.groups.get(groupName);
    return group?.files ?? [];
  }

  /**
   * Get all files from all groups.
   */
  getAllFiles(): GeneratedFile[] {
    const allFiles: GeneratedFile[] = [];

    for (const group of this.groups.values()) {
      allFiles.push(...group.files);
      if (group.index) {
        allFiles.push(group.index);
      }
    }

    // Generate root index if configured
    if (this.config.generateIndex) {
      const rootIndex = this.generateRootIndex();
      if (rootIndex) {
        allFiles.push(rootIndex);
      }
    }

    return allFiles;
  }

  /**
   * Get group names.
   */
  getGroupNames(): string[] {
    return Array.from(this.groups.keys());
  }

  /**
   * Get file count per group.
   */
  getFileCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [name, group] of this.groups) {
      counts[name] = group.files.length;
    }
    return counts;
  }

  // ==========================================================================
  // Index Generation
  // ==========================================================================

  /**
   * Generate index files for all groups.
   */
  generateIndexFiles(): void {
    if (!this.config.generateIndex) return;

    for (const [name, group] of this.groups) {
      if (group.files.length === 0) continue;

      const groupConfig = this.config.groups.find((g) => g.name === name);
      const content = groupConfig?.indexGenerator
        ? groupConfig.indexGenerator(group.files)
        : this.defaultIndexGenerator(group);

      group.index = {
        path: `${group.directory}/${this.config.indexFileName}`,
        content,
        type: 'index',
      };
    }
  }

  /**
   * Generate root index file.
   */
  private generateRootIndex(): GeneratedFile | null {
    const exports: string[] = [];

    for (const group of this.groups.values()) {
      if (group.files.length === 0) continue;
      exports.push(`export * from './${group.directory}/index.js';`);
    }

    if (exports.length === 0) return null;

    return {
      path: this.config.indexFileName,
      content: [
        '/**',
        ' * Generated index file',
        ' * DO NOT EDIT',
        ' */',
        '',
        ...exports,
      ].join('\n'),
      type: 'index',
    };
  }

  /**
   * Default index generator for a group.
   */
  private defaultIndexGenerator(group: FileGroup): string {
    const exports = group.files
      .filter((f) => f.path.endsWith('.ts') && !f.path.endsWith('.d.ts'))
      .map((f) => {
        const name = f.path.split('/').pop()?.replace(/\.ts$/, '');
        return `export * from './${name}.js';`;
      });

    return [
      '/**',
      ` * Generated index for ${group.name}`,
      ' * DO NOT EDIT',
      ' */',
      '',
      ...exports,
    ].join('\n');
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Clear all files from all groups.
   */
  clear(): void {
    for (const group of this.groups.values()) {
      group.files = [];
      group.index = undefined;
    }
  }

  /**
   * Clear files from a specific group.
   */
  clearGroup(groupName: string): void {
    const group = this.groups.get(groupName);
    if (group) {
      group.files = [];
      group.index = undefined;
    }
  }

  /**
   * Get statistics about the output.
   */
  getStats(): {
    totalFiles: number;
    totalSize: number;
    groups: Record<string, { files: number; size: number }>;
  } {
    let totalFiles = 0;
    let totalSize = 0;
    const groups: Record<string, { files: number; size: number }> = {};

    for (const [name, group] of this.groups) {
      const groupSize = group.files.reduce(
        (sum, f) => sum + Buffer.byteLength(f.content, 'utf-8'),
        0
      );
      groups[name] = {
        files: group.files.length,
        size: groupSize,
      };
      totalFiles += group.files.length;
      totalSize += groupSize;
    }

    return { totalFiles, totalSize, groups };
  }
}

// ============================================================================
// File Organization Utilities
// ============================================================================

/**
 * Organize files by type/category.
 */
export function organizeFilesByType(files: GeneratedFile[]): Map<string, GeneratedFile[]> {
  const organized = new Map<string, GeneratedFile[]>();

  for (const file of files) {
    const type = file.type ?? 'other';
    if (!organized.has(type)) {
      organized.set(type, []);
    }
    organized.get(type)!.push(file);
  }

  return organized;
}

/**
 * Organize files by directory.
 */
export function organizeFilesByDirectory(files: GeneratedFile[]): Map<string, GeneratedFile[]> {
  const organized = new Map<string, GeneratedFile[]>();

  for (const file of files) {
    const dir = file.path.includes('/') ? file.path.split('/').slice(0, -1).join('/') : '.';
    if (!organized.has(dir)) {
      organized.set(dir, []);
    }
    organized.get(dir)!.push(file);
  }

  return organized;
}

/**
 * Sort files by path.
 */
export function sortFilesByPath(files: GeneratedFile[]): GeneratedFile[] {
  return [...files].sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Filter files by extension.
 */
export function filterFilesByExtension(
  files: GeneratedFile[],
  extension: string
): GeneratedFile[] {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return files.filter((f) => f.path.endsWith(ext));
}

/**
 * Merge multiple file arrays, handling duplicates.
 */
export function mergeFiles(
  ...fileSets: GeneratedFile[][]
): GeneratedFile[] {
  const merged = new Map<string, GeneratedFile>();

  for (const files of fileSets) {
    for (const file of files) {
      merged.set(file.path, file); // Later files override earlier ones
    }
  }

  return Array.from(merged.values());
}
