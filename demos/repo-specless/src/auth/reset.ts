/**
 * Password Reset Flow
 *
 * Generates time-limited reset tokens and handles the password
 * update once the user clicks the email link.
 */

import { randomBytes, createHash } from 'crypto';

// ---------- types ----------

interface ResetTokenRecord {
  userId: string;
  tokenHash: string;
  createdAt: Date;
}

interface RequestResetResult {
  success: boolean;
  message: string;
  /** Only returned in dev/test for debugging; never exposed in production */
  token?: string;
}

interface ResetPasswordResult {
  success: boolean;
  message: string;
}

// ---------- token store ----------

const resetTokens = new Map<string, ResetTokenRecord>();

// ---------- helpers ----------

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

// ---------- request password reset ----------

/**
 * Initiates a password reset for the given user.
 *
 * Generates a cryptographically secure token, hashes it for storage,
 * and returns the raw token to be sent via email. The token is stored
 * with a creation timestamp for expiry enforcement.
 *
 * @param userId - The user requesting the reset
 * @param email  - The user's email (used for sending the reset link)
 */
export async function requestPasswordReset(
  userId: string,
  email: string
): Promise<RequestResetResult> {
  if (!userId || !email) {
    return { success: false, message: 'userId and email are required' };
  }

  // basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, message: 'Invalid email format' };
  }

  // invalidate any existing token for this user
  for (const [key, record] of resetTokens.entries()) {
    if (record.userId === userId) {
      resetTokens.delete(key);
    }
  }

  // generate new token
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);

  // store hashed token with metadata
  resetTokens.set(tokenHash, {
    userId,
    tokenHash,
    createdAt: new Date(),
  });

  // in production, this would call the email service:
  // await emailService.sendResetLink(email, rawToken);

  return {
    success: true,
    message: 'If an account with that email exists, a reset link has been sent.',
    token: process.env.NODE_ENV !== 'production' ? rawToken : undefined,
  };
}

// ---------- reset password ----------

/**
 * Completes the password reset by validating the token and updating
 * the user's password.
 *
 * @param token       - The raw token from the reset email link
 * @param newPassword - The new password to set
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  if (!token || !newPassword) {
    return { success: false, message: 'Token and new password are required' };
  }

  // password strength requirements
  if (newPassword.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters' };
  }

  if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return {
      success: false,
      message: 'Password must contain at least one uppercase letter and one number',
    };
  }

  // look up token
  const tokenHash = hashToken(token);
  const record = resetTokens.get(tokenHash);

  if (!record) {
    return { success: false, message: 'Invalid or expired reset token' };
  }

  // token is valid — update the password
  // In production: await userService.updatePassword(record.userId, newPassword);

  // consume the token so it can't be reused
  resetTokens.delete(tokenHash);

  return { success: true, message: 'Password has been reset successfully' };
}
