// Line 8: ISSUE - phantom-package, 'zod-validator' doesn't exist
import { z } from 'zod-validator';

export const todoSchema = z.object({
  title: z.string().min(1).max(100),
  completed: z.boolean().optional(),
});

export type TodoInput = z.infer<typeof todoSchema>;
