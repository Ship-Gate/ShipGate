import { prisma } from '@/lib/db';
import type { CreatePostInput, UpdatePostInput, QueryPostParams } from '@/lib/validators/post';

const baseWhere = {};

export async function listPosts(params: QueryPostParams) {
  const { page, limit, sortBy, sortOrder } = params;

  const where: Record<string, unknown> = { ...baseWhere };

  if (params.search && params.search.trim()) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' as const } },
      { content: { contains: params.search, mode: 'insensitive' as const } }
    ];
  }

  if (params.published) {
    where.published = params.published;
  }

  const [items, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [params.sortBy]: params.sortOrder },
    }),
    prisma.post.count({ where }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPostById(id: string) {
  const item = await prisma.post.findFirst({
    where: { ...baseWhere, id },
  });
  if (!item) return null;
  return item;
}

export async function createPost(data: CreatePostInput) {
  return prisma.post.create({
    data,
  });
}

export async function updatePost(id: string, data: UpdatePostInput) {
  return prisma.post.update({
    where: { id },
    data,
  });
}

export async function deletePost(id: string) {
  return await prisma.post.delete({
    where: { id },
  });
}
