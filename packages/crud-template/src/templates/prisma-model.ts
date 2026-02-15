/**
 * Prisma model template
 */

import type { EntityDefinition, EntityField } from '../types.js';
import { toCamelCase } from '../utils.js';
import { fieldToPrismaType } from '../field-maps.js';

function fieldToPrismaLine(field: EntityField): string {
  let line = `  ${field.name} ${fieldToPrismaType(field)}`;
  const attrs: string[] = [];

  if (field.name === 'id') {
    attrs.push('@id', '@default(uuid())');
  }
  if (field.name === 'createdAt') {
    attrs.push('@default(now())');
  }
  if (field.name === 'updatedAt') {
    attrs.push('@updatedAt');
  }

  if (attrs.length > 0) {
    line += ' ' + attrs.join(' ');
  }
  return line;
}

export function generatePrismaModel(entity: EntityDefinition): string {
  const entityName = entity.name;
  const entityCamel = toCamelCase(entityName);

  const standardFields: EntityField[] = [
    { name: 'id', type: 'String', required: true },
    ...entity.fields.filter((f) => f.name !== 'id'),
  ];

  if (!standardFields.some((f) => f.name === 'createdAt')) {
    standardFields.push({ name: 'createdAt', type: 'DateTime', required: true });
  }
  if (!standardFields.some((f) => f.name === 'updatedAt')) {
    standardFields.push({ name: 'updatedAt', type: 'DateTime', required: true });
  }
  if (entity.softDelete && !standardFields.some((f) => f.name === 'deletedAt')) {
    standardFields.push({ name: 'deletedAt', type: 'DateTime', required: false });
  }

  const modelLines = standardFields.map((f) => fieldToPrismaLine(f)).join('\n');

  return `model ${entityName} {
${modelLines}
}
`;
}
