import { z } from 'zod';

export const CreateTodoSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  completed: z.boolean().optional(),
});

export type CreateTodoInput = z.infer<typeof CreateTodoSchema>;
export type UpdateTodoInput = z.infer<typeof UpdateTodoSchema>;
