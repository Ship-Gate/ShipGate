/**
 * ADVERSARIAL FIXTURE: SQL Injection via Indirect Concatenation
 *
 * Vulnerability: SQL injection through user-controlled input
 * Evasion technique: The concatenation happens inside a helper function,
 * so scanners that only check for inline string concat with SQL keywords
 * miss the indirection layer. The tainted data flows through a function
 * boundary before reaching the query string.
 *
 * Exploit: GET /users?id=1' OR '1'='1
 */

import type { IncomingMessage, ServerResponse } from "node:http";

interface QueryParams {
  [key: string]: string | undefined;
}

function parseQuery(url: string): QueryParams {
  const idx = url.indexOf("?");
  if (idx === -1) return {};
  const params: QueryParams = {};
  const pairs = url.slice(idx + 1).split("&");
  for (const pair of pairs) {
    const [k, v] = pair.split("=");
    params[decodeURIComponent(k)] = v ? decodeURIComponent(v) : "";
  }
  return params;
}

function buildQuery(table: string, field: string, value: string): string {
  return "SELECT * FROM " + table + " WHERE " + field + "='" + value + "'";
}

function buildCountQuery(table: string, field: string, value: string): string {
  return "SELECT COUNT(*) FROM " + table + " WHERE " + field + "='" + value + "'";
}

interface DbConnection {
  query(sql: string): Promise<unknown[]>;
}

declare const db: DbConnection;

export async function handleGetUser(req: IncomingMessage, res: ServerResponse) {
  const query = parseQuery(req.url ?? "");
  const userId = query.id;

  if (!userId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing id parameter" }));
    return;
  }

  const sql = buildQuery("users", "id", userId);
  const countSql = buildCountQuery("users", "id", userId);

  const [rows, countResult] = await Promise.all([
    db.query(sql),
    db.query(countSql),
  ]);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ users: rows, total: countResult }));
}
