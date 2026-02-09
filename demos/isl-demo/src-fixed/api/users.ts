/**
 * Users API - FIXED VERSION
 * 
 * ✅ PASSES:
 * - No PII in logs
 * - Masked sensitive data in responses
 * - Proper authorization
 */

import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../../src/auth/middleware.js';

const router = Router();

interface User {
  id: string;
  email: string;
  phone: string;
  ssn: string;
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
  
  // ✅ NO PII IN LOGS - only log action, not data
  // logger.info('Profile accessed', { userId: user?.id });
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // ✅ MASKED PII - sensitive fields masked or omitted
  res.json({
    id: user.id,
    email: user.email,
    phone: maskPhone(user.phone),
    // ssn: NEVER returned
    dateOfBirth: user.dateOfBirth.slice(0, 4) + '-**-**', // Only year
  });
});

/**
 * Update user profile
 */
router.put('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { phone, address } = req.body;
  
  // ✅ NO PII IN LOGS
  // logger.info('Profile update', { userId: req.user?.id });
  
  const user = users.find(u => u.email === req.user?.email);
  if (user) {
    user.phone = phone || user.phone;
    user.address = address || user.address;
  }

  res.json({ success: true });
});

/**
 * List all users - ADMIN ONLY
 */
router.get('/', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  // ✅ PROPER ROLE CHECK - only admins can list users
  
  // ✅ Return sanitized user list
  res.json(users.map(u => ({
    id: u.id,
    email: u.email,
    // No sensitive data exposed
  })));
});

// ✅ Helper to mask phone numbers
function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})-(\d{3})-(\d{4})/, '$1-***-$3');
}

export default router;
