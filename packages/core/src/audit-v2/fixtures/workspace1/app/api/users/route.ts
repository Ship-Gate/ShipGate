/**
 * Users API Route - Next.js App Router
 * 
 * This is a sample route for testing the audit engine.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  // No auth check - should be flagged
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  // No auth check - should be flagged
  // No validation - should be flagged
  const body = await request.json();

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}

export async function DELETE(request: Request) {
  // Has auth check
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
