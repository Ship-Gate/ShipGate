/**
 * ISL Spec Versioner
 * 
 * Semantic versioning automation for ISL specifications.
 * Analyzes changes between spec versions and computes appropriate
 * version bumps following semver rules.
 */

export { ChangeAnalyzer, analyzeChanges, type ChangeAnalysis, type Change, type ChangeType } from './analyzer.js';
export { Versioner, computeNextVersion, type VersionBump, type VersionResult } from './versioner.js';
export { ChangelogGenerator, generateChangelog, type ChangelogOptions, type ChangelogEntry } from './changelog.js';
export { GitHooks, installHooks, uninstallHooks } from './git/hooks.js';
export { GitTags, createVersionTag, getLatestTag, listVersionTags } from './git/tags.js';

// Re-export types
export type { SemVer } from 'semver';
