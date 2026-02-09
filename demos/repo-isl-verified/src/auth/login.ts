import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { store } from "../store.js";

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  // --- Precondition: validate required fields ---
  if (
    !email ||
    typeof email !== "string" ||
    !password ||
    typeof password !== "string"
  ) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Email and password are required",
    });
    return;
  }

  // --- Invariant: identical error for unknown email vs wrong password ---
  const user = store.findByEmail(email);

  if (!user) {
    res.status(401).json({
      error: "INVALID_CREDENTIALS",
      message: "Invalid credentials",
    });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    res.status(401).json({
      error: "INVALID_CREDENTIALS",
      message: "Invalid credentials",
    });
    return;
  }

  // --- Postcondition: return JWT with expires_in = 3600 ---
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  res.status(200).json({
    token,
    expires_in: config.jwtExpiresIn,
  });
}
