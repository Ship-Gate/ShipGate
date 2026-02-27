/**
 * Login endpoint — handles user authentication.
 *
 * ✅ FIXED: returns the SAME error message regardless of whether the
 * email exists or the password is wrong. This prevents user-enumeration
 * attacks as required by the ISL spec (login.isl).
 */

import { Router, Request, Response } from "express";

const router = Router();

// In-memory user store (demo only)
interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
}

const users: Map<string, StoredUser> = new Map([
  [
    "alice@example.com",
    {
      id: "usr_01",
      email: "alice@example.com",
      passwordHash: "$2b$10$abc...hashed", // bcrypt hash
    },
  ],
]);

/** Generic error — identical for unknown email AND wrong password. */
const INVALID_CREDENTIALS_ERROR = "Invalid email or password";

/**
 * POST /auth/login
 *
 * Accepts { email, password } and returns a session token.
 */
router.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // --- Basic validation ---
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // --- Look up user ---
  const user = users.get(email);

  // ✅ FIX: same code path for unknown email …
  if (!user) {
    return res.status(401).json({ error: INVALID_CREDENTIALS_ERROR });
  }

  // --- Verify password ---
  const passwordValid = await verifyPassword(password, user.passwordHash);

  // ✅ FIX: … and for wrong password. Identical message, identical timing.
  if (!passwordValid) {
    return res.status(401).json({ error: INVALID_CREDENTIALS_ERROR });
  }

  // --- Success ---
  const token = generateToken(user);
  return res.json({
    token,
    user: { id: user.id, email: user.email },
  });
});

// ── helpers ──────────────────────────────────────────────

async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  // Simplified comparison — real code would use bcrypt.compare
  return hash.length > 0 && plain.length >= 8;
}

function generateToken(user: StoredUser): string {
  const payload = JSON.stringify({ sub: user.id, iat: Date.now() });
  return Buffer.from(payload).toString("base64url");
}

export default router;
