/**
 * ADVERSARIAL FIXTURE: SQL Injection via Array Join
 *
 * Vulnerability: SQL injection through array-based string building
 * Evasion technique: Instead of direct string concatenation or template
 * literals, the query is built by pushing segments into an array and
 * joining them. Scanners looking for `+` concat or `${}` interpolation
 * adjacent to SQL keywords will miss this pattern entirely.
 *
 * Exploit: GET /api/users?id=1 UNION SELECT * FROM credentials--
 */

interface DatabaseAdapter {
  raw(sql: string): Promise<Record<string, unknown>[]>;
}

declare const database: DatabaseAdapter;

export async function getUserById(id: string) {
  const parts = ["SELECT * FROM users WHERE id=", id];
  const sql = parts.join("");
  return database.raw(sql);
}

export async function searchUsers(
  name: string,
  email: string,
  role: string,
) {
  const clauses: string[] = [];

  if (name) clauses.push("name LIKE '%" + name + "%'");
  if (email) clauses.push("email = '" + email + "'");
  if (role) clauses.push("role = '" + role + "'");

  const queryParts = [
    "SELECT id, name, email, role FROM users",
  ];

  if (clauses.length > 0) {
    queryParts.push(" WHERE ");
    queryParts.push(clauses.join(" AND "));
  }

  queryParts.push(" LIMIT 100");

  const sql = queryParts.join("");
  return database.raw(sql);
}

export async function buildReport(
  tableName: string,
  columns: string[],
  filterField: string,
  filterValue: string,
) {
  const sql = [
    "SELECT",
    columns.join(", "),
    "FROM",
    tableName,
    "WHERE",
    `${filterField} = '${filterValue}'`,
  ].join(" ");

  return database.raw(sql);
}
