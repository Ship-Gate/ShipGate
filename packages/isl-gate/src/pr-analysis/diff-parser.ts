/**
 * PR Analysis - Git Diff Parser
 *
 * Parses `git diff --name-status` and `git diff --stat` output into
 * structured {@link FileChange} objects. Works entirely from local git —
 * no GitHub API required.
 *
 * @module @isl-lang/gate/pr-analysis
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

import type { FileChange, ChangeType, DiffHunk } from './types.js';

const execFileAsync = promisify(execFile);

// ============================================================================
// Git Command Helpers
// ============================================================================

/**
 * Execute a git command and return trimmed stdout.
 */
async function git(
  args: string[],
  cwd: string,
): Promise<string> {
  const cmd = process.platform === 'win32' ? 'git.exe' : 'git';
  const { stdout } = await execFileAsync(cmd, args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 60_000,
  });
  return stdout.trim();
}

// ============================================================================
// Name-Status Parser
// ============================================================================

/**
 * Parse `git diff --name-status` output into {@link FileChange} entries.
 *
 * Handles statuses: A (added), M (modified), D (deleted), R### (renamed).
 */
export function parseNameStatus(raw: string): FileChange[] {
  if (!raw) return [];

  const changes: FileChange[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Tab-separated: STATUS\tPATH  or  R###\tOLD\tNEW
    const parts = trimmed.split('\t');
    if (parts.length < 2) continue;

    const statusCode = parts[0].trim();
    const changeType = mapStatusToChangeType(statusCode);

    if (changeType === 'renamed') {
      // Rename: R###\toldPath\tnewPath
      const oldPath = normalizePath(parts[1]);
      const newPath = parts[2] ? normalizePath(parts[2]) : oldPath;
      changes.push({
        path: newPath,
        oldPath,
        changeType,
        linesAdded: 0,
        linesRemoved: 0,
        hunks: [],
      });
    } else {
      changes.push({
        path: normalizePath(parts[1]),
        changeType,
        linesAdded: 0,
        linesRemoved: 0,
        hunks: [],
      });
    }
  }

  return changes;
}

/**
 * Map git status letter to a {@link ChangeType}.
 */
function mapStatusToChangeType(status: string): ChangeType {
  const code = status.charAt(0).toUpperCase();
  switch (code) {
    case 'A': return 'added';
    case 'M': return 'modified';
    case 'D': return 'deleted';
    case 'R': return 'renamed';
    case 'C': return 'added';  // copy treated as added
    default:  return 'modified';
  }
}

// ============================================================================
// Numstat Parser
// ============================================================================

/**
 * Parse `git diff --numstat` output and merge line counts into
 * existing {@link FileChange} entries.
 *
 * Format: ADDED\tREMOVED\tPATH  (binary files show `-\t-\tpath`)
 */
export function mergeNumstat(
  changes: FileChange[],
  numstatRaw: string,
): void {
  if (!numstatRaw) return;

  const lookup = new Map<string, FileChange>();
  for (const c of changes) {
    lookup.set(c.path, c);
    if (c.oldPath) lookup.set(c.oldPath, c);
  }

  for (const line of numstatRaw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split('\t');
    if (parts.length < 3) continue;

    const [addedStr, removedStr, ...pathParts] = parts;
    const filePath = normalizePath(pathParts.join('\t')); // handles paths with rename arrows

    const change = lookup.get(filePath);
    if (!change) continue;

    if (addedStr !== '-') change.linesAdded = parseInt(addedStr, 10) || 0;
    if (removedStr !== '-') change.linesRemoved = parseInt(removedStr, 10) || 0;
  }
}

// ============================================================================
// Unified Diff Hunk Parser
// ============================================================================

const HUNK_HEADER_RE = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;

/**
 * Parse unified diff output and attach hunks to matching {@link FileChange} entries.
 */
export function mergeHunks(
  changes: FileChange[],
  unifiedDiff: string,
): void {
  if (!unifiedDiff) return;

  const lookup = new Map<string, FileChange>();
  for (const c of changes) {
    lookup.set(c.path, c);
    if (c.oldPath) lookup.set(c.oldPath, c);
  }

  let currentChange: FileChange | undefined;

  for (const line of unifiedDiff.split('\n')) {
    // Detect file header: diff --git a/... b/...
    if (line.startsWith('diff --git ')) {
      const bPathMatch = line.match(/\sb\/(.+)$/);
      if (bPathMatch) {
        const filePath = normalizePath(bPathMatch[1]);
        currentChange = lookup.get(filePath);
      }
      continue;
    }

    // Detect hunk header
    if (currentChange && line.startsWith('@@')) {
      const match = HUNK_HEADER_RE.exec(line);
      if (match) {
        const hunk: DiffHunk = {
          oldStart: parseInt(match[1], 10),
          oldCount: match[2] !== undefined ? parseInt(match[2], 10) : 1,
          newStart: parseInt(match[3], 10),
          newCount: match[4] !== undefined ? parseInt(match[4], 10) : 1,
          header: line,
        };
        currentChange.hunks.push(hunk);
      }
    }
  }
}

// ============================================================================
// High-level: Get Diff from Git
// ============================================================================

/**
 * Retrieve the full list of changed files between two refs using local git.
 *
 * Runs three git commands in sequence:
 * 1. `git diff --name-status` — file statuses
 * 2. `git diff --numstat` — line counts
 * 3. `git diff` (unified) — hunk headers
 */
export async function getChangedFiles(options: {
  baseBranch: string;
  headRef: string;
  cwd: string;
}): Promise<FileChange[]> {
  const { baseBranch, headRef, cwd } = options;
  const range = `${baseBranch}...${headRef}`;

  // 1) Name + status
  const nameStatus = await git(
    ['diff', range, '--name-status'],
    cwd,
  );
  const changes = parseNameStatus(nameStatus);

  if (changes.length === 0) return changes;

  // 2) Line counts
  const numstat = await git(
    ['diff', range, '--numstat'],
    cwd,
  );
  mergeNumstat(changes, numstat);

  // 3) Hunk headers (unified diff)
  const unified = await git(
    ['diff', range, '--unified=0'],
    cwd,
  );
  mergeHunks(changes, unified);

  return changes;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Normalize path separators to forward slashes.
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}
