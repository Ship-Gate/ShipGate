/**
 * Password Hashing and Validation
 */

import bcrypt from 'bcryptjs';
import type { PasswordPolicy } from './types';

const BCRYPT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password against policy
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicy
): { valid: boolean; failures: string[] } {
  const failures: string[] = [];

  if (password.length < policy.minLength) {
    failures.push(`Password must be at least ${policy.minLength} characters`);
  }

  if (password.length > policy.maxLength) {
    failures.push(`Password must be at most ${policy.maxLength} characters`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    failures.push('Password must contain at least one uppercase letter');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    failures.push('Password must contain at least one lowercase letter');
  }

  if (policy.requireNumber && !/\d/.test(password)) {
    failures.push('Password must contain at least one number');
  }

  if (policy.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    failures.push('Password must contain at least one special character');
  }

  // Check for common patterns
  if (isCommonPassword(password)) {
    failures.push('Password is too common');
  }

  return {
    valid: failures.length === 0,
    failures,
  };
}

/**
 * Check password strength (0-100)
 */
export function getPasswordStrength(password: string): {
  score: number;
  label: 'weak' | 'fair' | 'good' | 'strong';
} {
  let score = 0;

  // Length
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Character variety
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 15;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 20;

  // Patterns (negative)
  if (/^[a-zA-Z]+$/.test(password)) score -= 10;
  if (/^[0-9]+$/.test(password)) score -= 20;
  if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated chars
  if (/^(abc|123|qwerty)/i.test(password)) score -= 20;

  score = Math.max(0, Math.min(100, score));

  let label: 'weak' | 'fair' | 'good' | 'strong';
  if (score < 30) label = 'weak';
  else if (score < 50) label = 'fair';
  else if (score < 70) label = 'good';
  else label = 'strong';

  return { score, label };
}

/**
 * Generate a random password
 */
export function generatePassword(options: {
  length?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  numbers?: boolean;
  special?: boolean;
} = {}): string {
  const {
    length = 16,
    uppercase = true,
    lowercase = true,
    numbers = true,
    special = true,
  } = options;

  let chars = '';
  if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) chars += '0123456789';
  if (special) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (chars.length === 0) {
    chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  }

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  let password = Array.from(array, (byte) => chars[byte % chars.length]).join('');

  // Ensure at least one of each required type
  const requirements: string[] = [];
  if (uppercase && !/[A-Z]/.test(password)) requirements.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  if (lowercase && !/[a-z]/.test(password)) requirements.push('abcdefghijklmnopqrstuvwxyz');
  if (numbers && !/\d/.test(password)) requirements.push('0123456789');
  if (special && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    requirements.push('!@#$%^&*()_+-=[]{}|;:,.<>?');
  }

  // Replace random positions with required characters
  const passwordArray = password.split('');
  for (let i = 0; i < requirements.length && i < length; i++) {
    const reqChars = requirements[i];
    const randomIndex = Math.floor(Math.random() * reqChars.length);
    passwordArray[i] = reqChars[randomIndex];
  }

  // Shuffle
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join('');
}

// Common passwords list (abbreviated)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
  'baseball', 'iloveyou', 'master', 'sunshine', 'ashley',
  'michael', 'password1', 'shadow', '123123', '654321',
]);

function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}
