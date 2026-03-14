/**
 * ADVERSARIAL FIXTURE: Auth Bypass via JWT Role Confusion
 *
 * Vulnerability: Authorization based on unvalidated JWT claims
 * Evasion technique: The code correctly decodes the JWT and checks
 * req.user.role === "admin", which looks like proper RBAC. But the
 * role claim comes directly from the JWT payload without server-side
 * validation against a database or role store. An attacker can forge
 * a JWT with `role: "admin"` if the signing key is weak or leaked.
 * Scanners see an auth check and may mark the route as protected.
 *
 * Exploit: Craft a JWT with { "sub": "attacker", "role": "admin" }
 */

import type { IncomingMessage, ServerResponse } from "node:http";

interface JwtPayload {
  sub: string;
  role: string;
  email: string;
  iat: number;
  exp: number;
}

interface AuthenticatedRequest extends IncomingMessage {
  user: JwtPayload;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export function authMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: "Missing authorization" }));
    return;
  }

  const token = authHeader.slice(7);
  const payload = decodeJwt(token);

  if (!payload) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: "Invalid token" }));
    return;
  }

  // BUG: No signature verification - just decodes the payload
  (req as AuthenticatedRequest).user = payload;
  next();
}

export function requireAdmin(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const user = (req as AuthenticatedRequest).user;

  // Looks correct but role is from unvalidated JWT claim
  if (user.role !== "admin") {
    res.writeHead(403);
    res.end(JSON.stringify({ error: "Admin access required" }));
    return;
  }

  next();
}

export async function handleDeleteUser(req: IncomingMessage, res: ServerResponse) {
  const user = (req as AuthenticatedRequest).user;

  if (user.role === "admin" || user.role === "superadmin") {
    // Dangerous: role from JWT claim, no server-side verification
    res.writeHead(200);
    res.end(JSON.stringify({ deleted: true }));
  } else {
    res.writeHead(403);
    res.end(JSON.stringify({ error: "Forbidden" }));
  }
}
