/**
 * ISL Domain Differ
 * 
 * Compares two ISL domain versions and generates a diff of changes.
 */

import type {
  DomainDeclaration,
  EntityDeclaration,
  FieldDeclaration,
  EnumDeclaration,
  TypeDeclaration,
} from '@intentos/isl-core';

import type {
  DomainDiff,
  EntityDiff,
  FieldChange,
  EnumDiff,
  TypeAliasDiff,
  DiffStats,
  SerializedValue,
} from './types.js';

import {
  serializeType,
  serializeConstraints,
  serializeAnnotations,
  serializeExpression,
  arraysEqual,
  getAdded,
  getRemoved,
} from './utils.js';

/**
 * Diff two ISL domain versions
 */
export function diffDomains(
  oldDomain: DomainDeclaration,
  newDomain: DomainDeclaration
): DomainDiff {
  const entityDiffs = diffEntities(oldDomain.entities, newDomain.entities);
  const enumDiffs = diffEnums(oldDomain.enums, newDomain.enums);
  const typeDiffs = diffTypes(oldDomain.types, newDomain.types);
  
  const stats = calculateStats(entityDiffs, enumDiffs, typeDiffs);
  const breaking = hasBreakingChanges(entityDiffs, enumDiffs, typeDiffs);
  
  return {
    domain: newDomain.name.name,
    oldVersion: oldDomain.version?.value,
    newVersion: newDomain.version?.value,
    entities: entityDiffs,
    enums: enumDiffs,
    types: typeDiffs,
    breaking,
    stats,
  };
}

/**
 * Diff entity declarations
 */
function diffEntities(
  oldEntities: EntityDeclaration[],
  newEntities: EntityDeclaration[]
): EntityDiff[] {
  const diffs: EntityDiff[] = [];
  
  const oldEntityMap = new Map(oldEntities.map(e => [e.name.name, e]));
  const newEntityMap = new Map(newEntities.map(e => [e.name.name, e]));
  
  // Find added entities
  for (const [name, entity] of newEntityMap) {
    if (!oldEntityMap.has(name)) {
      diffs.push({
        type: 'added',
        entity: name,
        newDeclaration: entity,
        changes: entity.fields.map(f => fieldToAddedChange(f)),
      });
    }
  }
  
  // Find removed entities
  for (const [name, entity] of oldEntityMap) {
    if (!newEntityMap.has(name)) {
      diffs.push({
        type: 'removed',
        entity: name,
        oldDeclaration: entity,
      });
    }
  }
  
  // Find modified entities
  for (const [name, newEntity] of newEntityMap) {
    const oldEntity = oldEntityMap.get(name);
    if (oldEntity) {
      const fieldChanges = diffFields(oldEntity.fields, newEntity.fields);
      if (fieldChanges.length > 0) {
        diffs.push({
          type: 'modified',
          entity: name,
          oldDeclaration: oldEntity,
          newDeclaration: newEntity,
          changes: fieldChanges,
        });
      }
    }
  }
  
  return diffs;
}

/**
 * Convert field declaration to added field change
 */
function fieldToAddedChange(field: FieldDeclaration): FieldChange {
  return {
    type: 'added',
    field: field.name.name,
    newType: serializeType(field.type),
    nullable: field.optional,
    defaultValue: field.defaultValue 
      ? serializeExpression(field.defaultValue) 
      : undefined,
    newConstraints: serializeConstraints(field.constraints),
    newAnnotations: serializeAnnotations(field.annotations),
  };
}

/**
 * Diff field declarations
 */
function diffFields(
  oldFields: FieldDeclaration[],
  newFields: FieldDeclaration[]
): FieldChange[] {
  const changes: FieldChange[] = [];
  
  const oldFieldMap = new Map(oldFields.map(f => [f.name.name, f]));
  const newFieldMap = new Map(newFields.map(f => [f.name.name, f]));
  
  // Added fields
  for (const [name, field] of newFieldMap) {
    if (!oldFieldMap.has(name)) {
      changes.push(fieldToAddedChange(field));
    }
  }
  
  // Removed fields
  for (const [name, field] of oldFieldMap) {
    if (!newFieldMap.has(name)) {
      changes.push({
        type: 'removed',
        field: name,
        oldType: serializeType(field.type),
        oldNullable: field.optional,
        oldDefaultValue: field.defaultValue 
          ? serializeExpression(field.defaultValue) 
          : undefined,
        oldConstraints: serializeConstraints(field.constraints),
        oldAnnotations: serializeAnnotations(field.annotations),
      });
    }
  }
  
  // Modified fields
  for (const [name, newField] of newFieldMap) {
    const oldField = oldFieldMap.get(name);
    if (oldField) {
      const fieldChange = compareFields(name, oldField, newField);
      if (fieldChange) {
        changes.push(fieldChange);
      }
    }
  }
  
  return changes;
}

/**
 * Compare two field declarations
 */
