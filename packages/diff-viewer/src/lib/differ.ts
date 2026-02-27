// ============================================================================
// ISL-Aware Differ
// Computes both text and semantic diffs for ISL specifications
// ============================================================================

import * as Diff from 'diff';
import type {
  FileDiff,
  HunkDiff,
  LineDiff,
  ChangeType,
  SemanticChange,
  SemanticChangeType,
  BreakingChangeLevel,
  DiffSummary,
} from '../types';

/**
 * Compute text-based diff between two ISL files
 */
export function computeTextDiff(oldContent: string, newContent: string): FileDiff {
  const changes = Diff.diffLines(oldContent, newContent);
  const hunks: HunkDiff[] = [];
  let currentHunk: HunkDiff | null = null;
  let oldLineNumber = 1;
  let newLineNumber = 1;

  for (const change of changes) {
    const lines = change.value.split('\n').filter((line, index, arr) => {
      // Keep all lines except trailing empty line from split
      return index < arr.length - 1 || line !== '';
    });

    if (change.added || change.removed) {
      // Start new hunk if needed
      if (!currentHunk) {
        currentHunk = {
          oldStart: oldLineNumber,
          oldLines: 0,
          newStart: newLineNumber,
          newLines: 0,
          lines: [],
        };
      }

      for (const line of lines) {
        const lineDiff: LineDiff = {
          lineNumber: change.added ? newLineNumber : oldLineNumber,
          type: change.added ? 'added' : 'removed',
          content: line,
          oldLineNumber: change.removed ? oldLineNumber : undefined,
          newLineNumber: change.added ? newLineNumber : undefined,
        };
        currentHunk.lines.push(lineDiff);

        if (change.added) {
          currentHunk.newLines++;
          newLineNumber++;
        } else {
          currentHunk.oldLines++;
          oldLineNumber++;
        }
      }
    } else {
      // Unchanged lines
      if (currentHunk && currentHunk.lines.length > 0) {
        // Add context lines (up to 3)
        const contextLines = Math.min(3, lines.length);
        for (let i = 0; i < contextLines; i++) {
          currentHunk.lines.push({
            lineNumber: oldLineNumber + i,
            type: 'unchanged',
            content: lines[i],
            oldLineNumber: oldLineNumber + i,
            newLineNumber: newLineNumber + i,
          });
        }

        // Close hunk if we have more unchanged lines
        if (lines.length > 3) {
          hunks.push(currentHunk);
          currentHunk = null;
        }
      }

      oldLineNumber += lines.length;
      newLineNumber += lines.length;
    }
  }

  // Push final hunk
  if (currentHunk && currentHunk.lines.length > 0) {
    hunks.push(currentHunk);
  }

  // Calculate stats
  let additions = 0;
  let deletions = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'added') additions++;
      if (line.type === 'removed') deletions++;
    }
  }

  return {
    oldContent,
    newContent,
    hunks,
    additions,
    deletions,
  };
}

/**
 * Parse ISL content into a simple structure for comparison
 * This is a simplified parser for diffing purposes
 */
interface ParsedISL {
  domain: {
    name: string;
    version: string;
  };
  types: Map<string, ParsedType>;
  entities: Map<string, ParsedEntity>;
  behaviors: Map<string, ParsedBehavior>;
}

interface ParsedType {
  name: string;
  definition: string;
  constraints: string[];
  line: number;
}

interface ParsedEntity {
  name: string;
  fields: Map<string, ParsedField>;
  invariants: string[];
  line: number;
}

interface ParsedField {
  name: string;
  type: string;
  optional: boolean;
  annotations: string[];
  line: number;
}

interface ParsedBehavior {
  name: string;
  inputFields: Map<string, ParsedField>;
  outputType: string;
  errors: string[];
  preconditions: string[];
  postconditions: string[];
  temporal: string[];
  security: string[];
  line: number;
}

/**
 * Simple ISL parser for diffing (not full parser)
 */
