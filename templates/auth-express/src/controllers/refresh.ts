/**
 * Golden Auth Template (Express) — Refresh controller
 */

import type { Request, Response, NextFunction } from 'express';
import { refreshSchema } from '../validators/auth.js';
import * as authService from '../services/auth.js';

export async function refreshController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
      return;
    }
    const result = await authService.refresh(parsed.data);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_REFRESH_TOKEN') {
      res.status(401).json({ error: 'Invalid or expired refresh token', code: 'INVALID_REFRESH_TOKEN' });
      return;
    }
    next(error);
  }
}
