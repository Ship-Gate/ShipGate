/**
 * API route: GET (single) + PUT (update) + DELETE
 */

import type { EntityDefinition } from '../types.js';
import { toCamelCase } from '../utils.js';

export function generateApiDetailRoute(entity: EntityDefinition): string {
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
import { get${entityName}ById, update${entityName}, delete${entityName} } from '@/lib/services/${entityCamel}.service';
import { update${entityName}Schema } from '@/lib/validators/${entityCamel}';
${needsAuth ? `import { verifyAuth } from '@/lib/auth';` : ''}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await get${entityName}ById(id);
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
${authCheck}
    const { id } = await params;
    const body = await request.json();
    const parsed = update${entityName}Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const item = await update${entityName}(id, parsed.data);
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
${authCheck}
    const { id } = await params;
    await delete${entityName}(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
`;
}
