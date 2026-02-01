/**
 * Schema Migrator - Generate and apply migrations
 */
import * as semver from 'semver';
import type {
  ISLSchema,
  SchemaVersion,
  SchemaChange,
  MigrationPlan,
  MigrationStep,
  MigrationWarning,
  CompatibilityReport,
  DataMigrator,
  VersionHistory,
} from './types';
import { SchemaDiffer } from './differ';

export class SchemaMigrator {
  private differ: SchemaDiffer;
  private migrators: Map<string, DataMigrator> = new Map();

  constructor() {
    this.differ = new SchemaDiffer();
  }

  /**
   * Create a migration plan between two schema versions
   */
  createMigrationPlan(
    fromVersion: SchemaVersion,
    toVersion: SchemaVersion
  ): MigrationPlan {
    const changes = this.differ.diff(fromVersion.schema, toVersion.schema);
    const breakingChanges = changes.filter(c => c.breaking);
    const isBreaking = breakingChanges.length > 0;

    const steps = this.generateMigrationSteps(changes);
    const warnings = this.generateWarnings(changes);
    const suggestedVersion = this.suggestVersion(
      fromVersion.version,
      isBreaking,
      changes
    );

    return {
      fromVersion: fromVersion.version,
      toVersion: toVersion.version,
      changes,
      steps,
      isBreaking,
      suggestedVersion,
      warnings,
    };
  }

  /**
   * Check compatibility between two schemas
   */
  checkCompatibility(
    oldSchema: ISLSchema,
    newSchema: ISLSchema
  ): CompatibilityReport {
    const changes = this.differ.diff(oldSchema, newSchema);
    const breakingChanges = changes.filter(c => c.breaking);
    const nonBreakingChanges = changes.filter(c => !c.breaking);

    // Forward compatible: old consumers can handle new format
    const forwardCompatible = !breakingChanges.some(c =>
      ['FIELD_REMOVED', 'TYPE_REMOVED', 'ENUM_VALUE_REMOVED'].includes(c.type)
    );

    // Backward compatible: new consumers can handle old format
    const backwardCompatible = !breakingChanges.some(c =>
      ['FIELD_ADDED', 'CONSTRAINT_ADDED', 'PRECONDITION_ADDED'].includes(c.type) &&
      c.breaking
    );

    return {
      compatible: breakingChanges.length === 0,
      forwardCompatible,
      backwardCompatible,
      breakingChanges,
      nonBreakingChanges,
      recommendations: this.generateRecommendations(changes),
    };
  }

  /**
   * Generate migration steps from changes
   */
  private generateMigrationSteps(changes: SchemaChange[]): MigrationStep[] {
    const steps: MigrationStep[] = [];

    for (const change of changes) {
      if (change.migration) {
        steps.push(change.migration);
        continue;
      }

      // Auto-generate migration steps based on change type
      switch (change.type) {
        case 'FIELD_ADDED':
          if (!change.breaking) {
            steps.push({
              type: 'SET_DEFAULT',
              target: this.extractFieldName(change.path),
              defaultValue: (change.newValue as { defaultValue?: unknown })?.defaultValue,
            });
          }
          break;

        case 'FIELD_REMOVED':
          steps.push({
            type: 'DROP',
            target: this.extractFieldName(change.path),
          });
          break;

        case 'FIELD_RENAMED':
          steps.push({
            type: 'RENAME',
            source: change.oldValue as string,
            target: change.newValue as string,
          });
          break;

        case 'FIELD_TYPE_CHANGED':
          steps.push({
            type: 'TRANSFORM',
            source: this.extractFieldName(change.path),
            target: this.extractFieldName(change.path),
            transform: `convert_${change.oldValue}_to_${change.newValue}`,
          });
          break;

        case 'ENTITY_ADDED':
          steps.push({
            type: 'CREATE',
            target: this.extractEntityName(change.path),
          });
          break;

        case 'ENTITY_REMOVED':
          steps.push({
            type: 'DROP',
            target: this.extractEntityName(change.path),
          });
          break;
      }
    }

    return steps;
  }

  /**
   * Generate warnings for migration plan
   */
  private generateWarnings(changes: SchemaChange[]): MigrationWarning[] {
    const warnings: MigrationWarning[] = [];

    for (const change of changes) {
      if (change.breaking) {
        switch (change.type) {
          case 'FIELD_REMOVED':
            warnings.push({
              severity: 'critical',
              message: `Removing field will cause data loss`,
              change,
              suggestion: 'Consider deprecating instead of removing',
            });
            break;

          case 'FIELD_TYPE_CHANGED':
            warnings.push({
              severity: 'high',
              message: 'Type change may cause data conversion issues',
              change,
              suggestion: 'Ensure migration transform handles all edge cases',
            });
            break;

          case 'CONSTRAINT_ADDED':
            warnings.push({
              severity: 'high',
              message: 'New constraint may invalidate existing data',
              change,
              suggestion: 'Run data validation before applying migration',
            });
            break;

          case 'INVARIANT_ADDED':
            warnings.push({
              severity: 'high',
              message: 'New invariant may be violated by existing data',
              change,
              suggestion: 'Audit existing data for compliance',
            });
            break;

          case 'PRECONDITION_ADDED':
            warnings.push({
              severity: 'medium',
              message: 'New precondition may reject previously valid requests',
              change,
              suggestion: 'Communicate API change to consumers',
            });
            break;
        }
      }
    }

    return warnings;
  }