function parseISLForDiff(content: string): ParsedISL {
  const result: ParsedISL = {
    domain: { name: '', version: '' },
    types: new Map(),
    entities: new Map(),
    behaviors: new Map(),
  };

  const lines = content.split('\n');
  let currentContext: 'root' | 'entity' | 'behavior' | 'type' = 'root';
  let currentEntity: ParsedEntity | null = null;
  let currentBehavior: ParsedBehavior | null = null;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Track brace depth
    braceDepth += (line.match(/{/g) || []).length;
    braceDepth -= (line.match(/}/g) || []).length;

    // Domain header
    const domainMatch = line.match(/^domain\s+(\w+)\s*\{/);
    if (domainMatch) {
      result.domain.name = domainMatch[1];
      continue;
    }

    // Version
    const versionMatch = line.match(/version:\s*"([^"]+)"/);
    if (versionMatch) {
      result.domain.version = versionMatch[1];
      continue;
    }

    // Type declaration
    const typeMatch = line.match(/^type\s+(\w+)\s*=/);
    if (typeMatch) {
      result.types.set(typeMatch[1], {
        name: typeMatch[1],
        definition: line,
        constraints: [],
        line: lineNum,
      });
      continue;
    }

    // Entity declaration
    const entityMatch = line.match(/^entity\s+(\w+)\s*\{/);
    if (entityMatch) {
      currentContext = 'entity';
      currentEntity = {
        name: entityMatch[1],
        fields: new Map(),
        invariants: [],
        line: lineNum,
      };
      continue;
    }

    // Behavior declaration
    const behaviorMatch = line.match(/^behavior\s+(\w+)\s*\{/);
    if (behaviorMatch) {
      currentContext = 'behavior';
      currentBehavior = {
        name: behaviorMatch[1],
        inputFields: new Map(),
        outputType: '',
        errors: [],
        preconditions: [],
        postconditions: [],
        temporal: [],
        security: [],
        line: lineNum,
      };
      continue;
    }

    // Field in entity
    if (currentContext === 'entity' && currentEntity) {
      const fieldMatch = line.match(/^(\w+)(\?)?:\s*(\S+)/);
      if (fieldMatch) {
        const annotations: string[] = [];
        const annotationMatches = line.matchAll(/\[([^\]]+)\]/g);
        for (const match of annotationMatches) {
          annotations.push(...match[1].split(',').map((a) => a.trim()));
        }

        currentEntity.fields.set(fieldMatch[1], {
          name: fieldMatch[1],
          type: fieldMatch[3],
          optional: fieldMatch[2] === '?',
          annotations,
          line: lineNum,
        });
      }

      // End of entity
      if (line === '}' && braceDepth <= 1) {
        result.entities.set(currentEntity.name, currentEntity);
        currentEntity = null;
        currentContext = 'root';
      }
    }

    // End of behavior
    if (currentContext === 'behavior' && currentBehavior) {
      if (line === '}' && braceDepth <= 1) {
        result.behaviors.set(currentBehavior.name, currentBehavior);
        currentBehavior = null;
        currentContext = 'root';
      }
    }
  }

  return result;
}

/**
 * Compute semantic diff between two ISL files
 */
