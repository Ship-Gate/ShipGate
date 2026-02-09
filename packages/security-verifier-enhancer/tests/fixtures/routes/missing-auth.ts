/**
 * Route implementations with missing auth enforcement
 * These should be flagged as auth drift
 */

import { Request, Response } from 'express';

// Missing auth - should require auth per ISL
export async function getUser(req: Request, res: Response) {
  const { user_id } = req.params;
  
  // No auth check here - DRIFT DETECTED
  const user = await getUserById(user_id);
  
  if (!user) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  
  return res.json(user);
}

// Missing role check - should require ADMIN per ISL
export async function updateUser(req: Request, res: Response) {
  const { actor_id, target_user_id } = req.body;
  
  // No role check here - DRIFT DETECTED
  const user = await updateUserById(target_user_id, req.body.updates);
  
  return res.json(user);
}

async function getUserById(id: string) {
  // Mock implementation
  return { id, name: 'Test User' };
}

async function updateUserById(id: string, updates: unknown) {
  // Mock implementation
  return { id, ...updates };
}
