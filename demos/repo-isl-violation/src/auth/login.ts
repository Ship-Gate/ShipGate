/**
 * Login endpoint — handles user authentication.
 *
 * 🛑 THIS FILE INTENTIONALLY VIOLATES the ISL spec (login.isl).
 *
 * Violation: returns DIFFERENT error messages for "user not found"
 * vs "wrong password," which lets attackers enumerate valid accounts.
 *
 * The spec requires: identical "Invalid email or password" for both cases.
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

  // 🛑 VIOLATION: leaks that the email is not registered
  //    Spec says: "return identical error for wrong email or password"
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  // --- Verify password (simplified for demo) ---
  const passwordValid = await verifyPassword(password, user.passwordHash);

  // 🛑 VIOLATION: different message reveals the *password* was wrong,
  //    confirming the email IS valid — classic enumeration vector.
  if (!passwordValid) {
    return res.status(401).json({ error: "Invalid password" });
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
  // Demo token generation
  const payload = JSON.stringify({ sub: user.id, iat: Date.now() });
  return Buffer.from(payload).toString("base64url");
}

export default router;
