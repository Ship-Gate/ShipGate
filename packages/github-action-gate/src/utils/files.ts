/**
 * File utilities for handling changed files
 */

import { info, warning } from '@actions/core';
import { GitHubContext } from '../types.js';

interface GitHubFile {
  filename: string;
  sha: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
}

/**
 * Get list of changed files in a pull request
 */
export async function getChangedFiles(
  token: string,
  context: GitHubContext
): Promise<string[]> {
  if (!context.pullRequest) {
    warning('Not in a pull request context. Cannot get changed files.');
    return [];
  }

  const changedFiles: string[] = [];
  let page = 1;
  const perPage = 100;

  try {
    // Fetch all pages of changed files
    while (true) {
      const url = `${context.apiUrl}/repos/${context.repository.owner}/${context.repository.repo}/pulls/${context.pullRequest.number}/files?page=${page}&per_page=${perPage}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'isl-gate-action'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch changed files: ${response.statusText}`);
      }

      const files: GitHubFile[] = await response.json();
      
      if (files.length === 0) {
        break;
      }

      changedFiles.push(...files.map((f) => f.filename));
      page++;

      info(`Fetched ${files.length} changed files (page ${page - 1})`);
    }

    info(`Total changed files: ${changedFiles.length}`);
    return changedFiles;
  } catch (error) {
    warning(`Failed to get changed files: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * Filter files by extension
 */
export function filterFilesByExtension(
  files: string[],
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx', '.isl']
): string[] {
  return files.filter(file => {
    const ext = file.substring(file.lastIndexOf('.'));
    return extensions.includes(ext);
  });
}

/**
 * Check if a file matches any of the given patterns
 */
export function fileMatchesPatterns(
  file: string,
  patterns: string[]
): boolean {
  return patterns.some(pattern => {
    // Simple glob pattern matching
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(file);
  });
}

/**
 * Get files to check based on configuration
 */
export async function getFilesToCheck(
  token: string,
  context: GitHubContext,
  changedOnly: boolean,
  includePatterns: string[] = ['**/*.{ts,tsx,js,jsx,isl}'],
  excludePatterns: string[] = ['**/node_modules/**', '**/dist/**', '**/.git/**']
): Promise<string[]> {
  if (changedOnly && context.pullRequest) {
    const changedFiles = await getChangedFiles(token, context);
    
    // Filter by include/exclude patterns
    return changedFiles.filter(file => {
      // Check include patterns
      const included = includePatterns.length === 0 || 
        fileMatchesPatterns(file, includePatterns);
      
      // Check exclude patterns
      const excluded = excludePatterns.some(pattern => 
        fileMatchesPatterns(file, pattern)
      );

      return included && !excluded;
    });
  }

  // For non-PR contexts or when changedOnly is false,
  // we would need to walk the filesystem
  // For now, return empty and let the gate decide
  warning('Cannot determine files to check without PR context');
  return [];
}
