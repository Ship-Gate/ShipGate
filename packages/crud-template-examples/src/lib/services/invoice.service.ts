import { prisma } from '@/lib/db';
import type { CreateInvoiceInput, UpdateInvoiceInput, QueryInvoiceParams } from '@/lib/validators/invoice';

const baseWhere = { deletedAt: null };

export async function listInvoices(params: QueryInvoiceParams) {
  const { page, limit, sortBy, sortOrder } = params;

  const where: Record<string, unknown> = { ...baseWhere };

  if (params.search && params.search.trim()) {
    where.OR = [
      { invoiceNumber: { contains: params.search, mode: 'insensitive' as const } },
      { customerName: { contains: params.search, mode: 'insensitive' as const } }
    ];
  }

  if (params.status) {
    where.status = params.status;
  }

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [params.sortBy]: params.sortOrder },
    }),
    prisma.invoice.count({ where }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getInvoiceById(id: string) {
  const item = await prisma.invoice.findFirst({
    where: { ...baseWhere, id },
  });
  if (!item) return null;
  return item;
}

export async function createInvoice(data: CreateInvoiceInput) {
  return prisma.invoice.create({
    data,
  });
}

export async function updateInvoice(id: string, data: UpdateInvoiceInput) {
  return prisma.invoice.update({
    where: { id },
    data,
  });
}

export async function deleteInvoice(id: string) {
  return await prisma.invoice.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
