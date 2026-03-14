/**
 * Git-based change detection for incremental verification.
 *
 * Detects which files changed between the working tree and a base commit,
 * handling renames, binary files, and non-git fallbacks.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const execFileAsync = promisify(execFile);

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface ChangedFile {
  path: string;
  status: FileStatus;
  hash: string;
  /** Original path before rename (only set when status === 'renamed') */
  oldPath?: string;
}

export interface ChangeDetectorOptions {
  /** Compare against this commit/branch instead of HEAD~1 */
  baseRef?: string;
  /** Only include files matching these globs (e.g. ['**\/*.ts', '**\/*.isl']) */
  include?: string[];
  /** Exclude files matching these globs */
  exclude?: string[];
}

const DEFAULT_INCLUDE = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.isl'];
const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/dist/**', '**/.git/**'];

/**
 * Detect changed files using git diff, falling back to full-file enumeration
 * when not in a git repository.
 */
export async function detectChanges(
  projectRoot: string,
  options: ChangeDetectorOptions = {},
): Promise<ChangedFile[]> {
  const root = path.resolve(projectRoot);
  const isGit = await isGitRepo(root);

  if (!isGit) {
    return enumerateAllFiles(root, options);
  }

  return detectGitChanges(root, options);
}

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: dir });
    return true;
  } catch {
    return false;
  }
}

async function detectGitChanges(
  projectRoot: string,
  options: ChangeDetectorOptions,
): Promise<ChangedFile[]> {
  const baseRef = options.baseRef ?? 'HEAD~1';

  let stdout: string;
  try {
    const result = await execFileAsync(
      'git',
      ['diff', '--name-status', '--diff-filter=ADMRTU', '-z', baseRef],
      { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 },
    );
    stdout = result.stdout;
  } catch {
    // baseRef might not exist (shallow clone, initial commit) — treat everything as changed
    return enumerateAllFiles(projectRoot, options);
  }

  const changes = parseNameStatusOutput(stdout);
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;

  const filtered = changes.filter(
    (c) => matchesGlobs(c.path, include) && !matchesGlobs(c.path, exclude),
  );

  const withHashes: ChangedFile[] = await Promise.all(
    filtered.map(async (entry) => {
      const hash = entry.status === 'deleted'
        ? 'deleted'
        : await hashFile(path.join(projectRoot, entry.path));
      return { ...entry, hash };
    }),
  );

  return withHashes;
}

/**
 * Parse `git diff --name-status -z` output.
 * The -z flag uses NUL delimiters which avoids issues with spaces in paths.
 *
 * Format: STATUS\0PATH\0  (renames: STATUS\0OLD_PATH\0NEW_PATH\0)
 */
function parseNameStatusOutput(raw: string): ChangedFile[] {
  const parts = raw.split('\0').filter((s) => s.length > 0);
  const results: ChangedFile[] = [];
  let i = 0;

  while (i < parts.length) {
    const statusCode = parts[i];
    if (!statusCode) break;

    const firstChar = statusCode.charAt(0);

    if (firstChar === 'R' || firstChar === 'C') {
      // Rename or copy: STATUS\0OLD_PATH\0NEW_PATH
      const oldPath = parts[i + 1];
      const newPath = parts[i + 2];
      if (oldPath && newPath) {
        results.push({
          path: newPath,
          status: 'renamed',
          hash: '',
          oldPath,
        });
      }
      i += 3;
    } else {
      const filePath = parts[i + 1];
      if (filePath) {
        results.push({
          path: filePath,
          status: gitStatusToFileStatus(firstChar),
          hash: '',
        });
      }
      i += 2;
    }
  }

  return results;
}

function gitStatusToFileStatus(code: string): FileStatus {
  switch (code) {
    case 'A': return 'added';
    case 'D': return 'deleted';
    case 'M':
    case 'T':
    case 'U': return 'modified';
    default: return 'modified';
  }
}

/**
 * Fallback: enumerate all matching files as "added" when git is unavailable.
 */
async function enumerateAllFiles(
  projectRoot: string,
  options: ChangeDetectorOptions,
): Promise<ChangedFile[]> {
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;
  const files = await walkDir(projectRoot, projectRoot, include, exclude);

  return Promise.all(
    files.map(async (relPath) => ({
      path: relPath,
      status: 'added' as const,
      hash: await hashFile(path.join(projectRoot, relPath)),
    })),
  );
}

async function walkDir(
  root: string,
  dir: string,
  include: string[],
  exclude: string[],
): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(root, fullPath);

    if (matchesGlobs(relPath, exclude)) continue;

    if (entry.isDirectory()) {
      const nested = await walkDir(root, fullPath, include, exclude);
      results.push(...nested);
    } else if (matchesGlobs(relPath, include)) {
      results.push(relPath);
    }
  }

  return results;
}

async function hashFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  } catch {
    return 'unreadable';
  }
}

/**
 * Minimal glob matcher — supports `**`, `*`, and `?` without pulling in dependencies.
 */
function matchesGlobs(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(filePath, pattern));
}

function minimatch(filepath: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${regexStr}$`).test(filepath);
}