export function computeSemanticDiff(
  oldContent: string,
  newContent: string
): SemanticChange[] {
  const oldParsed = parseISLForDiff(oldContent);
  const newParsed = parseISLForDiff(newContent);
  const changes: SemanticChange[] = [];
  let changeId = 0;

  const makeId = () => `change-${++changeId}`;

  // Compare domain version
  if (oldParsed.domain.version !== newParsed.domain.version) {
    changes.push({
      id: makeId(),
      type: 'domain_version_changed',
      path: ['domain', 'version'],
      oldValue: oldParsed.domain.version,
      newValue: newParsed.domain.version,
      description: `Version changed from ${oldParsed.domain.version} to ${newParsed.domain.version}`,
      breakingLevel: 'safe',
    });
  }

  // Compare types
  for (const [name, newType] of newParsed.types) {
    const oldType = oldParsed.types.get(name);
    if (!oldType) {
      changes.push({
        id: makeId(),
        type: 'type_added',
        path: ['types', name],
        newValue: newType.definition,
        description: `Type '${name}' was added`,
        breakingLevel: 'safe',
        location: { newLine: newType.line },
      });
    } else if (oldType.definition !== newType.definition) {
      changes.push({
        id: makeId(),
        type: 'type_constraint_modified',
        path: ['types', name],
        oldValue: oldType.definition,
        newValue: newType.definition,
        description: `Type '${name}' definition changed`,
        breakingLevel: 'warning',
        location: { oldLine: oldType.line, newLine: newType.line },
      });
    }
  }

  for (const [name, oldType] of oldParsed.types) {
    if (!newParsed.types.has(name)) {
      changes.push({
        id: makeId(),
        type: 'type_removed',
        path: ['types', name],
        oldValue: oldType.definition,
        description: `Type '${name}' was removed`,
        breakingLevel: 'breaking',
        location: { oldLine: oldType.line },
      });
    }
  }

  // Compare entities
  for (const [name, newEntity] of newParsed.entities) {
    const oldEntity = oldParsed.entities.get(name);
    if (!oldEntity) {
      changes.push({
        id: makeId(),
        type: 'entity_added',
        path: ['entities', name],
        description: `Entity '${name}' was added`,
        breakingLevel: 'safe',
        location: { newLine: newEntity.line },
      });
    } else {
      // Compare fields
      changes.push(...compareEntityFields(oldEntity, newEntity, makeId));
    }
  }

  for (const [name, oldEntity] of oldParsed.entities) {
    if (!newParsed.entities.has(name)) {
      changes.push({
        id: makeId(),
        type: 'entity_removed',
        path: ['entities', name],
        description: `Entity '${name}' was removed`,
        breakingLevel: 'breaking',
        location: { oldLine: oldEntity.line },
      });
    }
  }

  // Compare behaviors
  for (const [name, newBehavior] of newParsed.behaviors) {
    const oldBehavior = oldParsed.behaviors.get(name);
    if (!oldBehavior) {
      changes.push({
        id: makeId(),
        type: 'behavior_added',
        path: ['behaviors', name],
        description: `Behavior '${name}' was added`,
        breakingLevel: 'safe',
        location: { newLine: newBehavior.line },
      });
    }
  }

  for (const [name, oldBehavior] of oldParsed.behaviors) {
    if (!newParsed.behaviors.has(name)) {
      changes.push({
        id: makeId(),
        type: 'behavior_removed',
        path: ['behaviors', name],
        description: `Behavior '${name}' was removed`,
        breakingLevel: 'breaking',
        location: { oldLine: oldBehavior.line },
      });
    }
  }

  return changes;
}

/**
 * Compare entity fields
 */
