import { NextRequest, NextResponse } from 'next/server';
import { getTodos, createTodo } from '@/lib/storage';

export async function GET() {
  try {
    const todos = await getTodos(); // Line 15: ISSUE - phantom-api, getTodos doesn't exist
    return NextResponse.json(todos);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch todos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Line 23: ISSUE - missing-auth, no authentication check
    const body = await request.json();
    // Line 25: ISSUE - unvalidated-input, no validation
    
    const todo = await createTodo(body);
    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 });
  }
}
