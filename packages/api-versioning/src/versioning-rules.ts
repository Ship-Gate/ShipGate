/**
 * Semantic Versioning Rules for API Contracts
 * 
 * Determines version bumps (major/minor/patch) based on API contract changes.
 */

import type { DomainDiff, Change, ChangeType } from './types.js';
import { diffDomains } from './migration/differ.js';
import * as semver from 'semver';

export interface VersionBump {
  type: 'major' | 'minor' | 'patch' | 'none';
  reason: string;
  fromVersion: string;
  toVersion: string;
  breakingChanges: Change[];
  featureChanges: Change[];
  fixChanges: Change[];
}

export interface VersioningRules {
  /**
   * Determine version bump from domain diff
   */
  determineBump(from: string, diff: DomainDiff): VersionBump;

  /**
   * Calculate version bump from current version and changes
   */
  calculateVersion(currentVersion: string, diff: DomainDiff): string;

  /**
   * Check if changes require major version bump
   */
  requiresMajorBump(changes: Change[]): boolean;

  /**
   * Check if changes require minor version bump
   */
  requiresMinorBump(changes: Change[]): boolean;

  /**
   * Check if changes require patch version bump
   */
  requiresPatchBump(changes: Change[]): boolean;
}

/**
 * Default semantic versioning rules implementation
 */
export class DefaultVersioningRules implements VersioningRules {
  /**
   * Determine version bump from domain diff
   */
  determineBump(from: string, diff: DomainDiff): VersionBump {
    const currentVersion = this.extractVersion(from) || '1.0.0';
    
    // Categorize changes
    const breakingChanges = diff.breaking;
    const featureChanges = diff.nonBreaking.filter(c => this.isFeatureChange(c));
    const fixChanges = diff.nonBreaking.filter(c => this.isFixChange(c));

    // Determine bump type
    let bumpType: 'major' | 'minor' | 'patch' | 'none' = 'none';
    let reason = 'No changes detected';

    if (breakingChanges.length > 0) {
      bumpType = 'major';
      reason = `${breakingChanges.length} breaking change(s) detected`;
    } else if (featureChanges.length > 0) {
      bumpType = 'minor';
      reason = `${featureChanges.length} new feature(s) added`;
    } else if (fixChanges.length > 0) {
      bumpType = 'patch';
      reason = `${fixChanges.length} fix(es) applied`;
    }

    const toVersion = this.calculateVersion(currentVersion, diff);

    return {
      type: bumpType,
      reason,
      fromVersion: currentVersion,
      toVersion,
      breakingChanges,
      featureChanges,
      fixChanges,
    };
  }

  /**
   * Calculate next version based on changes
   */
  calculateVersion(currentVersion: string, diff: DomainDiff): string {
    const parsed = semver.parse(currentVersion);
    if (!parsed) {
      // Invalid version, default to 1.0.0
      return diff.breaking.length > 0 ? '2.0.0' : '1.0.0';
    }

    if (diff.breaking.length > 0) {
      // Major bump for breaking changes
      return `${parsed.major + 1}.0.0`;
    }

    const featureChanges = diff.nonBreaking.filter(c => this.isFeatureChange(c));
    if (featureChanges.length > 0) {
      // Minor bump for new features
      return `${parsed.major}.${parsed.minor + 1}.0`;
    }

    const fixChanges = diff.nonBreaking.filter(c => this.isFixChange(c));
    if (fixChanges.length > 0) {
      // Patch bump for fixes
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    }

    // No changes
    return currentVersion;
  }

  /**
   * Check if changes require major version bump
   */
  requiresMajorBump(changes: Change[]): boolean {
    return changes.some(c => this.isBreakingChange(c.type));
  }

  /**
   * Check if changes require minor version bump
   */
  requiresMinorBump(changes: Change[]): boolean {
    if (this.requiresMajorBump(changes)) {
      return false; // Major takes precedence
    }
    return changes.some(c => this.isFeatureChange(c));
  }

  /**
   * Check if changes require patch version bump
   */
  requiresPatchBump(changes: Change[]): boolean {
    if (this.requiresMajorBump(changes) || this.requiresMinorBump(changes)) {
      return false; // Major/minor take precedence
    }
    return changes.some(c => this.isFixChange(c));
  }

  /**
   * Check if a change type is breaking
   */
  private isBreakingChange(type: ChangeType): boolean {
    const breakingTypes: ChangeType[] = [
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
      'precondition_added',
    ];
    return breakingTypes.includes(type);
  }

  /**
   * Check if a change is a feature addition
   */
  private isFeatureChange(change: Change): boolean {
    const featureTypes: ChangeType[] = [
      'field_added',
      'behavior_added',
      'entity_added',
      'type_added',
      'error_added',
      'postcondition_added',
    ];
    return featureTypes.includes(change.type);
  }

  /**
   * Check if a change is a fix
   */
  private isFixChange(change: Change): boolean {
    // Fixes are typically:
    // - Constraint removals (relaxing constraints)
    // - Field optional changes (making required -> optional)
    // - Postcondition removals (relaxing guarantees)
    const fixTypes: ChangeType[] = [
      'constraint_removed',
      'field_required_changed', // Only if going from required -> optional
      'postcondition_removed',
    ];
    
    if (fixTypes.includes(change.type)) {
      // For field_required_changed, check direction
      if (change.type === 'field_required_changed') {
        return change.from === 'required' && change.to === 'optional';
      }
      return true;
    }
    
    return false;
  }

  /**
   * Extract version from domain identifier (e.g., "User@1.2.3" -> "1.2.3")
   */
  private extractVersion(domainId: string): string | null {
    const match = domainId.match(/@([\d.]+)/);
    return match ? match[1] : null;
  }
}

/**
 * Create versioning rules instance
 */
export function createVersioningRules(): VersioningRules {
  return new DefaultVersioningRules();
}

/**
 * Determine version bump between two domains
 */
export function determineVersionBump(
  from: { name: string; version: string },
  to: { name: string; version: string },
  fromDomain: unknown,
  toDomain: unknown
): VersionBump {
  const rules = createVersioningRules();
  const diff = diffDomains(
    fromDomain as Parameters<typeof diffDomains>[0],
    toDomain as Parameters<typeof diffDomains>[1]
  );
  
  const fromId = `${from.name}@${from.version}`;
  return rules.determineBump(fromId, diff);
}
