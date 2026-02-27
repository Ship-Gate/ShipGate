/**
 * User creation endpoint — registers a new account.
 *
 * 🛑 THIS FILE INTENTIONALLY VIOLATES the ISL spec (create.isl).
 *
 * Violation: "hashes" the password with Base64 encoding, which is
 * trivially reversible. It *looks* like encryption to a casual
 * reviewer, but provides zero cryptographic security.
 *
 * The spec requires: bcrypt or argon2 — real, slow hash functions.
 */

import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";

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

  // --- "Hash" password ---
  // 🛑 VIOLATION: Base64 is encoding, NOT hashing.
  //    Anyone with database access can decode every password instantly:
  //        Buffer.from(hash, 'base64').toString()   →   "plaintextpassword"
  //
  //    Spec says: "must hash password with bcrypt or argon2"
  const passwordHash = Buffer.from(password).toString("base64");

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
