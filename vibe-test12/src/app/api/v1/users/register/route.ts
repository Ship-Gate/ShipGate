import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { registerUserSchema } from '@/lib/validators';
import { AppError, DuplicateEmailError, InvalidUsernameError } from '@/lib/errors';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = registerUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { email, username, password } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new DuplicateEmailError();
    }

    if (username.length < 3) {
      throw new InvalidUsernameError();
    }

    const user = await prisma.user.create({
      data: { email, username, password }
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}