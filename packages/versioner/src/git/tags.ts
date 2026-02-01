// ============================================================================
// Git Tag Management
// Create and manage version tags in Git
// ============================================================================

import { spawn } from 'child_process';
import type { SemanticVersion } from '../versioner';
import { formatVersion, parseVersion, compareVersions } from '../versioner';

// ============================================================================
// TYPES
// ============================================================================

export interface GitTag {
  name: string;
  version: SemanticVersion;
  commit: string;
  date: Date;
  message?: string;
  tagger?: string;
}

export interface CreateTagOptions {
  message?: string;
  sign?: boolean;
  annotated?: boolean;
  prefix?: string;
  force?: boolean;
}

// ============================================================================
// TAG OPERATIONS
// ============================================================================

/**
 * Create a new version tag
 */
export async function createTag(
  version: string | SemanticVersion,
  options: CreateTagOptions = {}
): Promise<GitTag> {
  const versionStr = typeof version === 'string' ? version : formatVersion(version);
  const prefix = options.prefix ?? 'v';
  const tagName = `${prefix}${versionStr.replace(/^v/, '')}`;
  
  const args = ['tag'];
  
  // Annotated tag (default for releases)
  if (options.annotated !== false) {
    args.push('-a');
  }
  
  // Sign tag
  if (options.sign) {
    args.push('-s');
  }
  
  // Force overwrite
  if (options.force) {
    args.push('-f');
  }
  
  // Tag name
  args.push(tagName);
  
  // Message
  if (options.message || options.annotated !== false) {
    args.push('-m', options.message ?? `Release ${versionStr}`);
  }
  
  await runGit(args);
  
  return getTag(tagName);
}

/**
 * Delete a tag
 */
export async function deleteTag(tagName: string, remote: boolean = false): Promise<void> {
  // Delete local tag
  await runGit(['tag', '-d', tagName]);
  
  // Delete remote tag if requested
  if (remote) {
    await runGit(['push', 'origin', `:refs/tags/${tagName}`]);
  }
}

/**
 * Push tags to remote
 */
export async function pushTags(tags?: string[]): Promise<void> {
  if (tags && tags.length > 0) {
    for (const tag of tags) {
      await runGit(['push', 'origin', tag]);
    }
  } else {
    await runGit(['push', '--tags']);
  }
}

// ============================================================================
// TAG QUERIES
// ============================================================================

/**
 * Get details about a specific tag
 */
export async function getTag(tagName: string): Promise<GitTag> {
  // Get tag info
  const showOutput = await runGit([
    'show',
    '--no-patch',
    '--format=%H%n%aI%n%an%n%s',
    tagName,
  ]);
  
  const lines = showOutput.trim().split('\n');
  const [commit, dateStr, tagger, message] = lines;
  
  // Parse version from tag name
  const versionStr = tagName.replace(/^v/, '');
  
  return {
    name: tagName,
    version: parseVersion(versionStr),
    commit,
    date: new Date(dateStr),
    message,
    tagger,
  };
}

/**
 * List all version tags
 */
export async function listTags(options: {
  prefix?: string;
  sort?: 'version' | 'date' | 'name';
  limit?: number;
} = {}): Promise<GitTag[]> {
  const prefix = options.prefix ?? 'v';
  const pattern = `${prefix}*`;
  
  // Get all tags matching pattern
  const output = await runGit([
    'tag',
    '-l',
    pattern,
    '--sort=-version:refname',
    '--format=%(refname:short)%09%(objectname:short)%09%(creatordate:iso-strict)',
  ]);
  
  if (!output.trim()) {
    return [];
  }
  
  const tags: GitTag[] = [];
  
  for (const line of output.trim().split('\n')) {
    const [name, commit, dateStr] = line.split('\t');
    if (!name) continue;
    
    const versionStr = name.replace(new RegExp(`^${prefix}`), '');
    
    try {
      tags.push({
        name,
        version: parseVersion(versionStr),
        commit,
        date: new Date(dateStr),
      });
    } catch {
      // Skip invalid version tags
    }
  }
  
  // Sort
  if (options.sort === 'date') {
    tags.sort((a, b) => b.date.getTime() - a.date.getTime());
  } else if (options.sort === 'name') {
    tags.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // Default: sort by version
    tags.sort((a, b) => compareVersions(b.version, a.version));
  }
  
  // Limit
  if (options.limit && options.limit > 0) {
    return tags.slice(0, options.limit);
  }
  
  return tags;
}