function compareFields(
  name: string,
  oldField: FieldDeclaration,
  newField: FieldDeclaration
): FieldChange | null {
  const oldType = serializeType(oldField.type);
  const newType = serializeType(newField.type);
  const oldConstraints = serializeConstraints(oldField.constraints);
  const newConstraints = serializeConstraints(newField.constraints);
  const oldAnnotations = serializeAnnotations(oldField.annotations);
  const newAnnotations = serializeAnnotations(newField.annotations);
  
  const typeChanged = oldType !== newType;
  const nullableChanged = oldField.optional !== newField.optional;
  const constraintsChanged = !arraysEqual(oldConstraints, newConstraints);
  const annotationsChanged = !arraysEqual(oldAnnotations, newAnnotations);
  const defaultChanged = !defaultValuesEqual(
    oldField.defaultValue ? serializeExpression(oldField.defaultValue) : undefined,
    newField.defaultValue ? serializeExpression(newField.defaultValue) : undefined
  );
  
  if (!typeChanged && !nullableChanged && !constraintsChanged && !annotationsChanged && !defaultChanged) {
    return null;
  }
  
  return {
    type: 'modified',
    field: name,
    oldType: typeChanged ? oldType : undefined,
    newType: typeChanged ? newType : undefined,
    oldNullable: nullableChanged ? oldField.optional : undefined,
    nullable: nullableChanged ? newField.optional : undefined,
    oldDefaultValue: defaultChanged && oldField.defaultValue 
      ? serializeExpression(oldField.defaultValue) 
      : undefined,
    defaultValue: defaultChanged && newField.defaultValue 
      ? serializeExpression(newField.defaultValue) 
      : undefined,
    constraintsChanged,
    oldConstraints: constraintsChanged ? oldConstraints : undefined,
    newConstraints: constraintsChanged ? newConstraints : undefined,
    annotationsChanged,
    oldAnnotations: annotationsChanged ? oldAnnotations : undefined,
    newAnnotations: annotationsChanged ? newAnnotations : undefined,
  };
}

/**
 * Compare default values for equality
 */
function defaultValuesEqual(
  a: SerializedValue | undefined,
  b: SerializedValue | undefined
): boolean {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;
  if (a.kind !== b.kind) return false;
  
  switch (a.kind) {
    case 'string':
    case 'expression':
      return b.kind === a.kind && a.value === b.value;
    case 'number':
      return b.kind === 'number' && a.value === b.value;
    case 'boolean':
      return b.kind === 'boolean' && a.value === b.value;
    case 'null':
      return b.kind === 'null';
  }
}

/**
 * Diff enum declarations
 */
function diffEnums(
  oldEnums: EnumDeclaration[],
  newEnums: EnumDeclaration[]
): EnumDiff[] {
  const diffs: EnumDiff[] = [];
  
  const oldEnumMap = new Map(oldEnums.map(e => [e.name.name, e]));
  const newEnumMap = new Map(newEnums.map(e => [e.name.name, e]));
  
  // Added enums
  for (const [name, _enum] of newEnumMap) {
    if (!oldEnumMap.has(name)) {
      diffs.push({
        type: 'added',
        enum: name,
        addedVariants: _enum.variants.map(v => v.name),
      });
    }
  }
  
  // Removed enums
  for (const [name, _enum] of oldEnumMap) {
    if (!newEnumMap.has(name)) {
      diffs.push({
        type: 'removed',
        enum: name,
        removedVariants: _enum.variants.map(v => v.name),
      });
    }
  }
  
  // Modified enums
  for (const [name, newEnum] of newEnumMap) {
    const oldEnum = oldEnumMap.get(name);
    if (oldEnum) {
      const oldVariants = oldEnum.variants.map(v => v.name);
      const newVariants = newEnum.variants.map(v => v.name);
      
      const addedVariants = getAdded(oldVariants, newVariants);
      const removedVariants = getRemoved(oldVariants, newVariants);
      
      if (addedVariants.length > 0 || removedVariants.length > 0) {
        diffs.push({
          type: 'modified',
          enum: name,
          addedVariants: addedVariants.length > 0 ? addedVariants : undefined,
          removedVariants: removedVariants.length > 0 ? removedVariants : undefined,
        });
      }
    }
  }
  
  return diffs;
}

/**
 * Diff type alias declarations
 */
function diffTypes(
  oldTypes: TypeDeclaration[],
  newTypes: TypeDeclaration[]
): TypeAliasDiff[] {
  const diffs: TypeAliasDiff[] = [];
  
  const oldTypeMap = new Map(oldTypes.map(t => [t.name.name, t]));
  const newTypeMap = new Map(newTypes.map(t => [t.name.name, t]));
  
  // Added types
  for (const [name, type] of newTypeMap) {
    if (!oldTypeMap.has(name)) {
      diffs.push({
        type: 'added',
        typeName: name,
        newBaseType: serializeType(type.baseType),
      });
    }
  }
  
  // Removed types
  for (const [name, type] of oldTypeMap) {
    if (!newTypeMap.has(name)) {
      diffs.push({
        type: 'removed',
        typeName: name,
        oldBaseType: serializeType(type.baseType),
      });
    }
  }
  
  // Modified types
  for (const [name, newType] of newTypeMap) {
    const oldType = oldTypeMap.get(name);
    if (oldType) {
      const oldBase = serializeType(oldType.baseType);
      const newBase = serializeType(newType.baseType);
      
      if (oldBase !== newBase) {
        diffs.push({
          type: 'modified',
          typeName: name,
          oldBaseType: oldBase,
          newBaseType: newBase,
        });
      }
    }
  }
  
  return diffs;
}

