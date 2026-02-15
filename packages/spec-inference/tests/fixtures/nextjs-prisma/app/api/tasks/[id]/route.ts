import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ id: params.id, title: 'Task' });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  return NextResponse.json({ id: params.id, ...body });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ deleted: true });
}
