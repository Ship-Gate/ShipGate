import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().min(1).max(5),
  assignee_id: z.string().uuid()
});