/**
 * Calculate diff statistics
 */
function calculateStats(
  entityDiffs: EntityDiff[],
  enumDiffs: EnumDiff[],
  typeDiffs: TypeAliasDiff[]
): DiffStats {
  let fieldsAdded = 0;
  let fieldsRemoved = 0;
  let fieldsModified = 0;
  
  for (const diff of entityDiffs) {
    if (diff.changes) {
      for (const change of diff.changes) {
        switch (change.type) {
          case 'added':
            fieldsAdded++;
            break;
          case 'removed':
            fieldsRemoved++;
            break;
          case 'modified':
            fieldsModified++;
            break;
        }
      }
    }
  }
  
  return {
    entitiesAdded: entityDiffs.filter(d => d.type === 'added').length,
    entitiesRemoved: entityDiffs.filter(d => d.type === 'removed').length,
    entitiesModified: entityDiffs.filter(d => d.type === 'modified').length,
    fieldsAdded,
    fieldsRemoved,
    fieldsModified,
    enumsAdded: enumDiffs.filter(d => d.type === 'added').length,
    enumsRemoved: enumDiffs.filter(d => d.type === 'removed').length,
    enumsModified: enumDiffs.filter(d => d.type === 'modified').length,
  };
}

/**
 * Check if diff contains breaking changes
 */
function hasBreakingChanges(
  entityDiffs: EntityDiff[],
  enumDiffs: EnumDiff[],
  typeDiffs: TypeAliasDiff[]
): boolean {
  // Removed entities are breaking
  if (entityDiffs.some(d => d.type === 'removed')) {
    return true;
  }
  
  // Removed fields are breaking
  for (const diff of entityDiffs) {
    if (diff.changes?.some(c => c.type === 'removed')) {
      return true;
    }
    
    // Making fields non-nullable is breaking
    if (diff.changes?.some(c => 
      c.type === 'modified' && 
      c.oldNullable === true && 
      c.nullable === false
    )) {
      return true;
    }
    
    // Type changes can be breaking
    if (diff.changes?.some(c => 
      c.type === 'modified' && 
      c.oldType !== undefined && 
      c.newType !== undefined &&
      c.oldType !== c.newType
    )) {
      return true;
    }
  }
  
  // Removed enum variants are breaking
  if (enumDiffs.some(d => d.removedVariants && d.removedVariants.length > 0)) {
    return true;
  }
  
  // Removed types are breaking
  if (typeDiffs.some(d => d.type === 'removed')) {
    return true;
  }
  
  return false;
}

/**
 * Create empty diff (no changes)
 */
export function emptyDiff(domain: DomainDeclaration): DomainDiff {
  return {
    domain: domain.name.name,
    oldVersion: domain.version?.value,
    newVersion: domain.version?.value,
    entities: [],
    enums: [],
    types: [],
    breaking: false,
    stats: {
      entitiesAdded: 0,
      entitiesRemoved: 0,
      entitiesModified: 0,
      fieldsAdded: 0,
      fieldsRemoved: 0,
      fieldsModified: 0,
      enumsAdded: 0,
      enumsRemoved: 0,
      enumsModified: 0,
    },
  };
}

/**
 * Check if diff is empty (no changes)
 */
export function isDiffEmpty(diff: DomainDiff): boolean {
  return (
    diff.entities.length === 0 &&
    diff.enums.length === 0 &&
    diff.types.length === 0
  );
}

/**
 * Get summary of changes
 */
export function getDiffSummary(diff: DomainDiff): string {
  const parts: string[] = [];
  const { stats } = diff;
  
  if (stats.entitiesAdded > 0) {
    parts.push(`${stats.entitiesAdded} entities added`);
  }
  if (stats.entitiesRemoved > 0) {
    parts.push(`${stats.entitiesRemoved} entities removed`);
  }
  if (stats.entitiesModified > 0) {
    parts.push(`${stats.entitiesModified} entities modified`);
  }
  if (stats.enumsAdded > 0) {
    parts.push(`${stats.enumsAdded} enums added`);
  }
  if (stats.enumsRemoved > 0) {
    parts.push(`${stats.enumsRemoved} enums removed`);
  }
  if (stats.enumsModified > 0) {
    parts.push(`${stats.enumsModified} enums modified`);
  }
  
  if (parts.length === 0) {
    return 'No changes';
  }
  
  return parts.join(', ');
}
