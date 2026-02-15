/**
 * Typed API client template
 */

import type { EntityDefinition } from '../types.js';
import { toCamelCase } from '../utils.js';
import { fieldToTsType } from '../field-maps.js';

export function generateApiClient(entity: EntityDefinition): string {
  const entityName = entity.name;
  const entityCamel = toCamelCase(entityName);
  const plural = entity.plural ?? entityCamel + 's';
  const basePath = `/api/${plural}`;

  const createFields = entity.fields.filter(
    (f) =>
      f.name !== 'id' &&
      f.name !== 'createdAt' &&
      f.name !== 'updatedAt' &&
      (entity.softDelete ? f.name !== 'deletedAt' : true)
  );
  const updateFields = createFields.filter((f) => f.editable !== false);

  const createInputType = createFields
    .map((f) => `  ${f.name}${f.required ? '' : '?'}: ${fieldToTsType(f)}`)
    .join(';\n');
  const updateInputType = updateFields.map((f) => `  ${f.name}?: ${fieldToTsType({ ...f, required: false })}`).join(';\n');

  const queryFields = entity.fields.filter((f) => f.sortable || f.filterable);
  const hasSearch = entity.fields.some((f) => f.searchable);
  let queryParams = '  page?: number;\n  limit?: number;\n  sortBy?: string;\n  sortOrder?: "asc" | "desc";';
  if (hasSearch) queryParams += '\n  search?: string;';
  for (const field of queryFields.filter((f) => f.filterable)) {
    queryParams += `\n  ${field.name}?: string;`;
  }

  return `const BASE = '${basePath}';

export interface ${entityName} {
  id: string;
${entity.fields.filter((f) => f.name !== 'id').map((f) => `  ${f.name}: ${fieldToTsType(f)};`).join('\n')}
}

export interface Create${entityName}Input {
${createInputType}
}

export interface Update${entityName}Input {
${updateInputType}
}

export interface List${entityName}Params {
${queryParams}
}

export interface List${entityName}Result {
  items: ${entityName}[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function list${entityName}s(params?: List${entityName}Params): Promise<List${entityName}Result> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') searchParams.set(k, String(v));
    });
  }
  const url = searchParams.toString() ? \`\${BASE}?\${searchParams}\` : BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export async function get${entityName}(id: string): Promise<${entityName} | null> {
  const res = await fetch(\`\${BASE}/\${id}\`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export async function create${entityName}(data: Create${entityName}Input): Promise<${entityName}> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}

export async function update${entityName}(id: string, data: Update${entityName}Input): Promise<${entityName}> {
  const res = await fetch(\`\${BASE}/\${id}\`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
}

export async function delete${entityName}(id: string): Promise<void> {
  const res = await fetch(\`\${BASE}/\${id}\`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
}
`;
}