/**
 * Get the latest version tag
 */
export async function getLatestTag(options: {
  prefix?: string;
  includePrerelease?: boolean;
} = {}): Promise<GitTag | null> {
  const tags = await listTags({
    prefix: options.prefix,
    sort: 'version',
  });
  
  if (!options.includePrerelease) {
    const stable = tags.find(t => !t.version.prerelease);
    if (stable) return stable;
  }
  
  return tags[0] ?? null;
}

/**
 * Get tags between two versions
 */
export async function getTagsBetween(
  from: string,
  to: string,
  options: { prefix?: string } = {}
): Promise<GitTag[]> {
  const tags = await listTags({ prefix: options.prefix });
  const fromVersion = parseVersion(from);
  const toVersion = parseVersion(to);
  
  return tags.filter(tag => {
    const cmpFrom = compareVersions(tag.version, fromVersion);
    const cmpTo = compareVersions(tag.version, toVersion);
    return cmpFrom >= 0 && cmpTo <= 0;
  });
}

/**
 * Check if a tag exists
 */
export async function tagExists(tagName: string): Promise<boolean> {
  try {
    await runGit(['rev-parse', tagName]);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// VERSION DERIVATION
// ============================================================================

/**
 * Get the next version based on existing tags
 */
export async function deriveNextVersion(
  bump: 'major' | 'minor' | 'patch',
  options: { prefix?: string } = {}
): Promise<SemanticVersion> {
  const latest = await getLatestTag({ prefix: options.prefix });
  
  if (!latest) {
    // No existing tags, start at 1.0.0
    return { major: 1, minor: 0, patch: 0 };
  }
  
  const version = { ...latest.version };
  delete version.prerelease;
  delete version.build;
  
  switch (bump) {
    case 'major':
      version.major += 1;
      version.minor = 0;
      version.patch = 0;
      break;
    case 'minor':
      version.minor += 1;
      version.patch = 0;
      break;
    case 'patch':
      version.patch += 1;
      break;
  }
  
  return version;
}

/**
 * Get commits since a tag
 */
export async function getCommitsSinceTag(tagName: string): Promise<string[]> {
  const output = await runGit([
    'log',
    `${tagName}..HEAD`,
    '--pretty=format:%H|%s|%an|%aI',
  ]);
  
  if (!output.trim()) {
    return [];
  }
  
  return output.trim().split('\n');
}

/**
 * Get changed files since a tag
 */
export async function getChangedFilesSinceTag(
  tagName: string,
  pattern?: string
): Promise<string[]> {
  const args = ['diff', '--name-only', tagName, 'HEAD'];
  
  if (pattern) {
    args.push('--', pattern);
  }
  
  const output = await runGit(args);
  
  if (!output.trim()) {
    return [];
  }
  
  return output.trim().split('\n');
}

// ============================================================================
// GIT UTILITIES
// ============================================================================

async function runGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Git command failed: ${stderr || stdout}`));
      } else {
        resolve(stdout);
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Check if current directory is a git repository
 */
export async function isGitRepo(): Promise<boolean> {
  try {
    await runGit(['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(): Promise<string> {
  const output = await runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  return output.trim();
}

/**
 * Get current commit hash
 */
export async function getCurrentCommit(): Promise<string> {
  const output = await runGit(['rev-parse', 'HEAD']);
  return output.trim();
}
