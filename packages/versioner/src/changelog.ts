// ============================================================================
// Changelog Generator
// Generates changelog entries from change analysis
// ============================================================================

import type { ChangeAnalysis, Change } from './analyzer';
import type { SemanticVersion } from './versioner';
import { formatVersion } from './versioner';

// ============================================================================
// TYPES
// ============================================================================

export interface ChangelogOptions {
  format?: 'markdown' | 'json' | 'conventional';
  includeDate?: boolean;
  includeAuthor?: boolean;
  author?: string;
  groupByCategory?: boolean;
  linkPattern?: string; // e.g., 'https://github.com/org/repo/commit/{hash}'
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: ChangelogChange[];
  breaking: ChangelogChange[];
  features: ChangelogChange[];
  fixes: ChangelogChange[];
}

export interface ChangelogChange {
  type: string;
  scope?: string;
  description: string;
  body?: string;
  hash?: string;
  author?: string;
}

// ============================================================================
// CHANGELOG GENERATION
// ============================================================================

/**
 * Generate a changelog entry from change analysis
 */
export function generateChangelog(
  version: string | SemanticVersion,
  analysis: ChangeAnalysis,
  options: ChangelogOptions = {}
): string {
  const versionStr = typeof version === 'string' ? version : formatVersion(version);
  const date = new Date().toISOString().split('T')[0];

  switch (options.format) {
    case 'json':
      return generateJsonChangelog(versionStr, date, analysis, options);
    case 'conventional':
      return generateConventionalChangelog(versionStr, date, analysis, options);
    case 'markdown':
    default:
      return generateMarkdownChangelog(versionStr, date, analysis, options);
  }
}

// ============================================================================
// MARKDOWN FORMAT
// ============================================================================

function generateMarkdownChangelog(
  version: string,
  date: string,
  analysis: ChangeAnalysis,
  options: ChangelogOptions
): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`## [${version}]${options.includeDate ? ` - ${date}` : ''}`);
  lines.push('');

  // Breaking changes
  if (analysis.breaking.length > 0) {
    lines.push('### ⚠️ Breaking Changes');
    lines.push('');
    for (const change of analysis.breaking) {
      lines.push(formatMarkdownChange(change, options));
    }
    lines.push('');
  }

  // Features
  if (analysis.features.length > 0) {
    lines.push('### ✨ Features');
    lines.push('');
    for (const change of analysis.features) {
      lines.push(formatMarkdownChange(change, options));
    }
    lines.push('');
  }

  // Fixes
  if (analysis.fixes.length > 0) {
    lines.push('### 🐛 Fixes');
    lines.push('');
    for (const change of analysis.fixes) {
      lines.push(formatMarkdownChange(change, options));
    }
    lines.push('');
  }

  // Migration guide for breaking changes
  if (analysis.breaking.length > 0) {
    lines.push('### 📝 Migration Guide');
    lines.push('');
    lines.push(generateMigrationGuide(analysis.breaking));
    lines.push('');
  }

  return lines.join('\n');
}

function formatMarkdownChange(change: Change, options: ChangelogOptions): string {
  const scope = extractScope(change.path);
  const scopeStr = scope ? `**${scope}**: ` : '';
  const description = change.description;
  
  let line = `- ${scopeStr}${description}`;
  
  if (change.oldValue !== undefined && change.newValue !== undefined) {
    line += ` (\`${change.oldValue}\` → \`${change.newValue}\`)`;
  }
  
  return line;
}

function extractScope(path: string): string | undefined {
  const parts = path.split('.');
  if (parts.length >= 2) {
    return parts.slice(0, 2).join('.');
  }
  return parts[0];
}

// ============================================================================
// CONVENTIONAL COMMITS FORMAT
// ============================================================================

