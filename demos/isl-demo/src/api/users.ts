/**
 * Users API
 * 
 * 🛑 ISSUES (fails-pii branch):
 * - Logs sensitive user data
 * - Returns unmasked PII in response
 */

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth/middleware.js';

const router = Router();

interface User {
  id: string;
  email: string;
  phone: string;
  ssn: string;  // 🛑 Should never be returned
  dateOfBirth: string;
  address: string;
}

// Mock database
const users: User[] = [
  {
    id: '1',
    email: 'alice@example.com',
    phone: '555-123-4567',
    ssn: '123-45-6789',
    dateOfBirth: '1990-01-15',
    address: '123 Main St, City, ST 12345',
  },
];

/**
 * Get current user profile
 */
router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = users.find(u => u.email === req.user?.email);
  
  // 🛑 PII IN LOGS - logs sensitive data
  console.log('User profile accessed:', user?.email, user?.ssn);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // 🛑 UNMASKED PII - returns SSN directly
  res.json({
    id: user.id,
    email: user.email,
    phone: user.phone,
    ssn: user.ssn,  // 🛑 Should be masked or omitted
    dateOfBirth: user.dateOfBirth,
  });
});

/**
 * Update user profile
 */
router.put('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { phone, address } = req.body;
  
  // 🛑 PII IN LOGS
  console.log('Updating user:', req.user?.email, 'Phone:', phone, 'Address:', address);
  
  // Update user (mock)
  const user = users.find(u => u.email === req.user?.email);
  if (user) {
    user.phone = phone || user.phone;
    user.address = address || user.address;
  }

  res.json({ success: true });
});

/**
 * List all users (admin only - but missing role check!)
 */
router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  // 🛑 NO ROLE CHECK - any authenticated user can see all users
  
  // 🛑 Returns all user data including PII
  res.json(users);
});

export default router;
