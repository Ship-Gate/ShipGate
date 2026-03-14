/**
 * ADVERSARIAL FIXTURE: SQL Injection via Computed Property Access
 *
 * Vulnerability: SQL injection through dynamically-accessed query builder
 * Evasion technique: The SQL-building function is stored in an object and
 * accessed via a computed property key. Static analyzers that resolve
 * direct function calls may not track data flow through bracket notation
 * property access on objects.
 *
 * Exploit: GET /api/data?type=q&value=1' UNION SELECT password FROM credentials--
 */

import type { IncomingMessage, ServerResponse } from "node:http";

interface DbClient {
  execute(sql: string): Promise<unknown[]>;
}

declare const db: DbClient;

type QueryBuilder = (value: string) => string;

const queryBuilders: Record<string, QueryBuilder> = {
  q: (id: string) => "SELECT * FROM users WHERE id=" + id,
  search: (term: string) => "SELECT * FROM products WHERE name LIKE '%" + term + "%'",
  count: (table: string) => "SELECT COUNT(*) FROM " + table,
};

function getQueryType(req: IncomingMessage): string {
  const url = new URL(req.url ?? "", "http://localhost");
  return url.searchParams.get("type") ?? "q";
}

function getQueryValue(req: IncomingMessage): string {
  const url = new URL(req.url ?? "", "http://localhost");
  return url.searchParams.get("value") ?? "";
}

export async function handleDataRequest(req: IncomingMessage, res: ServerResponse) {
  const queryType = getQueryType(req);
  const queryValue = getQueryValue(req);

  const builderKey = queryType;
  const builder = queryBuilders[builderKey];

  if (!builder) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid query type" }));
    return;
  }

  const sql = builder(queryValue);
  const results = await db.execute(sql);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ data: results }));
}

const ops = {
  q: (id: string) => "SELECT * FROM users WHERE id=" + id,
};

export async function quickLookup(req: IncomingMessage) {
  const url = new URL(req.url ?? "", "http://localhost");
  const id = url.searchParams.get("id") ?? "";
  const sql = ops["q"](id);
  return db.execute(sql);
}
