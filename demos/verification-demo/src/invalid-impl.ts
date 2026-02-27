/**
 * INVALID Implementation
 * 
 * This implementation has semantic violations that the gate will catch:
 * - Rate limit check happens AFTER body parsing (line order violation)
 * - Missing audit on some exit paths
 * - Console.log with potential PII
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface DeleteUserInput {
  user_id: string;
  admin_id: string;
}

export type DeleteUserResult =
  | { success: true }
  | { success: false; error: 'NOT_FOUND' | 'UNAUTHORIZED' };

// ============================================================================
// In-memory store
// ============================================================================

const users = new Map<string, User>();

// Seed test users
users.set('user-1', { id: 'user-1', email: 'user@example.com', role: 'USER' });
users.set('admin-1', { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });

// ============================================================================
// VIOLATION: No audit on delete operation
// ============================================================================

export async function deleteUser(input: DeleteUserInput): Promise<DeleteUserResult> {
  const { user_id, admin_id } = input;
  
  // Check admin exists and has permission
  const admin = users.get(admin_id);
  if (!admin || admin.role !== 'ADMIN') {
    // VIOLATION: No audit call on this exit path!
    return { success: false, error: 'UNAUTHORIZED' };
  }
  
  // Check user exists
  const user = users.get(user_id);
  if (!user) {
    // VIOLATION: No audit call on this exit path!
    return { success: false, error: 'NOT_FOUND' };
  }
  
  // Delete the user
  users.delete(user_id);
  
  // VIOLATION: Missing audit on success path too!
  return { success: true };
}

// ============================================================================
// VIOLATION: Rate limit AFTER body parsing
// ============================================================================

export interface BulkImportInput {
  users: Array<{ email: string; role: 'USER' | 'ADMIN' }>;
}

export type BulkImportResult =
  | { success: true; imported_count: number }
  | { success: false; error: 'RATE_LIMITED' };

const rateLimitCounters = new Map<string, number>();

function checkRateLimit(ip: string): boolean {
  const count = rateLimitCounters.get(ip) || 0;
  if (count >= 10) return false;
  rateLimitCounters.set(ip, count + 1);
  return true;
}

export async function bulkImport(
  input: BulkImportInput,
  ip: string = '127.0.0.1'
): Promise<BulkImportResult> {
  // VIOLATION: Body is already parsed (input.users) BEFORE rate limit check
  // This allows DoS via large request bodies before rate limiting kicks in
  
  // Parse the body first (already done by receiving input.users)
  const usersToImport = input.users;
  
  // VIOLATION: console.log with potential PII
  console.log(`Importing ${usersToImport.length} users from ${ip}`);
  
  // Rate limit check happens TOO LATE
  if (!checkRateLimit(ip)) {
    // VIOLATION: Missing audit on rate limit path
    return { success: false, error: 'RATE_LIMITED' };
  }
  
  // Import users
  let imported = 0;
  for (const userData of usersToImport) {
    const id = randomUUID();
    users.set(id, { id, ...userData });
    imported++;
    
    // VIOLATION: Logging email (PII)
    console.log(`Imported user: ${userData.email}`);
  }
  
  return { success: true, imported_count: imported };
}

// ============================================================================
// Helpers
// ============================================================================

export function resetState(): void {
  users.clear();
  users.set('user-1', { id: 'user-1', email: 'user@example.com', role: 'USER' });
  users.set('admin-1', { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
  rateLimitCounters.clear();
}
