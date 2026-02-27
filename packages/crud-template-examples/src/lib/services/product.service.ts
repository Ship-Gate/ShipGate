import { prisma } from '@/lib/db';
import type { CreateProductInput, UpdateProductInput, QueryProductParams } from '@/lib/validators/product';

const baseWhere = {};

export async function listProducts(params: QueryProductParams) {
  const { page, limit, sortBy, sortOrder } = params;

  const where: Record<string, unknown> = { ...baseWhere };

  if (params.search && params.search.trim()) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' as const } },
      { sku: { contains: params.search, mode: 'insensitive' as const } }
    ];
  }

  if (params.price) {
    where.price = params.price;
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [params.sortBy]: params.sortOrder },
    }),
    prisma.product.count({ where }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getProductById(id: string) {
  const item = await prisma.product.findFirst({
    where: { ...baseWhere, id },
  });
  if (!item) return null;
  return item;
}

export async function createProduct(data: CreateProductInput) {
  return prisma.product.create({
    data,
  });
}

export async function updateProduct(id: string, data: UpdateProductInput) {
  return prisma.product.update({
    where: { id },
    data,
  });
}

export async function deleteProduct(id: string) {
  return await prisma.product.delete({
    where: { id },
  });
}
