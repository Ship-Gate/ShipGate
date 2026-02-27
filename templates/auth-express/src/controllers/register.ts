/**
 * Golden Auth Template (Express) — Register controller
 */

import type { Request, Response, NextFunction } from 'express';
import { registerSchema } from '../validators/auth.js';
import * as authService from '../services/auth.js';

export async function registerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
      return;
    }
    const result = await authService.register(parsed.data);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_TAKEN') {
      res.status(409).json({ error: 'Email address is already registered', code: 'EMAIL_TAKEN' });
      return;
    }
    next(error);
  }
}
