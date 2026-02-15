import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().min(1).max(5)
});

export const registerUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string()
});