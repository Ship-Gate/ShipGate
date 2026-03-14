/**
 * ADVERSARIAL FIXTURE: Auth Bypass via Path Traversal
 *
 * Vulnerability: Auth middleware on /api/users doesn't protect
 * path-traversed equivalents like /api/users/../admin
 * Evasion technique: The router applies auth middleware to specific
 * path prefixes, but the underlying handler resolves paths that
 * include ".." segments. An attacker can bypass the auth check by
 * using path traversal to reach protected endpoints through
 * unprotected path prefixes. Scanners checking middleware chains
 * may see auth applied and mark routes as protected.
 *
 * Exploit: GET /api/public/../users/admin/delete (bypasses /api/users auth)
 */

interface RouteHandler {
  (req: AppRequest, res: AppResponse): Promise<void>;
}

interface Middleware {
  (req: AppRequest, res: AppResponse, next: () => void): void;
}

interface AppRequest {
  url: string;
  method: string;
  headers: Record<string, string | undefined>;
  user?: { id: string; role: string };
}

interface AppResponse {
  writeHead(code: number, headers?: Record<string, string>): void;
  end(body?: string): void;
}

const routes: Array<{
  path: string;
  handler: RouteHandler;
  middleware?: Middleware[];
}> = [];

function requireAuth(): Middleware {
  return (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    req.user = { id: "user-1", role: "user" };
    next();
  };
}

routes.push({
  path: "/api/users",
  middleware: [requireAuth()],
  handler: async (req, res) => {
    res.writeHead(200);
    res.end(JSON.stringify({ users: [] }));
  },
});

routes.push({
  path: "/api/public",
  handler: async (req, res) => {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "public" }));
  },
});

routes.push({
  path: "/api/admin",
  middleware: [requireAuth()],
  handler: async (req, res) => {
    res.writeHead(200);
    res.end(JSON.stringify({ admin: true }));
  },
});

function resolvePath(url: string): string {
  const parts = url.split("/").filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== ".") {
      resolved.push(part);
    }
  }

  return "/" + resolved.join("/");
}

export async function handleRequest(req: AppRequest, res: AppResponse) {
  const resolvedPath = resolvePath(req.url);

  const route = routes.find((r) => resolvedPath.startsWith(r.path));

  if (!route) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  // BUG: Auth middleware was matched on original path prefix,
  // but resolvedPath may have traversed from an unprotected prefix
  if (route.middleware) {
    for (const mw of route.middleware) {
      let proceed = false;
      mw(req, res, () => {
        proceed = true;
      });
      if (!proceed) return;
    }
  }

  await route.handler(req, res);
}
