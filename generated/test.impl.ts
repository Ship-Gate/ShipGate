/**
 * Sample implementation for CreateUser behavior
 */

import type { CreateUserResult, User } from './test.types.js';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage for demo
const users: Map<string, User> = new Map();

/**
 * CreateUser - Creates a new user
 */
export async function createUser(): Promise<CreateUserResult> {
  const id = uuidv4();
  
  const user: User = {
    id,
  };
  
  users.set(id, user);
  
  return {
    success: true,
    data: user,
  };
}

// Export for verification
export default { createUser };
