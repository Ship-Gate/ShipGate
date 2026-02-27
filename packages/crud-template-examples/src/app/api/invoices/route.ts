import { NextResponse } from 'next/server';
import { listInvoices, createInvoice } from '@/lib/services/invoice.service';
import { createInvoiceSchema, queryInvoiceSchema } from '@/lib/validators/invoice';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = queryInvoiceSchema.parse({
      page: searchParams.get('page') ?? 1,
      limit: searchParams.get('limit') ?? 20,
      sortBy: searchParams.get('sortBy') ?? 'id',
      sortOrder: searchParams.get('sortOrder') ?? 'asc',
      ...Object.fromEntries(searchParams.entries()),
    });
    const result = await listInvoices(params);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {

  verifyAuth(request);

    const body = await request.json();
    const parsed = createInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const item = await createInvoice(parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
