import { z } from 'zod';

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string(),
  customerName: z.string(),
  amount: z.number(),
  status: z.string()
});

export const updateInvoiceSchema = z.object({
  invoiceNumber: z.string().optional(),
  customerName: z.string().optional(),
  amount: z.number().optional(),
  status: z.string().optional()
}).partial();

export const queryInvoiceSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["invoiceNumber", "amount", "status"]).default("invoiceNumber"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  search: z.string().optional(),
  status: z.string().optional()
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type QueryInvoiceParams = z.infer<typeof queryInvoiceSchema>;
