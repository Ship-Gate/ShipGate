/**
 * Route implementations with correct auth enforcement
 * These should NOT be flagged as auth drift
 */

import { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

// Correct auth - has auth middleware
export async function createPost(req: Request, res: Response) {
  // Auth middleware applied elsewhere (e.g., router.use(requireAuth))
  const { author_id, title, content } = req.body;
  
  const post = await createPostInDb({ author_id, title, content });
  
  return res.json(post);
}

// Correct role check - has role enforcement
export async function updateUserWithAuth(req: Request, res: Response) {
  const { actor_id, target_user_id } = req.body;
  
  // Role check present
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  
  const user = await updateUserById(target_user_id, req.body.updates);
  
  return res.json(user);
}

async function createPostInDb(data: { author_id: string; title: string; content: string }) {
  // Mock implementation
  return { id: 'post-1', ...data };
}

async function updateUserById(id: string, updates: unknown) {
  // Mock implementation
  return { id, ...updates };
}
