/**
 * Public endpoint - correctly has no auth
 * Should NOT be flagged if ISL marks it as public
 */

import { Request, Response } from 'express';

// Public endpoint - no auth needed
export async function healthCheck(req: Request, res: Response) {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
