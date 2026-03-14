/**
 * ADVERSARIAL FIXTURE: Auth Bypass via Conditional Environment Check
 *
 * Vulnerability: Authentication is skipped based on NODE_ENV value
 * Evasion technique: The auth middleware wraps the actual check in an
 * environment conditional. Scanners see requireAuth() is called, so
 * the route appears protected. But in "test" or "development" mode
 * (or if NODE_ENV is unset), auth is silently skipped. If NODE_ENV
 * leaks or is misconfigured in production, the entire auth layer
 * is bypassed.
 *
 * Exploit: Set NODE_ENV=test in production, or rely on a missing env var
 */

interface Request {
  headers: Record<string, string | undefined>;
  user?: { id: string; role: string };
  path: string;
}

interface Response {
  status(code: number): Response;
  json(body: unknown): void;
}

type NextFunction = () => void;

function verifyToken(token: string): { id: string; role: string } | null {
  // Real token verification logic
  return token ? { id: "user-1", role: "user" } : null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  req.user = user;
  next();
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "test") {
    requireAuth(req, res, next);
  } else {
    req.user = { id: "test-user", role: "admin" };
    next();
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    next();
    return;
  }

  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}

export function rateLimiter(req: Request, _res: Response, next: NextFunction) {
  if (process.env.DISABLE_RATE_LIMIT === "true") {
    next();
    return;
  }

  // Rate limiting logic that can be entirely disabled via env var
  next();
}
