import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface ProductFilter {
  name?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  page?: number;
  limit?: number;
}

export async function getProducts(req: Request, res: Response) {
  const {
    name,
    category,
    minPrice,
    maxPrice,
    inStock,
    page = 1,
    limit = 20,
  } = req.query as unknown as ProductFilter;

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
  };

  if (name) {
    where.name = { contains: name, mode: 'insensitive' };
  }

  if (category) {
    where.category = category;
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) where.price.gte = Number(minPrice);
    if (maxPrice !== undefined) where.price.lte = Number(maxPrice);
  }

  if (inStock) {
    where.stockCount = { gt: 0 };
  }

  const skip = (Number(page) - 1) * Number(limit);

  try {
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          category: true,
          price: true,
          stockCount: true,
          imageUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.product.count({ where }),
    ]);

    return res.json({
      success: true,
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Product query failed:', error);
    return res.status(500).json({ success: false, message: 'Query failed' });
  }
}

export async function createProduct(req: Request, res: Response) {
  const { name, category, price, stockCount, imageUrl } = req.body;

  try {
    const product = await prisma.product.create({
      data: {
        name,
        category,
        price: new Prisma.Decimal(price),
        stockCount: Number(stockCount),
        imageUrl,
      },
    });

    return res.status(201).json({ success: true, product });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'Product with this name already exists',
        });
      }
    }
    console.error('Product creation failed:', error);
    return res.status(500).json({ success: false, message: 'Creation failed' });
  }
}
