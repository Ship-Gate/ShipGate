// ============================================================================
// File Writer with Formatting
// Writes generated files with deterministic formatting
// ============================================================================

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { GeneratedFile } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface WriteOptions {
  /** Base output directory */
  outputDir: string;
  /** Format code with prettier (if available) */
  format?: boolean;
  /** Sort files deterministically */
  sortFiles?: boolean;
}

export interface WriteResult {
  success: boolean;
  filesWritten: number;
  errors: Array<{ path: string; error: string }>;
}

// ============================================================================
// FILE WRITER
// ============================================================================

/**
 * Write generated files to disk with deterministic formatting
 */
export function writeFiles(
  files: GeneratedFile[],
  options: WriteOptions
): WriteResult {
  const { outputDir, format = true, sortFiles = true } = options;
  
  // Sort files deterministically by path
  const sortedFiles = sortFiles 
    ? [...files].sort((a, b) => a.path.localeCompare(b.path))
    : files;

  const errors: Array<{ path: string; error: string }> = [];
  let filesWritten = 0;

  for (const file of sortedFiles) {
    try {
      const fullPath = join(outputDir, file.path);
      const dir = dirname(fullPath);
      
      // Create directory if needed
      mkdirSync(dir, { recursive: true });
      
      // Format content if requested
      let content = file.content;
      if (format) {
        content = formatCode(content, file.path);
      }
      
      // Write file
      writeFileSync(fullPath, content, 'utf-8');
      filesWritten++;
    } catch (error) {
      errors.push({
        path: file.path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    success: errors.length === 0,
    filesWritten,
    errors,
  };
}

/**
 * Format code using prettier or biome if available
 */
function formatCode(content: string, filePath: string): string {
  // Try prettier first
  try {
    const prettier = require('prettier');
    return prettier.format(content, {
      parser: filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? 'typescript' : 'babel',
      singleQuote: true,
      trailingComma: 'es5',
      tabWidth: 2,
      semi: true,
    });
  } catch {
    // Prettier not available, try biome
    try {
      const { format } = require('@biomejs/biome');
      const result = format(content, {
        filePath,
      });
      return result.content;
    } catch {
      // Neither available, return as-is
      return content;
    }
  }
}

/**
 * Generate snapshot file for structured outputs
 */
export function generateSnapshotFile(
  behaviorName: string,
  structuredOutput: unknown,
  outputDir: string
): GeneratedFile {
  const snapshotContent = JSON.stringify(structuredOutput, null, 2);
  
  return {
    path: `${behaviorName}.snapshot.json`,
    content: snapshotContent,
    type: 'metadata',
  };
}
