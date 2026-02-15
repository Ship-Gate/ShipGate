/**
 * Call Site Finder
 *
 * Uses static grep to find example call sites for a function across a project.
 * Returns the top N most relevant call examples.
 *
 * @module @isl-lang/ai-generator/grounded-spec/call-site-finder
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CallSiteExample } from './types.js';

// ============================================================================
// Main entry
// ============================================================================

export interface CallSiteFinderOptions {
  functionName: string;
  projectRoot: string;
  filePath: string;
  maxResults?: number;
}

/**
 * Find example call sites for a function across the project.
 * Uses a synchronous file-walk + regex approach (no child_process needed).
 */
export async function findCallSites(options: CallSiteFinderOptions): Promise<CallSiteExample[]> {
  const { functionName, projectRoot, filePath, maxResults = 3 } = options;

  const normalizedFilePath = path.resolve(filePath);
  const candidates: CallSiteExample[] = [];

  // Build regex to find calls like: functionName( or .functionName(
  const callPattern = new RegExp(
    `(?:^|[^\\w.])${escapeRegex(functionName)}\\s*\\(`,
    'g',
  );

  // Walk source files
  const sourceFiles = collectSourceFiles(projectRoot, ['.ts', '.tsx', '.js', '.jsx']);

  for (const srcFile of sourceFiles) {
    // Skip the definition file itself
    if (path.resolve(srcFile) === normalizedFilePath) continue;

    let content: string;
    try {
      content = fs.readFileSync(srcFile, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      callPattern.lastIndex = 0;

      if (callPattern.test(line)) {
        const trimmed = line.trim();
        // Skip imports, type references, and declarations
        if (trimmed.startsWith('import ') || trimmed.startsWith('export ') ||
            trimmed.startsWith('//') || trimmed.startsWith('*')) {
          continue;
        }

        const args = extractCallArgs(line, functionName);

        candidates.push({
          file: path.relative(projectRoot, srcFile),
          line: i + 1,
          snippet: trimmed.slice(0, 200),
          args,
        });

        if (candidates.length >= maxResults * 3) break;
      }
    }

    if (candidates.length >= maxResults * 3) break;
  }

  // Sort by relevance: prefer shorter snippets (more focused), non-test files first
  candidates.sort((a, b) => {
    const aIsTest = isTestFile(a.file) ? 1 : 0;
    const bIsTest = isTestFile(b.file) ? 1 : 0;
    if (aIsTest !== bIsTest) return aIsTest - bIsTest;
    return a.snippet.length - b.snippet.length;
  });

  return candidates.slice(0, maxResults);
}

// ============================================================================
// File walker
// ============================================================================

function collectSourceFiles(dir: string, extensions: string[], depth = 0): string[] {
  if (depth > 8) return [];
  const results: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const name = entry.name;

    // Skip common non-source directories
    if (entry.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.git' ||
          name === '.turbo' || name === 'coverage' || name === '.next' ||
          name === 'build' || name === '__pycache__') {
        continue;
      }
      results.push(...collectSourceFiles(path.join(dir, name), extensions, depth + 1));
    } else if (entry.isFile()) {
      const ext = path.extname(name);
      if (extensions.includes(ext)) {
        results.push(path.join(dir, name));
      }
    }
  }

  return results;
}

// ============================================================================
// Helpers
// ============================================================================

function extractCallArgs(line: string, functionName: string): string[] {
  const pattern = new RegExp(`${escapeRegex(functionName)}\\s*\\(([^)]*)\\)`);
  const match = pattern.exec(line);
  if (!match || !match[1]) return [];

  return match[1]
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isTestFile(filePath: string): boolean {
  return /\.(test|spec|e2e)\.[jt]sx?$/.test(filePath) ||
         filePath.includes('__tests__') ||
         filePath.includes('/tests/') ||
         filePath.includes('\\tests\\');
}
