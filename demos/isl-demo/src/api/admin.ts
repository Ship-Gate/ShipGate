/**
 * Admin API
 * 
 * 🛑 ISSUES (fails-auth branch):
 * - Unprotected admin endpoint
 * - Missing role verification
 */

import { Router } from 'express';

const router = Router();

/**
 * 🛑 UNPROTECTED ADMIN ENDPOINT
 * No authentication, no authorization
 * Anyone can access admin functions
 */
router.get('/dashboard', (req, res) => {
  // Should require admin role!
  res.json({
    totalUsers: 150,
    activeToday: 42,
    revenue: 15000,
    secretApiKey: process.env.ADMIN_API_KEY, // 🛑 Exposing secrets
  });
});

/**
 * 🛑 UNPROTECTED - Delete user (admin only)
 */
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  
  // No auth check at all!
  console.log(`Deleting user ${id}`);
  
  res.json({ success: true, deleted: id });
});

/**
 * 🛑 UNPROTECTED - System settings
 */
router.post('/settings', (req, res) => {
  const { setting, value } = req.body;
  
  // 🛑 AUTH BYPASS - checking for magic header instead of real auth
  const bypassAuth = req.headers['x-admin-bypass'] === 'true';
  
  if (bypassAuth) {
    return res.json({ updated: true, setting, value });
  }
  
  // Still no real auth!
  res.json({ updated: true, setting, value });
});

export default router;
