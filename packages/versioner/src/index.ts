/**
 * ISL Spec Versioner
 * 
 * Semantic versioning automation for ISL specifications.
 * Analyzes changes between spec versions and computes appropriate
 * version bumps following semver rules.
 */

export { analyzeChanges, type ChangeAnalysis, type Change, type ChangeType } from './analyzer.js';
export { computeNextVersion, bumpVersion, parseVersion, formatVersion, compareVersions, isValidVersion, type SemanticVersion, type VersionBump, type VersionOptions } from './versioner.js';
export { generateChangelog, prependToChangelog, parseChangelog, type ChangelogOptions, type ChangelogEntry, type ChangelogChange } from './changelog.js';
export { installHooks, removeHooks, checkHooksInstalled, createPreCommitHook, createCommitMsgHook } from './git/hooks.js';
export { createTag, deleteTag, pushTags, getTag, listTags, getLatestTag, tagExists, deriveNextVersion, isGitRepo, type GitTag, type CreateTagOptions } from './git/tags.js';

// Re-export types
export type { SemVer } from 'semver';
