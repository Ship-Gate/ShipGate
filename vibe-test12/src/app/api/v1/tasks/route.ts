import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createTaskSchema } from '@/lib/validators';
import { AppError, InvalidPriorityError } from '@/lib/errors';
import { verifyAuth } from '@/middleware/auth';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const userId = verifyAuth(request);
    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { title, description, priority } = parsed.data;
    if (priority < 1 || priority > 5) {
      throw new InvalidPriorityError();
    }

    const task = await prisma.task.create({
      data: { title, description, priority, status: 'Todo', assigneeId: userId }
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}