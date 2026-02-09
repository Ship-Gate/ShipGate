import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { store, toPublicUser } from "../store.js";

export async function createUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { email, name, password } = req.body;

  // --- Precondition: validate required fields ---
  if (!email || typeof email !== "string") {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Valid email is required",
    });
    return;
  }

  if (!name || typeof name !== "string") {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Name is required",
    });
    return;
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Password must be at least 8 characters",
    });
    return;
  }

  // --- Error: DUPLICATE_EMAIL — no new record created ---
  if (store.emailExists(email)) {
    res.status(409).json({
      error: "DUPLICATE_EMAIL",
      message: "A user with this email already exists",
    });
    return;
  }

  // --- Invariant: password hashed before storage, never stored in plaintext ---
  const password_hash = await bcrypt.hash(password, config.bcryptRounds);

  const user = store.create({ email, name, password_hash });

  // --- Postcondition: return public user (no password_hash) ---
  res.status(201).json(toPublicUser(user));
}
