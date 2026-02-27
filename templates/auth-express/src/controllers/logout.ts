/**
 * Golden Auth Template (Express) — Logout controller
 */

import type { Request, Response, NextFunction } from 'express';
import { refreshSchema } from '../validators/auth.js';
import * as authService from '../services/auth.js';

export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = req.body?.refreshToken ?? req.headers['x-refresh-token'];
    const parsed = refreshSchema.safeParse({ refreshToken });
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
      return;
    }
    await authService.logout(parsed.data.refreshToken);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
