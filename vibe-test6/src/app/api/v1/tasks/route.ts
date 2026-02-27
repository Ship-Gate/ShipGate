import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createTaskSchema } from '@/lib/validators';
import { verifyAuth } from '@/middleware/auth';
import { InvalidPriorityError, UserNotFoundError } from '@/lib/errors';

export async function POST(request: Request) {
  const userId = verifyAuth(request);
  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { title, description, priority, assignee_id } = parsed.data;

  if (priority < 1 || priority > 5) {
    throw new InvalidPriorityError();
  }

  const assigneeExists = await prisma.user.findUnique({ where: { id: assignee_id } });
  if (!assigneeExists) {
    throw new UserNotFoundError();
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      priority,
      assigneeId: assignee_id,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'Todo'
    }
  });

  return NextResponse.json(task, { status: 201 });
}

export async function GET(request: Request) {
  const userId = verifyAuth(request);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  const tasks = await prisma.task.findMany({
    where: {
      status: status ?? undefined,
      assigneeId: userId
    }
  });

  return NextResponse.json(tasks, { status: 200 });
}