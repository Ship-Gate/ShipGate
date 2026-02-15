/**
 * Prisma schema inferrer.
 * Parses prisma/schema.prisma and produces ISL entities.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { InferredEntity, InferredEnum, InferredField } from '../../types.js';

const PRISMA_TYPES: Record<string, string> = {
  String: 'String',
  Int: 'Int',
  BigInt: 'Int',
  Float: 'Decimal',
  Decimal: 'Decimal',
  Boolean: 'Boolean',
  DateTime: 'Timestamp',
  Json: 'String',
  Bytes: 'String',
  UUID: 'UUID',
};

export async function inferFromPrisma(
  projectRoot: string,
  getSource?: (path: string) => Promise<string>
): Promise<{ entities: InferredEntity[]; enums: InferredEnum[] }> {
  const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');
  let content: string;

  if (getSource) {
    content = await getSource(schemaPath);
  } else {
    content = await fs.promises.readFile(schemaPath, 'utf-8');
  }

  const entities: InferredEntity[] = [];
  const enums: InferredEnum[] = [];
  const modelNames = new Set<string>();

  // First pass: collect model and enum names
  for (const line of content.split('\n')) {
    const m = line.trim().match(/^model\s+(\w+)\s*\{/);
    if (m) modelNames.add(m[1]);
  }

  const lines = content.split('\n');
  let currentModel: string | null = null;
  let currentEnum: string | null = null;
  let currentFields: InferredField[] = [];
  let currentEnumMembers: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('model ')) {
      if (currentModel) {
        entities.push(buildEntity(currentModel, currentFields, modelNames));
      }
      const match = trimmed.match(/model\s+(\w+)\s*\{/);
      currentModel = match?.[1] ?? null;
      currentFields = [];
      currentEnum = null;
    } else if (trimmed.startsWith('enum ')) {
      if (currentEnum) {
        enums.push({
          name: currentEnum,
          members: currentEnumMembers,
          confidence: 'high',
          source: 'prisma',
        });
      }
      const match = trimmed.match(/enum\s+(\w+)\s*\{/);
      currentEnum = match?.[1] ?? null;
      currentEnumMembers = [];
      currentModel = null;
    } else if (currentModel && trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('@@')) {
      const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\??)\s*(.*)$/);
      if (fieldMatch) {
        const [, name, rawType, optional, rest] = fieldMatch;
        const islType = modelNames.has(rawType) ? 'UUID' : (PRISMA_TYPES[rawType] ?? 'String');
        const annotations: string[] = [];

        if (name === 'id' || name.endsWith('Id')) {
          annotations.push('immutable', 'unique');
        }
        if (rest.includes('@unique')) annotations.push('unique');
        if (rest.includes('@id')) annotations.push('immutable', 'unique');
        if (rest.includes('@default(now())') || name === 'createdAt' || name === 'created_at') {
          annotations.push('immutable');
        }
        // Skip relation fields that are the "other" side (e.g. user User @relation) - keep only FKs
        if (rest.includes('@relation') && !name.endsWith('Id')) {
          continue;
        }
        // Skip array relations (e.g. tasks Task[])
        if (modelNames.has(rawType) && rest.includes('[]')) {
          continue;
        }

        currentFields.push({
          name: toSnakeCase(name),
          type: islType,
          optional: optional === '?',
          annotations: annotations.length ? annotations : undefined,
        });
      }
    } else if (currentEnum && trimmed && !trimmed.startsWith('//')) {
      const memberMatch = trimmed.match(/^(\w+)/);
      if (memberMatch) {
        currentEnumMembers.push(memberMatch[1]);
      }
    } else if (trimmed === '}') {
      if (currentModel) {
        entities.push(buildEntity(currentModel, currentFields, modelNames));
        currentModel = null;
      }
      if (currentEnum) {
        enums.push({
          name: currentEnum,
          members: currentEnumMembers,
          confidence: 'high',
          source: 'prisma',
        });
        currentEnum = null;
      }
    }
  }

  return { entities, enums };
}

function buildEntity(
  name: string,
  fields: InferredField[],
  modelNames: Set<string>
): InferredEntity {
  modelNames.add(name);
  return {
    name,
    fields,
    confidence: 'high',
    source: 'prisma',
  };
}

function toSnakeCase(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, '');
}
