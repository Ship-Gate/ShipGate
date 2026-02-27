import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string(),
  content: z.string().optional(),
  published: z.boolean()
});

export const updatePostSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  published: z.boolean().optional()
}).partial();

export const queryPostSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["title", "published"]).default("title"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  search: z.string().optional(),
  published: z.string().optional()
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type QueryPostParams = z.infer<typeof queryPostSchema>;
