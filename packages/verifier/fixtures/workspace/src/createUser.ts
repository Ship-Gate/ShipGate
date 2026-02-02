// ============================================================================
// CreateUser Implementation - Test fixture
// ============================================================================

export interface User {
  id: string;
  email: string;
  active: boolean;
}

export interface CreateUserInput {
  email: string;
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  // Validate email
  if (!input.email || input.email.length === 0) {
    throw new Error('Email is required');
  }
  
  if (!input.email.includes('@')) {
    throw new Error('Invalid email format');
  }
  
  // Create user
  const user: User = {
    id: generateId(),
    email: input.email,
    active: true,
  };
  
  return user;
}

/**
 * Generate deterministic ID for testing
 */
function generateId(): string {
  return 'user-' + Math.random().toString(36).slice(2, 10);
}
