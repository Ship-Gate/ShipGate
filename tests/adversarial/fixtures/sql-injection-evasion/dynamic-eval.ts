/**
 * ADVERSARIAL FIXTURE: SQL Injection via Dynamic eval()
 *
 * Vulnerability: SQL injection amplified by eval-based query execution
 * Evasion technique: The SQL query is partially constructed as a string
 * constant, then completed with user input, and the full expression is
 * passed through eval(). Scanners that don't flag eval() with
 * concatenated strings, or that only check for SQL patterns in direct
 * db.query() calls, will miss this.
 *
 * Exploit: GET /legacy/user?id=1'; DROP TABLE users; --
 */

interface LegacyDb {
  execSync(sql: string): unknown;
  query(sql: string): Promise<unknown[]>;
}

declare const legacyDb: LegacyDb;

export function legacyUserLookup(id: string) {
  const queryPrefix = "SELECT * FROM";
  const fullQuery = queryPrefix + " users WHERE id=" + id;

  // eslint-disable-next-line no-eval
  return eval(`legacyDb.execSync("${fullQuery}")`);
}

export function legacyReportQuery(table: string, conditions: string) {
  const base = `SELECT * FROM ${table}`;
  const where = conditions ? ` WHERE ${conditions}` : "";

  // eslint-disable-next-line no-eval
  const result = eval(`legacyDb.execSync(\`${base}${where}\`)`);
  return result;
}

const dynamicQueryRunner = new Function(
  "db",
  "table",
  "id",
  'return db.execSync("SELECT * FROM " + table + " WHERE id = " + id)',
);

export function runDynamicQuery(id: string) {
  return dynamicQueryRunner(legacyDb, "users", id);
}

export async function indirectEval(userId: string) {
  const queryStr = `"SELECT * FROM users WHERE id = ${userId}"`;
  const evalFn = eval;
  const sql = evalFn(queryStr) as string;
  return legacyDb.query(sql);
}
