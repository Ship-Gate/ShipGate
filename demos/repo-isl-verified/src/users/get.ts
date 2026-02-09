import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware.js";
import { store, toPublicUser } from "../store.js";

export function getUserHandler(
  req: AuthenticatedRequest,
  res: Response,
): void {
  const { id } = req.params;

  // --- Precondition: caller is authenticated (enforced by requireAuth middleware) ---

  const user = store.findById(id);

  if (!user) {
    // --- Postcondition: NOT_FOUND → 404 ---
    res.status(404).json({
      error: "NOT_FOUND",
      message: "User not found",
    });
    return;
  }

  // --- Invariant: password_hash never appears in response ---
  // --- Postcondition: result.id == input.id ---
  res.status(200).json(toPublicUser(user));
}
