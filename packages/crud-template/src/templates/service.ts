/**
 * Service layer template
 */

import type { EntityDefinition, EntityField } from '../types.js';
import { toCamelCase } from '../utils.js';

export function generateService(entity: EntityDefinition): string {
  const entityName = entity.name;
  const entityCamel = toCamelCase(entityName);
  const plural = entity.plural ?? entityCamel + 's';
  const searchFields = entity.searchFields ?? entity.fields.filter((f) => f.searchable).map((f) => f.name);
  const sortableFields = entity.fields.filter((f) => f.sortable).map((f) => f.name);
  const filterableFields = entity.fields.filter((f) => f.filterable).map((f) => f.name);

  const createFields = entity.fields.filter(
    (f) => f.name !== 'id' && f.name !== 'createdAt' && f.name !== 'updatedAt' && (entity.softDelete ? f.name !== 'deletedAt' : true)
  );
  const updateFields = createFields.filter((f) => f.editable !== false);

  let whereClause = '{}';
  if (entity.softDelete) {
    whereClause = '{ deletedAt: null }';
  }

  let listLogic = `
  const where: Record<string, unknown> = { ...baseWhere };
`;

  if (searchFields.length > 0) {
    listLogic += `
  if (params.search && params.search.trim()) {
    where.OR = [
      ${searchFields.map((f) => `{ ${f}: { contains: params.search, mode: 'insensitive' as const } }`).join(',\n      ')}
    ];
  }
`;
  }

  for (const f of filterableFields) {
    listLogic += `
  if (params.${f}) {
    where.${f} = params.${f};
  }
`;
  }

  const orderBy = sortableFields.length > 0 ? `{ [params.sortBy]: params.sortOrder }` : '{ id: "asc" }';

  const deleteOp = entity.softDelete
    ? `await prisma.${entityCamel}.update({
    where: { id },
    data: { deletedAt: new Date() },
  })`
    : `await prisma.${entityCamel}.delete({
    where: { id },
  })`;

  return `import { prisma } from '@/lib/db';
import type { Create${entityName}Input, Update${entityName}Input, Query${entityName}Params } from '@/lib/validators/${entityCamel}';

const baseWhere = ${whereClause};

export async function list${entityName}s(params: Query${entityName}Params) {
  const { page, limit, sortBy, sortOrder } = params;
${listLogic}
  const [items, total] = await Promise.all([
    prisma.${entityCamel}.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: ${orderBy},
    }),
    prisma.${entityCamel}.count({ where }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function get${entityName}ById(id: string) {
  const item = await prisma.${entityCamel}.findFirst({
    where: { ...baseWhere, id },
  });
  if (!item) return null;
  return item;
}

export async function create${entityName}(data: Create${entityName}Input) {
  return prisma.${entityCamel}.create({
    data,
  });
}

export async function update${entityName}(id: string, data: Update${entityName}Input) {
  return prisma.${entityCamel}.update({
    where: { id },
    data,
  });
}

export async function delete${entityName}(id: string) {
  return ${deleteOp};
}
`;
}
