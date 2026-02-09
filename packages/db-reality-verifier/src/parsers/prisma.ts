/**
 * Prisma Schema Parser
 */

import type { DatabaseSchema, Table, Column, Relation } from '../types.js';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Parse Prisma schema file
 */
export function parsePrismaSchema(filePath: string): DatabaseSchema {
  if (!existsSync(filePath)) {
    throw new Error(`Schema file not found: ${filePath}`);
  }
  const content = readFileSync(filePath, 'utf-8');
  const tables: Table[] = [];
  const relations: Relation[] = [];

  // Extract models
  const modelPattern = /model\s+(\w+)\s*\{([^}]+)\}/gs;
  let modelMatch: RegExpExecArray | null;

  while ((modelMatch = modelPattern.exec(content)) !== null) {
    const modelName = modelMatch[1];
    const modelBody = modelMatch[2] || '';
    if (!modelName) continue;

    const columns = extractPrismaColumns(modelBody);
    const modelRelations = extractPrismaRelations(modelName, modelBody);

    tables.push({
      name: modelName,
      columns,
    });

    relations.push(...modelRelations);
  }

  return {
    tables,
    relations,
    source: 'prisma',
    sourceFile: filePath,
  };
}

/**
 * Extract columns from Prisma model body
 */
function extractPrismaColumns(modelBody: string): Column[] {
  const columns: Column[] = [];
  const lines = modelBody.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) {
      continue;
    }

    // Pattern: fieldName Type? @attributes
    // Examples:
    //   id String @id @default(cuid())
    //   email String? @unique
    //   userId String @relation(fields: [userId], references: [id])
    const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\?)?(\[\])?\s*(.*)?$/);
    if (!fieldMatch) continue;

    const [, name, type, optional, array, attributes = ''] = fieldMatch;
    if (!name || !type) continue;

    // Skip relation fields (they have @relation attribute without fields)
    if (attributes.includes('@relation') && !attributes.includes('fields:')) {
      continue;
    }

    const column: Column = {
      name,
      type: array ? `${type}[]` : type,
      nullable: !!optional,
      primaryKey: attributes.includes('@id'),
      unique: attributes.includes('@unique') || attributes.includes('@id'),
    };

    // Extract default value (only set when present; exactOptionalPropertyTypes)
    const defaultMatch = attributes.match(/@default\(([^)]+)\)/);
    if (defaultMatch?.[1]) {
      column.defaultValue = defaultMatch[1];
    }

    // Extract foreign key from relation
    const relationMatch = attributes.match(/@relation\([^)]*fields:\s*\[(\w+)\][^)]*references:\s*\[(\w+)\][^)]*\)/);
    if (relationMatch) {
      // This is handled in relations, but we can mark it
      // The actual foreign key table is extracted in extractPrismaRelations
    }

    columns.push(column);
  }

  return columns;
}

/**
 * Extract relations from Prisma model
 */
function extractPrismaRelations(modelName: string, modelBody: string): Relation[] {
  const relations: Relation[] = [];
  const lines = modelBody.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.includes('@relation')) continue;

    // Pattern: fieldName Type @relation(fields: [fieldName], references: [id])
    // Or: fieldName Type[] @relation("RelationName")
    const relationMatch = trimmed.match(/^(\w+)\s+(\w+)(\?)?(\[\])?\s+.*@relation\(([^)]+)\)/);
    if (!relationMatch) continue;

    const [, fieldName, fieldType, , isArray, relationAttrs = ''] = relationMatch;
    if (!fieldName || !fieldType) continue;

    // One-to-many or many-to-many (array type)
    if (isArray) {
      // Find the related model name from the type
      const relatedModel = fieldType;
      relations.push({
        from: { table: modelName, column: fieldName },
        to: { table: relatedModel, column: 'id' }, // Assume id, could be improved
        type: 'many-to-many',
      });
      continue;
    }

    // One-to-one or many-to-one (has fields/references)
    const fieldsMatch = relationAttrs.match(/fields:\s*\[(\w+)\]/);
    const referencesMatch = relationAttrs.match(/references:\s*\[(\w+)\]/);
    const nameMatch = relationAttrs.match(/name:\s*["'](\w+)["']/);

    if (fieldsMatch && referencesMatch && fieldsMatch[1] && referencesMatch[1]) {
      const localField = fieldsMatch[1];
      const referencedField = referencesMatch[1];
      // Try to find the related model from the field type or relation name
      const relatedModel = nameMatch && nameMatch[1] ? nameMatch[1] : fieldType;

      relations.push({
        from: { table: modelName, column: localField },
        to: { table: relatedModel, column: referencedField },
        type: 'one-to-many',
      });
    }
  }

  return relations;
}
