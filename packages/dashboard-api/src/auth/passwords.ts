/**
 * Password hashing via bcrypt.
 * Uses bcryptjs (pure-JS, no native addons) for portability.
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/** Hash a plaintext password for storage. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Verify a plaintext password against a stored hash. */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
