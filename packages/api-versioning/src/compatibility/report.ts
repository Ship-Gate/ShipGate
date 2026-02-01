/**
 * Compatibility Report Generator
 * 
 * Generates human-readable compatibility reports.
 */

import type {
  Domain,
  DomainDiff,
  Change,
  CompatibilityReport,
  ReportChange,
  MigrationStep,
} from '../types.js';
import { diffDomains, behaviorToEndpoint } from '../migration/differ.js';
import { suggestMigrationStrategy } from './checker.js';

/**
 * Generate a full compatibility report
 */
export function generateReport(from: Domain, to: Domain): CompatibilityReport {
  const diff = diffDomains(from, to);
  
  const breakingChanges = diff.breaking.map(changeToReportChange);
  const nonBreakingChanges = diff.nonBreaking.map(changeToReportChange);
  const migrationPath = generateMigrationPath(diff);
  const markdown = generateMarkdownReport(diff, breakingChanges, nonBreakingChanges, migrationPath);
  
  return {
    from: diff.from,
    to: diff.to,
    summary: {
      breakingCount: diff.breaking.length,
      nonBreakingCount: diff.nonBreaking.length,
      isBackwardCompatible: diff.compatible,
    },
    breakingChanges,
    nonBreakingChanges,
    migrationPath,
    markdown,
  };
}

/**
 * Convert Change to ReportChange
 */
function changeToReportChange(change: Change): ReportChange {
  return {
    title: formatChangeTitle(change),
    severity: change.severity ?? 'medium',
    description: change.description,
    affectedEndpoints: change.affectedEndpoints ?? [],
    migration: change.migration,
  };
}

/**
 * Format change title
 */
function formatChangeTitle(change: Change): string {
  const typeLabels: Record<string, string> = {
    field_removed: 'Field Removed',
    field_added: 'Field Added',
    field_renamed: 'Field Renamed',
    field_type_changed: 'Type Changed',
    field_required_changed: 'Required Status Changed',
    type_changed: 'Type Definition Changed',
    type_added: 'Type Added',
    type_removed: 'Type Removed',
    constraint_added: 'Constraint Added',
    constraint_removed: 'Constraint Removed',
    constraint_changed: 'Constraint Changed',
    behavior_added: 'Behavior Added',
    behavior_removed: 'Behavior Removed',
    error_added: 'Error Case Added',
    error_removed: 'Error Case Removed',
    entity_added: 'Entity Added',
    entity_removed: 'Entity Removed',
    postcondition_added: 'Postcondition Added',
    precondition_added: 'Precondition Added',
  };
  
  const label = typeLabels[change.type] ?? change.type;
  return `${label}: \`${change.path}\``;
}

/**
 * Generate migration path steps
 */
function generateMigrationPath(diff: DomainDiff): MigrationStep[] {
  const steps: MigrationStep[] = [];
  let order = 1;
  
  const strategy = suggestMigrationStrategy(diff);
  
  // Initial setup step
  steps.push({
    order: order++,
    description: `Deploy ${diff.to} alongside ${diff.from}`,
    details: strategy.description,
  });
  
  // Group changes by entity/behavior
  const grouped = groupChanges(diff.breaking);
  
  // Generate migration steps for each group
  for (const [group, changes] of Object.entries(grouped)) {
    if (changes.length > 0) {
      steps.push({
        order: order++,
        description: `Migrate ${group} changes`,
        details: changes.map(c => `- ${c.migration ?? c.description}`).join('\n'),
      });
    }
  }
  
  // Handle non-breaking changes
  if (diff.nonBreaking.length > 0) {
    steps.push({
      order: order++,
      description: 'Handle new optional features',
      details: `${diff.nonBreaking.length} non-breaking changes added (optional fields, new errors, etc.)`,
    });
  }
  
  // Final sunset step
  steps.push({
    order: order++,
    description: `Sunset ${diff.from} after migration period`,
    details: 'Monitor for remaining traffic, then deprecate old version',
  });
  
  return steps;
}

/**
 * Group changes by entity/behavior
 */
function groupChanges(changes: Change[]): Record<string, Change[]> {
  const groups: Record<string, Change[]> = {
    entities: [],
    behaviors: [],
    types: [],
    other: [],
  };
  
  for (const change of changes) {
    if (change.type.includes('entity') || change.type.includes('field')) {
      groups.entities.push(change);
    } else if (change.type.includes('behavior') || change.type.includes('error')) {
      groups.behaviors.push(change);
    } else if (change.type.includes('type') || change.type.includes('constraint')) {
      groups.types.push(change);
    } else {
      groups.other.push(change);
    }
  }
  
  return groups;
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(
  diff: DomainDiff,
  breakingChanges: ReportChange[],
  nonBreakingChanges: ReportChange[],
  migrationPath: MigrationStep[]
): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`# API Compatibility Report: ${diff.from} → ${diff.to}`);
  lines.push('');
  
  // Summary
  lines.push('## Summary');
  lines.push(`- **Breaking Changes**: ${diff.breaking.length}`);
  lines.push(`- **Non-Breaking Changes**: ${diff.nonBreaking.length}`);
  lines.push(`- **Backward Compatible**: ${diff.compatible ? '✅ Yes' : '❌ No'}`);
  lines.push('');
  
  // Breaking Changes
  if (breakingChanges.length > 0) {
    lines.push('## Breaking Changes');
    lines.push('');
    
    breakingChanges.forEach((change, index) => {
      lines.push(`### ${index + 1}. ${change.title}`);
      lines.push(`- **Severity**: ${capitalizeFirst(change.severity)}`);
      if (change.affectedEndpoints.length > 0) {
        lines.push(`- **Affected Endpoints**: ${change.affectedEndpoints.join(', ')}`);
      }
      if (change.migration) {
        lines.push(`- **Migration**: ${change.migration}`);
      }
      lines.push('');
    });
  }
  
  // Non-Breaking Changes
  if (nonBreakingChanges.length > 0) {
    lines.push('## Non-Breaking Changes');
    lines.push('');
    
    nonBreakingChanges.forEach((change, index) => {
      lines.push(`### ${index + 1}. ${change.title}`);
      lines.push('');
    });
  }
  
  // Migration Path
  lines.push('## Recommended Migration Path');
  lines.push('');
  
  migrationPath.forEach(step => {
    lines.push(`${step.order}. ${step.description}`);
    if (step.details) {
      lines.push(`   ${step.details.split('\n').join('\n   ')}`);
    }
  });
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate short summary
 */
export function generateSummary(from: Domain, to: Domain): string {
  const diff = diffDomains(from, to);
  
  if (diff.compatible) {
    return `✅ ${diff.from} → ${diff.to}: Backward compatible (${diff.nonBreaking.length} additions)`;
  }
  
  return `❌ ${diff.from} → ${diff.to}: ${diff.breaking.length} breaking changes`;
}