function compareEntityFields(
  oldEntity: ParsedEntity,
  newEntity: ParsedEntity,
  makeId: () => string
): SemanticChange[] {
  const changes: SemanticChange[] = [];
  const entityName = newEntity.name;

  // Check for added fields
  for (const [name, newField] of newEntity.fields) {
    const oldField = oldEntity.fields.get(name);
    if (!oldField) {
      const breakingLevel: BreakingChangeLevel = newField.optional ? 'safe' : 'breaking';
      changes.push({
        id: makeId(),
        type: 'field_added',
        path: ['entities', entityName, 'fields', name],
        newValue: `${newField.type}${newField.optional ? '?' : ''}`,
        description: `Field '${name}' was added to '${entityName}'${!newField.optional ? ' (required, breaking)' : ''}`,
        breakingLevel,
        location: { newLine: newField.line },
      });
    } else {
      // Check type change
      if (oldField.type !== newField.type) {
        changes.push({
          id: makeId(),
          type: 'field_type_changed',
          path: ['entities', entityName, 'fields', name, 'type'],
          oldValue: oldField.type,
          newValue: newField.type,
          description: `Field '${name}' type changed from '${oldField.type}' to '${newField.type}'`,
          breakingLevel: 'breaking',
          location: { oldLine: oldField.line, newLine: newField.line },
        });
      }

      // Check optional change
      if (oldField.optional && !newField.optional) {
        changes.push({
          id: makeId(),
          type: 'field_made_required',
          path: ['entities', entityName, 'fields', name, 'optional'],
          oldValue: true,
          newValue: false,
          description: `Field '${name}' in '${entityName}' is now required`,
          breakingLevel: 'breaking',
          location: { oldLine: oldField.line, newLine: newField.line },
        });
      } else if (!oldField.optional && newField.optional) {
        changes.push({
          id: makeId(),
          type: 'field_made_optional',
          path: ['entities', entityName, 'fields', name, 'optional'],
          oldValue: false,
          newValue: true,
          description: `Field '${name}' in '${entityName}' is now optional`,
          breakingLevel: 'safe',
          location: { oldLine: oldField.line, newLine: newField.line },
        });
      }

      // Check annotation changes
      const addedAnnotations = newField.annotations.filter(
        (a) => !oldField.annotations.includes(a)
      );
      const removedAnnotations = oldField.annotations.filter(
        (a) => !newField.annotations.includes(a)
      );

      for (const annotation of addedAnnotations) {
        changes.push({
          id: makeId(),
          type: 'field_annotation_added',
          path: ['entities', entityName, 'fields', name, 'annotations', annotation],
          newValue: annotation,
          description: `Annotation '${annotation}' added to '${entityName}.${name}'`,
          breakingLevel: 'safe',
          location: { newLine: newField.line },
        });
      }

      for (const annotation of removedAnnotations) {
        changes.push({
          id: makeId(),
          type: 'field_annotation_removed',
          path: ['entities', entityName, 'fields', name, 'annotations', annotation],
          oldValue: annotation,
          description: `Annotation '${annotation}' removed from '${entityName}.${name}'`,
          breakingLevel: 'warning',
          location: { oldLine: oldField.line },
        });
      }
    }
  }

  // Check for removed fields
  for (const [name, oldField] of oldEntity.fields) {
    if (!newEntity.fields.has(name)) {
      changes.push({
        id: makeId(),
        type: 'field_removed',
        path: ['entities', entityName, 'fields', name],
        oldValue: `${oldField.type}${oldField.optional ? '?' : ''}`,
        description: `Field '${name}' was removed from '${entityName}'`,
        breakingLevel: 'breaking',
        location: { oldLine: oldField.line },
      });
    }
  }

  return changes;
}

/**
 * Generate complete diff summary
 */
export function generateDiffSummary(
  oldContent: string,
  newContent: string
): DiffSummary {
  const textDiff = computeTextDiff(oldContent, newContent);
  const semanticChanges = computeSemanticDiff(oldContent, newContent);
  const migrationHints = generateMigrationHints(semanticChanges);

  const breakingChanges = semanticChanges.filter(
    (c) => c.breakingLevel === 'breaking'
  ).length;
  const warnings = semanticChanges.filter(
    (c) => c.breakingLevel === 'warning'
  ).length;

  return {
    totalChanges: semanticChanges.length,
    additions: textDiff.additions,
    deletions: textDiff.deletions,
    modifications: semanticChanges.filter(
      (c) => c.type.includes('modified') || c.type.includes('changed')
    ).length,
    breakingChanges,
    warnings,
    semanticChanges,
    migrationHints,
  };
}

/**
 * Generate migration hints from semantic changes
 */
