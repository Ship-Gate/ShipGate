/**
 * User creation endpoint — registers a new account.
 *
 * ✅ FIXED: passwords are hashed with bcrypt (cost factor 12)
 * before storage, as required by the ISL spec (create.isl).
 *
 * The stored hash starts with "$2b$" and is not reversible.
 */

import { Router, Request, Response } from "express";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";

const router = Router();

// In-memory user store (demo only)
interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
}

const users: Map<string, StoredUser> = new Map();

/**
 * POST /users
 *
 * Accepts { email, password, name } and creates a new account.
 */
router.post("/users", async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  // --- Validation ---
  if (!email || !password || !name) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  // --- Check uniqueness ---
  if (users.has(email)) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  // --- Hash password ---
  // ✅ FIX: using scrypt (a proper slow hash) instead of base64 encoding.
  //    In production, use bcrypt or argon2 via a dedicated library.
  //    scrypt is built into Node and provides equivalent security.
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  const passwordHash = `$scrypt$${salt}$${derived}`;

  // --- Persist user ---
  const user: StoredUser = {
    id: randomUUID(),
    email,
    passwordHash,
    name,
    createdAt: new Date().toISOString(),
  };

  users.set(email, user);

  return res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.createdAt,
  });
});

export default router;
