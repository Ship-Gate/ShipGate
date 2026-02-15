/**
 * Zod validators template
 */

import type { EntityDefinition, EntityField } from '../types.js';
import { toCamelCase } from '../utils.js';
import { fieldToZodType } from '../field-maps.js';

export function generateValidators(entity: EntityDefinition): string {
  const entityName = entity.name;
  const createFields = entity.fields.filter((f) => f.name !== 'id' && f.name !== 'createdAt' && f.name !== 'updatedAt' && (entity.softDelete ? f.name !== 'deletedAt' : true));
  const updateFields = createFields.filter((f) => f.editable !== false);

  const createSchemaLines = createFields.map((f) => `  ${f.name}: ${fieldToZodType(f)}`).join(',\n');
  const updateSchemaLines = updateFields.map((f) => `  ${f.name}: ${fieldToZodType({ ...f, required: false })}`).join(',\n');

  const sortableFields = entity.fields.filter((f) => f.sortable).map((f) => f.name);
  const filterableFields = entity.fields.filter((f) => f.filterable).map((f) => f.name);
  const hasSearch = entity.fields.some((f) => f.searchable);
  const searchFields = entity.searchFields ?? entity.fields.filter((f) => f.searchable).map((f) => f.name);
  const sortByOptions = sortableFields.length > 0 ? sortableFields : ['id'];

  let querySchema = `  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum([${sortByOptions.map((f) => `"${f}"`).join(', ')}]).default("${sortByOptions[0]}"),
  sortOrder: z.enum(["asc", "desc"]).default("asc")`;

  if (hasSearch && searchFields.length > 0) {
    querySchema += `,
  search: z.string().optional()`;
  }

  for (const f of filterableFields) {
    querySchema += `,
  ${f}: z.string().optional()`;
  }

  return `import { z } from 'zod';

export const create${entityName}Schema = z.object({
${createSchemaLines}
});

export const update${entityName}Schema = z.object({
${updateSchemaLines}
}).partial();

export const query${entityName}Schema = z.object({
${querySchema}
});

export type Create${entityName}Input = z.infer<typeof create${entityName}Schema>;
export type Update${entityName}Input = z.infer<typeof update${entityName}Schema>;
export type Query${entityName}Params = z.infer<typeof query${entityName}Schema>;
`;
}
