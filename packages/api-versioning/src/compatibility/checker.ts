/**
 * Compatibility Checker
 * 
 * Checks backward compatibility between API versions.
 */

import type {
  Domain,
  DomainDiff,
  Change,
  ChangeSeverity,
} from '../types.js';
import { diffDomains } from '../migration/differ.js';

export interface CompatibilityResult {
  isCompatible: boolean;
  breakingChanges: Change[];
  warnings: Change[];
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100, 100 = fully compatible
}

/**
 * Check backward compatibility between two domain versions
 */
export function checkCompatibility(from: Domain, to: Domain): CompatibilityResult {
  const diff = diffDomains(from, to);
  
  const breakingChanges = diff.breaking;
  const warnings = diff.nonBreaking.filter(c => c.severity === 'medium');
  
  const severity = calculateSeverity(breakingChanges);
  const score = calculateCompatibilityScore(diff);
  
  return {
    isCompatible: breakingChanges.length === 0,
    breakingChanges,
    warnings,
    severity,
    score,
  };
}

/**
 * Calculate overall severity
 */
function calculateSeverity(changes: Change[]): CompatibilityResult['severity'] {
  if (changes.length === 0) return 'none';
  
  const severityCounts = {
    high: 0,
    medium: 0,
    low: 0,
  };
  
  for (const change of changes) {
    const sev = change.severity ?? 'medium';
    severityCounts[sev]++;
  }
  
  if (severityCounts.high >= 3) return 'critical';
  if (severityCounts.high >= 1) return 'high';
  if (severityCounts.medium >= 3) return 'medium';
  if (severityCounts.medium >= 1) return 'low';
  return 'low';
}

/**
 * Calculate compatibility score (0-100)
 */
function calculateCompatibilityScore(diff: DomainDiff): number {
  if (diff.breaking.length === 0) return 100;
  
  // Weights for different severities
  const weights: Record<ChangeSeverity, number> = {
    high: 20,
    medium: 10,
    low: 5,
  };
  
  let deductions = 0;
  
  for (const change of diff.breaking) {
    const severity = change.severity ?? 'medium';
    deductions += weights[severity];
  }
  
  return Math.max(0, 100 - deductions);
}

/**
 * Check if a specific change type is breaking
 */
export function isBreakingChangeType(type: string): boolean {
  const breakingTypes = new Set([
    'field_removed',
    'field_type_changed',
    'field_required_changed',
    'behavior_removed',
    'entity_removed',
    'type_removed',
    'type_changed',
    'error_removed',
    'constraint_added',
    'constraint_changed',
  ]);
  
  return breakingTypes.has(type);
}

/**
 * Suggest migration strategy based on changes
 */
export function suggestMigrationStrategy(diff: DomainDiff): MigrationStrategy {
  const breakingCount = diff.breaking.length;
  const highSeverityCount = diff.breaking.filter(c => c.severity === 'high').length;
  
  if (breakingCount === 0) {
    return {
      type: 'in-place',
      description: 'No breaking changes, can update in place',
      riskLevel: 'low',
    };
  }
  
  if (highSeverityCount > 0 || breakingCount > 5) {
    return {
      type: 'blue-green',
      description: 'Significant breaking changes require parallel deployment',
      riskLevel: 'high',
      steps: [
        'Deploy new version alongside old version',
        'Route new traffic to new version',
        'Migrate existing clients gradually',
        'Monitor for errors',
        'Sunset old version after migration period',
      ],
    };
  }
  
  return {
    type: 'rolling',
    description: 'Moderate changes allow rolling update with transformers',
    riskLevel: 'medium',
    steps: [
      'Deploy transformers for backward compatibility',
      'Rolling update to new version',
      'Monitor for client issues',
      'Deprecate old API after client updates',
    ],
  };
}

export interface MigrationStrategy {
  type: 'in-place' | 'rolling' | 'blue-green' | 'canary';
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  steps?: string[];
}
