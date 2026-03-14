/**
 * Git Blame Parser
 *
 * Runs `git blame --porcelain` and parses the output into structured
 * BlameEntry records with author, commit, timestamp, and line content.
 *
 * @module @isl-lang/code-provenance
 */

import { execSync } from 'child_process';
import type { BlameEntry } from './types.js';

/**
 * Parse git blame porcelain output for a single file.
 *
 * Porcelain format emits blocks per line:
 *   <hash> <orig-line> <final-line> [<num-lines>]
 *   author <name>
 *   author-mail <<email>>
 *   author-time <unix-ts>
 *   author-tz <tz>
 *   committer <name>
 *   committer-mail <<email>>
 *   committer-time <unix-ts>
 *   committer-tz <tz>
 *   summary <message>
 *   ...
 *   \t<content>
 *
 * When a commit hash is repeated, only the header line and content line
 * appear (no author/committer block). We cache the metadata from the
 * first occurrence to fill in repeated entries.
 */
export function parseBlameOutput(raw: string): BlameEntry[] {
  const lines = raw.split('\n');
  const entries: BlameEntry[] = [];
  const commitCache = new Map<string, Omit<BlameEntry, 'lineNumber' | 'content'>>();

  let i = 0;
  while (i < lines.length) {
    const headerLine = lines[i];
    if (!headerLine || headerLine.trim() === '') {
      i++;
      continue;
    }

    const headerMatch = headerLine.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)(?:\s+(\d+))?$/);
    if (!headerMatch) {
      i++;
      continue;
    }

    const commitHash = headerMatch[1]!;
    const finalLine = parseInt(headerMatch[3]!, 10);
    i++;

    const isFirstOccurrence = !commitCache.has(commitHash);

    let authorName = '';
    let authorEmail = '';
    let authorTimestamp = 0;
    let authorTz = '';
    let committerName = '';
    let committerEmail = '';
    let committerTimestamp = 0;
    let committerTz = '';
    let summary = '';

    if (isFirstOccurrence) {
      while (i < lines.length && !lines[i]!.startsWith('\t')) {
        const line = lines[i]!;
        if (line.startsWith('author ')) {
          authorName = line.slice(7);
        } else if (line.startsWith('author-mail ')) {
          authorEmail = line.slice(12).replace(/^<|>$/g, '');
        } else if (line.startsWith('author-time ')) {
          authorTimestamp = parseInt(line.slice(12), 10);
        } else if (line.startsWith('author-tz ')) {
          authorTz = line.slice(10);
        } else if (line.startsWith('committer ')) {
          committerName = line.slice(10);
        } else if (line.startsWith('committer-mail ')) {
          committerEmail = line.slice(15).replace(/^<|>$/g, '');
        } else if (line.startsWith('committer-time ')) {
          committerTimestamp = parseInt(line.slice(15), 10);
        } else if (line.startsWith('committer-tz ')) {
          committerTz = line.slice(13);
        } else if (line.startsWith('summary ')) {
          summary = line.slice(8);
        }
        i++;
      }

      commitCache.set(commitHash, {
        commitHash,
        authorName,
        authorEmail,
        authorTimestamp,
        authorTz,
        committerName,
        committerEmail,
        committerTimestamp,
        committerTz,
        summary,
      });
    } else {
      while (i < lines.length && !lines[i]!.startsWith('\t')) {
        i++;
      }
      const cached = commitCache.get(commitHash)!;
      authorName = cached.authorName;
      authorEmail = cached.authorEmail;
      authorTimestamp = cached.authorTimestamp;
      authorTz = cached.authorTz;
      committerName = cached.committerName;
      committerEmail = cached.committerEmail;
      committerTimestamp = cached.committerTimestamp;
      committerTz = cached.committerTz;
      summary = cached.summary;
    }

    let content = '';
    if (i < lines.length && lines[i]!.startsWith('\t')) {
      content = lines[i]!.slice(1);
      i++;
    }

    entries.push({
      commitHash,
      lineNumber: finalLine,
      content,
      authorName,
      authorEmail,
      authorTimestamp,
      authorTz,
      committerName,
      committerEmail,
      committerTimestamp,
      committerTz,
      summary,
    });
  }

  return entries;
}

/**
 * Run git blame on a file and return structured entries.
 * Returns empty array for binary files, empty files, or untracked files.
 */
export function blameFile(filePath: string, cwd: string): BlameEntry[] {
  try {
    const raw = execSync(`git blame --porcelain -- "${filePath}"`, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024, // 50MB for large files
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseBlameOutput(raw);
  } catch {
    return [];
  }
}

/**
 * Check whether a file is tracked by git.
 */
export function isTracked(filePath: string, cwd: string): boolean {
  try {
    execSync(`git ls-files --error-unmatch -- "${filePath}"`, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * List all tracked files matching the given include/exclude globs.
 */
export function listTrackedFiles(
  cwd: string,
  include: string[] = [],
  exclude: string[] = [],
): string[] {
  try {
    const raw = execSync('git ls-files', {
      cwd,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });

    let files = raw.split('\n').filter(Boolean);

    if (include.length > 0) {
      const includeExts = include
        .map((g) => g.replace(/^\*\*\/\*\./, '.'))
        .filter((e) => e.startsWith('.'));
      if (includeExts.length > 0) {
        files = files.filter((f) => includeExts.some((ext) => f.endsWith(ext)));
      }
    }

    if (exclude.length > 0) {
      const excludeDirs = exclude
        .map((g) => g.replace(/^\*\*\//, '').replace(/\/\*\*$/, ''))
        .filter(Boolean);
      files = files.filter(
        (f) => !excludeDirs.some((dir) => f.includes(dir + '/')),
      );
    }

    return files;
  } catch {
    return [];
  }
}