function generateMigrationHints(changes: SemanticChange[]): import('../types').MigrationHint[] {
  const hints: import('../types').MigrationHint[] = [];
  let hintId = 0;

  const breakingChanges = changes.filter((c) => c.breakingLevel === 'breaking');

  // Group by type
  const fieldRemovals = breakingChanges.filter((c) => c.type === 'field_removed');
  const fieldTypeChanges = breakingChanges.filter((c) => c.type === 'field_type_changed');
  const entityRemovals = breakingChanges.filter((c) => c.type === 'entity_removed');
  const behaviorRemovals = breakingChanges.filter((c) => c.type === 'behavior_removed');
  const requiredFields = breakingChanges.filter((c) => c.type === 'field_made_required');
  const newRequiredFields = breakingChanges.filter(
    (c) => c.type === 'field_added' && c.breakingLevel === 'breaking'
  );

  // Field removal hints
  if (fieldRemovals.length > 0) {
    hints.push({
      id: `hint-${++hintId}`,
      title: 'Handle Removed Fields',
      description: `${fieldRemovals.length} field(s) have been removed. Update code that references these fields.`,
      severity: 'critical',
      changeIds: fieldRemovals.map((c) => c.id),
      steps: [
        {
          order: 1,
          title: 'Update data models',
          description: 'Remove references to deleted fields in your data models and DTOs.',
          required: true,
        },
        {
          order: 2,
          title: 'Update database schema',
          description: 'Create a migration to remove the columns (after data migration if needed).',
          required: true,
        },
        {
          order: 3,
          title: 'Update API consumers',
          description: 'Notify API consumers that these fields are no longer available.',
          required: false,
        },
      ],
    });
  }

  // Field type change hints
  if (fieldTypeChanges.length > 0) {
    hints.push({
      id: `hint-${++hintId}`,
      title: 'Migrate Field Type Changes',
      description: `${fieldTypeChanges.length} field(s) have changed types. Data migration required.`,
      severity: 'critical',
      changeIds: fieldTypeChanges.map((c) => c.id),
      steps: [
        {
          order: 1,
          title: 'Create migration script',
          description: 'Write a migration to convert existing data to the new type.',
          required: true,
        },
        {
          order: 2,
          title: 'Update validation',
          description: 'Ensure validation rules match the new type constraints.',
          required: true,
        },
        {
          order: 3,
          title: 'Update serialization',
          description: 'Update JSON/API serialization to handle the new type.',
          required: true,
        },
      ],
      codeExample: {
        before: fieldTypeChanges[0]?.oldValue as string || '',
        after: fieldTypeChanges[0]?.newValue as string || '',
        language: 'typescript',
      },
    });
  }

  // Entity removal hints
  if (entityRemovals.length > 0) {
    hints.push({
      id: `hint-${++hintId}`,
      title: 'Handle Removed Entities',
      description: `${entityRemovals.length} entity/entities have been removed. Major refactoring required.`,
      severity: 'critical',
      changeIds: entityRemovals.map((c) => c.id),
      steps: [
        {
          order: 1,
          title: 'Archive data',
          description: 'Backup or archive any data from removed entities before deletion.',
          required: true,
        },
        {
          order: 2,
          title: 'Remove references',
          description: 'Remove all code references to the deleted entities.',
          required: true,
        },
        {
          order: 3,
          title: 'Drop database tables',
          description: 'Create migration to drop the associated tables.',
          required: true,
        },
      ],
    });
  }

  // Required field hints
  if (requiredFields.length > 0 || newRequiredFields.length > 0) {
    const allRequired = [...requiredFields, ...newRequiredFields];
    hints.push({
      id: `hint-${++hintId}`,
      title: 'Populate Required Fields',
      description: `${allRequired.length} field(s) are now required. Existing records need default values.`,
      severity: 'high',
      changeIds: allRequired.map((c) => c.id),
      steps: [
        {
          order: 1,
          title: 'Set default values',
          description: 'Determine appropriate default values for existing records.',
          required: true,
        },
        {
          order: 2,
          title: 'Run backfill migration',
          description: 'Create and run a migration to populate the new required fields.',
          required: true,
        },
        {
          order: 3,
          title: 'Add NOT NULL constraint',
          description: 'After backfill, add NOT NULL constraint to the database column.',
          required: true,
        },
      ],
    });
  }

  return hints;
}