function generateConventionalChangelog(
  version: string,
  date: string,
  analysis: ChangeAnalysis,
  options: ChangelogOptions
): string {
  const lines: string[] = [];
  
  lines.push(`# ${version} (${date})`);
  lines.push('');

  // Group changes by conventional commit type
  const grouped = groupByConventionalType(analysis);

  for (const [type, changes] of Object.entries(grouped)) {
    if (changes.length === 0) continue;
    
    lines.push(`### ${conventionalTypeHeader(type)}`);
    lines.push('');
    
    for (const change of changes) {
      const scope = extractScope(change.path);
      const scopeStr = scope ? `(${scope})` : '';
      lines.push(`* ${type}${scopeStr}: ${change.description}`);
    }
    lines.push('');
  }

  // BREAKING CHANGE section
  if (analysis.breaking.length > 0) {
    lines.push('### BREAKING CHANGES');
    lines.push('');
    for (const change of analysis.breaking) {
      lines.push(`* ${change.description}`);
      if (change.oldValue !== undefined && change.newValue !== undefined) {
        lines.push(`  - Before: \`${change.oldValue}\``);
        lines.push(`  - After: \`${change.newValue}\``);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function groupByConventionalType(analysis: ChangeAnalysis): Record<string, Change[]> {
  const groups: Record<string, Change[]> = {
    feat: [],
    fix: [],
    docs: [],
    refactor: [],
    perf: [],
    test: [],
    chore: [],
  };

  for (const change of analysis.features) {
    groups.feat.push(change);
  }

  for (const change of analysis.fixes) {
    if (change.type.includes('description') || change.type.includes('documentation')) {
      groups.docs.push(change);
    } else {
      groups.fix.push(change);
    }
  }

  for (const change of analysis.breaking) {
    // Breaking changes go to feat with BREAKING marker
    groups.feat.push(change);
  }

  return groups;
}

function conventionalTypeHeader(type: string): string {
  const headers: Record<string, string> = {
    feat: 'Features',
    fix: 'Bug Fixes',
    docs: 'Documentation',
    refactor: 'Code Refactoring',
    perf: 'Performance Improvements',
    test: 'Tests',
    chore: 'Chores',
  };
  return headers[type] ?? type;
}

// ============================================================================
// JSON FORMAT
// ============================================================================

function generateJsonChangelog(
  version: string,
  date: string,
  analysis: ChangeAnalysis,
  options: ChangelogOptions
): string {
  const entry: ChangelogEntry = {
    version,
    date,
    changes: analysis.all.map(changeToChangelogChange),
    breaking: analysis.breaking.map(changeToChangelogChange),
    features: analysis.features.map(changeToChangelogChange),
    fixes: analysis.fixes.map(changeToChangelogChange),
  };

  return JSON.stringify(entry, null, 2);
}

function changeToChangelogChange(change: Change): ChangelogChange {
  const scope = extractScope(change.path);
  
  return {
    type: change.type,
    scope,
    description: change.description,
    body: change.oldValue !== undefined && change.newValue !== undefined
      ? `Changed from ${change.oldValue} to ${change.newValue}`
      : undefined,
  };
}

// ============================================================================
// MIGRATION GUIDE
// ============================================================================

function generateMigrationGuide(breakingChanges: Change[]): string {
  const lines: string[] = [];

  for (const change of breakingChanges) {
    lines.push(`#### ${change.type}`);
    lines.push('');
    lines.push(change.description);
    lines.push('');

    // Generate specific migration steps based on change type
    const steps = getMigrationSteps(change);
    if (steps.length > 0) {
      lines.push('**Migration steps:**');
      for (const step of steps) {
        lines.push(`1. ${step}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function getMigrationSteps(change: Change): string[] {
  switch (change.type) {
    case 'entity-removed':
      return [
        'Remove all references to this entity in your code',
        'Update any database migrations that reference this entity',
        'Update API clients that depend on this entity',
      ];

    case 'field-removed':
      return [
        'Remove any code that reads or writes to this field',
        'Update API payloads to not include this field',
        'Run database migration to remove the column',
      ];

    case 'field-type-changed':
      return [
        `Update code to handle the new type: ${change.newValue}`,
        'Update validation logic for the new type',
        'Run database migration to update the column type',
      ];

    case 'behavior-removed':
      return [
        'Remove all client code that calls this behavior',
        'Update any automated tests that reference this behavior',
        'Update API documentation',
      ];

    case 'input-field-removed':
      return [
        'Update all API calls to not send this field',
        'Remove validation for this field',
      ];

    case 'input-field-type-changed':
      return [
        `Update all API calls to send the new type: ${change.newValue}`,
        'Update client-side validation',
      ];

    case 'precondition-added':
      return [
        'Ensure all callers satisfy the new precondition',
        'Add client-side validation for the new requirement',
        'Update tests to include the new precondition',
      ];

    case 'constraint-tightened':
      return [
        `Update existing data to satisfy the new constraint`,
        `Update validation to enforce: ${change.newValue}`,
      ];

    case 'enum-variant-removed':
      return [
        `Update code to handle the removed variant: ${change.oldValue}`,
        'Migrate existing data that uses this variant',
      ];

    default:
      return [];
  }
}

// ============================================================================
// FULL CHANGELOG MANAGEMENT
// ============================================================================

/**
 * Prepend a new entry to an existing changelog
 */
export function prependToChangelog(
  existingChangelog: string,
  newEntry: string
): string {
  // Find the first version header
  const headerMatch = existingChangelog.match(/^## \[/m);
  
  if (headerMatch && headerMatch.index !== undefined) {
    // Insert before the first version
    const before = existingChangelog.slice(0, headerMatch.index);
    const after = existingChangelog.slice(headerMatch.index);
    return `${before}${newEntry}\n${after}`;
  }
  
  // No existing versions, append after any header content
  return `${existingChangelog}\n${newEntry}`;
}

/**
 * Parse an existing changelog into entries
 */
export function parseChangelog(changelog: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const versionRegex = /^## \[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/gm;
  
  let match;
  const positions: Array<{ version: string; date: string; start: number }> = [];
  
  while ((match = versionRegex.exec(changelog)) !== null) {
    positions.push({
      version: match[1],
      date: match[2] ?? '',
      start: match.index,
    });
  }

  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const next = positions[i + 1];
    const content = changelog.slice(
      current.start,
      next?.start ?? changelog.length
    );

    entries.push({
      version: current.version,
      date: current.date,
      changes: parseChangelogSection(content),
      breaking: parseChangelogSection(content, 'Breaking'),
      features: parseChangelogSection(content, 'Features'),
      fixes: parseChangelogSection(content, 'Fixes'),
    });
  }

  return entries;
}

function parseChangelogSection(content: string, section?: string): ChangelogChange[] {
  const changes: ChangelogChange[] = [];
  
  // Find section if specified
  let sectionContent = content;
  if (section) {
    const sectionRegex = new RegExp(`### [^\\n]*${section}[^\\n]*\\n([\\s\\S]*?)(?=###|$)`, 'i');
    const match = content.match(sectionRegex);
    if (!match) return [];
    sectionContent = match[1];
  }

  // Parse bullet points
  const bulletRegex = /^[-*]\s+(?:\*\*([^*]+)\*\*:\s*)?(.+)$/gm;
  let match;
  
  while ((match = bulletRegex.exec(sectionContent)) !== null) {
    changes.push({
      type: 'unknown',
      scope: match[1],
      description: match[2].trim(),
    });
  }

  return changes;
}
