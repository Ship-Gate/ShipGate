/**
 * Route with extra auth that shouldn't have it
 * This might be flagged if ISL marks it as public
 */

import { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

// Extra auth on public endpoint - might be flagged
export async function publicEndpointWithAuth(req: Request, res: Response) {
  // Has auth but shouldn't per ISL
  const user = req.user; // Auth middleware applied
  
  return res.json({
    message: 'This is public but has auth',
    user: user?.id,
  });
}
