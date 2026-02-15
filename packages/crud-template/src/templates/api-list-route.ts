/**
 * API route: GET (list) + POST (create)
 */

import type { EntityDefinition } from '../types.js';
import { toCamelCase } from '../utils.js';

export function generateApiListRoute(entity: EntityDefinition): string {
  const entityName = entity.name;
  const entityCamel = toCamelCase(entityName);
  const auth = entity.auth ?? 'public';
  const needsAuth = auth !== 'public';

  const authCheck = needsAuth
    ? `
  verifyAuth(request);
`
    : '';

  return `import { NextResponse } from 'next/server';
import { list${entityName}s, create${entityName} } from '@/lib/services/${entityCamel}.service';
import { create${entityName}Schema, query${entityName}Schema } from '@/lib/validators/${entityCamel}';
${needsAuth ? `import { verifyAuth } from '@/lib/auth';` : ''}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = query${entityName}Schema.parse({
      page: searchParams.get('page') ?? 1,
      limit: searchParams.get('limit') ?? 20,
      sortBy: searchParams.get('sortBy') ?? 'id',
      sortOrder: searchParams.get('sortOrder') ?? 'asc',
      ...Object.fromEntries(searchParams.entries()),
    });
    const result = await list${entityName}s(params);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
${authCheck}
    const body = await request.json();
    const parsed = create${entityName}Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const item = await create${entityName}(parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
`;
}
