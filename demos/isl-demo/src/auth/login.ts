/**
 * Login Endpoint
 * 
 * 🛑 ISSUES (fails-auth branch):
 * - No rate limiting on authentication endpoint
 * - Auth bypass pattern detected
 */

import { Router } from 'express';

const router = Router();

// 🛑 NO RATE LIMITING - allows brute force attacks
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // 🛑 AUTH BYPASS PATTERN - should trigger policy
  const skipAuth = req.query.debug === 'true';
  
  if (skipAuth) {
    return res.json({ token: 'debug-token', user: { email } });
  }

  // Simple auth check (demo purposes)
  if (email && password) {
    const token = generateToken(email);
    return res.json({ token, user: { email } });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

// 🛑 MISSING AUTH on password reset
router.post('/reset-password', async (req, res) => {
  const { email } = req.body;
  
  // No rate limiting, no verification
  await sendResetEmail(email);
  
  res.json({ message: 'Reset email sent' });
});

function generateToken(email: string): string {
  return Buffer.from(`${email}:${Date.now()}`).toString('base64');
}

async function sendResetEmail(email: string): Promise<void> {
  // Mock implementation
  console.log(`Sending reset email to: ${email}`);
}

export default router;
