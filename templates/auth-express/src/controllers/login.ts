/**
 * Golden Auth Template (Express) — Login controller
 */

import type { Request, Response, NextFunction } from 'express';
import { loginSchema } from '../validators/auth.js';
import * as authService from '../services/auth.js';

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
      return;
    }
    const result = await authService.login(parsed.data);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
      return;
    }
    next(error);
  }
}
