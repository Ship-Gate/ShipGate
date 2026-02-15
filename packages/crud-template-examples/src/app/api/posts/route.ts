import { NextResponse } from 'next/server';
import { listPosts, createPost } from '@/lib/services/post.service';
import { createPostSchema, queryPostSchema } from '@/lib/validators/post';


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = queryPostSchema.parse({
      page: searchParams.get('page') ?? 1,
      limit: searchParams.get('limit') ?? 20,
      sortBy: searchParams.get('sortBy') ?? 'id',
      sortOrder: searchParams.get('sortOrder') ?? 'asc',
      ...Object.fromEntries(searchParams.entries()),
    });
    const result = await listPosts(params);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {

    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const item = await createPost(parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
