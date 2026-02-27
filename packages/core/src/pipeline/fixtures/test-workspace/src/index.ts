/**
 * Test workspace source file
 *
 * This is a minimal source file for testing the pipeline.
 */

export interface User {
  id: string;
  name: string;
  email: string;
}

export function createUser(name: string, email: string): User {
  return {
    id: crypto.randomUUID(),
    name,
    email,
  };
}

export function validateUser(user: User): boolean {
  return user.name.length > 0 && user.email.includes('@');
}
