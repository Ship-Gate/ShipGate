import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string(),
  sku: z.string(),
  price: z.number(),
  stock: z.number().int()
});

export const updateProductSchema = z.object({
  name: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().optional(),
  stock: z.number().int().optional()
}).partial();

export const queryProductSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "sku", "price", "stock"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  search: z.string().optional(),
  price: z.string().optional()
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type QueryProductParams = z.infer<typeof queryProductSchema>;