  /**
   * Generate recommendations based on changes
   */
  private generateRecommendations(changes: SchemaChange[]): string[] {
    const recommendations: string[] = [];
    const hasBreaking = changes.some(c => c.breaking);

    if (hasBreaking) {
      recommendations.push('Consider using API versioning for breaking changes');
      recommendations.push('Document migration path for existing consumers');
      recommendations.push('Plan deprecation period for removed features');
    }

    const removals = changes.filter(c => c.type.includes('REMOVED'));
    if (removals.length > 0) {
      recommendations.push('Mark removed items as deprecated before removal in future versions');
    }

    const typeChanges = changes.filter(c => c.type === 'FIELD_TYPE_CHANGED');
    if (typeChanges.length > 0) {
      recommendations.push('Provide data migration scripts for type changes');
      recommendations.push('Test migration with production data samples');
    }

    return recommendations;
  }

  /**
   * Suggest semantic version based on changes
   */
  private suggestVersion(
    currentVersion: string,
    isBreaking: boolean,
    changes: SchemaChange[]
  ): string {
    const parsed = semver.parse(currentVersion);
    if (!parsed) return '1.0.0';

    if (isBreaking) {
      // Major version bump for breaking changes
      return `${parsed.major + 1}.0.0`;
    }

    const hasNewFeatures = changes.some(c =>
      ['ENTITY_ADDED', 'BEHAVIOR_ADDED', 'FIELD_ADDED'].includes(c.type)
    );

    if (hasNewFeatures) {
      // Minor version bump for new features
      return `${parsed.major}.${parsed.minor + 1}.0`;
    }

    // Patch version for fixes and non-breaking changes
    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }

  /**
   * Register a data migrator for a specific version transition
   */
  registerMigrator(fromVersion: string, toVersion: string, migrator: DataMigrator): void {
    const key = `${fromVersion}->${toVersion}`;
    this.migrators.set(key, migrator);
  }

  /**
   * Migrate data from one version to another
   */
  async migrateData<T>(
    data: T,
    fromVersion: string,
    toVersion: string
  ): Promise<T> {
    const path = this.findMigrationPath(fromVersion, toVersion);
    if (!path) {
      throw new Error(`No migration path from ${fromVersion} to ${toVersion}`);
    }

    let current = data;
    for (const step of path) {
      const migrator = this.migrators.get(step);
      if (!migrator) {
        throw new Error(`Missing migrator for ${step}`);
      }

      // Validate before migration
      if (migrator.validate && !migrator.validate(current)) {
        throw new Error(`Data validation failed before migration ${step}`);
      }

      current = migrator.up(current) as T;
    }

    return current;
  }

  /**
   * Find migration path between versions
   */
  private findMigrationPath(from: string, to: string): string[] | null {
    // Simple BFS to find path
    const visited = new Set<string>();
    const queue: { version: string; path: string[] }[] = [{ version: from, path: [] }];

    while (queue.length > 0) {
      const { version, path } = queue.shift()!;

      if (version === to) {
        return path;
      }

      if (visited.has(version)) continue;
      visited.add(version);

      // Find all migrations from this version
      for (const key of this.migrators.keys()) {
        const [fromVer, toVer] = key.split('->');
        if (fromVer === version && !visited.has(toVer)) {
          queue.push({ version: toVer, path: [...path, key] });
        }
      }
    }

    return null;
  }

  // Helper methods
  private extractFieldName(path: string): string {
    const parts = path.split('.');
    return parts[parts.length - 1];
  }

  private extractEntityName(path: string): string {
    const match = path.match(/entities\.(\w+)/);
    return match ? match[1] : '';
  }
}

/**
 * Create version history from schema versions
 */
export function createVersionHistory(
  versions: SchemaVersion[],
  currentVersion: string,
  deprecatedVersions: string[] = []
): VersionHistory {
  const sortedVersions = versions.sort((a, b) =>
    semver.compare(a.version, b.version)
  );

  // Determine supported versions (current and previous minor versions)
  const current = semver.parse(currentVersion);
  const supportedVersions = sortedVersions
    .filter(v => {
      const parsed = semver.parse(v.version);
      if (!parsed || !current) return false;
      return (
        parsed.major === current.major &&
        (parsed.minor === current.minor || parsed.minor === current.minor - 1)
      );
    })
    .map(v => v.version);

  return {
    versions: sortedVersions,
    currentVersion,
    deprecatedVersions,
    supportedVersions,
  };
}
